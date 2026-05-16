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

  const totalSecs = settings.intervalMinutes * 60;
  const progressFraction = settings.enabled && !isFetching
    ? Math.max(0, Math.min(1, 1 - nextFetchIn / totalSecs))
    : 0;

  const CIRCLE_R = 5;
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

  const tooltip = settings.enabled
    ? isFetching
      ? "Auto-fetch in progress…"
      : `Auto-fetch every ${settings.intervalMinutes}m — click to configure`
    : "Auto-fetch disabled — click to configure";

  return (
    <div ref={wrapRef} className="relative flex shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        className="relative flex items-center px-1 border rounded-l-none rounded-r transition-colors bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
      >
        {/* Circular arc progress indicator — positioned at top where ↺ icon was */}
        {settings.enabled && (
          <div
            className="absolute top-1 left-1/2 -translate-x-1/2 z-10"
            style={{ width: "13px", height: "13px" }}
          >
            {/* SVG arc: 12시 방향에서 반시계 방향으로 그려지는 선 */}
            <svg width="13" height="13" viewBox="0 0 13 13" className="absolute inset-0">
              {/* Track — faint gray full circle */}
              <circle
                cx="6.5" cy="6.5" r={CIRCLE_R}
                fill="none"
                strokeWidth="1.5"
                className="stroke-gray-200 dark:stroke-gray-600"
              />
              {isFetching ? (
                /* Fetching: 75% 호가 빙글빙글 도는 indeterminate 스피너 */
                <circle
                  cx="6.5" cy="6.5" r={CIRCLE_R}
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-sky-400 dark:stroke-sky-400 animate-spin"
                  style={{
                    strokeDasharray: `${CIRCLE_CIRCUMFERENCE * 0.75} ${CIRCLE_CIRCUMFERENCE * 0.25}`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                />
              ) : (
                /* Countdown: 12시에서 반시계 방향으로 그려짐 */
                <circle
                  cx="6.5" cy="6.5" r={CIRCLE_R}
                  fill="none"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stroke-sky-400 dark:stroke-sky-400"
                  style={{
                    strokeDasharray: CIRCLE_CIRCUMFERENCE,
                    strokeDashoffset: CIRCLE_CIRCUMFERENCE * (1 - progressFraction),
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transform: "scaleX(-1) rotate(-90deg)",
                    transition: "stroke-dashoffset 1s linear",
                  }}
                />
              )}
            </svg>
            {/* ↺ icon centered over the circle */}
            <span className="absolute inset-0 flex items-center justify-center text-[7px] text-gray-500 dark:text-gray-400">
              ↺
            </span>
          </div>
        )}

        {/* ▾ — vertically centered, always visible, signals this is a clickable dropdown */}
        <span className="relative z-10">▾</span>
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
          {settings.enabled && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {isFetching
                ? "Fetching…"
                : `Next fetch in: ${formatCountdown(nextFetchIn)}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
