export const APP_NAME = "WimyGit";

// Dispatched on `window` (detail: the saved AiConfig) whenever the AI provider or
// API key is saved, so already-mounted components (e.g. PendingTab) can refresh
// their cached copy instead of relying on a stale value read at mount time.
export const AI_SETTINGS_CHANGED_EVENT = "wimygit:ai-settings-changed";

// Dispatched on `window` (detail: the message text) when the user picks an AI
// commit-message candidate in the sidebar; PendingTab owns the commit message
// box and asks how to merge it with any existing text.
export const AI_USE_COMMIT_MESSAGE_EVENT = "wimygit:ai-use-commit-message";
