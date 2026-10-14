// ============= Gemini AI helpers =============

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

const COMMIT_DIFF_LIMIT = 8000;
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

export interface AiReviewState {
  id: string;
  kind: AiReviewKind;
  status: "loading" | "done" | "error";
  fileCount: number;
  /** Untracked files included in an unstaged review (needed to preview them). */
  untrackedFiles: string[];
  at: number;
  result?: AiReviewResult;
  error?: string;
  /** Cancels the in-flight request; present while status is "loading". */
  abort?: () => void;
}

async function callGemini(
  prompt: string,
  apiKey: string,
  generationConfig?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(generationConfig ? { generationConfig } : {}),
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${response.status} ${err}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

export async function generateAiCommitMessage(
  stagedDiff: string,
  apiKey: string,
): Promise<string> {
  return callGemini(
    `Write a concise git commit message (one line, under 72 chars) for the following staged diff. Output only the commit message text, nothing else.\n\n${stagedDiff.slice(0, COMMIT_DIFF_LIMIT)}`,
    apiKey,
  );
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
  apiKey: string,
  signal?: AbortSignal,
): Promise<AiReviewResult> {
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

  const text = await callGemini(
    prompt,
    apiKey,
    { responseMimeType: "application/json" },
    signal,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
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
    summary: typeof obj.summary === "string" ? obj.summary : "",
    issues,
    truncated,
  };
}
