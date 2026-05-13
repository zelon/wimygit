import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CreateBranchModal } from "../shared/CreateBranchModal";
import { CreateTagModal } from "../shared/CreateTagModal";
import {
  getHistory,
  getCommitFiles,
  getCommitParents,
  getLocalOnlyBranches,
  getStaleBranches,
  getRemotes,
  type CommitInfo,
  type CommitFile,
  type SelectedDiffInfo,
} from "../../lib";
import { invoke } from "@tauri-apps/api/core";
import { computeGraphLayout, computeLinearLayout, GraphSvg, ROW_H } from "./GitGraph";

interface HistoryTabProps {
  repoPath: string;
  filePath?: string | null;
  refreshKey: number;
  onRefresh: () => void;
  onFileSelect?: (info: SelectedDiffInfo) => void;
  onClearPath?: () => void;
  onShowInWorkspace?: () => void;
  onShowInWorkspaceFile?: (absolutePath: string) => void;
  onShowInHistoryFile?: (absolutePath: string) => void;
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
  head: "bg-green-600 text-white",
  branch: "bg-blue-500 text-white",
  remote: "bg-gray-500 text-white",
  tag: "bg-yellow-500 text-white",
};

function formatDate(ts: number) {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatRelativeTime(ts: number): string | null {
  const diffMs = Date.now() - ts * 1000;
  if (diffMs < 0 || diffMs >= 8 * 60 * 60 * 1000) return null;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "(just now)";
  if (diffMin < 60) return `(${diffMin} minute${diffMin === 1 ? "" : "s"} ago)`;
  const diffHr = Math.floor(diffMin / 60);
  return `(${diffHr} hour${diffHr === 1 ? "" : "s"} ago)`;
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
  localOnlyBranches: Set<string>;
  staleBranches: Set<string>;
  onClose: () => void;
  onRefresh: () => void;
  onOpenCreateBranch: (commitHash: string) => void;
  onOpenCreateTag: (commitHash: string) => void;
}

function ContextMenu({ x, y, commit, repoPath, localOnlyBranches, staleBranches, onClose, onRefresh, onOpenCreateBranch, onOpenCreateTag }: ContextMenuProps) {
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

  const localOnlyRefsOnCommit = parseRefNames(commit.ref_names)
    .filter(r => (r.kind === "branch" || r.kind === "head") && localOnlyBranches.has(r.label))
    .map(r => r.label);

  const staleRefsOnCommit = parseRefNames(commit.ref_names)
    .filter(r => r.kind === "remote" && staleBranches.has(r.label))
    .map(r => r.label);

  const items: { label: string; action: () => void; danger?: boolean }[] = [
    { label: "Checkout", action: () => run(["checkout", commit.hash]) },
    {
      label: "Create Branch here…", action: () => {
        onClose();
        onOpenCreateBranch(commit.hash);
      }
    },
    {
      label: "Create Tag here…", action: () => {
        onClose();
        onOpenCreateTag(commit.hash);
      }
    },
    {
      label: "Cherry-pick", action: async () => {
        onClose();
        try { await invoke("run_git", { args: ["cherry-pick", commit.hash], cwd: repoPath }); }
        catch { /* run_git only fails if git is not found; conflicts are non-throwing */ }
        onRefresh();
      }
    },
    { label: "──", action: () => { } },
    { label: "Reset Soft", action: () => { if (confirm(`Reset soft to ${commit.short_hash}?`)) run(["reset", "--soft", commit.hash]); } },
    { label: "Reset Mixed", action: () => { if (confirm(`Reset mixed to ${commit.short_hash}?`)) run(["reset", "--mixed", commit.hash]); } },
    { label: "Reset Hard", danger: true, action: () => { if (confirm(`Reset HARD to ${commit.short_hash}?`)) run(["reset", "--hard", commit.hash]); } },
    { label: "──", action: () => { } },
    { label: "Copy Commit ID", action: () => { onClose(); navigator.clipboard.writeText(commit.hash).catch(() => { }); } },
    { label: "Copy Short ID", action: () => { onClose(); navigator.clipboard.writeText(commit.short_hash).catch(() => { }); } },
    ...(localOnlyRefsOnCommit.length > 0 ? [
      { label: "──", action: () => { } },
      ...localOnlyRefsOnCommit.map(branch => ({
        label: `Push "${branch}" to remote…`,
        action: async () => {
          onClose();
          let remotes: { name: string }[];
          try { remotes = await getRemotes(repoPath); }
          catch { alert("Failed to get remotes."); return; }
          if (remotes.length === 0) { alert("No remotes configured."); return; }

          let remote: string;
          if (remotes.length === 1) {
            remote = remotes[0].name;
          } else {
            const names = remotes.map(r => r.name).join(", ");
            const input = prompt(`Push to which remote? (${names})`, remotes[0].name);
            if (!input?.trim()) return;
            remote = input.trim();
          }

          try {
            await invoke("run_git_simple", { args: ["push", "-u", remote, branch], cwd: repoPath });
            onRefresh();
          } catch (e) { alert(String(e)); }
        },
      })),
    ] : []),
    ...(staleRefsOnCommit.length > 0 ? [
      { label: "──", action: () => { } },
      ...staleRefsOnCommit.map(branch => ({
        label: `Delete remote tracking ref "${branch}"`,
        danger: true,
        action: async () => {
          onClose();
          try {
            await invoke("run_git_simple", { args: ["branch", "-dr", branch], cwd: repoPath });
            onRefresh();
          } catch (e) { alert(String(e)); }
        },
      })),
    ] : []),
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

// ─── file context menu ────────────────────────────────────────────────────────

interface FileContextMenuProps {
  x: number;
  y: number;
  absolutePath: string;
  onClose: () => void;
  onShowInWorkspace: (absolutePath: string) => void;
  onShowInHistory: (absolutePath: string) => void;
}

function FileContextMenu({ x, y, absolutePath, onClose, onShowInWorkspace, onShowInHistory }: FileContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 min-w-[180px] text-sm">
      <button onClick={() => { onClose(); onShowInWorkspace(absolutePath); }}
        className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700">
        Show in Workspace
      </button>
      <button onClick={() => { onClose(); onShowInHistory(absolutePath); }}
        className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700">
        Show in History
      </button>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

export function HistoryTab({ repoPath, filePath, refreshKey, onRefresh, onFileSelect, onClearPath, onShowInWorkspace, onShowInWorkspaceFile, onShowInHistoryFile }: HistoryTabProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([]);
  const [parents, setParents] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; commit: CommitInfo } | null>(null);
  const [createBranchModal, setCreateBranchModal] = useState<{ commitHash: string; hasRemotes: boolean } | null>(null);
  const [createTagModal, setCreateTagModal] = useState<string | null>(null); // commit hash
  const [fileCtxMenu, setFileCtxMenu] = useState<{ x: number; y: number; absolutePath: string } | null>(null);
  const [allBranches, setAllBranches] = useState(true);
  const [staleBranches, setStaleBranches] = useState<Set<string>>(new Set());
  const [localOnlyBranches, setLocalOnlyBranches] = useState<Set<string>>(new Set());

  // ── load history ──────────────────────────────────────────────────────────

  const loadHistoryGenRef = useRef(0);

  const loadHistory = useCallback(async (skip = 0) => {
    if (!repoPath) return;
    const gen = ++loadHistoryGenRef.current;
    skip === 0 ? setLoading(true) : setLoadingMore(true);
    try {
      const result = await getHistory(repoPath, filePath ?? "", skip, PAGE_SIZE, allBranches, searchQuery || undefined);
      if (gen !== loadHistoryGenRef.current) return;
      setCommits((prev) => skip === 0 ? result : [...prev, ...result]);
      setHasMore(result.length === PAGE_SIZE);
      setError(null);
    } catch (e) {
      if (gen === loadHistoryGenRef.current) setError(String(e));
    } finally {
      if (gen === loadHistoryGenRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [repoPath, filePath, allBranches, searchQuery]);

  useEffect(() => {
    setSelectedCommit(null);
    setCommitFiles([]);
    setSelectedFile(null);
    setParents([]);
    loadHistory(0);
    return () => { loadHistoryGenRef.current++; };
  }, [repoPath, refreshKey, loadHistory]);

  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    getStaleBranches(repoPath)
      .then((branches) => { if (!cancelled) setStaleBranches(new Set(branches)); })
      .catch(() => { if (!cancelled) setStaleBranches(new Set()); });
    getLocalOnlyBranches(repoPath)
      .then((branches) => { if (!cancelled) setLocalOnlyBranches(new Set(branches)); })
      .catch(() => { if (!cancelled) setLocalOnlyBranches(new Set()); });
    return () => { cancelled = true; };
  }, [repoPath, refreshKey]);

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

  // ── graph layout ──────────────────────────────────────────────────────────

  const isPathFiltered = !!filePath && (
    filePath.replace(/\\/g, "/").replace(repoPath.replace(/\\/g, "/"), "") || "/"
  ) !== "/";

  const graphRows = useMemo(
    () => (isPathFiltered || !!searchQuery) ? computeLinearLayout(commits.length) : computeGraphLayout(commits),
    [commits, isPathFiltered, searchQuery]
  );

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading history...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">{error}</div>;
  }

  const displayPath = filePath
    ? filePath.replace(/\\/g, "/").replace(repoPath.replace(/\\/g, "/"), "") || "/"
    : "/";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Path indicator + options ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-gray-500 dark:text-gray-400">Path:</span>
        <span className="font-mono text-gray-700 dark:text-gray-300 truncate">{displayPath}</span>
        {displayPath !== "/" && (
          <>
            {onShowInWorkspace && (
              <button
                onClick={onShowInWorkspace}
                className="ml-6 shrink-0 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
              >
                Show in Workspace
              </button>
            )}
            {onClearPath && (
              <button
                onClick={onClearPath}
                className="ml-1 shrink-0 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
              >
                Clear Path
              </button>
            )}
          </>
        )}
        <label className="ml-auto flex items-center gap-1 cursor-pointer shrink-0 select-none text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={allBranches} onChange={(e) => setAllBranches(e.target.checked)} className="cursor-pointer" />
          All Branches
        </label>
      </div>
      {/* ── Search bar ── */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => setSearchQuery(searchInput)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
          title="Search"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
          </svg>
        </button>
        <input
          ref={searchRef}
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearchQuery(searchInput);
            if (e.key === "Escape") { setSearchInput(""); setSearchQuery(""); }
          }}
          placeholder="Search commits..."
          className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none"
        />
        {searchQuery && (
          loading ? (
            <span className="text-xs text-gray-400 shrink-0">...</span>
          ) : (
            <span className="text-xs text-gray-400 shrink-0">{commits.length}{hasMore ? "+" : ""} results</span>
          )
        )}
        {searchInput && (
          <button
            onClick={() => { setSearchInput(""); setSearchQuery(""); }}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            title="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        )}
      </div>
      {/* ── Top: commit list ── */}
      <div className="flex-[3] overflow-y-auto border-b border-gray-200 dark:border-gray-700">
        {commits.map((commit, idx) => {
          const refs = parseRefNames(commit.ref_names);
          const isSelected = selectedCommit?.hash === commit.hash;
          const relative = formatRelativeTime(commit.timestamp);
          const graphRow = graphRows[idx];
          return (
            <div
              key={commit.hash}
              onClick={() => handleSelectCommit(commit)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, commit }); }}
              className={`flex items-center gap-2 px-2 cursor-pointer border-b border-gray-100 dark:border-gray-800 ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              style={{ height: ROW_H }}
            >
              {/* Graph (SVG) */}
              {graphRow && <GraphSvg row={graphRow} />}
              {/* Message (with inline refs) */}
              <div className="flex-1 min-w-0 flex items-center gap-1">
                {refs.map((r, i) => {
                  const isStale = r.kind === "remote" && staleBranches.has(r.label);
                  const isLocalOnly = (r.kind === "branch" || r.kind === "head") && localOnlyBranches.has(r.label);
                  const isCurrent = r.kind === "head";

                  const outerCls = isStale
                    ? "border border-red-950"
                    : isLocalOnly
                    ? "border border-orange-950"
                    : "";

                  const nameBg = isStale
                    ? "bg-red-800 text-white"
                    : isCurrent
                    ? "bg-green-700 text-white"
                    : isLocalOnly
                    ? "bg-orange-700 text-white"
                    : REF_BADGE[r.kind];

                  return (
                    <span key={i} className={`inline-flex items-center shrink-0 leading-4 overflow-hidden rounded ${outerCls}`}>
                      <span className={`${isCurrent ? "text-[13px] px-[5px] leading-5" : "text-[10px] px-1 leading-4"} inline-flex items-center gap-0.5 ${nameBg}`}>
                        {(r.kind === "head" || r.kind === "branch" || r.kind === "remote") && (
                          <svg width={isCurrent ? 13 : 10} height={isCurrent ? 13 : 10} viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                            <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z" />
                          </svg>
                        )}
                        {r.kind === "tag" && (
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                            <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775zM6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                          </svg>
                        )}
                        {r.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[13px] px-[5px] leading-5 bg-green-600 text-white">HEAD</span>
                      )}
                      {isLocalOnly && (
                        <span className="text-[10px] px-1 leading-4 bg-orange-500 text-white">local only</span>
                      )}
                      {isStale && (
                        <span className="text-[10px] px-1 leading-4 bg-red-600 text-white">deleted on remote</span>
                      )}
                    </span>
                  );
                })}
                <span className="text-xs text-gray-800 dark:text-gray-200 truncate">{commit.message}</span>
              </div>
              {/* Author */}
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 grow-0 truncate text-right" style={{ width: "8rem" }}>{commit.author}</span>
              {/* DateTime */}
              <span className="text-xs text-gray-400 shrink-0 grow-0 text-right" style={{ width: "13rem" }}>
                {relative && <span className="text-gray-500 dark:text-gray-400 mr-1">{relative}</span>}
                {formatDate(commit.timestamp)}
              </span>
              {/* CommitId (right end) */}
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0 grow-0 text-right" style={{ width: "4.5rem" }}>{commit.short_hash}</span>
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
                const absPath = repoPath.replace(/\\/g, "/") + "/" + file.filename;
                return (
                  <div key={i}
                    onClick={() => handleSelectFile(file)}
                    onContextMenu={(e) => { e.preventDefault(); setFileCtxMenu({ x: e.clientX, y: e.clientY, absolutePath: absPath }); }}
                    className={`flex items-center gap-2 px-3 py-1 text-xs cursor-pointer border-b border-gray-50 dark:border-gray-800 ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
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

      {fileCtxMenu && onShowInWorkspaceFile && onShowInHistoryFile && (
        <FileContextMenu
          x={fileCtxMenu.x} y={fileCtxMenu.y}
          absolutePath={fileCtxMenu.absolutePath}
          onClose={() => setFileCtxMenu(null)}
          onShowInWorkspace={onShowInWorkspaceFile}
          onShowInHistory={onShowInHistoryFile}
        />
      )}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} commit={contextMenu.commit}
          repoPath={repoPath} localOnlyBranches={localOnlyBranches} staleBranches={staleBranches}
          onClose={() => setContextMenu(null)}
          onRefresh={() => { setContextMenu(null); onRefresh(); }}
          onOpenCreateBranch={async (hash) => {
            const remotes = await getRemotes(repoPath).catch(() => []);
            setCreateBranchModal({ commitHash: hash, hasRemotes: remotes.length > 0 });
          }}
          onOpenCreateTag={(hash) => setCreateTagModal(hash)} />
      )}
      {createBranchModal && (
        <CreateBranchModal
          commitHash={createBranchModal.commitHash}
          hasRemotes={createBranchModal.hasRemotes}
          onConfirm={async (name, checkout, pushToRemote) => {
            const { commitHash } = createBranchModal;
            setCreateBranchModal(null);
            try {
              const args = checkout
                ? ["checkout", "-b", name, commitHash]
                : ["branch", name, commitHash];
              await invoke("run_git_simple", { args, cwd: repoPath });
              if (pushToRemote) {
                const remotes = await getRemotes(repoPath);
                if (remotes.length > 0) {
                  let remote: string | undefined;
                  if (remotes.length === 1) {
                    remote = remotes[0].name;
                  } else {
                    const names = remotes.map(r => r.name).join(", ");
                    remote = prompt(`Push to which remote? (${names})`, remotes[0].name)?.trim();
                  }
                  if (remote) {
                    await invoke("run_git_simple", { args: ["push", "-u", remote, name], cwd: repoPath });
                  }
                }
              }
              onRefresh();
            } catch (e) { alert(String(e)); }
          }}
          onCancel={() => setCreateBranchModal(null)}
        />
      )}
      {createTagModal && (
        <CreateTagModal
          commitHash={createTagModal}
          onConfirm={async (name) => {
            setCreateTagModal(null);
            try {
              await invoke("run_git_simple", { args: ["tag", name, createTagModal], cwd: repoPath });
              onRefresh();
            } catch (e) { alert(String(e)); }
          }}
          onCancel={() => setCreateTagModal(null)}
        />
      )}
    </div>
  );
}
