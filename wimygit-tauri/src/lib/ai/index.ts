// ============= AI helpers (provider-independent) =============

import { callClaude } from "./claude";
import { callCodex } from "./codex";
import { callGemini } from "./gemini";
import { aiEffectiveModel, type AiConfig } from "./settings";
import type { AiReply } from "./types";

export * from "./settings";

const COMMIT_DIFF_LIMIT = 30_000;
export const REVIEW_DIFF_LIMIT = 100_000;
const REVIEW_FILE_LIST_LIMIT = 500;

export type AiReviewKind = "staged" | "unstaged";
export type AiReviewSeverity = "error" | "warning" | "info";

export interface AiReviewIssue {
  file: string;
  line?: number;
  severity: AiReviewSeverity;
  message: string;
}

export interface AiReviewResult {
  summary: string;
  issues: AiReviewIssue[];
  truncated: boolean;
}

// Each AI request opens its own sidebar tab; these are the tab states.
interface AiTabBase {
  id: string;
  status: "loading" | "done" | "error";
  fileCount: number;
  at: number;
  /** Display name of the AI provider that handled the request, e.g. "Claude". */
  providerName: string;
  /** Model the request was sent to, e.g. "gemini-flash-latest". */
  modelName: string;
  /** Model the response reports, e.g. "gemini-flash-5.3"; set once done. */
  respondedModel?: string;
  error?: string;
  /** Cancels the in-flight request; present while status is "loading". */
  abort?: () => void;
}

export interface AiReviewState extends AiTabBase {
  type: "review";
  kind: AiReviewKind;
  /** Untracked files included in an unstaged review (needed to preview them). */
  untrackedFiles: string[];
  result?: AiReviewResult;
}

export interface AiCommitState extends AiTabBase {
  type: "commit";
  candidates?: string[];
}

export type AiTabState = AiReviewState | AiCommitState;

// "requested" or, when the response reports a different model (e.g. an alias
// like gemini-flash-latest resolving to a concrete version), "requested -> actual".
export function aiModelLabel(tab: AiTabBase): string {
  const { modelName, respondedModel } = tab;
  return respondedModel && respondedModel !== modelName
    ? `${modelName} -> ${respondedModel}`
    : modelName;
}

// Sends `prompt` to the configured provider and returns its text reply, which
// the prompts below ask to be a single JSON object.
async function callAi(
  config: AiConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<AiReply> {
  const model = aiEffectiveModel(config);
  switch (config.provider) {
    case "claude":
      return callClaude(prompt, config.apiKey, model, signal);
    case "codex":
      return callCodex(prompt, config.apiKey, model, signal);
    case "gemini":
      return callGemini(prompt, config.apiKey, model, signal);
    default:
      throw new Error("AI is disabled in Settings");
  }
}

// Providers without a JSON response mode may wrap the object in a code fence
// or add a sentence around it; keep only the outermost {...}.
function extractJson(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = (fenced ? fenced[1] : text).trim();
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  return first >= 0 && last > first ? body.slice(first, last + 1) : body;
}

export async function generateAiCommitCandidates(
  stagedDiff: string,
  config: AiConfig,
  signal?: AbortSignal,
): Promise<{ candidates: string[]; respondedModel?: string }> {
  const prompt = `Write 3 alternative git commit messages for the following staged diff.
1. A concise one-line subject (under 72 chars).
2. A one-line subject in Conventional Commits style (e.g. "fix(ui): ..."), under 72 chars.
3. A subject line (under 72 chars), a blank line, then a short body of 1-4 lines (or "- " bullets) explaining what changed and why.
Use the imperative mood. Do not wrap messages in quotes or code fences.

Respond with JSON only: {"candidates": ["<message 1>", "<message 2>", "<message 3>"]}

${stagedDiff.slice(0, COMMIT_DIFF_LIMIT)}`;

  const { text, model } = await callAi(config, prompt, signal);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error(`Could not parse AI response: ${text.slice(0, 200)}`);
  }
  const list = (parsed as { candidates?: unknown } | null)?.candidates;
  const candidates = Array.isArray(list)
    ? list.map((c) => String(c ?? "").trim()).filter(Boolean)
    : [];
  if (candidates.length === 0) {
    throw new Error("AI returned no commit message candidates");
  }
  return { candidates: [...new Set(candidates)], respondedModel: model };
}

const SEVERITIES: AiReviewSeverity[] = ["error", "warning", "info"];

// The model may echo paths the way the diff header shows them ("b/src/x.ts",
// quoted, with backslashes). Map them back to a repo-relative path from
// `known` so the UI can open the file's diff.
function normalizeReviewPath(raw: string, known: Set<string>): string {
  const p = raw.trim().replace(/^"(.*)"$/, "$1").replace(/\\/g, "/");
  if (!p || known.has(p)) return p;
  const stripped = p.replace(/^[ab]\//, "");
  if (known.has(stripped)) return stripped;
  const bySuffix = [...known].filter((f) => f.endsWith("/" + stripped));
  return bySuffix.length === 1 ? bySuffix[0] : stripped;
}

export async function generateAiReview(
  diff: string,
  kind: AiReviewKind,
  files: string[],
  config: AiConfig,
  signal?: AbortSignal,
): Promise<{ result: AiReviewResult; respondedModel?: string }> {
  const truncated = diff.length > REVIEW_DIFF_LIMIT;
  const known = new Set(files);
  const fileList = files
    .slice(0, REVIEW_FILE_LIST_LIMIT)
    .map((f) => `- ${f}`)
    .join("\n");
  const prompt = `You are reviewing ${kind} changes in a git repository before they are committed.
Review the unified diff below. Focus on bugs, security problems, data loss, broken edge cases and obvious mistakes.
Do not comment on minor style or formatting. Do not praise. If there is nothing worth reporting, return an empty issues array.
Write in English.

Respond with JSON only, matching this shape:
{"summary": "<1-2 sentence summary of what the change does>",
 "issues": [{"file": "<one path from the file list below, copied exactly>", "line": <line number in the new file, or omit>, "severity": "error" | "warning" | "info", "message": "<concise explanation>"}]}
Use "" for "file" only when an issue is not about a specific file.
${truncated ? "\nNote: the diff was truncated; do not report problems caused only by the cut-off.\n" : ""}
Files under review (repo-relative, without the a/ or b/ diff prefixes):
${fileList}

${diff.slice(0, REVIEW_DIFF_LIMIT)}`;

  const { text, model } = await callAi(config, prompt, signal);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error(`Could not parse AI review response: ${text.slice(0, 200)}`);
  }
  const obj = (parsed ?? {}) as { summary?: unknown; issues?: unknown };
  const issues: AiReviewIssue[] = Array.isArray(obj.issues)
    ? obj.issues
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => ({
          file: normalizeReviewPath(String(i.file ?? ""), known),
          line: typeof i.line === "number" && i.line > 0 ? i.line : undefined,
          severity: SEVERITIES.includes(i.severity as AiReviewSeverity)
            ? (i.severity as AiReviewSeverity)
            : "info",
          message: String(i.message ?? ""),
        }))
        .filter((i) => i.message)
    : [];
  return {
    result: {
      summary: typeof obj.summary === "string" ? obj.summary : "",
      issues,
      truncated,
    },
    respondedModel: model,
  };
}
