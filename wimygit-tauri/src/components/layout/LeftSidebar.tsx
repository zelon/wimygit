import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  listDirEntries,
  getDiff,
  getCommitDiff,
  getGitStatus,
  getCommitParents,
  runDifftool,
  getLfsLockableExtensions,
  lfsLockFile,
  type FileStatus,
  type SelectedDiffInfo,
} from "../../lib";
import { type TreeNode, makeNode, patchNode } from "../tabs/DirectoryTreeTab";
import { DiffViewer } from "../shared/DiffViewer";

// ─── constants ────────────────────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 200;
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_MAIN_PANEL_WIDTH = 200;

type LeftTab = "workspace" | "quickdiff";

// ─── Workspace tree ───────────────────────────────────────────────────────────

interface WorkspaceTreeProps {
  repoPath: string;
  refreshKey: number;
  onFileSelect?: (path: string | null) => void;
  onRefresh?: () => void;
}

function WorkspaceTree({ repoPath, refreshKey, onFileSelect, onRefresh }: WorkspaceTreeProps) {
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

  const handleSelect = useCallback((path: string, isDir: boolean) => {
    setSelectedPath(path);
    onFileSelect?.(isDir ? null : path);
  }, [onFileSelect]);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    listDirEntries(repoPath)
      .then((entries) => {
        setRootNodes(entries.map(makeNode));
        setSelectedPath(repoPath);
        onFileSelect?.(null); // repo root selected = no file
      })
      .catch(() => setRootNodes([]))
      .finally(() => setLoading(false));
  }, [repoPath, refreshKey]);

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
          onClick={() => handleSelect(repoPath, true)}
          className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer rounded-sm ${selectedPath === repoPath
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            }`}
        >
          <span className="text-yellow-500 shrink-0">[repo]</span>
          <span className="truncate font-medium">
            {repoPath.replace(/\\/g, "/").split("/").pop()}
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
  const isSelected = selectedPath === node.path;
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

// ─── Quick Diff ───────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT = 3;
const CONTEXT_STEP = 5;

type DiffModeKind = "staged" | "working" | "combined" | `parent${number}`;

interface DiffMode {
  kind: DiffModeKind;
  label: string;
  /** For working tree: ref like "HEAD^1". For commit mode: actual parent hash. */
  parentRef?: string;
  staged?: boolean;
}

/** Modes for working tree (HEAD may be a merge commit). */
function buildWorkingModes(parents: string[]): DiffMode[] {
  if (parents.length >= 2) {
    return [
      { kind: "combined", label: "Combined Diff" },
      ...parents.map((_, i) => ({
        kind: `parent${i}` as DiffModeKind,
        label: `Diff ^${i + 1}`,
        parentRef: `HEAD^${i + 1}`,
      })),
    ];
  }
  return [
    { kind: "working", label: "Working", staged: false },
    { kind: "staged", label: "Staged", staged: true },
  ];
}

/** Modes for a selected commit from History. */
function buildCommitModes(parents: string[]): DiffMode[] {
  if (parents.length >= 2) {
    return [
      { kind: "combined", label: "Combined Diff" },
      ...parents.map((hash, i) => ({
        kind: `parent${i}` as DiffModeKind,
        label: `Diff ^${i + 1}`,
        parentRef: hash,
      })),
    ];
  }
  // Single parent or initial commit — just one "Diff" tab
  return [{ kind: "combined", label: "Diff" }];
}

interface PendingFilePreview {
  filename: string;
  staged: boolean;
}

interface SidebarQuickDiffProps {
  repoPath: string;
  refreshKey: number;
  selectedDiff?: SelectedDiffInfo | null;
  pendingFilePreview?: PendingFilePreview | null;
}

function SidebarQuickDiff({ repoPath, refreshKey, selectedDiff, pendingFilePreview }: SidebarQuickDiffProps) {
  const [modes, setModes] = useState<DiffMode[]>(buildWorkingModes([]));
  const [activeMode, setActiveMode] = useState<DiffModeKind>("working");
  const [contextLines, setContextLines] = useState(DEFAULT_CONTEXT);
  // Working-tree only: file list + internal selection
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null);
  const [diff, setDiff] = useState("");
  const [fullDiff, setFullDiff] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);
  // Pending file preview (from PendingTab clicks) — separate state to avoid conflicts
  const [pendingDiff, setPendingDiff] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  // When user clicks a file in the internal list, override pending preview
  const [internalOverride, setInternalOverride] = useState(false);

  const isCommitMode = !!selectedDiff;

  // ── Rebuild modes when commit selection or repo changes ──
  useEffect(() => {
    if (selectedDiff) {
      const newModes = buildCommitModes(selectedDiff.parents);
      setModes(newModes);
      setActiveMode(newModes[0].kind);
    } else {
      if (!repoPath) return;
      getCommitParents(repoPath, "HEAD")
        .then((parents) => {
          const newModes = buildWorkingModes(parents);
          setModes(newModes);
          setActiveMode(newModes[0].kind);
        })
        .catch(() => {
          const fallback = buildWorkingModes([]);
          setModes(fallback);
          setActiveMode(fallback[0].kind);
        });
    }
  }, [selectedDiff, repoPath, refreshKey]);

  const currentMode = modes.find((m) => m.kind === activeMode) ?? modes[0];

  // ── Pending file preview (from PendingTab) ──
  useEffect(() => {
    if (!pendingFilePreview || isCommitMode || !repoPath) {
      setPendingDiff("");
      return;
    }
    setInternalOverride(false); // reset override when new external preview arrives
    setPendingLoading(true);
    getDiff(repoPath, pendingFilePreview.staged, pendingFilePreview.filename, contextLines)
      .then((d) => setPendingDiff(d))
      .catch(() => setPendingDiff(""))
      .finally(() => setPendingLoading(false));
  }, [pendingFilePreview, isCommitMode, repoPath, contextLines]);

  // ── Working tree: refresh file list ──
  useEffect(() => {
    if (isCommitMode || !repoPath) return;
    setSelectedFile(null);
    setDiff("");
    setFullDiff("");
    getGitStatus(repoPath)
      .then((status) => {
        const staged = currentMode?.staged === true;
        setFiles(staged ? status.staged : [...status.modified, ...status.untracked]);
      })
      .catch(() => setFiles([]));
  }, [repoPath, refreshKey, activeMode, isCommitMode]);

  // ── Fetch diff ──
  useEffect(() => {
    if (!repoPath) return;
    setLoadingDiff(true);

    if (isCommitMode && selectedDiff) {
      // Commit mode: get diff for the selected file
      getCommitDiff(
        repoPath,
        selectedDiff.commitId,
        selectedDiff.file.filename,
        selectedDiff.file.filename2 ?? undefined,
        currentMode?.parentRef,
        contextLines,
      )
        .then((d) => setDiff(d))
        .catch(() => setDiff(""))
        .finally(() => setLoadingDiff(false));
    } else {
      // Working tree mode
      getDiff(repoPath, currentMode?.staged ?? false, undefined, contextLines, currentMode?.parentRef)
        .then((d) => {
          setFullDiff(d);
          if (!selectedFile) setDiff(d);
        })
        .catch(() => { setFullDiff(""); setDiff(""); })
        .finally(() => setLoadingDiff(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, refreshKey, activeMode, contextLines, selectedDiff]);

  // ── Working tree: select file ──
  const handleSelectFile = async (file: FileStatus | null) => {
    setInternalOverride(true); // user clicked internally → override pending preview
    setSelectedFile(file);
    if (!file) { setDiff(fullDiff); return; }
    setLoadingDiff(true);
    try {
      const d = await getDiff(repoPath, currentMode?.staged ?? false, file.filename, contextLines, currentMode?.parentRef);
      setDiff(d);
    } catch { setDiff(""); }
    finally { setLoadingDiff(false); }
  };

  // ── Diff Tool ──
  const handleDiffTool = async () => {
    const args: string[] = [];
    if (isCommitMode && selectedDiff) {
      if (currentMode?.parentRef) {
        args.push(currentMode.parentRef, selectedDiff.commitId);
      } else if (selectedDiff.parents.length > 0) {
        args.push(selectedDiff.parents[0], selectedDiff.commitId);
      } else {
        args.push(selectedDiff.commitId);
      }
      args.push("--", selectedDiff.file.filename);
    } else if (showingPendingPreview && pendingFilePreview) {
      if (pendingFilePreview.staged) args.push("--cached");
      args.push("--", pendingFilePreview.filename);
    } else {
      if (!selectedFile) return;
      if (currentMode?.parentRef) args.push(currentMode.parentRef);
      else if (currentMode?.staged) args.push("--cached");
      args.push("--", selectedFile.filename);
    }
    try { await runDifftool(repoPath, args); } catch { /* ignore */ }
  };

  const changeContext = (delta: number) => setContextLines((prev) => Math.max(0, prev + delta));

  // ── Derived display state ──
  const showingPendingPreview = !isCommitMode && !!pendingFilePreview && !internalOverride;
  const displayDiff = showingPendingPreview ? pendingDiff : diff;
  const displayLoading = showingPendingPreview ? pendingLoading : loadingDiff;
  const diffToolEnabled = isCommitMode || showingPendingPreview || !!selectedFile;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-0.5 px-1 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        <div className="flex gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {modes.map((m) => (
            <button
              key={m.kind}
              onClick={() => setActiveMode(m.kind)}
              className={`shrink-0 px-1.5 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${activeMode === m.kind
                  ? "bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 shrink-0 ml-auto">
          <button
            onClick={handleDiffTool}
            disabled={!diffToolEnabled}
            title="Open in Diff Tool (git difftool)"
            className="px-1.5 py-0.5 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40"
          >
            Diff Tool
          </button>
          <button
            onClick={() => changeContext(CONTEXT_STEP)}
            title={`More context (+${CONTEXT_STEP} lines)`}
            className="px-1.5 py-0.5 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            More
          </button>
          <button
            onClick={() => changeContext(-CONTEXT_STEP)}
            disabled={contextLines === 0}
            title={`Less context (-${CONTEXT_STEP} lines)`}
            className="px-1.5 py-0.5 text-xs rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40"
          >
            Less
          </button>
        </div>
      </div>

      {/* ── File header (commit mode or pending preview) ── */}
      {isCommitMode && selectedDiff && (
        <div className="shrink-0 px-2 py-1 text-xs border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 text-gray-700 dark:text-gray-300 truncate">
          <span className="text-gray-400 mr-1">{selectedDiff.commit.short_hash}</span>
          <span title={selectedDiff.file.display}>{selectedDiff.file.display}</span>
        </div>
      )}
      {showingPendingPreview && pendingFilePreview && (
        <div className="shrink-0 px-2 py-1 text-xs border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 text-gray-700 dark:text-gray-300 truncate flex items-center gap-1">
          <span className="text-gray-400 shrink-0">{pendingFilePreview.staged ? "staged" : "unstaged"}</span>
          <span title={pendingFilePreview.filename}>{pendingFilePreview.filename}</span>
        </div>
      )}

      {/* ── Working tree file list (only when not in pending preview) ── */}
      {!isCommitMode && !showingPendingPreview && files.length > 0 && (
        <div className="shrink-0 max-h-24 overflow-y-auto border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleSelectFile(null)}
            className={`w-full text-left px-2 py-0.5 text-xs border-b border-gray-100 dark:border-gray-800 ${!selectedFile
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            ≡ All ({files.length})
          </button>
          {files.map((f) => (
            <button
              key={f.filename}
              onClick={() => handleSelectFile(f)}
              className={`w-full text-left px-2 py-0.5 text-xs border-b border-gray-100 dark:border-gray-800 truncate ${selectedFile?.filename === f.filename
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              title={f.filename}
            >
              {f.filename}
            </button>
          ))}
        </div>
      )}

      {/* ── Diff viewer ── */}
      <div className="flex-1 overflow-hidden">
        {displayLoading ? (
          <div className="p-2 text-xs text-gray-400">Loading...</div>
        ) : (
          <DiffViewer
            diff={displayDiff}
            placeholder={isCommitMode ? "No diff available" : "No changes"}
          />
        )}
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 px-2 py-0.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <span>
          {isCommitMode ? "Commit diff" : showingPendingPreview ? "Pending preview" : "Working tree"}
        </span>
        <span>Context: {contextLines} lines</span>
      </div>
    </div>
  );
}

// ─── LeftSidebar ─────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  repoPath: string;
  refreshKey: number;
  selectedDiff?: SelectedDiffInfo | null;
  pendingFilePreview?: PendingFilePreview | null;
  onFileSelect?: (path: string | null) => void;
  onRefresh?: () => void;
}

export function LeftSidebar({ repoPath, refreshKey, selectedDiff, pendingFilePreview, onFileSelect, onRefresh }: LeftSidebarProps) {
  const [width, setWidth] = useState(() =>
    parseInt(localStorage.getItem("sidebar_width") ?? String(DEFAULT_SIDEBAR_WIDTH))
  );
  const [activeTab, setActiveTab] = useState<LeftTab>(() =>
    (localStorage.getItem("sidebar_tab") as LeftTab | null) ?? "workspace"
  );

  // Auto-switch to Quick Diff when a commit file is selected
  const prevSelectedDiff = useRef<SelectedDiffInfo | null | undefined>(undefined);
  useEffect(() => {
    if (selectedDiff && selectedDiff !== prevSelectedDiff.current) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
    prevSelectedDiff.current = selectedDiff;
  }, [selectedDiff]);

  // ── horizontal resize ──
  const startHResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      const maxW = window.innerWidth - MIN_MAIN_PANEL_WIDTH;
      const newW = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxW, startW + ev.clientX - startX));
      setWidth(newW);
      localStorage.setItem("sidebar_width", String(newW));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  const handleTabChange = (tab: LeftTab) => {
    setActiveTab(tab);
    localStorage.setItem("sidebar_tab", tab);
  };

  return (
    <div style={{ width }} className="flex shrink-0">
      {/* Panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">

        {/* ── Tab bar ── */}
        <div className="shrink-0 flex border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          {([
            { id: "workspace", label: "Workspace" },
            { id: "quickdiff", label: "Quick Diff" },
          ] as { id: LeftTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "workspace" && (
            <WorkspaceTree repoPath={repoPath} refreshKey={refreshKey} onFileSelect={onFileSelect} onRefresh={onRefresh} />
          )}
          {activeTab === "quickdiff" && (
            <SidebarQuickDiff
              repoPath={repoPath}
              refreshKey={refreshKey}
              selectedDiff={selectedDiff}
              pendingFilePreview={pendingFilePreview}
            />
          )}
        </div>
      </div>

      {/* ── Horizontal drag handle (right edge) ── */}
      <div
        onMouseDown={startHResize}
        className="w-1.5 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors shrink-0"
        title="Drag to resize"
      />
    </div>
  );
}
