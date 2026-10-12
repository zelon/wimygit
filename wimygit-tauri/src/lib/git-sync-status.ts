import { runGitSimple } from "./git-api";

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
