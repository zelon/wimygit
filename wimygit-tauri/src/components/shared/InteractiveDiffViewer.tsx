import { useState, useMemo, useEffect } from "react";
import {
  parseDiffIntoHunks,
  buildBlockPatch,
  buildLinePatch,
  type ParsedLine,
} from "../../lib/diff-parser";
import { gitApplyPatch } from "../../lib";

interface InteractiveDiffViewerProps {
  diff: string;
  repoPath: string;
  filename: string;
  staged: boolean; // true = viewing staged diff → button unstages; false → stages
  onApplied: () => void;
  placeholder?: string;
}

function lineBg(type: ParsedLine["type"], hovered: boolean): string {
  if (type === "added") {
    return hovered
      ? "bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-100 border-l-2 border-green-500"
      : "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-l-2 border-green-400";
  }
  if (type === "removed") {
    return hovered
      ? "bg-red-200 dark:bg-red-800/60 text-red-900 dark:text-red-100 border-l-2 border-red-500"
      : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-l-2 border-red-400";
  }
  return "text-gray-700 dark:text-gray-300";
}

export function InteractiveDiffViewer({
  diff,
  repoPath,
  filename,
  staged,
  onApplied,
  placeholder,
}: InteractiveDiffViewerProps) {
  // hoveredAt tracks which hunk+line the mouse is currently over.
  // isHovered for each line is derived from this + ctrlHeld, so pressing
  // Ctrl while hovering instantly switches between block and line highlight.
  const [hoveredAt, setHoveredAt] = useState<{ hunkIdx: number; lineIdx: number } | null>(null);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === "Control") setCtrlHeld(true); };
    const onUp   = (e: KeyboardEvent) => { if (e.key === "Control") setCtrlHeld(false); };
    const onBlur = () => setCtrlHeld(false); // guard against stuck Ctrl if window loses focus
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const fileDiffs = useMemo(() => parseDiffIntoHunks(diff), [diff]);
  const fileDiff = useMemo(
    () => fileDiffs.find((f) => f.filename === filename) ?? fileDiffs[0] ?? null,
    [fileDiffs, filename]
  );

  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {placeholder ?? "No diff to display"}
      </div>
    );
  }

  if (!fileDiff) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {placeholder ?? "No diff to display"}
      </div>
    );
  }

  const handleApply = async (patch: string, key: string) => {
    if (!patch) return;
    setApplyingKey(key);
    try {
      // staged=true: viewing staged file → reverse to unstage
      // staged=false: viewing unstaged file → apply to index (stage)
      await gitApplyPatch(repoPath, patch, true, staged);
      onApplied();
    } catch (e) {
      alert(`Failed to apply patch: ${e}`);
    } finally {
      setApplyingKey(null);
    }
  };

  const btnLabel = staged ? "−" : "+";
  const btnColor = staged
    ? "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
    : "text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200";
  const blockVerb = staged ? "Unstage" : "Stage";

  return (
    <div
      className="h-full overflow-auto"
      onMouseLeave={() => setHoveredAt(null)}
    >
      <pre className="text-xs font-mono leading-5 p-0 m-0">
        {/* File-level header lines */}
        {fileDiff.header.map((line, i) => (
          <div
            key={`fh${i}`}
            className="px-4 py-0 text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all"
          >
            {line || " "}
          </div>
        ))}

        {fileDiff.hunks.map((hunk, hunkIdx) => (
          <div key={hunkIdx}>
            {/* Hunk @@ header */}
            <div className="px-4 py-0 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium whitespace-pre-wrap break-all">
              {hunk.header}
            </div>

            {hunk.lines.map((line, lineIdx) => {
              const isChanged = line.blockId >= 0;

              // Determine if this line should be highlighted.
              // When Ctrl is held: only the exact hovered line lights up.
              // Otherwise: all lines sharing the same blockId light up.
              const isHovered =
                isChanged &&
                hoveredAt !== null &&
                hoveredAt.hunkIdx === hunkIdx &&
                (ctrlHeld
                  ? hoveredAt.lineIdx === lineIdx
                  : fileDiff.hunks[hoveredAt.hunkIdx]?.lines[hoveredAt.lineIdx]?.blockId ===
                    line.blockId);

              const blockKey = `b:${hunkIdx}:${line.blockId}`;
              const singleKey = `l:${hunkIdx}:${lineIdx}`;
              const isApplying = applyingKey === blockKey || applyingKey === singleKey;

              const prefix =
                line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

              const btnTitle = ctrlHeld
                ? `${blockVerb} this line (Ctrl+click)`
                : `${blockVerb} this block  ·  Ctrl+click to ${blockVerb.toLowerCase()} single line`;

              return (
                <div
                  key={lineIdx}
                  className={`flex items-stretch ${lineBg(line.type, isHovered)}`}
                  onMouseEnter={() =>
                    setHoveredAt(isChanged ? { hunkIdx, lineIdx } : null)
                  }
                >
                  {/* Line content */}
                  <div className="flex-1 px-4 py-0 whitespace-pre-wrap break-all min-w-0">
                    {prefix}
                    {line.content || " "}
                  </div>

                  {/* Stage/Unstage button — visible only on hover */}
                  {isChanged && (
                    <button
                      onClick={(e) => {
                        if (e.ctrlKey) {
                          handleApply(buildLinePatch(fileDiff, hunkIdx, lineIdx), singleKey);
                        } else {
                          handleApply(buildBlockPatch(fileDiff, hunkIdx, line.blockId), blockKey);
                        }
                      }}
                      disabled={applyingKey !== null}
                      title={btnTitle}
                      className={`shrink-0 w-6 text-center font-bold transition-opacity ${btnColor} disabled:opacity-30 ${
                        isHovered ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {isApplying ? "…" : btnLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </pre>
    </div>
  );
}
