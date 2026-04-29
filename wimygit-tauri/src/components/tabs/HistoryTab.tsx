import { useState, useEffect, useCallback, useRef } from "react";
import {
  getHistory,
  getCommitFiles,
  getCommitParents,
  type CommitInfo,
  type CommitFile,
  type SelectedDiffInfo,
} from "../../lib";
import { invoke } from "@tauri-apps/api/core";

interface HistoryTabProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
  onFileSelect?: (info: SelectedDiffInfo) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseRefNames(refNames: string) {
  if (!refNames) return [];
  return refNames
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      if (r.startsWith("HEAD ->")) return { label: r.replace("HEAD -> ", ""), kind: "head" as const };
      if (r === "HEAD") return { label: "HEAD", kind: "head" as const };
      if (r.startsWith("tag: ")) return { label: r.replace("tag: ", ""), kind: "tag" as const };
      if (r.includes("/")) return { label: r, kind: "remote" as const };
      return { label: r, kind: "branch" as const };
    });
}

const REF_BADGE: Record<string, string> = {
  head:   "bg-green-600 text-white",
  branch: "bg-blue-500 text-white",
  remote: "bg-gray-500 text-white",
  tag:    "bg-yellow-500 text-white",
};

function formatDate(ts: number) {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const FILE_STATUS_ICON: Record<string, { icon: string; cls: string }> = {
  M: { icon: "M", cls: "text-yellow-600 dark:text-yellow-400" },
  A: { icon: "+", cls: "text-green-600 dark:text-green-400" },
  D: { icon: "−", cls: "text-red-600 dark:text-red-400" },
  R: { icon: "→", cls: "text-blue-600 dark:text-blue-400" },
  C: { icon: "C", cls: "text-purple-600 dark:text-purple-400" },
  T: { icon: "T", cls: "text-gray-600 dark:text-gray-400" },
};

// ─── context menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number; y: number;
  commit: CommitInfo;
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

function ContextMenu({ x, y, commit, repoPath, onClose, onRefresh }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const run = async (args: string[]) => {
    onClose();
    try { await invoke("run_git_simple", { args, cwd: repoPath }); onRefresh(); }
    catch (e) { alert(String(e)); }
  };

  const items: { label: string; action: () => void; danger?: boolean }[] = [
    { label: "Checkout",          action: () => run(["checkout", commit.hash]) },
    { label: "Create Branch here…", action: async () => {
        onClose();
        const name = prompt("New branch name:"); if (!name?.trim()) return;
        try { await invoke("run_git_simple", { args: ["checkout", "-b", name.trim(), commit.hash], cwd: repoPath }); onRefresh(); }
        catch (e) { alert(String(e)); }
    }},
    { label: "Create Tag here…", action: async () => {
        onClose();
        const name = prompt("Tag name:"); if (!name?.trim()) return;
        try { await invoke("run_git_simple", { args: ["tag", name.trim(), commit.hash], cwd: repoPath }); onRefresh(); }
        catch (e) { alert(String(e)); }
    }},
    { label: "Cherry-pick",       action: () => run(["cherry-pick", commit.hash]) },
    { label: "──", action: () => {} },
    { label: "Reset Soft",        action: () => { if (confirm(`Reset soft to ${commit.short_hash}?`)) run(["reset", "--soft", commit.hash]); } },
    { label: "Reset Mixed",       action: () => { if (confirm(`Reset mixed to ${commit.short_hash}?`)) run(["reset", "--mixed", commit.hash]); } },
    { label: "Reset Hard", danger: true, action: () => { if (confirm(`Reset HARD to ${commit.short_hash}?`)) run(["reset", "--hard", commit.hash]); } },
    { label: "──", action: () => {} },
    { label: "Copy Commit ID",    action: () => { onClose(); navigator.clipboard.writeText(commit.hash).catch(() => {}); } },
    { label: "Copy Short ID",     action: () => { onClose(); navigator.clipboard.writeText(commit.short_hash).catch(() => {}); } },
  ];

  return (
    <div ref={ref} style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 min-w-[200px] text-sm">
      {items.map((item, i) =>
        item.label === "──"
          ? <div key={i} className="border-t border-gray-200 dark:border-gray-700 my-1" />
          : <button key={i} onClick={item.action}
              className={`w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${item.danger ? "text-red-600 dark:text-red-400" : ""}`}>
              {item.label}
            </button>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function HistoryTab({ repoPath, refreshKey, onRefresh, onFileSelect }: HistoryTabProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([]);
  const [parents, setParents] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; commit: CommitInfo } | null>(null);

  // ── load history ──────────────────────────────────────────────────────────

  const loadHistory = useCallback(async (skip = 0) => {
    if (!repoPath) return;
    skip === 0 ? setLoading(true) : setLoadingMore(true);
    try {
      const result = await getHistory(repoPath, "", skip, PAGE_SIZE);
      setCommits((prev) => skip === 0 ? result : [...prev, ...result]);
      setHasMore(result.length === PAGE_SIZE);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [repoPath]);

  useEffect(() => {
    setSelectedCommit(null);
    setCommitFiles([]);
    setSelectedFile(null);
    setParents([]);
    loadHistory(0);
  }, [repoPath, refreshKey, loadHistory]);

  // ── select commit → load files + parents ─────────────────────────────────

  const handleSelectCommit = useCallback(async (commit: CommitInfo) => {
    setSelectedCommit(commit);
    setSelectedFile(null);
    setCommitFiles([]);
    setFilesLoading(true);
    try {
      const [files, parentHashes] = await Promise.all([
        getCommitFiles(repoPath, commit.hash),
        getCommitParents(repoPath, commit.hash),
      ]);
      setCommitFiles(files);
      setParents(parentHashes);
    } finally {
      setFilesLoading(false);
    }
  }, [repoPath]);

  // ── select file → notify parent for Quick Diff ────────────────────────────

  const handleSelectFile = useCallback((file: CommitFile) => {
    if (!selectedCommit) return;
    setSelectedFile(file);
    onFileSelect?.({
      commitId: selectedCommit.hash,
      commit: selectedCommit,
      file,
      parents,
    });
  }, [selectedCommit, parents, onFileSelect]);

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading history...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top: commit list ── */}
      <div className="flex-[3] overflow-y-auto border-b border-gray-200 dark:border-gray-700">
        {commits.map((commit) => {
          const refs = parseRefNames(commit.ref_names);
          const isSelected = selectedCommit?.hash === commit.hash;
          return (
            <div
              key={commit.hash}
              onClick={() => handleSelectCommit(commit)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, commit }); }}
              className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer border-b border-gray-100 dark:border-gray-800 ${
                isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span className="font-mono text-xs text-gray-400 shrink-0 leading-5 select-none" style={{ minWidth: "1.5rem" }}>
                {commit.graph}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">{commit.short_hash}</span>
                  {refs.map((r, i) => (
                    <span key={i} className={`text-[10px] px-1 rounded leading-4 shrink-0 ${REF_BADGE[r.kind]}`}>{r.label}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-800 dark:text-gray-200 truncate">{commit.message}</div>
                <div className="text-[10px] text-gray-400 flex gap-2">
                  <span>{commit.author}</span>
                  <span>{formatDate(commit.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {hasMore && (
          <div className="p-3 text-center">
            <button onClick={() => loadHistory(commits.length)} disabled={loadingMore}
              className="px-4 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 disabled:opacity-50">
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom: Detail (left) + Files (right) ── */}
      <div className="flex-[2] flex overflow-hidden min-h-0">

        {/* Detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700">
          <div className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            Detail
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
            {selectedCommit ? (
              <>
                <div><span className="text-gray-400">Commit</span><br />
                  <span className="font-mono text-blue-600 dark:text-blue-400 break-all">{selectedCommit.hash}</span>
                </div>
                <div><span className="text-gray-400">Author</span><br />{selectedCommit.author}</div>
                <div><span className="text-gray-400">Date</span><br />{formatDate(selectedCommit.timestamp)}</div>
                {parents.length > 0 && (
                  <div><span className="text-gray-400">Parents</span><br />
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {parents.map((p) => p.slice(0, 7)).join(", ")}
                    </span>
                  </div>
                )}
                <div><span className="text-gray-400">Message</span><br />
                  <span className="whitespace-pre-wrap">{selectedCommit.message}</span>
                </div>
              </>
            ) : (
              <span className="text-gray-400 italic">Select a commit</span>
            )}
          </div>
        </div>

        {/* Files panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            Files {selectedCommit ? `(${commitFiles.length})` : ""}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filesLoading ? (
              <div className="flex items-center justify-center h-12 text-xs text-gray-400">Loading...</div>
            ) : commitFiles.length === 0 && selectedCommit ? (
              <div className="flex items-center justify-center h-12 text-xs text-gray-400">No files changed</div>
            ) : (
              commitFiles.map((file, i) => {
                const si = FILE_STATUS_ICON[file.status] ?? { icon: file.status, cls: "text-gray-500" };
                const isSelected = selectedFile?.filename === file.filename;
                return (
                  <div key={i} onClick={() => handleSelectFile(file)}
                    className={`flex items-center gap-2 px-3 py-1 text-xs cursor-pointer border-b border-gray-50 dark:border-gray-800 ${
                      isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className={`font-mono font-bold w-4 shrink-0 ${si.cls}`}>{si.icon}</span>
                    <span className="truncate" title={file.display}>{file.display}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} commit={contextMenu.commit}
          repoPath={repoPath} onClose={() => setContextMenu(null)}
          onRefresh={() => { setContextMenu(null); onRefresh(); }} />
      )}
    </div>
  );
}
