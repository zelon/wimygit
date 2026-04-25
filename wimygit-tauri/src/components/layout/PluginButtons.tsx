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

  return (
    <>
      {plugins.filter((p) => !p.load_error).map((p) => (
        <button
          key={p.name}
          onClick={() => handleRun(p)}
          disabled={!!runningPlugin || !repoPath}
          title={p.description || p.title}
          className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded disabled:opacity-50"
        >
          {runningPlugin === p.name ? "..." : p.title}
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
