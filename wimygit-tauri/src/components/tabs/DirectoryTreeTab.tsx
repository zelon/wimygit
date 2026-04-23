import { useState, useEffect, useCallback } from "react";
import {
  listDirEntries,
  openInFileManager,
  openInTerminal,
  getHistory,
  getCommitFiles,
  getCommitDiff,
  getLfsLockableExtensions,
  lfsLockFile,
  type DirEntry,
  type CommitInfo,
  type CommitFile,
} from "../../lib";
import { DiffViewer } from "../shared/DiffViewer";

interface DirectoryTreeTabProps {
  repoPath: string;
  refreshKey: number;
}

// ─── tree node ────────────────────────────────────────────────────────────────

export interface TreeNode extends DirEntry {
  children: TreeNode[];
  expanded: boolean;
  loaded: boolean;
}

export function makeNode(entry: DirEntry): TreeNode {
  return { ...entry, children: [], expanded: false, loaded: false };
}

export function patchNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode
): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) return updater(n);
    if (n.children.length > 0)
      return { ...n, children: patchNode(n.children, targetPath, updater) };
    return n;
  });
}

// ─── tree item component ──────────────────────────────────────────────────────

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: TreeNode) => void;
  onToggle: (node: TreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}

function TreeItem({ node, depth, selectedPath, onSelect, onToggle, onContextMenu }: TreeItemProps) {
  const isSelected = selectedPath === node.path;
  const indent = depth * 14;

  return (
    <>
      <div
        onClick={() => {
          onSelect(node);
          if (node.is_dir) onToggle(node);
        }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        style={{ paddingLeft: `${indent + 8}px` }}
        className={`flex items-center gap-1.5 py-0.5 pr-2 cursor-pointer text-xs rounded-sm ${
          isSelected
            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        }`}
      >
        {node.is_dir ? (
          <>
            <span className="text-gray-400 w-3 text-center select-none">
              {node.has_children ? (node.expanded ? "v" : ">") : " "}
            </span>
            <span className="text-yellow-500 select-none">
              {node.expanded ? "[−]" : "[+]"}
            </span>
          </>
        ) : (
          <span className="w-3" />
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {node.expanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onToggle={onToggle}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
}

// ─── context menu ─────────────────────────────────────────────────────────────

interface CtxMenuProps {
  x: number;
  y: number;
  node: TreeNode;
  onClose: () => void;
  onOpenExplorer: (path: string) => void;
  onOpenTerminal: (path: string) => void;
  onLfsLock?: (path: string) => void;
  isLfsLockable?: boolean;
}

function CtxMenu({ x, y, node, onClose, onOpenExplorer, onOpenTerminal, onLfsLock, isLfsLockable }: CtxMenuProps) {
  return (
    <>
      {/* 투명 오버레이: 메뉴 바깥 클릭 시 닫기 */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      {/* 컨텍스트 메뉴 본체 */}
      <div
        style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[180px]"
      >
      <button
        onClick={() => { onOpenExplorer(node.path); onClose(); }}
        className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Open in File Manager
      </button>
      <button
        onClick={() => { onOpenTerminal(node.path); onClose(); }}
        className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Open in Terminal
      </button>
      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
      <button
        onClick={() => { navigator.clipboard.writeText(node.path).catch(() => {}); onClose(); }}
        className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Copy Path
      </button>
      {!node.is_dir && isLfsLockable && onLfsLock && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            onClick={() => { onLfsLock(node.path); onClose(); }}
            className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600 dark:text-amber-400"
          >
            LFS Lock
          </button>
        </>
      )}
      </div>
    </>
  );
}

// ─── history panel (right side) ──────────────────────────────────────────────

const PAGE_SIZE = 100;

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const FILE_STATUS_ICON: Record<string, { icon: string; cls: string }> = {
  M: { icon: "M", cls: "text-yellow-600 dark:text-yellow-400" },
  A: { icon: "+", cls: "text-green-600 dark:text-green-400" },
  D: { icon: "−", cls: "text-red-600 dark:text-red-400" },
  R: { icon: "→", cls: "text-blue-600 dark:text-blue-400" },
};

interface HistoryPanelProps {
  repoPath: string;
  selectedPath: string | null;
}

function HistoryPanel({ repoPath, selectedPath }: HistoryPanelProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);
  const [diff, setDiff] = useState("");

  const relativePath = selectedPath && repoPath
    ? selectedPath.replace(repoPath, "").replace(/\\/g, "/").replace(/^\//, "")
    : "";

  const loadCommits = useCallback(async (skip = 0) => {
    if (!repoPath) return;
    if (skip === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await getHistory(repoPath, relativePath, skip, PAGE_SIZE);
      if (skip === 0) {
        setCommits(result);
        setSelectedCommit(null);
        setCommitFiles([]);
        setSelectedFile(null);
        setDiff("");
      } else {
        setCommits((prev) => [...prev, ...result]);
      }
      setHasMore(result.length === PAGE_SIZE);
    } catch {
      setCommits([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [repoPath, relativePath]);

  useEffect(() => {
    loadCommits(0);
  }, [loadCommits]);

  const handleSelectCommit = async (commit: CommitInfo) => {
    setSelectedCommit(commit);
    setSelectedFile(null);
    setDiff("");
    try {
      const files = await getCommitFiles(repoPath, commit.hash);
      setCommitFiles(files);
    } catch {
      setCommitFiles([]);
    }
  };

  const handleSelectFile = async (file: CommitFile) => {
    if (!selectedCommit) return;
    setSelectedFile(file);
    try {
      const d = await getCommitDiff(repoPath, selectedCommit.hash, file.filename, file.filename2 ?? undefined);
      setDiff(d);
    } catch {
      setDiff("");
    }
  };

  if (!selectedPath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a file or directory to view history
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Path header */}
      <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        History: {relativePath || "/"}
        <span className="ml-2 text-gray-400">({commits.length}{hasMore ? "+" : ""} commits)</span>
      </div>

      {/* Commit list */}
      <div className="h-[35%] overflow-y-auto border-b border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center h-12 text-xs text-gray-400">Loading...</div>
        ) : commits.length === 0 ? (
          <div className="flex items-center justify-center h-12 text-xs text-gray-400">No commits for this path</div>
        ) : (
          <>
            {commits.map((c) => (
              <div
                key={c.hash}
                onClick={() => handleSelectCommit(c)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-b border-gray-50 dark:border-gray-800 ${
                  selectedCommit?.hash === c.hash
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0">{c.short_hash}</span>
                <span className="flex-1 truncate text-gray-800 dark:text-gray-200">{c.message}</span>
                <span className="text-gray-400 shrink-0">{formatTimestamp(c.timestamp)}</span>
              </div>
            ))}
            {hasMore && (
              <div className="p-2 text-center">
                <button
                  onClick={() => loadCommits(commits.length)}
                  disabled={loadingMore}
                  className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* File list */}
      <div className="h-[20%] overflow-y-auto border-b border-gray-200 dark:border-gray-700">
        {commitFiles.map((f, i) => {
          const si = FILE_STATUS_ICON[f.status] ?? { icon: f.status, cls: "text-gray-500" };
          return (
            <div
              key={i}
              onClick={() => handleSelectFile(f)}
              className={`flex items-center gap-2 px-3 py-1 text-xs cursor-pointer border-b border-gray-50 dark:border-gray-800 ${
                selectedFile?.filename === f.filename
                  ? "bg-blue-50 dark:bg-blue-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span className={`font-mono font-bold w-4 shrink-0 ${si.cls}`}>{si.icon}</span>
              <span className="truncate">{f.display}</span>
            </div>
          );
        })}
      </div>

      {/* Diff */}
      <div className="flex-1 overflow-hidden">
        <DiffViewer diff={diff} placeholder="Select a file to view diff" />
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function DirectoryTreeTab({ repoPath, refreshKey }: DirectoryTreeTabProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [lfsLockableExtensions, setLfsLockableExtensions] = useState<string[]>([]);

  // lockable 확장자 여부 판별
  const isLfsLockable = useCallback((path: string): boolean => {
    const dotIdx = path.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const ext = path.substring(dotIdx).toLowerCase();
    return lfsLockableExtensions.includes(ext);
  }, [lfsLockableExtensions]);

  // repoPath 변경 시 lockable 확장자 로드
  useEffect(() => {
    if (!repoPath) return;
    getLfsLockableExtensions(repoPath)
      .then(setLfsLockableExtensions)
      .catch(() => setLfsLockableExtensions([]));
  }, [repoPath]);

  // LFS Lock 처리
  const handleLfsLock = useCallback(async (path: string) => {
    const relativePath = path
      .replace(repoPath, "")
      .replace(/^[/\\]/, "")
      .replace(/\\/g, "/");
    try {
      await lfsLockFile(repoPath, relativePath);
    } catch (e) {
      const msg = String(e);
      const match = msg.match(/already locked by\s+(\S+)/);
      const owner = match ? match[1] : null;
      alert(
        owner
          ? `LFS Lock failed: ${relativePath} is already locked by ${owner}`
          : `LFS Lock failed:\n\n${msg}`
      );
    }
  }, [repoPath]);

  // Load root
  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    listDirEntries(repoPath)
      .then((entries) => {
        setRootNodes(entries.map(makeNode));
        setSelectedPath(repoPath);
      })
      .catch(() => setRootNodes([]))
      .finally(() => setLoading(false));
  }, [repoPath, refreshKey]);

  const handleToggle = useCallback(async (target: TreeNode) => {
    if (!target.is_dir) return;

    const toggleNode = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => {
        if (n.path === target.path) {
          const willExpand = !n.expanded;
          if (willExpand && !n.loaded) {
            // async load — update after fetch
            listDirEntries(n.path)
              .then((entries) => {
                setRootNodes((prev) =>
                  patchNode(prev, n.path, (node) => ({
                    ...node,
                    children: entries.map(makeNode),
                    expanded: true,
                    loaded: true,
                  }))
                );
              })
              .catch(() => {});
            return { ...n, expanded: true };
          }
          return { ...n, expanded: willExpand };
        }
        return { ...n, children: toggleNode(n.children) };
      });

    setRootNodes((prev) => toggleNode(prev));
  }, []);

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedPath(node.path);
  }, []);

  const handleOpenExplorer = async (path: string) => {
    try { await openInFileManager(path); } catch { /* ignore */ }
  };
  const handleOpenTerminalFn = async (path: string) => {
    try { await openInTerminal(path); } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading directory tree...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: file tree */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span>Files</span>
          <div className="flex gap-1">
            <button
              onClick={() => selectedPath && handleOpenExplorer(selectedPath)}
              disabled={!selectedPath}
              title="Open in file manager"
              className="px-1.5 py-0.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
            >
              Exp
            </button>
            <button
              onClick={() => selectedPath && handleOpenTerminalFn(selectedPath)}
              disabled={!selectedPath}
              title="Open in terminal"
              className="px-1.5 py-0.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
            >
              Term
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {/* Root entry */}
          <div
            onClick={() => setSelectedPath(repoPath)}
            className={`flex items-center gap-1.5 px-2 py-0.5 cursor-pointer text-xs rounded-sm ${
              selectedPath === repoPath
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            }`}
          >
            <span className="text-yellow-500">[repo]</span>
            <span className="truncate font-medium">
              {repoPath.split(/[/\\]/).pop()}
            </span>
          </div>

          {rootNodes.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={1}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onContextMenu={(e, n) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, node: n });
              }}
            />
          ))}
        </div>
      </div>

      {/* Right: history for selected path */}
      <div className="flex-1 overflow-hidden">
        <HistoryPanel repoPath={repoPath} selectedPath={selectedPath} />
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <CtxMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          onClose={() => setCtxMenu(null)}
          onOpenExplorer={handleOpenExplorer}
          onOpenTerminal={handleOpenTerminalFn}
          onLfsLock={handleLfsLock}
          isLfsLockable={isLfsLockable(ctxMenu.node.path)}
        />
      )}
    </div>
  );
}

