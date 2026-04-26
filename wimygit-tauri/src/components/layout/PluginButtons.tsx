import { useState } from "react";
import { runPlugin, type PluginInfo } from "../../lib";

interface OutputModalProps {
  title: string;
  output: string;
  onClose: () => void;
}

function OutputModal({ title, output, onClose }: OutputModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-sm">{title}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-lg leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            {output || "(no output)"}
          </pre>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Default puzzle-piece icon for plugins without a custom icon
function IconPlugin({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" /><path d="M10 6h4" />
      <path d="M18 8h2a1 1 0 0 1 1 1v3a3 3 0 0 1-6 0V8" />
      <path d="M6 8H4a1 1 0 0 0-1 1v3a3 3 0 0 0 6 0V8" />
      <path d="M6 18H4a1 1 0 0 1-1-1v-3a3 3 0 0 1 6 0v4" />
      <path d="M18 18h2a1 1 0 0 0 1-1v-3a3 3 0 0 0-6 0v4" />
      <path d="M10 18h4v4h-4z" />
    </svg>
  );
}

const BASE_BTN =
  "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[56px] text-[11px] rounded transition-colors shrink-0 border disabled:opacity-40";
const IDLE_BTN =
  "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600";
const BUSY_BTN =
  "bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 cursor-wait";

interface PluginButtonsProps {
  plugins: PluginInfo[];
  repoPath: string;
  onRefresh: () => void;
}

export function PluginButtons({ plugins, repoPath, onRefresh }: PluginButtonsProps) {
  const [runningPlugin, setRunningPlugin] = useState<string | null>(null);
  const [output, setOutput] = useState<{ title: string; text: string } | null>(null);

  const handleRun = async (plugin: PluginInfo) => {
    if (!repoPath) return;
    setRunningPlugin(plugin.name);
    try {
      const result = await runPlugin(
        plugin.command,
        plugin.arguments,
        plugin.execution_type,
        repoPath
      );
      if (plugin.execution_type === "WimyGitInnerShellAndRefreshRepositoryStatus") {
        setOutput({ title: plugin.title, text: result });
        onRefresh();
      }
    } catch (e) {
      alert(`Plugin "${plugin.title}" failed:\n${String(e)}`);
    } finally {
      setRunningPlugin(null);
    }
  };

  if (plugins.length === 0) return null;

  const isBusy = runningPlugin !== null;

  return (
    <>
      {plugins.filter((p) => !p.load_error).map((p) => (
        <button
          key={p.name}
          onClick={() => handleRun(p)}
          disabled={isBusy || !repoPath}
          title={p.description || p.title}
          className={`${BASE_BTN} ${runningPlugin === p.name ? BUSY_BTN : IDLE_BTN}`}
        >
          {p.icon_data_url ? (
            <img src={p.icon_data_url} alt={p.title} className="w-6 h-6 object-contain" />
          ) : (
            <IconPlugin />
          )}
          <span>{runningPlugin === p.name ? `${p.title}...` : p.title}</span>
        </button>
      ))}

      {output && (
        <OutputModal
          title={`${output.title} — output`}
          output={output.text}
          onClose={() => setOutput(null)}
        />
      )}
    </>
  );
}
