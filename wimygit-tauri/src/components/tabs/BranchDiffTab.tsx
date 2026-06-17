import { useState, useEffect, useRef, useMemo } from "react";
import {
  getBranches,
  getCurrentBranch,
  getBranchDiffCommits,
  getBranchDiffFiles,
  getBranchFileDiff,
  type BranchInfo,
  type BranchDiffCommit,
  type BranchDiffFile,
} from "../../lib";

interface BranchDiffTabProps {
  repoPath: string;
  refreshKey: number;
  onFileSelect: (diff: string, filename: string) => void;
  initialBase?: string;
  initialCompare?: string;
}

export function BranchDiffTab({ repoPath, refreshKey, onFileSelect, initialBase, initialCompare }: BranchDiffTabProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [base, setBase] = useState("");
  const [compare, setCompare] = useState("");
  const [commits, setCommits] = useState<BranchDiffCommit[]>([]);
  const [allFiles, setAllFiles] = useState<BranchDiffFile[]>([]);
  const [commitFiles, setCommitFiles] = useState<BranchDiffFile[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGenRef = useRef(0);

  // Load branches and set defaults
  useEffect(() => {
    if (!repoPath) return;
    (async () => {
      try {
        const [branchList, current] = await Promise.all([
          getBranches(repoPath),
          getCurrentBranch(repoPath),
        ]);
        setBranches(branchList);

        const localBranches = branchList.filter((b) => !b.is_remote);
        // Accept any ref (branch name or commit hash) directly
        const effectiveCompare = initialCompare || current;
        setCompare(effectiveCompare);

        const effectiveBase = initialBase || (() => {
          const main = localBranches.find((b) => b.name === "main" || b.name === "master");
          return main && main.name !== effectiveCompare
            ? main.name
            : localBranches.find((b) => b.name !== effectiveCompare)?.name ?? "";
        })();
        setBase(effectiveBase);
      } catch {
        // ignore
      }
    })();
  }, [repoPath, refreshKey]);

  // Load commits + files when base/compare changes
  useEffect(() => {
    if (!base || !compare || base === compare) {
      setCommits([]);
      setAllFiles([]);
      setSelectedCommit(null);
      setSelectedFile(null);
      return;
    }
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setSelectedCommit(null);
    setSelectedFile(null);
    Promise.all([
      getBranchDiffCommits(repoPath, base, compare),
      getBranchDiffFiles(repoPath, base, compare),
    ])
      .then(([commitList, fileList]) => {
        if (gen !== fetchGenRef.current) return;
        setCommits(commitList);
        setAllFiles(fileList);
        setError(null);
      })
      .catch((e) => {
        if (gen === fetchGenRef.current) setError(String(e));
      })
      .finally(() => {
        if (gen === fetchGenRef.current) setLoading(false);
      });
  }, [repoPath, base, compare]);

  // Load files for a specific commit
  useEffect(() => {
    if (!selectedCommit) { setCommitFiles([]); return; }
    getBranchDiffFiles(repoPath, base, compare, selectedCommit)
      .then(setCommitFiles)
      .catch(() => setCommitFiles([]));
  }, [selectedCommit, repoPath, base, compare]);

  const displayFiles = selectedCommit ? commitFiles : allFiles;

  const handleFileClick = async (filename: string) => {
    setSelectedFile(filename);
    setFileLoading(true);
    try {
      const diff = await getBranchFileDiff(
        repoPath, base, compare, filename,
        selectedCommit ?? undefined
      );
      onFileSelect(diff, filename);
    } catch {
      onFileSelect("", filename);
    } finally {
      setFileLoading(false);
    }
  };

  const handleCommitClick = (hash: string) => {
    setSelectedCommit((prev) => (prev === hash ? null : hash));
    setSelectedFile(null);
  };

  const handleAllClick = () => {
    setSelectedCommit(null);
    setSelectedFile(null);
  };

  const totalAdded = allFiles.reduce((s, f) => s + f.added, 0);
  const totalDeleted = allFiles.reduce((s, f) => s + f.deleted, 0);

  const allBranchOptions = useMemo(() => {
    const names = branches.map((b) => b.name);
    // Include current base/compare even if they're commit hashes (not branch names)
    const extras = [base, compare].filter((v) => v && !names.includes(v));
    return [...new Set([...extras, ...names])];
  }, [branches, base, compare]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Branch selectors */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Base:</span>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allBranchOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <span className="text-gray-400 font-mono">⇄</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Compare:</span>
            <select
              value={compare}
              onChange={(e) => setCompare(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allBranchOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          {base === compare && base && (
            <span className="text-xs text-amber-500">Same branch selected</span>
          )}
        </div>

        {/* Stats bar */}
        {!loading && commits.length > 0 && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>{commits.length} commit{commits.length !== 1 ? "s" : ""} ahead</span>
            <span>·</span>
            <span>{allFiles.length} file{allFiles.length !== 1 ? "s" : ""} changed</span>
            <span>·</span>
            <span className="text-green-600 dark:text-green-400">+{totalAdded}</span>
            <span className="text-red-500 dark:text-red-400">−{totalDeleted}</span>
          </div>
        )}
        {!loading && commits.length === 0 && base && compare && base !== compare && (
          <div className="mt-2 text-xs text-gray-400">No commits ahead</div>
        )}
      </div>

      {error && (
        <div className="shrink-0 mx-4 mt-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading...</div>
      ) : (
        /* Split pane: commits (left) | files (right) */
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Commits panel */}
          <div className="w-2/5 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700">
            <div className="shrink-0 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              Commits
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* "All commits" pinned row */}
              <button
                onClick={handleAllClick}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 transition-colors ${
                  selectedCommit === null
                    ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  All ({commits.length} commit{commits.length !== 1 ? "s" : ""})
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  <span className="text-green-600 dark:text-green-400">+{totalAdded}</span>
                  {" "}
                  <span className="text-red-500 dark:text-red-400">−{totalDeleted}</span>
                  {" · "}
                  {allFiles.length} file{allFiles.length !== 1 ? "s" : ""}
                </div>
              </button>

              {/* Individual commits */}
              {commits.map((commit) => (
                <button
                  key={commit.hash}
                  onClick={() => handleCommitClick(commit.hash)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 transition-colors ${
                    selectedCommit === commit.hash
                      ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="text-sm text-gray-800 dark:text-gray-200 truncate" title={commit.subject}>
                    {commit.subject}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                    <span className="font-mono">{commit.short_hash}</span>
                    <span>{commit.author}</span>
                    <span>{commit.date.slice(0, 10)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Files panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {selectedCommit
                ? `Files in ${commits.find((c) => c.hash === selectedCommit)?.short_hash ?? ""} (${commitFiles.length})`
                : `Changed Files (${allFiles.length})`}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {displayFiles.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400">No files changed</div>
              ) : (
                displayFiles.map((file) => (
                  <button
                    key={file.filename}
                    onClick={() => handleFileClick(file.filename)}
                    disabled={fileLoading}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-800 transition-colors flex items-center gap-2 ${
                      selectedFile === file.filename
                        ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate font-mono" title={file.filename}>
                      {file.filename}
                    </span>
                    <span className="shrink-0 text-xs text-green-600 dark:text-green-400 w-10 text-right">
                      {file.added > 0 ? `+${file.added}` : ""}
                    </span>
                    <span className="shrink-0 text-xs text-red-500 dark:text-red-400 w-10 text-right">
                      {file.deleted > 0 ? `−${file.deleted}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
