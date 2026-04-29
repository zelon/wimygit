import { useState, useEffect } from "react";
import {
  getStashList,
  stashPush,
  stashApply,
  stashPop,
  stashDrop,
  type StashEntry,
} from "../../lib";

interface StashTabProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
}

export function StashTab({ repoPath, refreshKey, onRefresh }: StashTabProps) {
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newStashMessage, setNewStashMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);

  const fetchStashes = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const list = await getStashList(repoPath);
      setStashes(list);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStashes();
  }, [repoPath, refreshKey]);

  const handleCreate = async () => {
    setError(null);
    setSuccess(null);
    try {
      await stashPush(
        repoPath,
        newStashMessage.trim() || undefined,
        includeUntracked
      );
      setNewStashMessage("");
      setShowCreate(false);
      setSuccess("Stash created");
      await fetchStashes();
      onRefresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleApply = async (index: number) => {
    setOperating(index);
    setError(null);
    setSuccess(null);
    try {
      await stashApply(repoPath, index);
      setSuccess(`Applied stash@{${index}}`);
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handlePop = async (index: number) => {
    setOperating(index);
    setError(null);
    setSuccess(null);
    try {
      await stashPop(repoPath, index);
      setSuccess(`Popped stash@{${index}}`);
      await fetchStashes();
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleDrop = async (index: number) => {
    if (!confirm(`Drop stash@{${index}}?`)) return;
    setOperating(index);
    setError(null);
    setSuccess(null);
    try {
      await stashDrop(repoPath, index);
      setSuccess(`Dropped stash@{${index}}`);
      await fetchStashes();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

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

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Create Stash */}
      <div className="mb-6">
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create Stash
          </button>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="mb-3">
              <input
                type="text"
                value={newStashMessage}
                onChange={(e) => setNewStashMessage(e.target.value)}
                placeholder="Stash message (optional)"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
              />
            </div>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeUntracked}
                  onChange={(e) => setIncludeUntracked(e.target.checked)}
                  className="rounded"
                />
                Include untracked files
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create Stash
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewStashMessage("");
                }}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stash List */}
      <h3 className="text-sm font-medium mb-3">Stashes ({stashes.length})</h3>
      <div className="space-y-2">
        {stashes.map((stash) => (
          <div
            key={stash.index}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {stash.full_ref}
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                    {stash.branch}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {stash.message || "(no message)"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApply(stash.index)}
                  disabled={operating === stash.index}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                >
                  Apply
                </button>
                <button
                  onClick={() => handlePop(stash.index)}
                  disabled={operating === stash.index}
                  className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                >
                  Pop
                </button>
                <button
                  onClick={() => handleDrop(stash.index)}
                  disabled={operating === stash.index}
                  className="px-3 py-1 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                >
                  Drop
                </button>
              </div>
            </div>
          </div>
        ))}

        {stashes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No stashes. Use "Create Stash" to save your current changes.
          </div>
        )}
      </div>
    </div>
  );
}
