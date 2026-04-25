import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  getGitStatus,
  gitStage,
  gitUnstage,
  gitDiscard,
  gitCommit,
  getLastCommitMessage,
  gitDiff,
  type GitStatus,
  type FileStatus,
  getLfsLocks,
  getLfsLockableExtensions,
  lfsUnlockFile,
  type LfsLock,
} from "../../lib";

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
  onFilePreview?: (filename: string, staged: boolean) => void;
  onLfsLockCountChange?: (count: number) => void;
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
      <span className="flex-1 truncate" title={file.filename}>{file.filename}</span>
      {isLocked && (
        <span title="LFS Locked" className="text-amber-500 shrink-0 text-xs">🔒</span>
      )}
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

interface FileCtxMenuProps {
  x: number;
  y: number;
  filename: string;
  isLocked: boolean;
  isModified: boolean;
  onClose: () => void;
  onUnlockLfs: () => void;
}

function FileCtxMenu({ x, y, filename: _filename, isLocked, isModified, onClose, onUnlockLfs }: FileCtxMenuProps) {
  if (!isLocked) return null;

  return createPortal(
    <>
      {/* 투명 오버레이: 바깥 클릭 시 닫기 */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{ position: "fixed", top: y, left: x, zIndex: 9999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[160px]"
      >
        <button
          onClick={() => {
            if (isModified) {
              alert("Cannot unlock a modified file. Revert changes first.");
              onClose();
              return;
            }
            onUnlockLfs();
            onClose();
          }}
          className="w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600 dark:text-amber-400"
        >
          Unlock (LFS)
        </button>
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

export function PendingTab({ repoPath, refreshKey, onFilePreview, onLfsLockCountChange }: PendingTabProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(AI_API_KEY_STORAGE) ?? "");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());

  // LFS state
  const [lfsLocks, setLfsLocks] = useState<LfsLock[]>([]);
  const [hasLfsLockable, setHasLfsLockable] = useState(false);
  const [showLocksModal, setShowLocksModal] = useState<{ locks: LfsLock[]; loading: boolean } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; filename: string; isLocked: boolean; isModified: boolean;
  } | null>(null);

  const fetchStatus = async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const [result, locks, lockableExts] = await Promise.all([
        getGitStatus(repoPath),
        getLfsLocks(repoPath).catch(() => [] as LfsLock[]),
        getLfsLockableExtensions(repoPath).catch(() => [] as string[]),
      ]);
      setStatus(result);
      setLfsLocks(locks);
      setHasLfsLockable(lockableExts.length > 0);
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

  const handleUnstagedClick = (filename: string, ctrlKey: boolean) => {
    if (ctrlKey) {
      setSelectedUnstaged((prev) => {
        const next = new Set(prev);
        if (next.has(filename)) {
          next.delete(filename);
        } else {
          next.add(filename);
          setPreviewKey(`u:${filename}`);
          onFilePreview?.(filename, false);
        }
        return next;
      });
    } else {
      setSelectedUnstaged(new Set([filename]));
      setPreviewKey(`u:${filename}`);
      onFilePreview?.(filename, false);
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

  const handleDiscard = async (files: string[]) => {
    if (!confirm(`Discard changes to ${files.length} file(s)?`)) return;
    try { await gitDiscard(repoPath, files); await fetchStatus(); }
    catch (e) { setError(String(e)); }
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
  const unstagedFilenames = new Set(unstagedFiles.map((f) => f.filename));
  // 수정 없이 잠기기만 한 파일 (Pending 목록에 없는 locked 파일)
  const onlyLockedFiles = lfsLocks.filter((l) => !unstagedFilenames.has(l.filename));

  const hasLocks = lfsLocks.length > 0;
  const unstagedSectionLabel = hasLocks ? "Unstaged & Locked Files" : "Unstaged files";
  const unstagedSectionCount = unstagedFiles.length + onlyLockedFiles.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

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
              checked={amend}
              onChange={(e) => handleAmendToggle(e.target.checked)}
              className="w-3 h-3 accent-blue-600"
            />
            Amend Commit
          </label>
          <div className="flex items-center gap-1.5">
            <button
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
        <div className="overflow-y-auto">
          {stagedFiles.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-gray-400 italic">No staged files</div>
          ) : (
            stagedFiles.map((file) => (
              <div key={file.filename} className="group">
                <FileRow
                  file={file}
                  isSelected={previewKey === `s:${file.filename}`}
                  onClick={(_e) => handleFileClick(file.filename, true)}
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
      </div>

      {/* ── Stage Selected bar ── */}
      <div className="shrink-0 flex items-center justify-end px-3 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={handleStageSelected}
          disabled={selectedUnstaged.size === 0}
          title={
            selectedUnstaged.size > 0
              ? `Stage ${selectedUnstaged.size} selected file(s)`
              : "Select files below to stage"
          }
          className="px-3 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Stage Selected{selectedUnstaged.size > 0 ? ` (${selectedUnstaged.size})` : ""}
        </button>
      </div>

      {/* ── Unstaged files ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <SectionHeader
          label={unstagedSectionLabel}
          count={unstagedSectionCount}
          action={
            hasLfsLockable
              ? { label: "Show Locks", onClick: handleShowLocks }
              : unstagedFiles.length > 0
                ? { label: "Stage All", onClick: handleStageAll }
                : undefined
          }
        />
        {/* Stage All 버튼: Show Locks가 표시될 때는 별도 위치에 배치 */}
        {hasLfsLockable && unstagedFiles.length > 0 && (
          <div className="shrink-0 flex justify-end px-3 py-0.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={handleStageAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Stage All
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
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
                onClick={(e) => handleUnstagedClick(file.filename, e.ctrlKey || e.metaKey)}
                actions={<></>}
              />
            </div>
          ))}
          {unstagedFiles.length === 0 && onlyLockedFiles.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-gray-400 italic">No unstaged changes</div>
          ) : (
            <>
              {unstagedFiles.map((file) => {
                const isLocked = lockedSet.has(file.filename);
                const isModified = file.unstaged_status === "Modified";
                return (
                  <div key={file.filename} className="group">
                    <FileRow
                      file={file}
                      isSelected={selectedUnstaged.has(file.filename)}
                      isLocked={isLocked}
                      onClick={(e) => handleUnstagedClick(file.filename, e.ctrlKey || e.metaKey)}
                      onContextMenu={isLocked ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCtxMenu({ x: e.clientX, y: e.clientY, filename: file.filename, isLocked, isModified });
                      } : undefined}
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
              })}
              {/* Only-Locked 파일 (수정 없이 잠긴 파일) */}
              {onlyLockedFiles.map((lock) => (
                <div key={`locked:${lock.filename}`} className="group">
                  <LockedOnlyRow
                    lock={lock}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCtxMenu({ x: e.clientX, y: e.clientY, filename: lock.filename, isLocked: true, isModified: false });
                    }}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <FileCtxMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          filename={ctxMenu.filename}
          isLocked={ctxMenu.isLocked}
          isModified={ctxMenu.isModified}
          onClose={() => setCtxMenu(null)}
          onUnlockLfs={() => handleUnlockLfs(ctxMenu.filename)}
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
