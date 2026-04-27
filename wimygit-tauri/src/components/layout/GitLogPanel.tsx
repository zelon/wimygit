import { useState, useEffect, useRef } from "react";
import { subscribeLog, clearLog, type GitLogEntry } from "../../lib/git-log";

export function GitLogPanel() {
  const [entries, setEntries] = useState<GitLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeLog(setEntries), []);

  // Auto-scroll to bottom when new entry arrives and panel is expanded
  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries, expanded]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const latestEntry = entries[entries.length - 1] ?? null;

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-1 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {expanded ? "▾" : "▸"} Git Log
        </span>
        {!expanded && latestEntry && (
          <span className={`text-xs font-mono truncate flex-1 ${latestEntry.exitCode !== 0 ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}>
            $ git {latestEntry.command.replace(/^git /, "")}
          </span>
        )}
        {entries.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); clearLog(); setSelectedId(null); }}
            className="ml-auto text-xs text-gray-400 hover:text-red-500"
            title="Clear log"
          >
            Clear
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="flex h-40 border-t border-gray-200 dark:border-gray-700">
          {/* Left: command list */}
          <div
            ref={listRef}
            className="w-1/2 overflow-y-auto border-r border-gray-200 dark:border-gray-700"
          >
            {entries.length === 0 ? (
              <div className="p-2 text-xs text-gray-400 italic">No commands yet</div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={`flex items-center gap-2 px-2 py-0.5 cursor-pointer text-xs font-mono hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    selectedId === entry.id ? "bg-blue-50 dark:bg-blue-900/30" : ""
                  }`}
                >
                  <span className="shrink-0 text-gray-400">
                    [{entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
                  </span>
                  <span className={`shrink-0 ${entry.exitCode !== 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                    {entry.exitCode !== 0 ? "✕" : "✓"}
                  </span>
                  <span className="truncate text-gray-700 dark:text-gray-300">
                    {entry.command}
                  </span>
                  <span className="ml-auto shrink-0 text-gray-400">
                    ({entry.durationMs < 1000 ? `${entry.durationMs}ms` : `${(entry.durationMs / 1000).toFixed(1)}s`})
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Right: output detail */}
          <div className="w-1/2 overflow-auto p-2">
            {selected ? (
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {[selected.stdout, selected.stderr].filter(Boolean).join("\n") || "(no output)"}
              </pre>
            ) : (
              <div className="text-xs text-gray-400 italic">Select a command to view output</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
