import { useState, useEffect } from "react";
import {
  getWorktrees,
  addWorktree,
  removeWorktree,
  openInFileManager,
  getCurrentBranch,
  type WorktreeInfo,
} from "../../lib";

interface WorktreeTabProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
  onOpenRepo?: (path: string) => void;
}

export function WorktreeTab({ repoPath, refreshKey, onRefresh, onOpenRepo }: WorktreeTabProps) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operating, setOperating] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addPath, setAddPath] = useState("");
  const [addBranch, setAddBranch] = useState("");
  const [isNewBranch, setIsNewBranch] = useState(false);

  const fetchWorktrees = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const list = await getWorktrees(repoPath);
      setWorktrees(list);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorktrees();
  }, [repoPath, refreshKey]);

  // Pre-fill current branch when opening the add form
  const handleOpenAdd = async () => {
    setShowAdd(true);
    try {
      const branch = await getCurrentBranch(repoPath);
      setAddBranch(branch);
    } catch {
      // ignore
    }
  };

  const handleAdd = async () => {
    if (!addPath.trim()) {
      setError("Worktree path is required");
      return;
    }
    if (!addBranch.trim()) {
      setError("Branch name is required");
      return;
    }
    setOperating("add");
    setError(null);
    try {
      await addWorktree(repoPath, addPath.trim(), addBranch.trim(), isNewBranch);
      setSuccess(`Worktree added at "${addPath.trim()}"`);
      setAddPath("");
      setAddBranch("");
      setIsNewBranch(false);
      setShowAdd(false);
      await fetchWorktrees();
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleRemove = async (worktree: WorktreeInfo) => {
    if (worktree.is_main) {
      setError("Cannot remove the main worktree");
      return;
    }
    if (!confirm(`Remove worktree at "${worktree.path}"?\nThis does not delete the directory.`)) return;
    setOperating(`remove-${worktree.path}`);
    try {
      await removeWorktree(repoPath, worktree.path);
      setSuccess(`Worktree removed`);
      await fetchWorktrees();
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleOpenInExplorer = async (path: string) => {
    try {
      await openInFileManager(path);
    } catch (e) {
      setError(String(e));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading worktrees...</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl">
      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Worktrees ({worktrees.length})
        </h2>
        <button
          onClick={handleOpenAdd}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Worktree
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
          <h3 className="text-sm font-medium">New Worktree</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Path *</label>
            <input
              type="text"
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              placeholder="/path/to/new/worktree"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isNewBranch"
              checked={isNewBranch}
              onChange={(e) => setIsNewBranch(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isNewBranch" className="text-sm text-gray-700 dark:text-gray-300">
              Create new branch
            </label>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {isNewBranch ? "New Branch Name *" : "Existing Branch *"}
            </label>
            <input
              type="text"
              value={addBranch}
              onChange={(e) => setAddBranch(e.target.value)}
              placeholder={isNewBranch ? "feature/new-branch" : "existing-branch"}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!!operating}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {operating === "add" ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddPath(""); setAddBranch(""); setIsNewBranch(false); }}
              className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Worktree cards */}
      <div className="space-y-3">
        {worktrees.map((wt) => (
          <div
            key={wt.path}
            className={`p-4 border rounded-lg ${
              wt.is_main
                ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {wt.is_main && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded">main</span>
                  )}
                  {wt.is_locked && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-500 text-white rounded">locked</span>
                  )}
                  <span
                    className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium"
                  >
                    {wt.branch}
                  </span>
                  {wt.commit_hash && (
                    <span className="font-mono text-xs text-gray-400">{wt.commit_hash}</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">
                  {wt.path}
                </p>
              </div>

              <div className="flex gap-1 ml-4 shrink-0">
                <button
                  onClick={() => handleOpenInExplorer(wt.path)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  title="Open in file manager"
                >
                  Open
                </button>
                {onOpenRepo && (
                  <button
                    onClick={() => onOpenRepo(wt.path)}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    title="Open as repository"
                  >
                    Switch
                  </button>
                )}
                {!wt.is_main && (
                  <button
                    onClick={() => handleRemove(wt)}
                    disabled={!!operating}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                    title="Remove worktree"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {worktrees.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No worktrees found
          </div>
        )}
      </div>
    </div>
  );
}
