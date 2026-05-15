import { useState, useRef, useEffect } from "react";
import { AUTO_FETCH_INTERVALS, type AutoFetchSettings } from "../../hooks/useAutoFetch";

interface AutoFetchIndicatorProps {
  settings: AutoFetchSettings;
  nextFetchIn: number;
  isFetching: boolean;
  lastFetchedAt: Date | null;
  onChange: (settings: AutoFetchSettings) => void;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AutoFetchIndicator({
  settings,
  nextFetchIn,
  isFetching,
  lastFetchedAt,
  onChange,
}: AutoFetchIndicatorProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const label = settings.enabled
    ? isFetching
      ? "Fetching…"
      : formatCountdown(nextFetchIn)
    : "Auto";

  const tooltip = settings.enabled
    ? `Auto-fetch every ${settings.intervalMinutes}m — click to configure`
    : "Auto-fetch disabled — click to enable";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        className={`flex items-center gap-1 px-2 py-1 h-full text-[10px] rounded border transition-colors ${
          settings.enabled
            ? "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"
        }`}
      >
        <span
          className={isFetching ? "inline-block animate-spin" : ""}
          style={{ display: "inline-block" }}
        >
          ↺
        </span>
        <span className="tabular-nums">{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-0.5 z-50 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Auto Fetch
          </div>

          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">Enable auto-fetch</span>
          </label>

          <div className="text-[10px] text-gray-500 dark:text-gray-500 mb-1.5">Interval</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {AUTO_FETCH_INTERVALS.map((m) => (
              <button
                key={m}
                onClick={() => onChange({ ...settings, intervalMinutes: m })}
                disabled={!settings.enabled}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors disabled:opacity-40 ${
                  settings.intervalMinutes === m
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>

          {lastFetchedAt && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500">
              Last fetched: {lastFetchedAt.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
