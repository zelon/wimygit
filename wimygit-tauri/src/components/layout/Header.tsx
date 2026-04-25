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
  "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[56px] text-[11px] rounded transition-colors shrink-0 border disabled:opacity-40";
const IDLE_BTN =
  "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600";
const BUSY_BTN =
  "bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 cursor-wait";

// ─── Simple tool button ───────────────────────────────────────────────────────

// ─── SVG Icons (24×24, stroke-based) ─────────────────────────────────────────

const ICON_CLASS = "w-6 h-6";

function IconRefresh({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function IconTimeLapse({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconFetchAll({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="m8 11 4 4 4-4" />
      <path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
    </svg>
  );
}

function IconPull({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v15" /><path d="m7 13 5 5 5-5" /><line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

function IconPush({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V6" /><path d="m17 11-5-5-5 5" /><line x1="4" y1="3" x2="20" y2="3" />
    </svg>
  );
}

function IconFolder({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconTerminal({ className = ICON_CLASS }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

// ─── Simple tool button ───────────────────────────────────────────────────────

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  busyLabel?: string;
  title: string;
  isBusy: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, busyLabel, title, isBusy, disabled, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${BASE_BTN} ${isBusy ? BUSY_BTN : IDLE_BTN}`}
    >
      {icon}
      <span>{isBusy ? (busyLabel ?? `${label}…`) : label}</span>
    </button>
  );
}

// ─── Split button (main + dropdown arrow) ────────────────────────────────────

interface DropdownItem {
  label: string;
  action: () => void;
}

interface SplitButtonProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  isBusy: boolean;
  disabled: boolean;
  onMain: () => void;
  items: DropdownItem[];
}

function SplitButton({ icon, label, title, isBusy, disabled, onMain, items }: SplitButtonProps) {
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
        {icon}
        <span>{isBusy ? `${label}…` : label}</span>
      </button>
      {/* Dropdown arrow */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={`${label} options`}
        className={`flex items-center px-1 border rounded-l-none rounded-r transition-colors disabled:opacity-40 ${isBusy ? BUSY_BTN : IDLE_BTN}`}
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
  return <div className="self-stretch w-px bg-gray-300 dark:bg-gray-600 shrink-0 mx-1" />;
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
      {/* ── Repo / branch info ── */}
      <div className="flex items-center gap-2 px-3 py-1 text-sm border-b border-gray-200 dark:border-gray-700">
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

      {/* ── Toolbar buttons ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 flex-wrap">

        {/* ── 1. Refresh ── */}
        <ToolButton
          icon={<IconRefresh />}
          label="Refresh"
          busyLabel="Refresh…"
          title="Refresh repository status"
          isBusy={busy === "refresh"}
          disabled={isDisabled}
          onClick={() => run("refresh", async () => onRefresh())}
        />

        {/* ── 2. TimeLapse ── */}
        <ToolButton
          icon={<IconTimeLapse />}
          label="TimeLapse"
          title={selectedFilePath ? `TimeLapse: ${selectedFilePath.replace(/\\/g, "/").split("/").pop()}` : "Select a file to use TimeLapse"}
          isBusy={busy === "timelapse"}
          disabled={isDisabled || !selectedFilePath}
          onClick={() => onTimeLapse?.()}
        />

        <Sep />

        {/* ── 3. FetchAll ── */}
        <ToolButton
          icon={<IconFetchAll />}
          label="FetchAll"
          title="git fetch --all"
          isBusy={busy === "fetchAll"}
          disabled={isDisabled}
          onClick={() => run("fetchAll", () => gitFetchAll(repoPath), true)}
        />

        {/* ── 4. Pull ── */}
        <ToolButton
          icon={<IconPull />}
          label="Pull"
          title="git pull"
          isBusy={busy === "pull"}
          disabled={isDisabled}
          onClick={() => run("pull", () => gitPull(repoPath), true)}
        />

        {/* ── 5. Push (split button with dropdown) ── */}
        <SplitButton
          icon={<IconPush />}
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
          icon={<IconFolder />}
          label="OpenFolder"
          title="Open repository in file manager"
          isBusy={busy === "folder"}
          disabled={isDisabled}
          onClick={() => run("folder", () => openInFileManager(repoPath))}
        />

        {/* ── 7. Terminal ── */}
        <ToolButton
          icon={<IconTerminal />}
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
