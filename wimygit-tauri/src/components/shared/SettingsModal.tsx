import { useState } from "react";
import {
  AI_PROVIDERS,
  loadAiApiKey,
  loadAiConfig,
  loadAiModel,
  saveAiConfig,
  type AiProvider,
} from "../../lib";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [initial] = useState(loadAiConfig);
  const [provider, setProvider] = useState<AiProvider>(initial.provider);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [saved, setSaved] = useState(false);
  const providerInfo = AI_PROVIDERS.find((p) => p.id === provider);

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    setApiKey(loadAiApiKey(next));
    setModel(loadAiModel(next));
  };

  const handleSave = () => {
    saveAiConfig({ provider, apiKey, model });
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
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
              autoFocus={provider === "none"}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {provider !== "none" && providerInfo && (
              <>
                <label className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {providerInfo.keyLabel}
                </label>
                <input
                  key={provider}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={providerInfo.keyPlaceholder}
                  autoFocus
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                  Model
                </label>
                <input
                  key={`${provider}-model`}
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={providerInfo.defaultModel}
                  spellCheck={false}
                  className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Leave empty to use the default ({providerInfo.defaultModel}).
                </p>
              </>
            )}
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Used for AI commit messages and AI reviews in the Pending Changes tab.
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
