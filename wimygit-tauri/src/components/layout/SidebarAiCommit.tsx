import { aiModelLabel, type AiCommitState } from "../../lib";

interface SidebarAiCommitProps {
  commit: AiCommitState;
  onUse?: (message: string) => void;
}

export function SidebarAiCommit({ commit, onUse }: SidebarAiCommitProps) {
  const { status, candidates, error, fileCount, at, providerName } = commit;
  const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="shrink-0 px-3 py-1.5 text-xs border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-1.5">
        <span className="text-purple-600 dark:text-purple-400">✦</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">Commit message for staged changes</span>
        <span className="text-gray-400">· by {providerName} - {aiModelLabel(commit)} · {fileCount} file{fileCount === 1 ? "" : "s"} · {time}</span>
      </div>

      <div className="flex-1 overflow-y-auto text-xs">
        {status === "loading" && (
          <div className="px-3 py-3 text-gray-500 dark:text-gray-400 animate-pulse">
            Generating commit messages…
          </div>
        )}

        {status === "error" && (
          <div className="px-3 py-3 text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {error}
          </div>
        )}

        {status === "done" && candidates && (
          <div className="p-2 flex flex-col gap-2">
            {candidates.map((message, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Option {idx + 1}
                  </div>
                  <pre className="font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {message}
                  </pre>
                </div>
                <button
                  onClick={() => onUse?.(message)}
                  className="shrink-0 px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Use as commit message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
