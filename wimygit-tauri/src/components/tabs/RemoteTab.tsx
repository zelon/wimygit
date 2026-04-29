import { useState, useEffect } from "react";
import {
  getRemotes,
  addRemote,
  removeRemote,
  gitFetch,
  gitPull,
  gitPush,
  getCurrentBranch,
  type RemoteInfo,
} from "../../lib";

interface RemoteTabProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
}

export function RemoteTab({ repoPath, refreshKey, onRefresh }: RemoteTabProps) {
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddRemote, setShowAddRemote] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState("");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");

  const fetchData = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const [remoteList, branch] = await Promise.all([
        getRemotes(repoPath),
        getCurrentBranch(repoPath),
      ]);
      setRemotes(remoteList);
      setCurrentBranch(branch);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [repoPath, refreshKey]);

  const handleFetch = async (remote: string) => {
    setOperating(`fetch-${remote}`);
    setError(null);
    setSuccess(null);
    try {
      await gitFetch(repoPath, remote);
      setSuccess(`Fetched from ${remote}`);
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handlePull = async (remote: string) => {
    setOperating(`pull-${remote}`);
    setError(null);
    setSuccess(null);
    try {
      await gitPull(repoPath, remote, currentBranch);
      setSuccess(`Pulled from ${remote}/${currentBranch}`);
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handlePush = async (remote: string) => {
    setOperating(`push-${remote}`);
    setError(null);
    setSuccess(null);
    try {
      await gitPush(repoPath, remote, currentBranch);
      setSuccess(`Pushed to ${remote}/${currentBranch}`);
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleAddRemote = async () => {
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
    try {
      await addRemote(repoPath, newRemoteName.trim(), newRemoteUrl.trim());
      setNewRemoteName("");
      setNewRemoteUrl("");
      setShowAddRemote(false);
      await fetchData();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemoveRemote = async (name: string) => {
    if (!confirm(`Remove remote "${name}"?`)) return;
    try {
      await removeRemote(repoPath, name);
      await fetchData();
    } catch (e) {
      setError(String(e));
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

      {/* Quick Actions */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-sm font-medium mb-3">Quick Actions (Current: {currentBranch})</h3>
        <div className="flex gap-2">
          <button
            onClick={() => remotes[0] && handleFetch(remotes[0].name)}
            disabled={remotes.length === 0 || !!operating}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {operating?.startsWith("fetch") ? "Fetching..." : "Fetch"}
          </button>
          <button
            onClick={() => remotes[0] && handlePull(remotes[0].name)}
            disabled={remotes.length === 0 || !!operating}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {operating?.startsWith("pull") ? "Pulling..." : "Pull"}
          </button>
          <button
            onClick={() => remotes[0] && handlePush(remotes[0].name)}
            disabled={remotes.length === 0 || !!operating}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {operating?.startsWith("push") ? "Pushing..." : "Push"}
          </button>
        </div>
      </div>

      {/* Remote List */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Remotes ({remotes.length})</h3>
        <button
          onClick={() => setShowAddRemote(!showAddRemote)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Remote
        </button>
      </div>

      {/* Add Remote Form */}
      {showAddRemote && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={newRemoteName}
              onChange={(e) => setNewRemoteName(e.target.value)}
              placeholder="Remote name (e.g., origin)"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
            />
            <input
              type="text"
              value={newRemoteUrl}
              onChange={(e) => setNewRemoteUrl(e.target.value)}
              placeholder="Remote URL"
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddRemote}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddRemote(false);
                setNewRemoteName("");
                setNewRemoteUrl("");
              }}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Remote Cards */}
      <div className="space-y-3">
        {remotes.map((remote) => (
          <div
            key={remote.name}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{remote.name}</h4>
                <div className="text-sm text-gray-500 mt-1 space-y-1">
                  <div className="flex gap-2">
                    <span className="text-gray-400">Fetch:</span>
                    <span className="font-mono text-xs">{remote.fetch_url}</span>
                  </div>
                  {remote.push_url !== remote.fetch_url && (
                    <div className="flex gap-2">
                      <span className="text-gray-400">Push:</span>
                      <span className="font-mono text-xs">{remote.push_url}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFetch(remote.name)}
                  disabled={!!operating}
                  className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Fetch
                </button>
                <button
                  onClick={() => handlePull(remote.name)}
                  disabled={!!operating}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                >
                  Pull
                </button>
                <button
                  onClick={() => handlePush(remote.name)}
                  disabled={!!operating}
                  className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                >
                  Push
                </button>
                <button
                  onClick={() => handleRemoveRemote(remote.name)}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}

        {remotes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No remotes configured. Add a remote to push/pull changes.
          </div>
        )}
      </div>
    </div>
  );
}
