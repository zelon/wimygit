import { runGitSimple } from "../../lib";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncCommit {
  id: string;
  date: string;
  message: string;
}

export interface SyncStatus {
  ahead: number;
  behind: number;
  aheadCommits: SyncCommit[];
  behindCommits: SyncCommit[];
  mergeBaseCommit: SyncCommit | null;
}

// ─── Data fetching ───────────────────────────────────────────────────────────

export async function getSyncStatus(cwd: string): Promise<SyncStatus | null> {
  try {
    // Check if there is a tracking upstream
    const upstream = await runGitSimple(
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      cwd
    ).catch(() => "");
    if (!upstream.trim()) return null;

    // Get ahead/behind counts
    const counts = await runGitSimple(
      ["rev-list", "--left-right", "--count", `${upstream.trim()}...HEAD`],
      cwd
    );
    const [behindStr, aheadStr] = counts.trim().split(/\s+/);
    const ahead = parseInt(aheadStr, 10) || 0;
    const behind = parseInt(behindStr, 10) || 0;

    if (ahead === 0 && behind === 0) return { ahead: 0, behind: 0, aheadCommits: [], behindCommits: [], mergeBaseCommit: null };

    const parseCommits = (raw: string): SyncCommit[] =>
      raw.trim().split("\n").filter(Boolean).map((line) => {
        const [id, date, ...rest] = line.split("|");
        return { id, date, message: rest.join("|") };
      });

    // Merge base commit (last synced point)
    let mergeBaseCommit: SyncCommit | null = null;
    try {
      const baseHash = await runGitSimple(
        ["merge-base", "HEAD", upstream.trim()],
        cwd
      );
      if (baseHash.trim()) {
        const baseInfo = await runGitSimple(
          ["log", "-1", `--format=%h|%ci|%s`, baseHash.trim()],
          cwd
        );
        const parsed = parseCommits(baseInfo);
        if (parsed.length > 0) mergeBaseCommit = parsed[0];
      }
    } catch { /* ignore */ }

    // Ahead commits (oldest first)
    let aheadCommits: SyncCommit[] = [];
    if (ahead > 0) {
      if (ahead <= 3) {
        const raw = await runGitSimple(
          ["log", "--reverse", `${upstream.trim()}..HEAD`, `--format=%h|%ci|%s`],
          cwd
        );
        aheadCommits = parseCommits(raw);
      } else {
        // oldest 1 + newest 1
        const newest = await runGitSimple(
          ["log", `${upstream.trim()}..HEAD`, `--format=%h|%ci|%s`, "-1"],
          cwd
        );
        const oldest = await runGitSimple(
          ["log", `${upstream.trim()}..HEAD`, `--format=%h|%ci|%s`, `--skip=${ahead - 1}`, "-1"],
          cwd
        );
        aheadCommits = [...parseCommits(oldest), ...parseCommits(newest)];
      }
    }

    // Behind commits (oldest first = chronological order)
    let behindCommits: SyncCommit[] = [];
    if (behind > 0) {
      if (behind <= 2) {
        // Show all (oldest first)
        const raw = await runGitSimple(
          ["log", "--reverse", `HEAD..${upstream.trim()}`, `--format=%h|%ci|%s`],
          cwd
        );
        behindCommits = parseCommits(raw);
      } else {
        // 3+: only newest 1 (shown after "...")
        const newest = await runGitSimple(
          ["log", `HEAD..${upstream.trim()}`, `--format=%h|%ci|%s`, "-1"],
          cwd
        );
        behindCommits = parseCommits(newest);
      }
    }

    return { ahead, behind, aheadCommits, behindCommits, mergeBaseCommit };
  } catch {
    return null;
  }
}

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
