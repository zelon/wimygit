import { useState, useEffect, useMemo } from "react";
import { resolve } from "@tauri-apps/api/path";
import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import {
  readTextFile,
  writeTextFile,
  gitStage,
  getGitFileBlob,
  runGit,
  runMergetool,
  type FileStatus,
} from "../../lib";
import {
  parseConflictMarkers,
  resolveConflicts,
  hasUnresolvedConflicts,
  type ConflictBlock,
  type ConflictResolution,
  type ConflictSegment,
  type ParsedConflictFile,
} from "../../lib";

export interface MergeEditorProps {
  repoPath: string;
  file: FileStatus;
  onResolved: () => void;
  onClose: () => void;
}

function b64ToText(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getCtxBefore(segments: ConflictSegment[], blockIndex: number, n = 3): string[] {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "block" && seg.blockIndex === blockIndex) {
      if (i > 0 && segments[i - 1].kind === "text") {
        return (segments[i - 1] as Extract<ConflictSegment, { kind: "text" }>).lines.slice(-n);
      }
      return [];
    }
  }
  return [];
}

function getCtxAfter(segments: ConflictSegment[], blockIndex: number, n = 3): string[] {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.kind === "block" && seg.blockIndex === blockIndex) {
      if (i + 1 < segments.length && segments[i + 1].kind === "text") {
        return (segments[i + 1] as Extract<ConflictSegment, { kind: "text" }>).lines.slice(0, n);
      }
      return [];
    }
  }
  return [];
}

function findBaseLines(
  baseAllLines: string[],
  ctxBefore: string[],
  ctxAfter: string[],
  searchFrom: number,
): { lines: string[]; nextSearchFrom: number } {
  let startIdx = searchFrom;
  let endIdx = baseAllLines.length;

  if (ctxBefore.length > 0) {
    const anchor = ctxBefore[ctxBefore.length - 1];
    for (let i = searchFrom; i < baseAllLines.length; i++) {
      if (baseAllLines[i] === anchor) {
        startIdx = i + 1;
        break;
      }
    }
  }

  if (ctxAfter.length > 0) {
    const anchor = ctxAfter[0];
    for (let i = startIdx; i < baseAllLines.length; i++) {
      if (baseAllLines[i] === anchor) {
        endIdx = i;
        break;
      }
    }
  }

  return { lines: baseAllLines.slice(startIdx, endIdx), nextSearchFrom: endIdx };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResolutionBadge({ resolution }: { resolution: ConflictResolution }) {
  if (resolution === "unresolved") {
    return (
      <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
        Unresolved
      </span>
    );
  }
  const label =
    resolution === "ours" ? "Ours" : resolution === "theirs" ? "Theirs" : "Both";
  return (
    <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium">
      ✓ {label}
    </span>
  );
}

function CodePane({ lines, colorClass }: { lines: string[]; colorClass: string }) {
  return (
    <div className={`px-2 py-1 min-h-[1.5rem] ${colorClass}`}>
      {lines.map((line, i) => (
        <div key={i} className="font-mono text-xs whitespace-pre leading-5 text-gray-800 dark:text-gray-200">
          {line || " "}
        </div>
      ))}
    </div>
  );
}

function ContextPane({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800/30">
      {lines.map((line, i) => (
        <div key={i} className="font-mono text-xs whitespace-pre leading-5 text-gray-400 dark:text-gray-500">
          {line || " "}
        </div>
      ))}
    </div>
  );
}

interface ConflictBlockRowProps {
  block: ConflictBlock;
  baseLines: string[];
  ctxBefore: string[];
  ctxAfter: string[];
  resolution: ConflictResolution;
  onResolve: (r: ConflictResolution) => void;
  currentBranch: string;
  theirsBranch: string;
}

function ConflictBlockRow({
  block, baseLines, ctxBefore, ctxAfter, resolution, onResolve, currentBranch, theirsBranch,
}: ConflictBlockRowProps) {
  const btn = "px-2 py-0.5 rounded text-xs font-medium border transition-colors";
  const divider = "divide-x divide-gray-200 dark:divide-gray-700";

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Context before */}
      {ctxBefore.length > 0 && (
        <div className={`grid grid-cols-3 ${divider}`}>
          <ContextPane lines={ctxBefore} />
          <ContextPane lines={ctxBefore} />
          <ContextPane lines={ctxBefore} />
        </div>
      )}

      {/* Pane sub-headers */}
      <div className={`grid grid-cols-3 ${divider} border-t border-gray-200 dark:border-gray-700`}>
        <div className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 truncate">
          {block.oursLabel === "HEAD" ? (currentBranch || "HEAD") : (block.oursLabel || currentBranch || "HEAD")}
        </div>
        <div className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
          BASE
        </div>
        <div className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 truncate">
          {theirsBranch || block.theirsLabel || "incoming"}
        </div>
      </div>

      {/* Conflict lines */}
      <div className={`grid grid-cols-3 ${divider}`}>
        <CodePane
          lines={block.oursLines.length > 0 ? block.oursLines : [""]}
          colorClass="bg-green-50 dark:bg-green-950/20 border-l-2 border-green-400"
        />
        <CodePane
          lines={baseLines.length > 0 ? baseLines : [""]}
          colorClass="bg-gray-50 dark:bg-gray-800/30"
        />
        <CodePane
          lines={block.theirsLines.length > 0 ? block.theirsLines : [""]}
          colorClass="bg-blue-50 dark:bg-blue-950/20 border-l-2 border-blue-400"
        />
      </div>

      {/* Action buttons */}
      <div className={`grid grid-cols-3 ${divider} bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800`}>
        <div className="px-2 py-1.5 flex items-center gap-2">
          <button
            onClick={() => onResolve("ours")}
            className={`${btn} bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40`}
          >
            ✓ Accept Ours
          </button>
          <ResolutionBadge resolution={resolution} />
        </div>
        <div className="px-2 py-1.5" />
        <div className="px-2 py-1.5 flex items-center justify-end gap-2">
          <button
            onClick={() => onResolve("theirs")}
            className={`${btn} bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40`}
          >
            ✓ Accept Theirs
          </button>
          <button
            onClick={() => onResolve("both")}
            className={`${btn} bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600`}
          >
            ⊕ Both
          </button>
        </div>
      </div>

      {/* Context after */}
      {ctxAfter.length > 0 && (
        <div className={`grid grid-cols-3 ${divider}`}>
          <ContextPane lines={ctxAfter} />
          <ContextPane lines={ctxAfter} />
          <ContextPane lines={ctxAfter} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MergeEditor({ repoPath, file, onResolved, onClose }: MergeEditorProps) {
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedConflictFile | null>(null);
  const [baseAllLines, setBaseAllLines] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<Map<number, ConflictResolution>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentBranch, setCurrentBranch] = useState("");
  const [theirsBranch, setTheirsBranch] = useState("");

  const gitFilePath = file.filename.replace(/\\/g, "/");

  useEffect(() => {
    setLoading(true);
    setError(null);
    setResolutions(new Map());
    setParsed(null);
    setBaseAllLines([]);
    setCurrentBranch("");
    setTheirsBranch("");

    (async () => {
      try {
        const absPath = await resolve(repoPath, file.filename);
        const [content, baseB64] = await Promise.all([
          readTextFile(absPath),
          getGitFileBlob(repoPath, ":1", gitFilePath).catch(() => ""),
        ]);
        const parsedFile = parseConflictMarkers(content);
        setRawContent(content);
        setParsed(parsedFile);
        if (baseB64) {
          setBaseAllLines(b64ToText(baseB64).split(/\r?\n/));
        }
        // OURS branch: symbolic-ref HEAD (fails when detached, e.g. during rebase)
        try {
          const r = await runGit(["symbolic-ref", "--short", "HEAD"], repoPath);
          if (r.exit_code === 0) {
            setCurrentBranch(r.stdout.trim());
          } else {
            // During rebase HEAD is detached — read branch from rebase state files
            for (const rel of [".git/rebase-merge/head-name", ".git/rebase-apply/head-name"]) {
              try {
                const p = await resolve(repoPath, rel);
                const txt = await readTextFile(p);
                setCurrentBranch(txt.trim().replace(/^refs\/heads\//, ""));
                break;
              } catch { /* file doesn't exist, try next */ }
            }
          }
        } catch { /* git invocation failed */ }
        // THEIRS branch: parse commit hash from theirsLabel, then name-rev
        try {
          const rawLabel = parsedFile.blocks[0]?.theirsLabel ?? "";
          // "abc1234 (branch)" → extract branch directly
          const inParen = rawLabel.match(/\(([^)]+)\)$/);
          if (inParen) {
            setTheirsBranch(inParen[1]);
          } else {
            // May be a plain commit hash → look up via name-rev
            const hashMatch = rawLabel.match(/^([0-9a-f]{7,40})/i);
            if (hashMatch) {
              const nr = await runGit(["name-rev", "--name-only", "--no-undefined", hashMatch[1]], repoPath);
              if (nr.exit_code === 0) {
                setTheirsBranch(nr.stdout.trim().replace(/[~^]\d*$/, ""));
              }
            }
          }
        } catch { /* branch lookup failed */ }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [repoPath, file.filename, gitFilePath]);

  const resolvedContent = useMemo(() => {
    if (!parsed || rawContent === null) return "";
    return resolveConflicts(parsed, resolutions, rawContent);
  }, [parsed, resolutions, rawContent]);

  const unresolvedCount = useMemo(() => {
    if (!parsed) return 0;
    return parsed.blocks.filter(
      (b) => (resolutions.get(b.index) ?? "unresolved") === "unresolved"
    ).length;
  }, [parsed, resolutions]);

  const handleResolve = (blockIndex: number, r: ConflictResolution) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(blockIndex, r);
      return next;
    });
  };

  const handleAcceptAll = (r: "ours" | "theirs") => {
    if (!parsed) return;
    setResolutions(new Map(parsed.blocks.map((b) => [b.index, r])));
  };

  const handleMarkResolved = async () => {
    if (!parsed || rawContent === null) return;

    if (hasUnresolvedConflicts(parsed, resolutions)) {
      const ok = await tauriConfirm(
        `${unresolvedCount} conflict(s) are still unresolved. Save and stage anyway?`,
        { title: "Unresolved Conflicts", kind: "warning" }
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const absPath = await resolve(repoPath, file.filename);
      await writeTextFile(absPath, resolvedContent);
      await gitStage(repoPath, [gitFilePath]);
      onResolved();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Loading conflict file…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm">
        <span className="text-red-500">{error}</span>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          ← Back
        </button>
      </div>
    );
  }

  const blocks = parsed?.blocks ?? [];
  const segments = parsed?.segments ?? [];
  const oursLabel = blocks[0]?.oursLabel || "HEAD";
  const theirsLabel = blocks[0]?.theirsLabel || "";

  // Pre-compute base lines and context for each block
  let baseSearchFrom = 0;
  const blockData = blocks.map((block) => {
    const ctxBefore = getCtxBefore(segments, block.index);
    const ctxAfter = getCtxAfter(segments, block.index);
    const { lines: bLines, nextSearchFrom } = findBaseLines(
      baseAllLines, ctxBefore, ctxAfter, baseSearchFrom
    );
    baseSearchFrom = nextSearchFrom;
    return { block, ctxBefore, ctxAfter, baseLines: bLines };
  });

  const resolveBtn = "px-2.5 py-0.5 rounded text-xs font-medium border transition-colors";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-900">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          ← Back
        </button>
        <span className="text-amber-500 shrink-0">⚠</span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1" title={file.filename}>
          {file.filename}
        </span>
        <span className="text-xs shrink-0 text-gray-500 dark:text-gray-400">
          {unresolvedCount > 0
            ? `${unresolvedCount} conflict${unresolvedCount !== 1 ? "s" : ""} remaining`
            : "✓ All resolved"}
        </span>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={() => handleAcceptAll("ours")}
          className={`${resolveBtn} bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40`}
        >
          Accept All Ours
        </button>
        <button
          onClick={() => handleAcceptAll("theirs")}
          className={`${resolveBtn} bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40`}
        >
          Accept All Theirs
        </button>
        <div className="flex-1" />
        <button
          onClick={() => runMergetool(repoPath, [file.filename])}
          className={`${resolveBtn} bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600`}
        >
          External Tool
        </button>
        <button
          onClick={handleMarkResolved}
          disabled={saving}
          className={`${resolveBtn} bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700 disabled:opacity-50`}
        >
          {saving ? "Saving…" : "Mark as Resolved"}
        </button>
      </div>

      {/* ── 3-pane column headers ── */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800">
        <div className="px-3 py-1 text-xs font-bold text-green-700 dark:text-green-400 truncate">
          OURS (HEAD) · {currentBranch || (oursLabel !== "HEAD" ? oursLabel : "…")}
        </div>
        <div className="px-3 py-1 text-xs font-bold text-gray-600 dark:text-gray-400">BASE (ancestor)</div>
        <div className="px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-400 truncate">
          THEIRS (incoming){theirsBranch ? ` · ${theirsBranch}` : theirsLabel ? ` · ${theirsLabel}` : ""}
        </div>
      </div>

      {/* ── 3-pane conflict blocks — scrollable ── */}
      <div className="flex-1 overflow-y-auto">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>No conflict markers found.</span>
            <span className="text-xs text-gray-400">File may already be resolved — click "Mark as Resolved" to stage it.</span>
          </div>
        ) : (
          blockData.map(({ block, ctxBefore, ctxAfter, baseLines }) => (
            <ConflictBlockRow
              key={block.index}
              block={block}
              baseLines={baseLines}
              ctxBefore={ctxBefore}
              ctxAfter={ctxAfter}
              resolution={resolutions.get(block.index) ?? "unresolved"}
              onResolve={(r) => handleResolve(block.index, r)}
              currentBranch={currentBranch}
              theirsBranch={theirsBranch}
            />
          ))
        )}
      </div>

      {/* ── Result pane ── */}
      <div className="h-1/3 flex flex-col border-t border-gray-200 dark:border-gray-700 shrink-0 overflow-hidden">
        <div className="flex items-center px-3 py-1 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">RESULT</span>
          <div className="flex-1" />
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {unresolvedCount === 0 ? "✓ Ready to stage" : `${unresolvedCount} unresolved — markers shown as-is`}
          </span>
        </div>
        <div className="flex-1 overflow-auto text-xs font-mono leading-5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
          {resolvedContent.split("\n").map((line, i) => {
            const isOurs = line.startsWith("<<<<<<<");
            const isSep = line === "=======";
            const isBase = line.startsWith("|||||||"); // diff3 style
            const isTheirs = line.startsWith(">>>>>>>");
            const badge = isOurs ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 whitespace-nowrap leading-none">
                {currentBranch || (oursLabel !== "HEAD" ? oursLabel : "HEAD")}
              </span>
            ) : isTheirs ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 whitespace-nowrap leading-none">
                {theirsBranch || theirsLabel || "theirs"}
              </span>
            ) : isSep || isBase ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 whitespace-nowrap leading-none">
                BASE
              </span>
            ) : null;
            return (
              <div key={i} className="flex items-center gap-1.5 px-1 min-h-[1.25rem]">
                <div className="w-20 flex-shrink-0 flex justify-end">{badge}</div>
                <span className="whitespace-pre flex-1">{line}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={handleMarkResolved}
            disabled={saving}
            className="px-3 py-1 rounded text-xs font-medium border border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "✓ Mark as Resolved"}
          </button>
        </div>
      </div>
    </div>
  );
}
