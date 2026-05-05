import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { remove } from "@tauri-apps/plugin-fs";
import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";
import {
  getGitStatus,
  gitStage,
  gitUnstage,
  gitDiscard,
  gitCommit,
  getLastCommitMessage,
  gitDiff,
  runDifftool,
  runMergetool,
  openInFileManager,
  type GitStatus,
  type FileStatus,
  getLfsLocks,
  getLfsLockableExtensions,
  lfsUnlockFile,
  readTextFile,
  writeTextFile,
  type LfsLock,
} from "../../lib";
import { getSyncStatus, SyncStatusBar, type SyncStatus } from "./SyncStatusBar";

const AI_API_KEY_STORAGE = "wimygit_ai_api_key";

async function generateAiCommitMessage(stagedDiff: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Write a concise git commit message (one line, under 72 chars) for the following staged diff. Output only the commit message text, nothing else.\n\n${stagedDiff.slice(0, 8000)}`,
            },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${response.status} ${err}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

interface PendingTabProps {
  repoPath: string;
  refreshKey: number;
  onFilePreview?: (filename: string, staged: boolean, isUntracked?: boolean) => void;
  onLfsLockCountChange?: (count: number) => void;
  onShowInWorkspaceFile?: (absolutePath: string) => void;
  onShowInHistoryFile?: (absolutePath: string) => void;
}

function statusIcon(file: FileStatus): { icon: string; cls: string } {
  if (file.is_unmerged) return { icon: "!", cls: "text-yellow-500" };
  const s = file.staged_status ?? file.unstaged_status;
  if (s === "Added" || s === "Untracked") return { icon: "+", cls: "text-green-600 dark:text-green-400" };
  if (s === "Deleted") return { icon: "−", cls: "text-red-600 dark:text-red-400" };
  if (s === "Renamed") return { icon: "→", cls: "text-blue-600 dark:text-blue-400" };
  return { icon: "M", cls: "text-yellow-600 dark:text-yellow-400" };
}

// ─── API Key Input ────────────────────────────────────────────────────────────

interface ApiKeyInputProps {
  initial: string;
  onSave: (key: string) => void;
  onCancel: () => void;
}

function ApiKeyInput({ initial, onSave, onCancel }: ApiKeyInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-xs">
      <span className="font-medium text-yellow-800 dark:text-yellow-200">Google Gemini API Key</span>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(value); if (e.key === "Escape") onCancel(); }}
        placeholder="AIza..."
        autoFocus
        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-1 justify-end">
        <button onClick={onCancel} className="px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
        <button onClick={() => onSave(value)} className="px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
      </div>
    </div>
  );
}

// ─── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileStatus;
  isSelected: boolean;
  isCheckSelected?: boolean;
  isLocked?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  actions: React.ReactNode;
}

function FileRow({ file, isSelected, isCheckSelected, isLocked, onClick, onContextMenu, actions }: FileRowProps) {
  const { icon, cls } = statusIcon(file);
  const highlight = isSelected || isCheckSelected;
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`flex items-center gap-1.5 px-3 py-0.5 text-xs cursor-pointer border-b border-gray-50 dark:border-gray-800 select-none ${highlight
        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
        : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        }`}
    >
      <span className={`font-mono font-bold w-3.5 shrink-0 ${cls}`}>{icon}</span>
      {isLocked && (
        <span title="LFS Locked" className="text-amber-500 shrink-0 text-xs">🔒</span>
      )}
      <span className="flex-1 truncate" title={file.filename}>{file.filename}</span>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </div>
  );
}

// ─── Only-Locked file row (파일이 잠겨있지만 수정되지 않은 경우) ──────────────

interface LockedOnlyRowProps {
  lock: LfsLock;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function LockedOnlyRow({ lock, onContextMenu }: LockedOnlyRowProps) {
  return (
    <div
      onContextMenu={onContextMenu}
      className="flex items-center gap-1.5 px-3 py-0.5 text-xs cursor-default border-b border-gray-50 dark:border-gray-800 select-none hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
    >
      <span className="font-mono font-bold w-3.5 shrink-0 text-amber-500">🔒</span>
      <span className="flex-1 truncate" title={lock.filename}>{lock.filename}</span>
      <span className="text-gray-400 shrink-0">Locked</span>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface UnstagedCtxMenuProps {
  x: number;
  y: number;
  repoPath: string;
  files: string[];
  hasUntracked: boolean;
  hasUnmerged: boolean;
  isLocked: boolean;
  isModified: boolean;
  onClose: () => void;
  onStage: (files: string[]) => void;
  onRevert: (files: string[]) => void;
  onRefresh: () => void;
  onDiff: (filename: string) => void;
  onDeleteFiles: (files: string[]) => void;
  onUnlockLfs: () => void;
  onShowInWorkspaceFile?: (absolutePath: string) => void;
  onShowInHistoryFile?: (absolutePath: string) => void;
}

function UnstagedCtxMenu({
  x, y, repoPath, files, hasUntracked, hasUnmerged,
  isLocked, isModified,
  onClose, onStage, onRevert, onRefresh, onDiff, onDeleteFiles, onUnlockLfs,
  onShowInWorkspaceFile, onShowInHistoryFile,
}: UnstagedCtxMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴가 화면 밖으로 나가지 않도록 위치 조정
  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newTop = y;
      let newLeft = x;
      if (y + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height - 4;
      if (x + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width - 4;
      if (newTop !== y || newLeft !== x) setPos({ top: newTop, left: newLeft });
    }
  }, [x, y]);

  const isSingle = files.length === 1;
  const firstFile = files[0];

  // .gitignore에 추가할 폴더 경로 후보 목록 계산
  const folderCandidates = isSingle
    ? firstFile.split("/").slice(0, -1).reduce<string[]>((acc, part) => {
      acc.push(acc.length > 0 ? `${acc[acc.length - 1]}/${part}` : part);
      return acc;
    }, [])
    : [];

  const [showGitignoreSub, setShowGitignoreSub] = useState(false);

  const btnClass = "w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between";
  const dangerClass = "w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 flex items-center justify-between";
  const kbdClass = "ml-4 text-[11px] text-gray-400 dark:text-gray-500";
  const sep = <div className="border-t border-gray-200 dark:border-gray-700 my-1" />;

  const handleAddToGitignore = async (pattern: string) => {
    try {
      const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
      const gitignorePath = `${repoPath}${sep}.gitignore`;
      // 디스크의 현재 .gitignore 읽기 (없으면 빈 문자열)
      const currentContent = await readTextFile(gitignorePath).catch(() => "");
      const newContent = currentContent.endsWith("\n") || currentContent === ""
        ? `${currentContent}${pattern}\n`
        : `${currentContent}\n${pattern}\n`;
      await writeTextFile(gitignorePath, newContent);
      onClose();
      onRefresh();
    } catch (e) {
      alert(`Failed to update .gitignore: ${e}`);
      onClose();
    }
  };

  return createPortal(
    <>
      {/* 투명 오버레이: 바깥 클릭 시 닫기 */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={menuRef}
        style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[200px]"
      >
        {/* MergeTool — unmerged 파일, Stage 보다 먼저 표시 */}
        {hasUnmerged && isSingle && (
          <>
            <button className={btnClass} onClick={async () => {
              try { await runMergetool(repoPath, [firstFile]); } catch { /* ignore */ }
              onClose();
              onRefresh();
            }}>
              <span>MergeTool</span>
            </button>
            {sep}
          </>
        )}

        {/* Stage */}
        <button className={btnClass} onClick={() => { onStage(files); onClose(); }}>
          <span>Stage{!isSingle ? ` (${files.length} files)` : ""}</span>
        </button>

        {/* Diff — 단일 파일, untracked 아닌 경우만 */}
        {isSingle && !hasUntracked && (
          <button className={btnClass} onClick={() => { onDiff(firstFile); onClose(); }}>
            <span>Diff</span>
            <span className={kbdClass}>Ctrl+D</span>
          </button>
        )}

        {/* Revert — untracked 아닌 경우만 */}
        {!hasUntracked && (
          <button className={dangerClass} onClick={() => { onRevert(files); onClose(); }}>
            <span>Revert{!isSingle ? ` (${files.length} files)` : ""}</span>
            <span className={kbdClass}>Ctrl+R</span>
          </button>
        )}

        {sep}

        {/* Refresh */}
        <button className={btnClass} onClick={() => { onRefresh(); onClose(); }}>
          <span>Refresh</span>
          <span className={kbdClass}>F5</span>
        </button>

        {/* Open Explorer — 단일 파일만 */}
        {isSingle && (
          <button className={btnClass} onClick={async () => {
            try {
              const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
              const dir = firstFile.includes("/") || firstFile.includes("\\")
                ? `${repoPath}${sep}${firstFile.substring(0, firstFile.lastIndexOf(firstFile.includes("/") ? "/" : "\\"))}`
                : repoPath;
              await openInFileManager(dir);
            } catch { /* ignore */ }
            onClose();
          }}>
            <span>Open Explorer</span>
            <span className={kbdClass}>Ctrl+Shift+S</span>
          </button>
        )}

        {/* Show in workspace — 단일 파일만 */}
        {isSingle && onShowInWorkspaceFile && (
          <button className={btnClass} onClick={() => {
            const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
            const fullPath = `${repoPath}${sep}${firstFile.replace(/\//g, sep)}`;
            onShowInWorkspaceFile(fullPath);
            onClose();
          }}>
            <span>Show in Workspace</span>
          </button>
        )}

        {/* Show in History — 단일 파일만 */}
        {isSingle && onShowInHistoryFile && (
          <button className={btnClass} onClick={() => {
            const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
            const fullPath = `${repoPath}${sep}${firstFile.replace(/\//g, sep)}`;
            onShowInHistoryFile(fullPath);
            onClose();
          }}>
            <span>Show in History</span>
          </button>
        )}

        {sep}

        {/* Delete Local File */}
        <button className={dangerClass} onClick={async () => { await onDeleteFiles(files); onClose(); }}>
          <span>Delete Local File{!isSingle ? ` (${files.length} files)` : ""}</span>
        </button>

        {/* Add to .gitignore — 단일 파일인 경우 */}
        {isSingle && (
          <div
            className="relative"
            onMouseEnter={() => setShowGitignoreSub(true)}
            onMouseLeave={() => setShowGitignoreSub(false)}
          >
            <button className={btnClass}>
              <span>Add to .gitignore</span>
              <span className="ml-2 text-gray-400">▸</span>
            </button>
            {showGitignoreSub && (
              <div
                style={{ position: "absolute", top: 0, left: "100%", zIndex: 10000 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[160px]"
              >
                {/* 파일 자체를 .gitignore에 추가 */}
                <button
                  className={btnClass}
                  onClick={() => handleAddToGitignore(firstFile)}
                >
                  {firstFile}
                </button>
                {/* 폴더 경로 후보 */}
                {folderCandidates.map((folder) => (
                  <button
                    key={folder}
                    className={btnClass}
                    onClick={() => handleAddToGitignore(folder + "/")}
                  >
                    {folder}/
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LFS Unlock — LFS 잠긴 파일만 */}
        {isLocked && (
          <>
            {sep}
            <button
              className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600 dark:text-amber-400"
              onClick={() => {
                if (isModified) {
                  alert("Cannot unlock a modified file. Revert changes first.");
                  onClose();
                  return;
                }
                onUnlockLfs();
                onClose();
              }}
            >
              Unlock (LFS)
            </button>
          </>
        )}
      </div>
    </>,
    document.body
  );
}

// ─── Staged Context Menu ──────────────────────────────────────────────────────

interface StagedCtxMenuProps {
  x: number;
  y: number;
  repoPath: string;
  files: string[];
  onClose: () => void;
  onUnstage: (files: string[]) => void;
  onDiff: (filename: string) => void;
  onRefresh: () => void;
  onShowInWorkspaceFile?: (absolutePath: string) => void;
  onShowInHistoryFile?: (absolutePath: string) => void;
}

function StagedCtxMenu({ x, y, repoPath, files, onClose, onUnstage, onDiff, onRefresh, onShowInWorkspaceFile, onShowInHistoryFile }: StagedCtxMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newTop = y;
      let newLeft = x;
      if (y + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height - 4;
      if (x + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width - 4;
      if (newTop !== y || newLeft !== x) setPos({ top: newTop, left: newLeft });
    }
  }, [x, y]);

  const isSingle = files.length === 1;
  const firstFile = files[0];
  const btnClass = "w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between";
  const kbdClass = "ml-4 text-[11px] text-gray-400 dark:text-gray-500";

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={menuRef}
        style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[200px]"
      >
        <button className={btnClass} onClick={() => { onUnstage(files); onClose(); }}>
          <span>Unstage{!isSingle ? ` (${files.length} files)` : ""}</span>
        </button>

        {isSingle && (
          <button className={btnClass} onClick={() => { onDiff(firstFile); onClose(); }}>
            <span>Diff</span>
            <span className={kbdClass}>Ctrl+D</span>
          </button>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

        <button className={btnClass} onClick={() => { onRefresh(); onClose(); }}>
          <span>Refresh</span>
        </button>

        {isSingle && (
          <button className={btnClass} onClick={async () => {
            try {
              const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
              const dir = firstFile.includes("/") || firstFile.includes("\\")
                ? `${repoPath}${sep}${firstFile.substring(0, firstFile.lastIndexOf(firstFile.includes("/") ? "/" : "\\"))}`
                : repoPath;
              await openInFileManager(dir);
            } catch { /* ignore */ }
            onClose();
          }}>
            <span>Open Explorer</span>
            <span className={kbdClass}>Ctrl+Shift+S</span>
          </button>
        )}

        {isSingle && onShowInWorkspaceFile && (
          <button className={btnClass} onClick={() => {
            const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
            const fullPath = `${repoPath}${sep}${firstFile.replace(/\//g, sep)}`;
            onShowInWorkspaceFile(fullPath);
            onClose();
          }}>
            <span>Show in Workspace</span>
          </button>
        )}

        {isSingle && onShowInHistoryFile && (
          <button className={btnClass} onClick={() => {
            const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
            const fullPath = `${repoPath}${sep}${firstFile.replace(/\//g, sep)}`;
            onShowInHistoryFile(fullPath);
            onClose();
          }}>
            <span>Show in History</span>
          </button>
        )}
      </div>
    </>,
    document.body
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  count: number;
  action?: { label: string; onClick: () => void };
}

function SectionHeader({ label, count, action }: SectionHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-3 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {label} <span className="text-gray-400">({count})</span>
      </span>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PendingTab({ repoPath, refreshKey, onFilePreview, onLfsLockCountChange, onShowInWorkspaceFile, onShowInHistoryFile }: PendingTabProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(AI_API_KEY_STORAGE) ?? "");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());
  const lastClickedUnstagedRef = useRef<string | null>(null);

  // LFS state
  const [lfsLocks, setLfsLocks] = useState<LfsLock[]>([]);
  const [hasLfsLockable, setHasLfsLockable] = useState(false);
  const [showLocksModal, setShowLocksModal] = useState<{ locks: LfsLock[]; loading: boolean } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; files: string[];
    isLocked: boolean; isModified: boolean;
    hasUntracked: boolean; hasUnmerged: boolean;
  } | null>(null);
  const [stagedCtxMenu, setStagedCtxMenu] = useState<{
    x: number; y: number; files: string[];
  } | null>(null);

  const fetchStatus = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const [result, lockableExts, sync] = await Promise.all([
        getGitStatus(repoPath),
        getLfsLockableExtensions(repoPath).catch(() => [] as string[]),
        getSyncStatus(repoPath),
      ]);
      const hasLockable = lockableExts.length > 0;
      const locks = hasLockable
        ? await getLfsLocks(repoPath).catch(() => [] as LfsLock[])
        : [];
      setStatus(result);
      setSyncStatus(sync);
      setLfsLocks(locks);
      setHasLfsLockable(hasLockable);
      onLfsLockCountChange?.(locks.length);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    setPreviewKey(null);
    setSelectedUnstaged(new Set());
  }, [repoPath, refreshKey]);

  // ── File actions ──────────────────────────────────────────────────────────

  const handleFileClick = (filename: string, staged: boolean) => {
    setPreviewKey(`${staged ? "s" : "u"}:${filename}`);
    onFilePreview?.(filename, staged);
  };

  const handleUnstagedClick = (filename: string, ctrlKey: boolean, shiftKey: boolean) => {
    // 현재 전체 unstaged 파일 목록 (unmerged + modified + untracked)
    const allUnstagedNames = [
      ...(status?.unmerged ?? []),
      ...(status?.modified ?? []),
      ...(status?.untracked ?? []),
    ].map((f) => f.filename);

    const isUntracked = status?.untracked?.some((f) => f.filename === filename) ?? false;

    if (shiftKey && lastClickedUnstagedRef.current) {
      // Shift+Click: 범위 선택
      const anchorIdx = allUnstagedNames.indexOf(lastClickedUnstagedRef.current);
      const currentIdx = allUnstagedNames.indexOf(filename);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const rangeFiles = allUnstagedNames.slice(start, end + 1);
        setSelectedUnstaged((prev) => {
          const next = ctrlKey ? new Set(prev) : new Set<string>();
          for (const f of rangeFiles) next.add(f);
          return next;
        });
        setPreviewKey(`u:${filename}`);
        onFilePreview?.(filename, false, isUntracked);
      }
    } else if (ctrlKey) {
      // Ctrl+Click: 개별 토글
      setSelectedUnstaged((prev) => {
        const next = new Set(prev);
        if (next.has(filename)) {
          next.delete(filename);
        } else {
          next.add(filename);
          setPreviewKey(`u:${filename}`);
          onFilePreview?.(filename, false, isUntracked);
        }
        return next;
      });
      lastClickedUnstagedRef.current = filename;
    } else {
      // 일반 클릭: 단일 선택
      setSelectedUnstaged(new Set([filename]));
      setPreviewKey(`u:${filename}`);
      onFilePreview?.(filename, false, isUntracked);
      lastClickedUnstagedRef.current = filename;
    }
  };

  const handleStage = async (files: string[]) => {
    try { await gitStage(repoPath, files); await fetchStatus(); }
    catch (e) { setError(String(e)); }
  };

  const handleStageSelected = async () => {
    if (selectedUnstaged.size === 0) return;
    const files = [...selectedUnstaged];
    setSelectedUnstaged(new Set());
    try { await gitStage(repoPath, files); await fetchStatus(); }
    catch (e) { setError(String(e)); }
  };

  const handleUnstage = async (files: string[]) => {
    try { await gitUnstage(repoPath, files); await fetchStatus(); }
    catch (e) { setError(String(e)); }
  };

  const buildRevertMessage = (files: string[], rp: string) => {
    const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
    const MAX = 20;
    const shown = files.length <= MAX ? files : files.slice(0, MAX);
    const lines = shown.map((f) => `${rp}${sep}${f}`);
    if (files.length > MAX) lines.push("...");
    return `Revert changes to ${files.length} file(s)?\n\n${lines.join("\n")}`;
  };

  const handleDiscard = async (files: string[]) => {
    const ok = await tauriConfirm(
      buildRevertMessage(files, repoPath),
      { title: "Revert", kind: "warning" }
    );
    if (!ok) return;
    try { await gitDiscard(repoPath, files); await fetchStatus(); }
    catch (e) { setError(String(e)); }
  };

  // Ctrl+R: 선택된 unstaged 파일 중 untracked 제외하고 revert
  const ctrlRStateRef = useRef({ selectedUnstaged, status, repoPath });
  ctrlRStateRef.current = { selectedUnstaged, status, repoPath };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        e.stopPropagation();
        const { selectedUnstaged: sel, status: st, repoPath: rp } = ctrlRStateRef.current;
        if (sel.size === 0) return;
        const untrackedNames = new Set((st?.untracked ?? []).map((f) => f.filename));
        const revertable = [...sel].filter((f) => !untrackedNames.has(f));
        if (revertable.length === 0) return;
        tauriConfirm(buildRevertMessage(revertable, rp), { title: "Revert", kind: "warning" })
          .then((ok) => { if (ok) gitDiscard(rp, revertable).then(() => fetchStatus()).catch((e) => setError(String(e))); })
          .catch(() => { });
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  const handleDeleteFiles = async (files: string[]) => {
    const sep = navigator.platform.startsWith("Win") ? "\\" : "/";
    const absolutePaths = files.map(f => `${repoPath}${sep}${f}`);
    const ok = await tauriConfirm(`Delete ${files.length} file(s) permanently?\n\n${absolutePaths.join("\n")}`, { title: "Delete Local File", kind: "warning" });
    if (!ok) return;
    try {
      for (const p of absolutePaths) {
        await remove(p);
      }
      await fetchStatus();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDifftool = async (filename: string) => {
    try {
      await runDifftool(repoPath, [filename]);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleStagedDifftool = async (filename: string) => {
    try {
      await runDifftool(repoPath, ["--cached", filename]);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleUnstagedContextMenu = (
    e: React.MouseEvent,
    filename: string,
    file: FileStatus,
    isLocked: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // 우클릭한 파일이 선택에 포함되지 않으면 해당 파일만 선택
    let targetFiles: string[];
    if (selectedUnstaged.has(filename)) {
      targetFiles = [...selectedUnstaged];
    } else {
      setSelectedUnstaged(new Set([filename]));
      targetFiles = [filename];
    }

    const hasUntracked = targetFiles.some((f) => {
      const found = [...(status?.untracked ?? [])].find((u) => u.filename === f);
      return !!found;
    });
    const hasUnmerged = targetFiles.some((f) => {
      const found = [...(status?.unmerged ?? [])].find((u) => u.filename === f);
      return !!found;
    });

    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      files: targetFiles,
      isLocked,
      isModified: file.unstaged_status === "Modified",
      hasUntracked,
      hasUnmerged,
    });
  };

  const handleStagedContextMenu = (e: React.MouseEvent, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    setStagedCtxMenu({ x: e.clientX, y: e.clientY, files: [filename] });
  };

  const handleStageAll = () => {
    const files = [
      ...(status?.modified || []).map((f) => f.filename),
      ...(status?.untracked || []).map((f) => f.filename),
    ];
    if (files.length > 0) handleStage(files);
  };

  const handleUnstageAll = () => {
    const files = (status?.staged || []).map((f) => f.filename);
    if (files.length > 0) handleUnstage(files);
  };

  // ── LFS actions ───────────────────────────────────────────────────────────

  const handleUnlockLfs = async (filename: string) => {
    try {
      await lfsUnlockFile(repoPath, filename);
      await fetchStatus();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleShowLocks = async () => {
    if (!hasLfsLockable) return;
    setShowLocksModal({ locks: [], loading: true });
    try {
      const locks = await getLfsLocks(repoPath);
      setShowLocksModal({ locks, loading: false });
    } catch (e) {
      setShowLocksModal({ locks: [], loading: false });
      setError(String(e));
    }
  };

  // ── Commit ────────────────────────────────────────────────────────────────

  const handleAmendToggle = async (checked: boolean) => {
    setAmend(checked);
    if (checked && !commitMessage) {
      try {
        const msg = await getLastCommitMessage(repoPath);
        setCommitMessage(msg.trim());
      } catch { /* ignore */ }
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) { setError("Commit message is required"); return; }
    try {
      await gitCommit(repoPath, commitMessage, amend);
      setCommitMessage("");
      setAmend(false);
      await fetchStatus();
    } catch (e) { setError(String(e)); }
  };

  const handleAiCommitMessage = async () => {
    const key = apiKey.trim();
    if (!key) { setShowApiKeyInput(true); return; }
    setAiGenerating(true);
    setError(null);
    try {
      const stagedDiff = await gitDiff(repoPath, undefined, true);
      if (!stagedDiff.trim()) { setError("No staged changes to generate message from"); return; }
      const message = await generateAiCommitMessage(stagedDiff, key);
      setCommitMessage(message);
    } catch (e) { setError(String(e)); }
    finally { setAiGenerating(false); }
  };

  const handleSaveApiKey = (value: string) => {
    const trimmed = value.trim();
    setApiKey(trimmed);
    localStorage.setItem(AI_API_KEY_STORAGE, trimmed);
    setShowApiKeyInput(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Loading...</div>;
  }

  const stagedFiles = status?.staged ?? [];
  const modifiedFiles = status?.modified ?? [];
  const untrackedFiles = status?.untracked ?? [];
  const unmergedFiles = status?.unmerged ?? [];
  const unstagedFiles = [...modifiedFiles, ...untrackedFiles];

  // LFS 계산
  const lockedSet = new Set(lfsLocks.map((l) => l.filename));

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Sync Status (ahead/behind) ── */}
      {syncStatus && <SyncStatusBar syncStatus={syncStatus} />}

      {/* ── Error bar ── */}
      {error && (
        <div className="shrink-0 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Commit Message ── */}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col gap-1.5">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Commit message</div>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Enter commit message..."
          rows={3}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-850 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-200"
        />
        {showApiKeyInput && (
          <ApiKeyInput
            initial={apiKey}
            onSave={handleSaveApiKey}
            onCancel={() => setShowApiKeyInput(false)}
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              tabIndex={-1}
              checked={amend}
              onChange={(e) => handleAmendToggle(e.target.checked)}
              className="w-3 h-3 accent-blue-600"
            />
            Amend Commit
          </label>
          <div className="flex items-center gap-1.5">
            <button
              tabIndex={-1}
              onClick={handleAiCommitMessage}
              disabled={aiGenerating || stagedFiles.length === 0}
              title={apiKey ? "Generate AI commit message (Gemini)" : "Set Gemini API key first"}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 whitespace-nowrap flex items-center gap-1"
            >
              {aiGenerating ? <span className="animate-pulse">Generating…</span> : <><span>✦</span><span>AI commit message</span></>}
            </button>
            <button
              onClick={handleCommit}
              disabled={(stagedFiles.length === 0 && !amend) || !commitMessage.trim()}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
            >
              {amend ? "Amend" : "Commit"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Staged files ── */}
      <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 overflow-hidden" style={{ maxHeight: "40%" }}>
        <SectionHeader
          label="Staged files"
          count={stagedFiles.length}
          action={stagedFiles.length > 0 ? { label: "Unstage All", onClick: handleUnstageAll } : undefined}
        />
        <div className="overflow-y-auto min-h-[2.5rem]">
          {stagedFiles.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-gray-400 italic">No staged files</div>
          ) : (
            stagedFiles.map((file) => (
              <div key={file.filename} className="group">
                <FileRow
                  file={file}
                  isSelected={previewKey === `s:${file.filename}`}
                  isLocked={lockedSet.has(file.filename)}
                  onClick={(_e) => handleFileClick(file.filename, true)}
                  onContextMenu={(e) => handleStagedContextMenu(e, file.filename)}
                  actions={
                    <button
                      onClick={() => handleUnstage([file.filename])}
                      title="Unstage"
                      className="px-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs font-bold"
                    >
                      −
                    </button>
                  }
                />
              </div>
            ))
          )}
        </div>
        <div className="h-2.5 shrink-0" />
      </div>

      {/* ── Stage Selected bar ── */}
      <div className="shrink-0 flex items-center justify-center px-3 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={handleStageSelected}
          disabled={selectedUnstaged.size === 0}
          title={
            selectedUnstaged.size > 0
              ? `Stage ${selectedUnstaged.size} selected file(s)`
              : "Select files below to stage"
          }
          className="px-6 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ↑ Stage Selected{selectedUnstaged.size > 0 ? ` (${selectedUnstaged.size})` : ""} ↑
        </button>
      </div>

      {/* ── Unstaged files + Locked files ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Unstaged files ── */}
        <div
          className={`flex flex-col overflow-hidden${hasLfsLockable && lfsLocks.length > 0 ? "" : " flex-1"}`}
          style={hasLfsLockable && lfsLocks.length > 0 ? { maxHeight: "60%" } : undefined}
        >
          <SectionHeader
            label="Unstaged files"
            count={unstagedFiles.length + unmergedFiles.length}
            action={
              unstagedFiles.length > 0
                ? { label: "Stage All", onClick: handleStageAll }
                : undefined
            }
          />

          <div className="flex-1 overflow-y-auto min-h-[2.5rem]">
            {unmergedFiles.length > 0 && (
              <div className="px-3 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                {unmergedFiles.length} conflict{unmergedFiles.length > 1 ? "s" : ""}
              </div>
            )}
            {unmergedFiles.map((file) => (
              <div key={file.filename} className="group">
                <FileRow
                  file={file}
                  isSelected={selectedUnstaged.has(file.filename)}
                  onClick={(e) => handleUnstagedClick(file.filename, e.ctrlKey || e.metaKey, e.shiftKey)}
                  onContextMenu={(e) => handleUnstagedContextMenu(e, file.filename, file, false)}
                  actions={<></>}
                />
              </div>
            ))}
            {unstagedFiles.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-gray-400 italic">No unstaged changes</div>
            ) : (
              unstagedFiles.map((file) => {
                const isLocked = lockedSet.has(file.filename);
                return (
                  <div key={file.filename} className="group">
                    <FileRow
                      file={file}
                      isSelected={selectedUnstaged.has(file.filename)}
                      isLocked={isLocked}
                      onClick={(e) => handleUnstagedClick(file.filename, e.ctrlKey || e.metaKey, e.shiftKey)}
                      onContextMenu={(e) => handleUnstagedContextMenu(e, file.filename, file, isLocked)}
                      actions={
                        <>
                          <button
                            onClick={() => handleStage([file.filename])}
                            title="Stage"
                            className="px-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 text-xs font-bold"
                          >
                            +
                          </button>
                          {file.unstaged_status !== "Untracked" && (
                            <button
                              onClick={() => handleDiscard([file.filename])}
                              title="Discard"
                              className="px-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </>
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="h-2.5 shrink-0" />

        {/* ── Locked files (LFS) ── */}
        {hasLfsLockable && lfsLocks.length > 0 && (
          <div className="flex flex-col overflow-hidden" style={{ maxHeight: "40%" }}>
            <SectionHeader
              label="Locked files"
              count={lfsLocks.length}
              action={{ label: "Show Locks", onClick: handleShowLocks }}
            />
            <div className="overflow-y-auto min-h-[2.5rem]">
              {lfsLocks.map((lock) => (
                <div key={`locked:${lock.filename}`} className="group">
                  <LockedOnlyRow
                    lock={lock}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtxMenu({
                        x: e.clientX, y: e.clientY,
                        files: [lock.filename], isLocked: true, isModified: false,
                        hasUntracked: false, hasUnmerged: false,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Staged Context Menu ── */}
      {stagedCtxMenu && (
        <StagedCtxMenu
          x={stagedCtxMenu.x}
          y={stagedCtxMenu.y}
          repoPath={repoPath}
          files={stagedCtxMenu.files}
          onClose={() => setStagedCtxMenu(null)}
          onUnstage={handleUnstage}
          onDiff={handleStagedDifftool}
          onRefresh={fetchStatus}
          onShowInWorkspaceFile={onShowInWorkspaceFile}
          onShowInHistoryFile={onShowInHistoryFile}
        />
      )}

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <UnstagedCtxMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          repoPath={repoPath}
          files={ctxMenu.files}
          hasUntracked={ctxMenu.hasUntracked}
          hasUnmerged={ctxMenu.hasUnmerged}
          isLocked={ctxMenu.isLocked}
          isModified={ctxMenu.isModified}
          onClose={() => setCtxMenu(null)}
          onStage={handleStage}
          onRevert={handleDiscard}
          onRefresh={fetchStatus}
          onDiff={handleDifftool}
          onDeleteFiles={handleDeleteFiles}
          onUnlockLfs={() => handleUnlockLfs(ctxMenu.files[0])}
          onShowInWorkspaceFile={onShowInWorkspaceFile}
          onShowInHistoryFile={onShowInHistoryFile}
        />
      )}

      {/* ── LFS Locks Modal ── */}
      {showLocksModal && createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.4)" }}
            onClick={() => setShowLocksModal(null)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              minWidth: 360,
              maxWidth: 600,
              maxHeight: "70vh",
            }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">LFS Locks</span>
              <button
                onClick={() => setShowLocksModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {showLocksModal.loading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
              ) : showLocksModal.locks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No LFS locks found.</p>
              ) : (
                <ul className="space-y-1">
                  {showLocksModal.locks.map((l) => (
                    <li key={l.lock_id || l.filename} className="text-xs font-mono text-gray-700 dark:text-gray-300 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="font-medium">{l.filename}</span>
                      {l.owner && <span className="ml-2 text-gray-400">(owner: {l.owner})</span>}
                      {l.lock_id && <span className="ml-2 text-gray-400">ID: {l.lock_id}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
