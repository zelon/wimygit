import type { SyncCommit, SyncStatus } from "../../lib";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSyncDate(dateStr: string): string {
  // "2026-04-29 14:30:00 +0900" → "04-29 14:30"
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return dateStr;
  return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

function CommitRow({ c, label, labelClass }: { c: SyncCommit; label?: string; labelClass?: string }) {
  return (
    <div className="flex items-center min-w-0">
      {label !== undefined ? (
        <span className={`shrink-0 w-[64px] pr-1.5 font-medium text-right ${labelClass ?? ""}`}>{label}</span>
      ) : (
        <span className="shrink-0 w-[64px] pr-1.5" />
      )}
      <span className="shrink-0 w-px self-stretch bg-gray-300 dark:bg-gray-600 mr-1.5" />
      <span className="shrink-0 w-[56px] pr-1.5 text-blue-600 dark:text-blue-400">{c.id}</span>
      <span className="shrink-0 w-[76px] pr-1.5 text-gray-400 dark:text-gray-500">{formatSyncDate(c.date)}</span>
      <span className="min-w-0 truncate">{c.message}</span>
    </div>
  );
}

function EllipsisRow({ hasLabel }: { hasLabel?: boolean }) {
  return (
    <div className="flex items-center">
      {hasLabel && <span className="shrink-0 w-[64px] pr-1.5" />}
      <span className="text-gray-400 dark:text-gray-500">...</span>
    </div>
  );
}

const commitBoxClass =
  "font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 px-2 py-1 divide-y divide-gray-100 dark:divide-gray-800";

export function SyncStatusBar({ syncStatus }: { syncStatus: SyncStatus }) {
  if (syncStatus.ahead === 0 && syncStatus.behind === 0) return null;

  return (
    <div className="shrink-0 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-xs">
      {/* Behind section: last sync + behind commits (above the summary line) */}
      {syncStatus.behind > 0 && syncStatus.mergeBaseCommit && (
        <div className={`mb-1 ${commitBoxClass}`}>
          <CommitRow c={syncStatus.mergeBaseCommit} label="= synced" labelClass="text-green-600 dark:text-green-400" />
          {syncStatus.behind >= 3 && <EllipsisRow hasLabel />}
          {syncStatus.behindCommits.map((c) => (
            <CommitRow key={c.id} c={c} label="remote" labelClass="text-orange-600 dark:text-orange-400" />
          ))}
        </div>
      )}

      {/* Summary line */}
      <div className="flex items-center gap-3 font-medium text-gray-600 dark:text-gray-300">
        {syncStatus.ahead > 0 && (
          <span className="text-green-600 dark:text-green-400">↑ {syncStatus.ahead} ahead</span>
        )}
        {syncStatus.behind > 0 && (
          <span className="text-orange-600 dark:text-orange-400">↓ {syncStatus.behind} behind</span>
        )}
      </div>

      {/* Ahead commits (below the summary line) */}
      {syncStatus.ahead > 0 && syncStatus.aheadCommits.length > 0 && (
        <div className={`mt-1 ${commitBoxClass}`}>
          {syncStatus.ahead <= 3 ? (
            syncStatus.aheadCommits.map((c) => (
              <CommitRow key={c.id} c={c} label="local" labelClass="text-green-600 dark:text-green-400" />
            ))
          ) : (
            <>
              <CommitRow c={syncStatus.aheadCommits[0]} label="local" labelClass="text-green-600 dark:text-green-400" />
              <EllipsisRow hasLabel />
              <CommitRow c={syncStatus.aheadCommits[1]} label="local" labelClass="text-green-600 dark:text-green-400" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
