import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  listDirEntries,
  getLfsLockableExtensions,
  lfsLockFile,
} from "../../lib";
import { type TreeNode, makeNode, patchNode } from "../tabs/DirectoryTreeTab";

// ─── path helpers ─────────────────────────────────────────────────────────────

const normalizeSlashes = (p: string) => p.replace(/\\/g, "/");

/** Like patchNode but uses normalized path comparison (handles \ vs / on Windows) */
function patchNodeNorm(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode
): TreeNode[] {
  const normTarget = normalizeSlashes(targetPath);
  return nodes.map((n) => {
    if (normalizeSlashes(n.path) === normTarget) return updater(n);
    if (n.children.length > 0)
      return { ...n, children: patchNodeNorm(n.children, targetPath, updater) };
    return n;
  });
}

// ─── Workspace tree ───────────────────────────────────────────────────────────

export interface WorkspaceTreeProps {
  repoPath: string;
  refreshKey: number;
  onFileSelect?: (path: string | null) => void;
  onRefresh?: () => void;
  selectPath?: { path: string; triggerCount: number } | null;
}

export function WorkspaceTree({ repoPath, refreshKey, onFileSelect, onRefresh, selectPath }: WorkspaceTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lfsLockableExtensions, setLfsLockableExtensions] = useState<string[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  // LFS lockable 확장자 로드
  useEffect(() => {
    if (!repoPath) return;
    getLfsLockableExtensions(repoPath)
      .then(setLfsLockableExtensions)
      .catch(() => setLfsLockableExtensions([]));
  }, [repoPath]);

  const isLfsLockable = useCallback((path: string): boolean => {
    const dotIdx = path.lastIndexOf(".");
    if (dotIdx === -1) return false;
    const ext = path.substring(dotIdx).toLowerCase();
    return lfsLockableExtensions.includes(ext);
  }, [lfsLockableExtensions]);

  const handleLfsLock = useCallback(async (path: string) => {
    const relativePath = path
      .replace(repoPath, "")
      .replace(/^[/\\]/, "")
      .replace(/\\/g, "/");
    try {
      await lfsLockFile(repoPath, relativePath);
      onRefresh?.();
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
  }, [repoPath, onRefresh]);

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
    onFileSelect?.(path);
  }, [onFileSelect]);

  // Track the latest selectPath in a ref so async callbacks can read it without deps
  const selectPathRef = useRef<string | null | undefined>(selectPath?.path);
  selectPathRef.current = selectPath?.path;

  // Expands all ancestor directories of targetPath and selects the file.
  // Must be called only after root nodes are loaded.
  const expandToPath = useCallback(async (targetPath: string) => {
    const normRepo = normalizeSlashes(repoPath);
    const normTarget = normalizeSlashes(targetPath);
    if (!normTarget.startsWith(normRepo + "/")) return;

    const relative = normTarget.slice(normRepo.length + 1);
    const segments = relative.split("/");

    // Expand each ancestor directory from root down (all but the last segment = the file)
    for (let i = 0; i < segments.length - 1; i++) {
      const dirNorm = normRepo + "/" + segments.slice(0, i + 1).join("/");
      try {
        const entries = await listDirEntries(dirNorm);
        setRootNodes(prev =>
          patchNodeNorm(prev, dirNorm, node => ({
            ...node,
            children: node.loaded ? node.children : entries.map(makeNode),
            loaded: true,
            expanded: true,
          }))
        );
      } catch {
        break;
      }
    }

    setSelectedPath(normTarget);
  }, [repoPath]);

  // Ref so the load effect can call the latest expandToPath without it being a dep
  const expandToPathRef = useRef(expandToPath);
  expandToPathRef.current = expandToPath;

  // When selectPath changes on an already-mounted tree, expand immediately.
  // (Fresh-mount case is handled inside the load effect below.)
  const rootLoadedRef = useRef(false);
  useEffect(() => {
    if (selectPath && rootLoadedRef.current) {
      expandToPath(selectPath.path);
    }
  }, [selectPath, expandToPath]);

  useEffect(() => {
    if (!repoPath) return;
    rootLoadedRef.current = false;
    setLoading(true);
    listDirEntries(repoPath)
      .then((entries) => {
        setRootNodes(entries.map(makeNode));
        rootLoadedRef.current = true;
        if (selectPathRef.current) {
          // External highlight: expand the tree to the file without resetting parent's selectedFilePath
          expandToPathRef.current(selectPathRef.current);
        } else {
          setSelectedPath(repoPath);
          onFileSelect?.(null); // repo root selected = no file
        }
      })
      .catch(() => setRootNodes([]))
      .finally(() => setLoading(false));
  }, [repoPath, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(async (target: TreeNode) => {
    if (!target.is_dir) return;
    const toggleNode = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => {
        if (n.path !== target.path) return { ...n, children: toggleNode(n.children) };
        const willExpand = !n.expanded;
        if (willExpand && !n.loaded) {
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
            .catch(() => { });
          return { ...n, expanded: true };
        }
        return { ...n, expanded: willExpand };
      });
    setRootNodes((prev) => toggleNode(prev));
  }, []);

  if (loading) {
    return <div className="p-2 text-xs text-gray-400">Loading...</div>;
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto py-1 text-xs select-none">
        {/* Repo root */}
        <div
          onClick={() => handleSelect(repoPath)}
          className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer rounded-sm ${normalizeSlashes(selectedPath ?? "") === normalizeSlashes(repoPath)
            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            }`}
        >
          <span className="text-yellow-500 shrink-0">[repo]</span>
          <span className="truncate font-medium">
            {repoPath.replace(/\\/g, "/")}
          </span>
        </div>

        {rootNodes.map((node) => (
          <TreeRow
            key={node.path}
            node={node}
            depth={1}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onToggle={handleToggle}
            onContextMenu={(e, n) => setCtxMenu({ x: e.clientX, y: e.clientY, node: n })}
          />
        ))}
      </div>

      {ctxMenu && (
        <WorkspaceCtxMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          isLfsLockable={isLfsLockable(ctxMenu.node.path)}
          onClose={() => setCtxMenu(null)}
          onLfsLock={handleLfsLock}
        />
      )}
    </>
  );
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string, isDir: boolean) => void;
  onToggle: (node: TreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}

function TreeRow({ node, depth, selectedPath, onSelect, onToggle, onContextMenu }: TreeRowProps) {
  const isSelected = normalizeSlashes(selectedPath ?? "") === normalizeSlashes(node.path);
  return (
    <>
      <div
        onClick={() => { onSelect(node.path, node.is_dir); if (node.is_dir) onToggle(node); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className={`flex items-center gap-1 py-0.5 pr-1 cursor-pointer text-xs rounded-sm ${isSelected
          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
      >
        {node.is_dir ? (
          <span className="text-yellow-500 shrink-0 w-5">
            {node.expanded ? "[-]" : "[+]"}
          </span>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {node.expanded &&
        node.children.map((child) => (
          <TreeRow
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

// ─── WorkspaceTree context menu ───────────────────────────────────────────────

interface WorkspaceCtxMenuProps {
  x: number;
  y: number;
  node: TreeNode;
  isLfsLockable: boolean;
  onClose: () => void;
  onLfsLock: (path: string) => void;
}

function WorkspaceCtxMenu({ x, y, node, isLfsLockable, onClose, onLfsLock }: WorkspaceCtxMenuProps) {
  return createPortal(
    <>
      {/* 투명 오버레이: 바깥 클릭 시 닫기 */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      {/* 메뉴 본체 */}
      <div
        style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[160px]"
      >
        <button
          onClick={() => { navigator.clipboard.writeText(node.path).catch(() => { }); onClose(); }}
          className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Copy Path
        </button>
        {!node.is_dir && isLfsLockable && (
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
    </>,
    document.body
  );
}

