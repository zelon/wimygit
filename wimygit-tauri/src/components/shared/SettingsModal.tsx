import { useRef, useState } from "react";
import { AI_API_KEY_CHANGED_EVENT, AI_API_KEY_STORAGE } from "../../constants";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(AI_API_KEY_STORAGE) ?? "",
  );
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    localStorage.setItem(AI_API_KEY_STORAGE, trimmed);
    // Same-tab localStorage writes don't fire the native "storage" event, so
    // notify already-mounted components (e.g. PendingTab) directly.
    window.dispatchEvent(new CustomEvent(AI_API_KEY_CHANGED_EVENT, { detail: trimmed }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              AI
            </h3>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Google Gemini API Key
            </label>
            <input
              ref={inputRef}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="AIza..."
              autoFocus
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Used to generate AI commit messages from the Pending Changes tab.
            </p>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          {saved && (
            <span className="text-xs text-green-600 dark:text-green-400 mr-auto">
              Saved
            </span>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
