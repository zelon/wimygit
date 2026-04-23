import { useState, useEffect } from "react";
import {
  getTags,
  createTag,
  deleteTag,
  pushTag,
  getRemotes,
  type TagInfo,
} from "../../lib";

interface TagTabProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
}

export function TagTab({ repoPath, refreshKey, onRefresh }: TagTabProps) {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [remotes, setRemotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [operating, setOperating] = useState<string | null>(null);

  // create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [isAnnotated, setIsAnnotated] = useState(false);

  const fetchData = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const [tagList, remoteList] = await Promise.all([
        getTags(repoPath),
        getRemotes(repoPath),
      ]);
      setTags(tagList);
      setRemotes(remoteList.map((r) => r.name));
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

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError("Tag name is required");
      return;
    }
    setOperating("create");
    try {
      await createTag(
        repoPath,
        newName.trim(),
        newTarget.trim() || undefined,
        isAnnotated ? (newMessage.trim() || newName.trim()) : undefined
      );
      setSuccess(`Tag "${newName.trim()}" created`);
      setNewName("");
      setNewTarget("");
      setNewMessage("");
      setIsAnnotated(false);
      setShowCreate(false);
      await fetchData();
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete tag "${name}"?`)) return;
    setOperating(`delete-${name}`);
    try {
      await deleteTag(repoPath, name);
      setSuccess(`Tag "${name}" deleted`);
      await fetchData();
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handlePush = async (tagName: string, remote: string) => {
    setOperating(`push-${tagName}`);
    setError(null);
    setSuccess(null);
    try {
      await pushTag(repoPath, remote, tagName);
      setSuccess(`Tag "${tagName}" pushed to ${remote}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading tags...</div>
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
          Tags ({tags.length})
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create Tag
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
          <h3 className="text-sm font-medium">New Tag</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tag Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="v1.0.0"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Target (commit/branch, default: HEAD)</label>
              <input
                type="text"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="HEAD"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="annotated"
              checked={isAnnotated}
              onChange={(e) => setIsAnnotated(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="annotated" className="text-sm text-gray-700 dark:text-gray-300">
              Annotated tag
            </label>
          </div>

          {isAnnotated && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Message</label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Tag message..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!!operating}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {operating === "create" ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); setNewTarget(""); setNewMessage(""); setIsAnnotated(false); }}
              className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tag list */}
      {tags.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No tags found in this repository
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Commit</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr
                  key={tag.name}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-2 font-medium">{tag.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{tag.commit_id}</td>
                  <td className="px-4 py-2">
                    {tag.is_annotated ? (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                        annotated
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">
                        lightweight
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end items-center gap-1">
                      {/* Push dropdown */}
                      {remotes.length > 0 && (
                        <div className="relative group">
                          <button
                            disabled={!!operating}
                            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                          >
                            {operating === `push-${tag.name}` ? "Pushing..." : "Push"}
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg hidden group-hover:block z-10 min-w-max">
                            {remotes.map((r) => (
                              <button
                                key={r}
                                onClick={() => handlePush(tag.name, r)}
                                className="block w-full text-left px-4 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Push to {r}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => handleDelete(tag.name)}
                        disabled={!!operating}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
