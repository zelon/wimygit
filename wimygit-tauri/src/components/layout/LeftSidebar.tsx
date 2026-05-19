import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  listDirEntries,
  getDiff,
  getCommitDiff,
  getGitFileBlob,
  smudgeLfsPointer,
  runDifftool,
  getLfsLockableExtensions,
  lfsLockFile,
  readTextFile,
  type SelectedDiffInfo,
} from "../../lib";
import { type TreeNode, makeNode, patchNode } from "../tabs/DirectoryTreeTab";
import { DiffViewer } from "../shared/DiffViewer";
import { InteractiveDiffViewer } from "../shared/InteractiveDiffViewer";
import { ImageDiffViewer, type ImageDiffMode } from "../shared/ImageDiffViewer";

// ─── constants ────────────────────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 200;
const MIN_MAIN_PANEL_WIDTH = 200;

type LeftTab = "workspace" | "quickdiff";

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

interface WorkspaceTreeProps {
  repoPath: string;
  refreshKey: number;
  onFileSelect?: (path: string | null) => void;
  onRefresh?: () => void;
  selectPath?: { path: string; triggerCount: number } | null;
}

function WorkspaceTree({ repoPath, refreshKey, onFileSelect, onRefresh, selectPath }: WorkspaceTreeProps) {
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

// ─── Quick Diff ───────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT = 3;
const CONTEXT_STEP = 5;

type DiffModeKind = "combined" | `parent${number}`;

interface DiffMode {
  kind: DiffModeKind;
  label: string;
  parentRef?: string; // actual parent hash for getCommitDiff / difftool
}

/** Returns diff modes based on parent count — one "Diff" tab for single-parent, Combined+parent tabs for merges. */
function buildDiffModes(parents: string[]): DiffMode[] {
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
  return [{ kind: "combined", label: "Diff", parentRef: parents[0] }];
}

interface PendingFilePreview {
  filename: string;
  staged: boolean;
  isUntracked?: boolean;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico", ".tiff", ".avif"]);
const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".bmp": "image/bmp", ".ico": "image/x-icon", ".tiff": "image/tiff", ".avif": "image/avif",
};

const CHECKER = "repeating-conic-gradient(#d1d5db 0% 25%, #ffffff 0% 50%) 0 0 / 12px 12px";

const LFS_POINTER_MAGIC = "version https://git-lfs.github.com/spec/v1";

/**
 * Convert raw bytes (from readFile) to a data URL for the given MIME type.
 * If the bytes are a Git LFS pointer, `git lfs smudge` is invoked via Tauri
 * to fetch the real binary before encoding.
 */
async function bytesToDataUrl(bytes: Uint8Array, mime: string, repoPath: string): Promise<string> {
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, LFS_POINTER_MAGIC.length));
  if (prefix === LFS_POINTER_MAGIC) {
    const pointer = new TextDecoder("utf-8").decode(bytes);
    const b64 = await smudgeLfsPointer(repoPath, pointer);
    return `data:${mime};base64,${b64}`;
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function base64ByteSize(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = (b64.match(/=+$/) ?? [""])[0].length;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function SingleImagePreview({ src, label, filename }: { src: string; label: string; filename?: string }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return (
    <div className="flex flex-col h-full">
      {/* Info bar */}
      <div className="shrink-0 flex items-center justify-center gap-2 px-2 py-1 border-b border-gray-700 text-xs bg-gray-900 select-none">
        <span className="inline-flex items-center overflow-hidden rounded shrink-0">
          <span className={`px-1.5 py-0.5 font-semibold text-white leading-4 ${label === "NEW FILE" ? "bg-orange-600" : label === "DELETED" ? "bg-red-700" : "bg-gray-500"}`}>
            {label}
          </span>
        </span>
        <span className="text-gray-400">{natural ? `${natural.w}×${natural.h}` : "—"}</span>
        <span className="text-gray-500">{formatBytes(base64ByteSize(src))}</span>
      </div>
      {/* Image area */}
      <div className="flex-1 bg-black flex items-center justify-center overflow-auto p-2">
        <img src={src} alt={filename} className="max-w-full max-h-full block" style={{ background: CHECKER }} />
      </div>
    </div>
  );
}

interface SidebarQuickDiffProps {
  repoPath: string;
  selectedDiff?: SelectedDiffInfo | null;
  pendingFilePreview?: PendingFilePreview | null;
  onRefresh?: () => void;
}

function SidebarQuickDiff({ repoPath, selectedDiff, pendingFilePreview, onRefresh }: SidebarQuickDiffProps) {
  const [modes, setModes] = useState<DiffMode[]>([{ kind: "combined", label: "Diff" }]);
  const [activeMode, setActiveMode] = useState<DiffModeKind>("combined");
  const [contextLines, setContextLines] = useState(DEFAULT_CONTEXT);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [diff, setDiff] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [pendingDiff, setPendingDiff] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);
  const [imageDiffSrcs, setImageDiffSrcs] = useState<{ before: string; after: string } | null>(null);
  const [imageDiffMode, setImageDiffMode] = useState<ImageDiffMode>("side-by-side");
  const [localRefresh, setLocalRefresh] = useState(0);

  const isCommitMode = !!selectedDiff;
  const showingPendingPreview = !isCommitMode && !!pendingFilePreview;
  const currentMode = modes.find((m) => m.kind === activeMode) ?? modes[0];

  // ── Rebuild commit modes when selection changes ──
  useEffect(() => {
    if (!selectedDiff) return;
    const newModes = buildDiffModes(selectedDiff.parents);
    setModes(newModes);
    setActiveMode(newModes[0].kind);
  }, [selectedDiff]);

  // ── Commit diff (from History tab) ──
  useEffect(() => {
    if (!selectedDiff || !repoPath) {
      setDiff("");
      setImagePreviewSrc(null);
      setImageDiffSrcs(null);
      return;
    }

    const { filename, filename2, status } = selectedDiff.file;
    const currentFilename = filename2 ?? filename;
    const ext = ("." + currentFilename.split(".").pop()).toLowerCase();

    if (IMAGE_EXTS.has(ext)) {
      setDiff("");
      setImagePreviewSrc(null);
      setImageDiffSrcs(null);
      setLoadingDiff(true);

      const mime = IMAGE_MIME[ext] ?? "application/octet-stream";
      const parentRef = currentMode.parentRef;

      if (status === "A" || !parentRef) {
        // 추가된 파일 — 현재 커밋의 이미지만 표시
        getGitFileBlob(repoPath, selectedDiff.commitId, currentFilename)
          .then((b64) => setImagePreviewSrc(`data:${mime};base64,${b64}`))
          .catch(() => setImagePreviewSrc(null))
          .finally(() => setLoadingDiff(false));
      } else if (status === "D") {
        // 삭제된 파일 — 부모 커밋의 이미지만 표시
        getGitFileBlob(repoPath, parentRef, filename)
          .then((b64) => setImagePreviewSrc(`data:${mime};base64,${b64}`))
          .catch(() => setImagePreviewSrc(null))
          .finally(() => setLoadingDiff(false));
      } else {
        // 수정/이름변경 — before/after 비교
        Promise.all([
          getGitFileBlob(repoPath, parentRef, filename)
            .then((b64) => `data:${mime};base64,${b64}`)
            .catch(() => null),
          getGitFileBlob(repoPath, selectedDiff.commitId, currentFilename)
            .then((b64) => `data:${mime};base64,${b64}`)
            .catch(() => null),
        ])
          .then(([beforeSrc, afterSrc]) => {
            if (beforeSrc && afterSrc) {
              setImageDiffSrcs({ before: beforeSrc, after: afterSrc });
            } else if (afterSrc) {
              setImagePreviewSrc(afterSrc);
            } else if (beforeSrc) {
              setImagePreviewSrc(beforeSrc);
            }
          })
          .finally(() => setLoadingDiff(false));
      }
      return;
    }

    setImagePreviewSrc(null);
    setImageDiffSrcs(null);
    setLoadingDiff(true);
    getCommitDiff(
      repoPath,
      selectedDiff.commitId,
      filename,
      filename2 ?? undefined,
      currentMode.parentRef,
      contextLines,
      ignoreWhitespace,
    )
      .then((d) => setDiff(d))
      .catch(() => setDiff(""))
      .finally(() => setLoadingDiff(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath, selectedDiff, activeMode, contextLines, ignoreWhitespace]);

  // ── Pending file preview (from PendingTab) ──
  useEffect(() => {
    if (!pendingFilePreview || isCommitMode || !repoPath) {
      setPendingDiff(""); setImagePreviewSrc(null); setImageDiffSrcs(null); return;
    }

    const ext = ("." + pendingFilePreview.filename.split(".").pop()).toLowerCase();
    const absPath = repoPath.replace(/\\/g, "/") + "/" + pendingFilePreview.filename;

    if (pendingFilePreview.isUntracked) {
      setPendingLoading(true);
      setImagePreviewSrc(null);
      setImageDiffSrcs(null);
      setPendingDiff("");

      if (IMAGE_EXTS.has(ext)) {
        const mime = IMAGE_MIME[ext] ?? "application/octet-stream";
        readFile(absPath)
          .then((bytes) => bytesToDataUrl(bytes, mime, repoPath))
          .then((src) => setImagePreviewSrc(src))
          .catch(() => setImagePreviewSrc(null))
          .finally(() => setPendingLoading(false));
      } else {
        readTextFile(absPath)
          .then((content) => {
            const lines = content.split("\n");
            const header = `--- /dev/null\n+++ b/${pendingFilePreview.filename}\n@@ -0,0 +1,${lines.length} @@\n`;
            setPendingDiff(header + lines.map((l) => `+${l}`).join("\n"));
          })
          .catch(() => setPendingDiff(""))
          .finally(() => setPendingLoading(false));
      }
      return;
    }

    if (IMAGE_EXTS.has(ext)) {
      const mime = IMAGE_MIME[ext] ?? "application/octet-stream";
      // before = HEAD version (fails for new files → plain image view)
      // after  = staged ? index (:0) : working dir file
      setPendingLoading(true);
      setImagePreviewSrc(null);
      setImageDiffSrcs(null);
      setPendingDiff("");

      const afterPromise = pendingFilePreview.staged
        ? getGitFileBlob(repoPath, ":0", pendingFilePreview.filename)
            .then((b64) => `data:${mime};base64,${b64}`)
            .catch(() => null)
        : readFile(absPath)
            .then((bytes) => bytesToDataUrl(bytes, mime, repoPath))
            .catch(() => null);

      Promise.all([
        getGitFileBlob(repoPath, "HEAD", pendingFilePreview.filename)
          .then((b64) => `data:${mime};base64,${b64}`)
          .catch(() => null),
        afterPromise,
      ])
        .then(([beforeSrc, afterSrc]) => {
          if (beforeSrc && afterSrc) {
            setImageDiffSrcs({ before: beforeSrc, after: afterSrc });
          } else if (afterSrc) {
            setImagePreviewSrc(afterSrc);
          }
        })
        .finally(() => setPendingLoading(false));
      return;
    }

    setImagePreviewSrc(null);
    setImageDiffSrcs(null);
    setPendingLoading(true);
    getDiff(repoPath, pendingFilePreview.staged, pendingFilePreview.filename, contextLines, undefined, ignoreWhitespace)
      .then((d) => setPendingDiff(d))
      .catch(() => setPendingDiff(""))
      .finally(() => setPendingLoading(false));
  }, [pendingFilePreview, isCommitMode, repoPath, contextLines, ignoreWhitespace, localRefresh]);

  // ── Diff Tool ──
  const handleDiffTool = async () => {
    const args: string[] = [];
    if (isCommitMode && selectedDiff) {
      if (currentMode.parentRef) args.push(currentMode.parentRef, selectedDiff.commitId);
      else args.push(selectedDiff.commitId);
      args.push("--", selectedDiff.file.filename);
    } else if (showingPendingPreview && pendingFilePreview) {
      if (pendingFilePreview.staged) args.push("--cached");
      args.push("--", pendingFilePreview.filename);
    } else {
      return;
    }
    try { await runDifftool(repoPath, args); } catch { /* ignore */ }
  };

  const changeContext = (delta: number) => setContextLines((prev) => Math.max(0, prev + delta));

  const displayDiff = showingPendingPreview ? pendingDiff : diff;
  const displayLoading = showingPendingPreview ? pendingLoading : loadingDiff;
  const isImageDiff = !displayLoading && (!!imageDiffSrcs || !!imagePreviewSrc);

  // label for SingleImagePreview in commit mode
  const commitImageLabel = isCommitMode && selectedDiff
    ? selectedDiff.file.status === "D" ? "DELETED" : "NEW FILE"
    : "NEW FILE";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-0.5 px-1 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        {/* Commit parent mode buttons — only shown for merge commits */}
        {isCommitMode && modes.length > 1 && (
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
        )}
        {isImageDiff ? (
          /* Image diff mode: show Side by side / Slider radio buttons */
          <div className="flex gap-3 ml-auto items-center text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-600 dark:text-gray-400">
              <input
                type="radio"
                name="img-diff-mode"
                checked={imageDiffMode === "side-by-side"}
                onChange={() => setImageDiffMode("side-by-side")}
                className="cursor-pointer"
              />
              Side by side
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-600 dark:text-gray-400">
              <input
                type="radio"
                name="img-diff-mode"
                checked={imageDiffMode === "slider"}
                onChange={() => setImageDiffMode("slider")}
                className="cursor-pointer"
              />
              Before / After slider
            </label>
          </div>
        ) : (
          /* Text diff mode: show normal controls */
          <div className="flex gap-0.5 shrink-0 ml-auto items-center">
            <label className="flex items-center gap-0.5 cursor-pointer select-none text-xs text-gray-600 dark:text-gray-400 px-1" title="Ignore whitespace changes (-w)">
              <input
                type="checkbox"
                checked={ignoreWhitespace}
                onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                className="w-3 h-3 cursor-pointer"
              />
              Ignore Whitespace
            </label>
            <button
              onClick={handleDiffTool}
              disabled={!isCommitMode && !showingPendingPreview}
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
        )}
      </div>

      {/* ── File header ── */}
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

      {/* ── Diff viewer / Image preview ── */}
      <div className="flex-1 overflow-hidden">
        {displayLoading ? (
          <div className="p-2 text-xs text-gray-400">Loading...</div>
        ) : imageDiffSrcs ? (
          <ImageDiffViewer
            beforeSrc={imageDiffSrcs.before}
            afterSrc={imageDiffSrcs.after}
            filename={isCommitMode ? (selectedDiff?.file.display ?? selectedDiff?.file.filename) : pendingFilePreview?.filename}
            mode={imageDiffMode}
          />
        ) : imagePreviewSrc ? (
          <SingleImagePreview
            src={imagePreviewSrc}
            label={isCommitMode ? commitImageLabel : (pendingFilePreview?.isUntracked ? "UNTRACKED" : "NEW FILE")}
            filename={isCommitMode ? (selectedDiff?.file.filename2 ?? selectedDiff?.file.filename) : pendingFilePreview?.filename}
          />
        ) : showingPendingPreview && pendingFilePreview && !pendingFilePreview.isUntracked ? (
          <InteractiveDiffViewer
            diff={pendingDiff}
            repoPath={repoPath}
            filename={pendingFilePreview.filename}
            staged={pendingFilePreview.staged}
            onApplied={() => {
              setLocalRefresh((k) => k + 1);
              onRefresh?.();
            }}
            placeholder="No changes"
          />
        ) : (
          <DiffViewer
            diff={displayDiff}
            placeholder={isCommitMode ? "No diff available" : showingPendingPreview ? "No changes" : "Select a file from History or Pending Changes"}
          />
        )}
      </div>

      {/* ── Footer — hidden in image diff mode ── */}
      {!isImageDiff && (
        <div className="shrink-0 px-2 py-0.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <span>{isCommitMode ? "Commit diff" : showingPendingPreview ? "Pending preview" : "—"}</span>
          <span>Context: {contextLines} lines</span>
        </div>
      )}
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
  highlightPath?: { path: string; triggerCount: number } | null;
}

export function LeftSidebar({ repoPath, refreshKey, selectedDiff, pendingFilePreview, onFileSelect, onRefresh, highlightPath }: LeftSidebarProps) {
  const [width, setWidth] = useState(() => {
    const quarter = Math.round(window.innerWidth / 4);
    return Math.max(MIN_SIDEBAR_WIDTH, quarter);
  });
  const [activeTab, setActiveTab] = useState<LeftTab>(() =>
    (localStorage.getItem("sidebar_tab") as LeftTab | null) ?? "workspace"
  );

  // Auto-switch to Quick Diff when a commit file or pending file is selected
  const prevSelectedDiff = useRef<SelectedDiffInfo | null | undefined>(undefined);
  useEffect(() => {
    if (selectedDiff && selectedDiff !== prevSelectedDiff.current) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
    prevSelectedDiff.current = selectedDiff;
  }, [selectedDiff]);

  const prevPendingFilePreview = useRef<PendingFilePreview | null | undefined>(undefined);
  useEffect(() => {
    if (pendingFilePreview && pendingFilePreview !== prevPendingFilePreview.current) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
    prevPendingFilePreview.current = pendingFilePreview;
  }, [pendingFilePreview]);

  // Auto-switch to Workspace tab when highlightPath is set
  useEffect(() => {
    if (highlightPath) {
      setActiveTab("workspace");
      localStorage.setItem("sidebar_tab", "workspace");
    }
  }, [highlightPath]); // object reference always changes on each click, so effect always fires

  // ── double-click to toggle 3:1 / 1:3 ratio ──
  const handleDoubleClick = useCallback(() => {
    const total = window.innerWidth;
    const quarter = Math.round(total / 4);
    const threeQuarter = Math.round((total * 3) / 4);
    const tolerance = 30;

    const is3to1 = Math.abs(width - threeQuarter) < tolerance;
    const is1to3 = Math.abs(width - quarter) < tolerance;

    let newW: number;
    if (is3to1) {
      newW = quarter;       // 3:1 → 1:3
    } else if (is1to3) {
      newW = threeQuarter;  // 1:3 → 3:1
    } else {
      // not at either ratio: left is smaller → 3:1, right is smaller → 1:3
      newW = width < total / 2 ? threeQuarter : quarter;
    }

    newW = Math.max(MIN_SIDEBAR_WIDTH, Math.min(total - MIN_MAIN_PANEL_WIDTH, newW));
    setWidth(newW);
  }, [width]);

  // ── horizontal resize ──
  const startHResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      const maxW = window.innerWidth - MIN_MAIN_PANEL_WIDTH;
      const newW = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxW, startW + ev.clientX - startX));
      setWidth(newW);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  // ── clamp sidebar when window shrinks ──
  useEffect(() => {
    const onResize = () => {
      setWidth((prev) => {
        const maxW = window.innerWidth - MIN_MAIN_PANEL_WIDTH;
        if (prev > maxW) return Math.max(MIN_SIDEBAR_WIDTH, maxW);
        return prev;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleTabChange = (tab: LeftTab) => {
    setActiveTab(tab);
    localStorage.setItem("sidebar_tab", tab);
  };

  return (
    <div style={{ width, minWidth: MIN_SIDEBAR_WIDTH }} className="flex shrink-0">
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
            <WorkspaceTree repoPath={repoPath} refreshKey={refreshKey} onFileSelect={onFileSelect} onRefresh={onRefresh} selectPath={highlightPath} />
          )}
          {activeTab === "quickdiff" && (
            <SidebarQuickDiff
              repoPath={repoPath}
              selectedDiff={selectedDiff}
              pendingFilePreview={pendingFilePreview}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>

      {/* ── Horizontal drag handle (right edge) ── */}
      <div
        onMouseDown={startHResize}
        onDoubleClick={handleDoubleClick}
        className="w-3 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors shrink-0"
        title="Drag to resize / Double-click to toggle 3:1 ratio"
      />
    </div>
  );
}
