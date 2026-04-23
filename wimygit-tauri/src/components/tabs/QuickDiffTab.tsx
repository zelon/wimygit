import { useState, useEffect } from "react";
import { getDiff, getGitStatus, type FileStatus } from "../../lib";
import { DiffViewer } from "../shared/DiffViewer";

interface QuickDiffTabProps {
  repoPath: string;
  refreshKey: number;
}

type DiffMode = "staged" | "working";

function getStatusLabel(file: FileStatus): string {
  const s = file.staged_status ?? file.unstaged_status;
  switch (s) {
    case "Added": return "+";
    case "Deleted": return "−";
    case "Renamed": return "→";
    case "Untracked": return "?";
    default: return "M";
  }
}

function getStatusColor(file: FileStatus): string {
  const s = file.staged_status ?? file.unstaged_status;
  switch (s) {
    case "Added": return "text-green-600 dark:text-green-400";
    case "Deleted": return "text-red-600 dark:text-red-400";
    case "Renamed": return "text-blue-600 dark:text-blue-400";
    case "Untracked": return "text-gray-500 dark:text-gray-400";
    default: return "text-yellow-600 dark:text-yellow-400";
  }
}

export function QuickDiffTab({ repoPath, refreshKey }: QuickDiffTabProps) {
  const [mode, setMode] = useState<DiffMode>("staged");
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileStatus | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [fullDiff, setFullDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file list based on mode
  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setSelectedFile(null);
    setDiff("");
    setFullDiff("");

    getGitStatus(repoPath)
      .then((status) => {
        if (mode === "staged") {
          setFiles(status.staged);
        } else {
          setFiles([...status.modified, ...status.untracked]);
        }
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repoPath, refreshKey, mode]);

  // Load full diff for the current mode
  useEffect(() => {
    if (!repoPath) return;
    setDiffLoading(true);
    getDiff(repoPath, mode === "staged")
      .then((d) => {
        setFullDiff(d);
        // If no file is selected, show full diff
        if (!selectedFile) setDiff(d);
      })
      .catch(() => setFullDiff(""))
      .finally(() => setDiffLoading(false));
  }, [repoPath, refreshKey, mode]);

  // Load diff for selected file
  const handleSelectFile = async (file: FileStatus | null) => {
    setSelectedFile(file);
    if (!file) {
      setDiff(fullDiff);
      return;
    }
    setDiffLoading(true);
    try {
      const d = await getDiff(repoPath, mode === "staged", file.filename);
      setDiff(d);
    } catch (e) {
      setDiff("");
    } finally {
      setDiffLoading(false);
    }
  };

  const modeLabel = mode === "staged" ? "Staged Changes" : "Working Tree";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: file list ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Mode toggle */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex gap-1 bg-gray-200 dark:bg-gray-700 rounded p-0.5">
            {(["staged", "working"] as DiffMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1 text-xs rounded transition-colors ${
                  mode === m
                    ? "bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {m === "staged" ? "Staged" : "Working"}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
            {error}
          </div>
        )}

        {/* File list header */}
        <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          {modeLabel} ({files.length})
        </div>

        {/* "All files" row */}
        <button
          onClick={() => handleSelectFile(null)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs text-left border-b border-gray-100 dark:border-gray-800 ${
            !selectedFile
              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}
        >
          <span className="font-mono w-4">≡</span>
          <span>All files</span>
        </button>

        {/* Individual files */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-16 text-xs text-gray-400">
              Loading...
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-xs text-gray-400">
              No {mode === "staged" ? "staged" : "unstaged"} changes
            </div>
          ) : (
            files.map((file) => {
              const isSelected = selectedFile?.filename === file.filename;
              return (
                <button
                  key={file.filename}
                  onClick={() => handleSelectFile(file)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left border-b border-gray-100 dark:border-gray-800 ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className={`font-mono font-bold w-4 shrink-0 ${getStatusColor(file)}`}>
                    {getStatusLabel(file)}
                  </span>
                  <span className="truncate text-gray-800 dark:text-gray-200">
                    {file.filename}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: diff viewer ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 flex items-center gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {selectedFile ? selectedFile.filename : `All ${modeLabel.toLowerCase()}`}
          </span>
          {selectedFile && (
            <button
              onClick={() => handleSelectFile(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Show all"
            >
              ✕
            </button>
          )}
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-hidden">
          {diffLoading ? (
            <div className="flex items-center justify-center h-full text-xs text-gray-400">
              Loading diff...
            </div>
          ) : (
            <DiffViewer
              diff={diff}
              placeholder={`No ${modeLabel.toLowerCase()} to display`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
