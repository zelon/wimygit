import { useState, useEffect, useRef, useCallback } from "react";
import { getFileCommits, getBlameAtCommit, type FileCommit, type BlameEntry } from "../../lib";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePath(p: string) {
  return p.replace(/\\/g, "/");
}

/** Return file path relative to repo root (forward slashes). */
function relativePath(repoPath: string, filePath: string): string {
  const base = normalizePath(repoPath).replace(/\/$/, "") + "/";
  const file = normalizePath(filePath);
  return file.startsWith(base) ? file.slice(base.length) : file;
}

/** Convert Unix timestamp (seconds) to a human-readable relative string. */
function relativeTime(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSec);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)}주 전`;
  if (diff < 86400 * 365) return `${Math.floor(diff / 86400 / 30)}개월 전`;
  return `${Math.floor(diff / 86400 / 365)}년 전`;
}

/** Deterministic pastel background for a commit hash. */
function commitBg(hash: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(hash.length, 8); i++) {
    h = (h * 31 + hash.charCodeAt(i)) & 0xffff;
  }
  return `hsl(${h % 360}, 55%, 95%)`;
}

// ─── TrackBar ─────────────────────────────────────────────────────────────────

interface TrackBarProps {
  commits: FileCommit[]; // display order: oldest (left, idx=0) → newest (right, idx=last)
  selectedIdx: number;
  onChange: (idx: number) => void;
}

function TrackBar({ commits, selectedIdx, onChange }: TrackBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const idxFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || commits.length <= 1) return selectedIdx;
      // 12px padding on each side (px-3)
      const usable = rect.width - 24;
      const x = clientX - rect.left - 12;
      const ratio = Math.max(0, Math.min(1, x / usable));
      return Math.round(ratio * (commits.length - 1));
    },
    [commits.length, selectedIdx]
  );

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(idxFromClientX(e.clientX));
    const onMove = (ev: MouseEvent) => onChange(idxFromClientX(ev.clientX));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (commits.length === 0) return null;

  return (
    <div
      ref={trackRef}
      className="relative h-8 flex items-center select-none px-3 cursor-pointer"
      onMouseDown={startDrag}
    >
      {/* Track line */}
      <div className="absolute left-3 right-3 h-0.5 bg-gray-300 dark:bg-gray-600 rounded pointer-events-none" />

      {/* Dots */}
      {commits.map((commit, idx) => {
        const pct = commits.length === 1 ? 50 : (idx / (commits.length - 1)) * 100;
        const isSelected = idx === selectedIdx;
        return (
          <div
            key={commit.hash}
            style={{
              position: "absolute",
              // Position within padded area: 12px + pct% of (100% - 24px)
              left: `calc(12px + (100% - 24px) * ${pct / 100})`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: isSelected ? 10 : 1,
            }}
            title={`${commit.short_hash} · ${commit.summary}`}
            className={`rounded-full transition-all pointer-events-none ${
              isSelected
                ? "w-4 h-4 bg-blue-500 border-2 border-white dark:border-gray-800 shadow-md"
                : "w-2.5 h-2.5 bg-gray-400 dark:bg-gray-500"
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── BlameView ────────────────────────────────────────────────────────────────

interface BlameViewProps {
  entries: BlameEntry[];
  loading: boolean;
  error: string | null;
}

function BlameView({ entries, loading, error }: BlameViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 text-xs text-gray-400 dark:text-gray-500">
        Loading blame…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 text-xs text-red-500 dark:text-red-400 px-4 text-center">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-xs text-gray-400 dark:text-gray-500">
        파일 내용 없음
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto font-mono text-xs">
      {entries.map((entry, idx) => {
        const showAuthor =
          idx === 0 || entries[idx - 1].commit_hash !== entry.commit_hash;
        const bg = showAuthor ? commitBg(entry.commit_hash) : undefined;

        return (
          <div
            key={idx}
            className="flex items-stretch min-w-max border-b border-gray-100 dark:border-gray-800/40 last:border-b-0"
            style={bg ? { backgroundColor: bg } : undefined}
          >
            {/* Author column */}
            <div
              className="w-44 shrink-0 px-2 py-px border-r border-gray-200 dark:border-gray-700 overflow-hidden"
              title={
                showAuthor
                  ? `${entry.author_name} <${entry.author_email}>\n${entry.summary}`
                  : undefined
              }
            >
              {showAuthor && (
                <span className="text-gray-500 dark:text-gray-400 truncate flex leading-5">
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate mr-1">
                    {entry.author_name}
                  </span>
                  <span className="shrink-0">· {relativeTime(entry.author_time)}</span>
                </span>
              )}
            </div>

            {/* Commit ID column */}
            <div
              className="w-16 shrink-0 px-2 py-px border-r border-gray-200 dark:border-gray-700 overflow-hidden"
              title={showAuthor ? `${entry.commit_hash}\n${entry.summary}` : undefined}
            >
              {showAuthor && (
                <span className="text-blue-500 dark:text-blue-400 leading-5">
                  {entry.short_hash}
                </span>
              )}
            </div>

            {/* Line number */}
            <div className="w-10 shrink-0 text-right pr-2 pl-1 py-px text-gray-400 dark:text-gray-600 border-r border-gray-200 dark:border-gray-700 select-none leading-5">
              {entry.line_no}
            </div>

            {/* Code content */}
            <div className="flex-1 pl-3 pr-4 py-px whitespace-pre text-gray-800 dark:text-gray-200 leading-5">
              {entry.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TimeLapsePanel ───────────────────────────────────────────────────────────

interface TimeLapsePanelProps {
  repoPath: string;
  /** Absolute path to the selected file */
  filePath: string;
  onClose: () => void;
}

export function TimeLapsePanel({ repoPath, filePath, onClose }: TimeLapsePanelProps) {
  const fileName = normalizePath(filePath).split("/").pop() ?? filePath;
  const relPath = relativePath(repoPath, filePath);

  // Commits ordered oldest → newest for trackbar display
  const [displayCommits, setDisplayCommits] = useState<FileCommit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(true);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  // Selected dot index (0 = oldest, last = newest/HEAD)
  const [selectedIdx, setSelectedIdx] = useState(-1);

  // Blame data for the selected commit
  const [blameEntries, setBlameEntries] = useState<BlameEntry[]>([]);
  const [blameLoading, setBlameLoading] = useState(false);
  const [blameError, setBlameError] = useState<string | null>(null);

  // Load file commit history on mount
  useEffect(() => {
    setCommitsLoading(true);
    setCommitsError(null);
    getFileCommits(repoPath, relPath)
      .then((commits) => {
        // git log returns newest first → reverse for left=oldest display order
        const ordered = [...commits].reverse();
        setDisplayCommits(ordered);
        setSelectedIdx(ordered.length > 0 ? ordered.length - 1 : -1);
      })
      .catch((e) => setCommitsError(String(e)))
      .finally(() => setCommitsLoading(false));
  }, [repoPath, relPath]);

  // Load blame whenever selected commit changes
  useEffect(() => {
    if (selectedIdx < 0 || displayCommits.length === 0) return;
    const commit = displayCommits[selectedIdx];
    setBlameLoading(true);
    setBlameError(null);
    getBlameAtCommit(repoPath, commit.hash, relPath)
      .then(setBlameEntries)
      .catch((e) => {
        setBlameError(String(e));
        setBlameEntries([]);
      })
      .finally(() => setBlameLoading(false));
  }, [selectedIdx, displayCommits, repoPath, relPath]);

  // Keyboard navigation (← →  to move between commits, Esc to close)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(displayCommits.length - 1, i + 1));
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const selectedCommit =
    selectedIdx >= 0 && selectedIdx < displayCommits.length
      ? displayCommits[selectedIdx]
      : null;

  const hasContent = !commitsError && !commitsLoading && displayCommits.length > 0;

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex flex-col h-full bg-white dark:bg-gray-900 outline-none"
    >
      {/* ── Title bar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-1 truncate min-w-0">
          TimeLapse:{" "}
          <span className="font-mono text-blue-600 dark:text-blue-400">{fileName}</span>
        </span>
        {commitsLoading && (
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">Loading…</span>
        )}
        {hasContent && (
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {displayCommits.length}개 커밋 · ← → 이동
          </span>
        )}
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-white text-sm leading-none"
        >
          ×
        </button>
      </div>

      {/* ── Empty / error states ── */}
      {commitsError && (
        <div className="flex-1 flex items-center justify-center text-xs text-red-500 dark:text-red-400 px-4 text-center">
          {commitsError}
        </div>
      )}
      {!commitsError && !commitsLoading && displayCommits.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
          이 파일의 git 히스토리가 없습니다.
        </div>
      )}

      {/* ── Main content ── */}
      {hasContent && (
        <>
          {/* Column headers */}
          <div className="shrink-0 flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono text-xs text-gray-500 dark:text-gray-400 font-medium select-none">
            <div className="w-44 shrink-0 px-2 py-0.5 border-r border-gray-200 dark:border-gray-700">
              Author · Date
            </div>
            <div className="w-16 shrink-0 px-2 py-0.5 border-r border-gray-200 dark:border-gray-700">
              Commit
            </div>
            <div className="w-10 shrink-0 text-right pr-2 py-0.5 border-r border-gray-200 dark:border-gray-700">
              Ln
            </div>
            <div className="flex-1 pl-3 py-0.5 font-sans">Content</div>
          </div>

          {/* Blame view */}
          <BlameView entries={blameEntries} loading={blameLoading} error={blameError} />

          {/* ── TrackBar + commit info ── */}
          <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {/* oldest / newest labels */}
            <div className="flex items-center px-4 pt-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">oldest</span>
              <div className="flex-1" />
              <span className="text-xs text-gray-400 dark:text-gray-500">newest</span>
            </div>

            <TrackBar
              commits={displayCommits}
              selectedIdx={selectedIdx}
              onChange={setSelectedIdx}
            />

            {/* Commit info row */}
            {selectedCommit && (
              <div className="flex items-start gap-2 px-3 pb-2 pt-0.5">
                <span className="shrink-0 font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded leading-4">
                  {selectedCommit.short_hash}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate leading-5">
                    {selectedCommit.summary}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-4">
                    {selectedCommit.author_name}
                    {selectedCommit.author_email && (
                      <span className="text-gray-400 dark:text-gray-500">
                        {" "}&lt;{selectedCommit.author_email}&gt;
                      </span>
                    )}
                    {" · "}
                    {selectedCommit.author_date.slice(0, 16)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
