// ============= AI provider settings (localStorage) =============

import { AI_SETTINGS_CHANGED_EVENT } from "../../constants";

export type AiProvider = "none" | "claude" | "codex" | "gemini";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  /** Model name typed in Settings; "" means the provider's `defaultModel`. */
  model: string;
}

export const AI_PROVIDERS: {
  id: AiProvider;
  label: string;
  /** Short name used in tooltips, e.g. "Review with AI (Claude)". */
  name: string;
  keyLabel: string;
  keyPlaceholder: string;
  defaultModel: string;
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
];

const PROVIDER_STORAGE = "wimygit_ai_provider";
// Pre-multi-provider builds stored a single Gemini key here.
const LEGACY_API_KEY_STORAGE = "wimygit_ai_api_key";

const apiKeyStorage = (provider: AiProvider) => `wimygit_ai_api_key_${provider}`;
const modelStorage = (provider: AiProvider) => `wimygit_ai_model_${provider}`;

function isProvider(v: string | null): v is AiProvider {
  return AI_PROVIDERS.some((p) => p.id === v);
}

export function aiProviderName(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.name ?? "";
}

export function aiDefaultModel(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "";
}

/** The model a request actually uses: the one typed in Settings, else the default. */
export function aiEffectiveModel(config: AiConfig): string {
  return config.model || aiDefaultModel(config.provider);
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
  };
}

export function saveAiConfig(config: AiConfig) {
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();
  localStorage.setItem(PROVIDER_STORAGE, config.provider);
  if (config.provider !== "none") {
    localStorage.setItem(apiKeyStorage(config.provider), apiKey);
    if (model) localStorage.setItem(modelStorage(config.provider), model);
    else localStorage.removeItem(modelStorage(config.provider));
  }
  // Same-tab localStorage writes don't fire the native "storage" event, so
  // notify already-mounted components (e.g. PendingTab) directly.
  window.dispatchEvent(
    new CustomEvent<AiConfig>(AI_SETTINGS_CHANGED_EVENT, {
      detail: { provider: config.provider, apiKey, model },
    }),
  );
}
