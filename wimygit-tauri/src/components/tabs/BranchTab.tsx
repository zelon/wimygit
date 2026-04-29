import { useState, useEffect } from "react";
import {
  getBranches,
  getCurrentBranch,
  gitCheckout,
  gitCreateBranch,
  gitDeleteBranch,
  gitMerge,
  type BranchInfo,
} from "../../lib";

interface BranchTabProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
}

export function BranchTab({ repoPath, refreshKey, onRefresh }: BranchTabProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [filter, setFilter] = useState<"all" | "local" | "remote">("local");

  const fetchBranches = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const [branchList, current] = await Promise.all([
        getBranches(repoPath),
        getCurrentBranch(repoPath),
      ]);
      setBranches(branchList);
      setCurrentBranch(current);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [repoPath, refreshKey]);

  const handleCheckout = async (branchName: string) => {
    try {
      await gitCheckout(repoPath, branchName);
      await fetchBranches();
      onRefresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      await gitCreateBranch(repoPath, newBranchName.trim(), true);
      setNewBranchName("");
      setShowNewBranch(false);
      await fetchBranches();
      onRefresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDeleteBranch = async (branchName: string, force: boolean = false) => {
    if (!confirm(`Delete branch "${branchName}"?`)) return;
    try {
      await gitDeleteBranch(repoPath, branchName, force);
      await fetchBranches();
    } catch (e) {
      if (!force && String(e).includes("not fully merged")) {
        if (confirm(`Branch "${branchName}" is not fully merged. Force delete?`)) {
          await handleDeleteBranch(branchName, true);
        }
      } else {
        setError(String(e));
      }
    }
  };

  const handleMerge = async (branchName: string) => {
    if (!confirm(`Merge "${branchName}" into "${currentBranch}"?`)) return;
    try {
      await gitMerge(repoPath, branchName);
      await fetchBranches();
      onRefresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const filteredBranches = branches.filter((b) => {
    if (filter === "local") return !b.is_remote;
    if (filter === "remote") return b.is_remote;
    return true;
  });

  const localBranches = filteredBranches.filter((b) => !b.is_remote);
  const remoteBranches = filteredBranches.filter((b) => b.is_remote);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded p-1">
          {(["local", "remote", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded ${
                filter === f
                  ? "bg-white dark:bg-gray-700 shadow"
                  : "hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewBranch(!showNewBranch)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Branch
        </button>
      </div>

      {/* New Branch Input */}
      {showNewBranch && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="Branch name..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
          />
          <button
            onClick={handleCreateBranch}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create
          </button>
          <button
            onClick={() => {
              setShowNewBranch(false);
              setNewBranchName("");
            }}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Branch List */}
      <div className="space-y-1">
        {filter !== "remote" &&
          localBranches.map((branch) => (
            <BranchRow
              key={branch.name}
              branch={branch}
              isCurrent={branch.name === currentBranch}
              onCheckout={handleCheckout}
              onDelete={handleDeleteBranch}
              onMerge={handleMerge}
                          />
          ))}
        {filter !== "local" && remoteBranches.length > 0 && (
          <>
            {filter === "all" && localBranches.length > 0 && (
              <div className="text-xs text-gray-500 uppercase tracking-wide py-2 mt-4">
                Remote Branches
              </div>
            )}
            {remoteBranches.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                isCurrent={false}
                onCheckout={handleCheckout}
                onDelete={() => {}}
                onMerge={handleMerge}
                              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

interface BranchRowProps {
  branch: BranchInfo;
  isCurrent: boolean;
  onCheckout: (name: string) => void;
  onDelete: (name: string) => void;
  onMerge: (name: string) => void;
}

function BranchRow({
  branch,
  isCurrent,
  onCheckout,
  onDelete,
  onMerge,
}: BranchRowProps) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded ${
        isCurrent
          ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {isCurrent && (
            <span className="text-green-600 dark:text-green-400">●</span>
          )}
          <span className={`font-medium ${branch.is_remote ? "text-gray-500" : ""}`}>
            {branch.name}
          </span>
          {branch.upstream && (
            <span className="text-xs text-gray-400">→ {branch.upstream}</span>
          )}
          {(branch.ahead > 0 || branch.behind > 0) && (
            <span className="text-xs text-gray-500">
              {branch.ahead > 0 && <span className="text-green-600">↑{branch.ahead}</span>}
              {branch.behind > 0 && <span className="text-red-600 ml-1">↓{branch.behind}</span>}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">
          <span className="font-mono">{branch.commit_id.slice(0, 7)}</span>
          {branch.commit_message && <span className="ml-2">{branch.commit_message}</span>}
        </div>
      </div>
      <div className="flex gap-1">
        {!isCurrent && !branch.is_remote && (
          <>
            <button
              onClick={() => onCheckout(branch.name)}
              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              title="Checkout"
            >
              Checkout
            </button>
            <button
              onClick={() => onMerge(branch.name)}
              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              title="Merge into current"
            >
              Merge
            </button>
            <button
              onClick={() => onDelete(branch.name)}
              className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              title="Delete"
            >
              ✕
            </button>
          </>
        )}
        {branch.is_remote && (
          <button
            onClick={() => onCheckout(branch.name.replace(/^[^/]+\//, ""))}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            title="Checkout"
          >
            Checkout
          </button>
        )}
      </div>
    </div>
  );
}
