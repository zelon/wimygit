export const APP_NAME = "WimyGit";

// localStorage key for the Google Gemini API key (shared by PendingTab's
// inline AI commit-message prompt and the Settings modal).
export const AI_API_KEY_STORAGE = "wimygit_ai_api_key";

// Dispatched on `window` whenever the Gemini API key is saved, so already-mounted
// components (e.g. PendingTab) can refresh their cached copy instead of relying on
// a stale value read at mount time.
export const AI_API_KEY_CHANGED_EVENT = "wimygit:ai-api-key-changed";

// Dispatched on `window` (detail: the message text) when the user picks an AI
// commit-message candidate in the sidebar; PendingTab owns the commit message
// box and asks how to merge it with any existing text.
export const AI_USE_COMMIT_MESSAGE_EVENT = "wimygit:ai-use-commit-message";
