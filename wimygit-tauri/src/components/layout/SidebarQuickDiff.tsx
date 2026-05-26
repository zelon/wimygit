import { useState, useEffect } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  getDiff,
  getCommitDiff,
  getGitFileBlob,
  getConflictDiff,
  smudgeLfsPointer,
  runDifftool,
  readTextFile,
  type SelectedDiffInfo,
} from "../../lib";
import { DiffViewer } from "../shared/DiffViewer";
import { InteractiveDiffViewer } from "../shared/InteractiveDiffViewer";
import { ImageDiffViewer, type ImageDiffMode } from "../shared/ImageDiffViewer";

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

export interface PendingFilePreview {
  filename: string;
  staged: boolean;
  isUntracked?: boolean;
  isConflict?: boolean;
}

type ConflictViewMode = "unified" | "ours" | "theirs";

const CONFLICT_MODES: { mode: ConflictViewMode; label: string }[] = [
  { mode: "unified", label: "UNIFIED" },
  { mode: "ours", label: "BASE → OURS" },
  { mode: "theirs", label: "BASE → THEIRS" },
];

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

export interface SidebarQuickDiffProps {
  repoPath: string;
  selectedDiff?: SelectedDiffInfo | null;
  pendingFilePreview?: PendingFilePreview | null;
  onRefresh?: () => void;
}

export function SidebarQuickDiff({ repoPath, selectedDiff, pendingFilePreview, onRefresh }: SidebarQuickDiffProps) {
  const [modes, setModes] = useState<DiffMode[]>([{ kind: "combined", label: "Diff" }]);
  const [activeMode, setActiveMode] = useState<DiffModeKind>("combined");
  const [conflictViewMode, setConflictViewMode] = useState<ConflictViewMode>("unified");
  const [contextLines, setContextLines] = useState(DEFAULT_CONTEXT);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [diff, setDiff] = useState("");
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [pendingDiff, setPendingDiff] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null);
  const [imageDiffSrcs, setImageDiffSrcs] = useState<{ before: string; after: string } | null>(null);
  const [imageDiffMode, setImageDiffMode] = useState<ImageDiffMode>(
    () => (localStorage.getItem("image_diff_mode") as ImageDiffMode | null) ?? "side-by-side"
  );
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

  // ── Reset conflict view mode when file changes ──
  useEffect(() => {
    setConflictViewMode("unified");
  }, [pendingFilePreview?.filename]);

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
      // currentMode.parentRef can be stale on first render (modes state not yet updated),
      // so derive parentRef directly from selectedDiff.parents.
      const parentRef = activeMode === "combined"
        ? (selectedDiff.parents.length === 1 ? selectedDiff.parents[0] : undefined)
        : selectedDiff.parents[parseInt(activeMode.replace("parent", ""), 10)];

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
    const textParentRef = activeMode === "combined"
      ? (selectedDiff.parents.length === 1 ? selectedDiff.parents[0] : undefined)
      : selectedDiff.parents[parseInt(activeMode.replace("parent", ""), 10)];
    getCommitDiff(
      repoPath,
      selectedDiff.commitId,
      filename,
      filename2 ?? undefined,
      textParentRef,
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

    // Conflict file — show UNIFIED / BASE→OURS / BASE→THEIRS
    if (pendingFilePreview.isConflict) {
      setImagePreviewSrc(null);
      setImageDiffSrcs(null);
      setPendingLoading(true);
      getConflictDiff(repoPath, pendingFilePreview.filename, conflictViewMode, contextLines, ignoreWhitespace)
        .then((d) => setPendingDiff(d))
        .catch(() => setPendingDiff(""))
        .finally(() => setPendingLoading(false));
      return;
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
  }, [pendingFilePreview, isCommitMode, repoPath, contextLines, ignoreWhitespace, localRefresh, conflictViewMode]);

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

  useEffect(() => {
    if (!isImageDiff) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "s" || e.key === "S") {
        setImageDiffMode((prev) => {
          const next = prev === "side-by-side" ? "slider" : "side-by-side";
          localStorage.setItem("image_diff_mode", next);
          return next;
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isImageDiff]);

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
        {/* Conflict view mode buttons — only shown for conflict files */}
        {showingPendingPreview && pendingFilePreview?.isConflict && (
          <div className="flex gap-0.5 flex-1 min-w-0 overflow-x-auto">
            {CONFLICT_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => setConflictViewMode(mode)}
                className={`shrink-0 px-1.5 py-0.5 text-xs rounded transition-colors whitespace-nowrap ${conflictViewMode === mode
                  ? "bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
              >
                {label}
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
                onChange={() => { setImageDiffMode("side-by-side"); localStorage.setItem("image_diff_mode", "side-by-side"); }}
                className="cursor-pointer"
              />
              Side by side
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-600 dark:text-gray-400">
              <input
                type="radio"
                name="img-diff-mode"
                checked={imageDiffMode === "slider"}
                onChange={() => { setImageDiffMode("slider"); localStorage.setItem("image_diff_mode", "slider"); }}
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
          <span className={`shrink-0 ${pendingFilePreview.isConflict ? "text-amber-500" : "text-gray-400"}`}>
            {pendingFilePreview.isConflict ? "conflict" : pendingFilePreview.staged ? "staged" : "unstaged"}
          </span>
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
        ) : showingPendingPreview && pendingFilePreview && !pendingFilePreview.isUntracked && !pendingFilePreview.isConflict ? (
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
