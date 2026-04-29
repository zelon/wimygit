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

    if (ahead === 0 && behind === 0) return { ahead: 0, behind: 0, aheadCommits: [], behindCommits: [] };

    const parseCommits = (raw: string): SyncCommit[] =>
      raw.trim().split("\n").filter(Boolean).map((line) => {
        const [id, date, ...rest] = line.split("|");
        return { id, date, message: rest.join("|") };
      });

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
        const oldest = await runGitSimple(
          ["log", "--reverse", `${upstream.trim()}..HEAD`, `--format=%h|%ci|%s`, "-1"],
          cwd
        );
        const newest = await runGitSimple(
          ["log", `${upstream.trim()}..HEAD`, `--format=%h|%ci|%s`, "-1"],
          cwd
        );
        aheadCommits = [...parseCommits(oldest), ...parseCommits(newest)];
      }
    }

    // Behind commits (newest first from remote)
    let behindCommits: SyncCommit[] = [];
    if (behind > 0) {
      // newest 1
      const newest = await runGitSimple(
        ["log", `HEAD..${upstream.trim()}`, `--format=%h|%ci|%s`, "-1"],
        cwd
      );
      behindCommits = parseCommits(newest);
    }

    return { ahead, behind, aheadCommits, behindCommits };
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

function CommitLine({ c }: { c: SyncCommit }) {
  return (
    <div className="truncate">
      <span className="text-blue-600 dark:text-blue-400">{c.id}</span>
      {" "}
      <span className="text-gray-400 dark:text-gray-500">{formatSyncDate(c.date)}</span>
      {" "}
      <span>{c.message}</span>
    </div>
  );
}

const commitBoxClass =
  "font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 px-2 py-1";

export function SyncStatusBar({ syncStatus }: { syncStatus: SyncStatus }) {
  if (syncStatus.ahead === 0 && syncStatus.behind === 0) return null;

  return (
    <div className="shrink-0 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 text-xs">
      {/* Behind commits (above the summary line) */}
      {syncStatus.behind > 0 && syncStatus.behindCommits.length > 0 && (
        <div className={`mb-1 ${commitBoxClass}`}>
          {syncStatus.behind >= 2 && (
            <div className="text-gray-400 dark:text-gray-500">...</div>
          )}
          {syncStatus.behindCommits.map((c) => (
            <CommitLine key={c.id} c={c} />
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
              <CommitLine key={c.id} c={c} />
            ))
          ) : (
            <>
              <CommitLine c={syncStatus.aheadCommits[0]} />
              <div className="text-gray-400 dark:text-gray-500">...</div>
              <CommitLine c={syncStatus.aheadCommits[1]} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
