import { useState, useEffect, useRef, useCallback } from "react";
import {
  getCurrentBranch,
  getRepositoryRoot,
  getGitAuthor,
  gitFetchAll,
  gitPull,
  gitPush,
  runGitSimple,
  openInFileManager,
  openInTerminal,
  type PluginInfo,
} from "../../lib";
import { PluginButtons } from "./PluginButtons";

interface HeaderProps {
  repoPath: string;
  refreshKey: number;
  onRefresh: () => void;
  plugins?: PluginInfo[];
  selectedFilePath?: string | null;
  onTimeLapse?: () => void;
}

type BusyKey =
  | "refresh"
  | "timelapse"
  | "fetchAll"
  | "pull"
  | "push"
  | "folder"
  | "terminal";

// ─── Shared button styles ─────────────────────────────────────────────────────

const BASE_BTN =
  "px-2.5 py-1 text-xs rounded transition-colors shrink-0 border disabled:opacity-60";
const IDLE_BTN =
  "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600";
const BUSY_BTN =
  "bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 cursor-wait";

// ─── Simple tool button ───────────────────────────────────────────────────────

interface ToolButtonProps {
  label: string;
  busyLabel?: string;
  title: string;
  isBusy: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ToolButton({ label, busyLabel, title, isBusy, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${BASE_BTN} ${isBusy ? BUSY_BTN : IDLE_BTN}`}
    >
      {isBusy ? (busyLabel ?? `${label}…`) : label}
    </button>
  );
}

// ─── Split button (main + dropdown arrow) ────────────────────────────────────

interface DropdownItem {
  label: string;
  action: () => void;
}

interface SplitButtonProps {
  label: string;
  title: string;
  isBusy: boolean;
  disabled: boolean;
  onMain: () => void;
  items: DropdownItem[];
}

function SplitButton({ label, title, isBusy, disabled, onMain, items }: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex shrink-0">
      {/* Main action */}
      <button
        onClick={onMain}
        disabled={disabled}
        title={title}
        className={`${BASE_BTN} ${isBusy ? BUSY_BTN : IDLE_BTN} rounded-r-none border-r-0`}
      >
        {isBusy ? `${label}…` : label}
      </button>
      {/* Dropdown arrow */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={`${label} options`}
        className={`${BASE_BTN} ${isBusy ? BUSY_BTN : IDLE_BTN} rounded-l-none px-1.5`}
      >
        ▾
      </button>
      {/* Dropdown menu */}
      {open && (
        <div className="absolute left-0 top-full mt-0.5 z-50 min-w-[180px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); item.action(); }}
              className="w-full text-left px-4 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Separator ────────────────────────────────────────────────────────────────

function Sep() {
  return <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 shrink-0 mx-0.5" />;
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header({ repoPath, refreshKey, onRefresh, plugins = [], selectedFilePath, onTimeLapse }: HeaderProps) {
  const [currentBranch, setCurrentBranch] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");
  const [author, setAuthor] = useState<{ name: string; email: string } | null>(null);
  const [busy, setBusy] = useState<BusyKey | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    getCurrentBranch(repoPath).then(setCurrentBranch).catch(console.error);
  }, [repoPath, refreshKey]);

  useEffect(() => {
    if (!repoPath) return;
    getRepositoryRoot(repoPath).then((root) => {
      setRepoName(root.replace(/\\/g, "/").split("/").pop() ?? "");
    }).catch(console.error);
  }, [repoPath]);

  useEffect(() => {
    if (!repoPath) return;
    getGitAuthor(repoPath).then(setAuthor).catch(console.error);
  }, [repoPath]);

  const run = useCallback(async (
    key: BusyKey,
    fn: () => Promise<unknown>,
    refreshAfter = false,
  ) => {
    setBusy(key);
    setLastError(null);
    try {
      await fn();
      if (refreshAfter) onRefresh();
    } catch (e) {
      setLastError(String(e));
    } finally {
      setBusy(null);
    }
  }, [onRefresh]);

  const isDisabled = busy !== null;

  // ── Push dropdown items ──────────────────────────────────────────────────

  const pushItems: DropdownItem[] = [
    {
      label: "git push",
      action: () => run("push", () => gitPush(repoPath), true),
    },
    {
      label: "git push --tags",
      action: () => run("push", () => runGitSimple(["push", "--tags"], repoPath), true),
    },
    {
      label: "git push --branches",
      action: () => run("push", () => runGitSimple(["push", "--branches"], repoPath), true),
    },
    {
      label: "git push --all",
      action: () => run("push", () => runGitSimple(["push", "--all"], repoPath), true),
    },
  ];

  return (
    <div className="shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1 px-3 py-1.5 flex-wrap">

        {/* ── Repo / branch info ── */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          {repoName && (
            <span className="font-semibold text-gray-800 dark:text-gray-100">{repoName}</span>
          )}
          {currentBranch && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
              {currentBranch}
            </span>
          )}
          {author && (author.name || author.email) && (
            <span
              title={author.email ? `${author.name} <${author.email}>` : author.name}
              className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
            >
              <span>👤</span>
              <span>{author.name || author.email}</span>
            </span>
          )}
        </div>

        <Sep />

        {/* ── 1. Refresh ── */}
        <ToolButton
          label="↻ Refresh"
          busyLabel="↻…"
          title="Refresh repository status"
          isBusy={busy === "refresh"}
          disabled={isDisabled}
          onClick={() => run("refresh", async () => onRefresh())}
        />

        {/* ── 2. TimeLapse ── */}
        <ToolButton
          label="TimeLapse"
          title={selectedFilePath ? `TimeLapse: ${selectedFilePath.replace(/\\/g, "/").split("/").pop()}` : "Select a file to use TimeLapse"}
          isBusy={busy === "timelapse"}
          disabled={isDisabled || !selectedFilePath}
          onClick={() => onTimeLapse?.()}
        />

        <Sep />

        {/* ── 3. FetchAll ── */}
        <ToolButton
          label="FetchAll"
          title="git fetch --all"
          isBusy={busy === "fetchAll"}
          disabled={isDisabled}
          onClick={() => run("fetchAll", () => gitFetchAll(repoPath), true)}
        />

        {/* ── 4. Pull ── */}
        <ToolButton
          label="Pull"
          title="git pull"
          isBusy={busy === "pull"}
          disabled={isDisabled}
          onClick={() => run("pull", () => gitPull(repoPath), true)}
        />

        {/* ── 5. Push (split button with dropdown) ── */}
        <SplitButton
          label="Push"
          title="git push"
          isBusy={busy === "push"}
          disabled={isDisabled}
          onMain={() => run("push", () => gitPush(repoPath), true)}
          items={pushItems}
        />

        <Sep />

        {/* ── 6. OpenFolder ── */}
        <ToolButton
          label="OpenFolder"
          title="Open repository in file manager"
          isBusy={busy === "folder"}
          disabled={isDisabled}
          onClick={() => run("folder", () => openInFileManager(repoPath))}
        />

        {/* ── 7. Terminal ── */}
        <ToolButton
          label="Terminal"
          title="Open terminal at repository path"
          isBusy={busy === "terminal"}
          disabled={isDisabled}
          onClick={() => run("terminal", () => openInTerminal(repoPath))}
        />

        {/* ── Plugin buttons ── */}
        {plugins.length > 0 && (
          <>
            <Sep />
            <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0">
              <PluginButtons plugins={plugins} repoPath={repoPath} onRefresh={onRefresh} />
            </div>
          </>
        )}
      </div>

      {/* Error bar */}
      {lastError && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
          <span className="flex-1 truncate">{lastError}</span>
          <button onClick={() => setLastError(null)} className="shrink-0 hover:text-red-800 dark:hover:text-red-200">✕</button>
        </div>
      )}
    </div>
  );
}
