import { useState, useEffect } from "react";
import { getRepoState, runGit } from "../../lib";
import type { RepoState } from "../../lib";

interface RepoStateBannerProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
  conflictCount?: number;
}

const STATE_CONFIG: Record<string, { label: string; color: string }> = {
  "rebase-interactive": {
    label: "INTERACTIVE REBASE",
    color: "bg-orange-500",
  },
  rebase: {
    label: "REBASE",
    color: "bg-orange-500",
  },
  merging: {
    label: "MERGE",
    color: "bg-purple-500",
  },
  "cherry-picking": {
    label: "CHERRY-PICK",
    color: "bg-teal-500",
  },
  reverting: {
    label: "REVERT",
    color: "bg-red-500",
  },
  bisecting: {
    label: "BISECT",
    color: "bg-yellow-500",
  },
};

export function RepoStateBanner({ repoPath, refreshKey, onRefresh, conflictCount = 0 }: RepoStateBannerProps) {
  const [repoState, setRepoState] = useState<RepoState | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!repoPath) return;
    getRepoState(repoPath).then(setRepoState).catch(() => setRepoState(null));
  }, [repoPath, refreshKey]);

  if (!repoState || repoState.state === "normal") return null;

  const config = STATE_CONFIG[repoState.state];
  if (!config) return null;

  const isRebase = repoState.state === "rebase" || repoState.state === "rebase-interactive";
  const isMerge = repoState.state === "merging";
  const isCherryPick = repoState.state === "cherry-picking";
  const isRevert = repoState.state === "reverting";
  const isBisect = repoState.state === "bisecting";

  const runAction = async (args: string[]) => {
    setRunning(true);
    try {
      await runGit(args, repoPath);
      onRefresh();
    } catch {
      // errors will show via git log panel
      onRefresh();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-white shrink-0 border-b border-gray-200 dark:border-gray-700"
      style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, transparent 100%)" }}
    >
      <span className={`${config.color} text-white font-bold px-2 py-0.5 rounded text-base tracking-wide`}>
        {config.label}
      </span>
      <span className="text-gray-800 dark:text-gray-200 font-medium">
        {repoState.detail ?? `${config.label} in progress`}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        {isRebase && (
          <>
            <button
              disabled={running}
              onClick={() => runAction(["rebase", "--continue"])}
              className="px-2.5 py-0.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium"
            >
              Continue
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["rebase", "--skip"])}
              className="px-2.5 py-0.5 rounded bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-medium"
            >
              Skip
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["rebase", "--abort"])}
              className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
            >
              Abort
            </button>
          </>
        )}
        {isMerge && (
          <>
            <button
              disabled={running || conflictCount > 0}
              onClick={() => runAction(["merge", "--continue"])}
              title={conflictCount > 0 ? `${conflictCount} conflict(s) must be resolved first` : ""}
              className="px-2.5 py-0.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium"
            >
              Continue
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["merge", "--abort"])}
              className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
            >
              Abort Merge
            </button>
          </>
        )}
        {isCherryPick && (
          <>
            <button
              disabled={running}
              onClick={() => runAction(["cherry-pick", "--continue"])}
              className="px-2.5 py-0.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium"
            >
              Continue
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["cherry-pick", "--abort"])}
              className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
            >
              Abort
            </button>
          </>
        )}
        {isRevert && (
          <>
            <button
              disabled={running}
              onClick={() => runAction(["revert", "--continue"])}
              className="px-2.5 py-0.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium"
            >
              Continue
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["revert", "--abort"])}
              className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
            >
              Abort
            </button>
          </>
        )}
        {isBisect && (
          <>
            <button
              disabled={running}
              onClick={() => runAction(["bisect", "good"])}
              className="px-2.5 py-0.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium"
            >
              Good
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["bisect", "bad"])}
              className="px-2.5 py-0.5 rounded bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium"
            >
              Bad
            </button>
            <button
              disabled={running}
              onClick={() => runAction(["bisect", "reset"])}
              className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium"
            >
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}
