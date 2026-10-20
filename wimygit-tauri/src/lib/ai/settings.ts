// ============= AI provider settings (localStorage) =============

import { AI_SETTINGS_CHANGED_EVENT } from "../../constants";

export type AiProvider = "none" | "claude" | "codex" | "gemini" | "ollama";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  /** Model name typed in Settings; "" means the provider's `defaultModel`. */
  model: string;
  /** Server URL typed in Settings; "" means the provider's `defaultBaseUrl`. */
  baseUrl: string;
}

export const AI_PROVIDERS: {
  id: AiProvider;
  label: string;
  /** Short name used in tooltips, e.g. "Review with AI (Claude)". */
  name: string;
  /** Empty for providers that need no API key (e.g. a local Ollama server). */
  keyLabel: string;
  keyPlaceholder: string;
  defaultModel: string;
  /** Set for providers whose server URL is configurable. */
  defaultBaseUrl?: string;
  /** Max diff chars sent to this provider, below the app-wide limits. */
  diffLimit?: number;
}[] = [
  {
    id: "none",
    label: "Disabled",
    name: "",
    keyLabel: "",
    keyPlaceholder: "",
    defaultModel: "",
  },
  {
    id: "claude",
    label: "Claude Code API",
    name: "Claude",
    keyLabel: "Anthropic API Key",
    keyPlaceholder: "sk-ant-...",
    defaultModel: "claude-haiku-5-5",
  },
  {
    id: "codex",
    label: "Codex API",
    name: "Codex",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-...",
    defaultModel: "gpt-5-codex",
  },
  {
    id: "gemini",
    label: "Gemini API",
    name: "Gemini",
    keyLabel: "Google Gemini API Key",
    keyPlaceholder: "AIza...",
    defaultModel: "gemini-flash-latest",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    name: "Ollama",
    keyLabel: "",
    keyPlaceholder: "",
    defaultModel: "gemma4:latest",
    defaultBaseUrl: "http://localhost:11434",
    // Local models have small context windows and are slow on long input.
    diffLimit: 20_000,
  },
];

const PROVIDER_STORAGE = "wimygit_ai_provider";
// Pre-multi-provider builds stored a single Gemini key here.
const LEGACY_API_KEY_STORAGE = "wimygit_ai_api_key";

const apiKeyStorage = (provider: AiProvider) => `wimygit_ai_api_key_${provider}`;
const modelStorage = (provider: AiProvider) => `wimygit_ai_model_${provider}`;
const baseUrlStorage = (provider: AiProvider) => `wimygit_ai_base_url_${provider}`;

function isProvider(v: string | null): v is AiProvider {
  return AI_PROVIDERS.some((p) => p.id === v);
}

export function aiProviderName(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.name ?? "";
}

export function aiDefaultModel(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "";
}

export function aiDefaultBaseUrl(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.defaultBaseUrl ?? "";
}

/** True when `provider` authenticates with an API key. */
export function aiRequiresApiKey(provider: AiProvider): boolean {
  return !!AI_PROVIDERS.find((p) => p.id === provider)?.keyLabel;
}

/** True when requests can be sent: a provider is chosen and has a key if it needs one. */
export function aiIsConfigured(config: AiConfig): boolean {
  if (config.provider === "none") return false;
  return !aiRequiresApiKey(config.provider) || !!config.apiKey;
}

/** `limit` lowered to the provider's own diff limit, if it has one. */
export function aiDiffLimit(provider: AiProvider, limit: number): number {
  const own = AI_PROVIDERS.find((p) => p.id === provider)?.diffLimit;
  return own ? Math.min(own, limit) : limit;
}

/** The model a request actually uses: the one typed in Settings, else the default. */
export function aiEffectiveModel(config: AiConfig): string {
  return config.model || aiDefaultModel(config.provider);
}

/** The server URL a request actually uses: the one typed in Settings, else the default. */
export function aiEffectiveBaseUrl(config: AiConfig): string {
  return config.baseUrl || aiDefaultBaseUrl(config.provider);
}

/** Stored key for `provider` (keys are kept per provider so switching back keeps them). */
export function loadAiApiKey(provider: AiProvider): string {
  if (provider === "none") return "";
  return localStorage.getItem(apiKeyStorage(provider)) ?? "";
}

/** Model name typed for `provider`, or "" to use its default (kept per provider). */
export function loadAiModel(provider: AiProvider): string {
  if (provider === "none") return "";
  return localStorage.getItem(modelStorage(provider)) ?? "";
}

/** Server URL typed for `provider`, or "" to use its default (kept per provider). */
export function loadAiBaseUrl(provider: AiProvider): string {
  if (provider === "none") return "";
  return localStorage.getItem(baseUrlStorage(provider)) ?? "";
}

export function loadAiConfig(): AiConfig {
  let stored = localStorage.getItem(PROVIDER_STORAGE);
  if (!isProvider(stored)) {
    const legacyKey = localStorage.getItem(LEGACY_API_KEY_STORAGE)?.trim();
    if (legacyKey) {
      localStorage.setItem(apiKeyStorage("gemini"), legacyKey);
      localStorage.setItem(PROVIDER_STORAGE, "gemini");
      localStorage.removeItem(LEGACY_API_KEY_STORAGE);
      stored = "gemini";
    } else {
      stored = "none";
    }
  }
  const provider = stored as AiProvider;
  return {
    provider,
    apiKey: loadAiApiKey(provider),
    model: loadAiModel(provider),
    baseUrl: loadAiBaseUrl(provider),
  };
}

// ============= Editable prompt instructions =============

export type AiPromptKind = "review" | "commit";

// Only the guidance part of each prompt is editable; the role, the rule to
// treat the diff as data and the JSON response format are always added by the app.
export const DEFAULT_AI_REVIEW_INSTRUCTIONS = `Focus on bugs, security problems, data loss, broken edge cases and obvious mistakes.
Do not comment on minor style or formatting. Do not praise. If there is nothing worth reporting, return an empty issues array.
Write in English.`;

export const DEFAULT_AI_COMMIT_INSTRUCTIONS = `Write 3 alternative commit messages for the diff:
1. A concise one-line subject (under 72 chars).
2. A one-line subject with a bit more detail, under 72 chars.
3. A subject line (under 72 chars), a blank line, then a short body of 1-4 lines (or "- " bullets) explaining what changed and why.
Write in the language most of the recent commits use, and follow their conventions (prefixes such as "fix(ui): ", issue references, capitalization, punctuation).
If there are no recent commits, write in English and use Conventional Commits style (e.g. "fix(ui): ...").
Use the imperative mood (or its natural equivalent in that language). Do not wrap messages in quotes or code fences.`;

const promptStorage = (kind: AiPromptKind) => `wimygit_ai_prompt_${kind}`;

export function aiDefaultPrompt(kind: AiPromptKind): string {
  return kind === "review"
    ? DEFAULT_AI_REVIEW_INSTRUCTIONS
    : DEFAULT_AI_COMMIT_INSTRUCTIONS;
}

/** Instructions typed in Settings for `kind`, else the app default. */
export function loadAiPrompt(kind: AiPromptKind): string {
  return localStorage.getItem(promptStorage(kind))?.trim() || aiDefaultPrompt(kind);
}

// An empty or default value is not stored, so a changed default in a later
// app version takes effect.
export function saveAiPrompt(kind: AiPromptKind, text: string) {
  const value = text.trim();
  if (!value || value === aiDefaultPrompt(kind)) {
    localStorage.removeItem(promptStorage(kind));
  } else {
    localStorage.setItem(promptStorage(kind), value);
  }
}

export function saveAiConfig(config: AiConfig) {
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
  localStorage.setItem(PROVIDER_STORAGE, config.provider);
  if (config.provider !== "none") {
    localStorage.setItem(apiKeyStorage(config.provider), apiKey);
    if (model) localStorage.setItem(modelStorage(config.provider), model);
    else localStorage.removeItem(modelStorage(config.provider));
    if (baseUrl) localStorage.setItem(baseUrlStorage(config.provider), baseUrl);
    else localStorage.removeItem(baseUrlStorage(config.provider));
  }
  // Same-tab localStorage writes don't fire the native "storage" event, so
  // notify already-mounted components (e.g. PendingTab) directly.
  window.dispatchEvent(
    new CustomEvent<AiConfig>(AI_SETTINGS_CHANGED_EVENT, {
      detail: { provider: config.provider, apiKey, model, baseUrl },
    }),
  );
}
