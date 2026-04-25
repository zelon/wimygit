import { useState, useEffect, useRef } from "react";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { fetch } from "@tauri-apps/plugin-http";
import { getExecutableDir, getConfigDir, openInFileManager } from "../../lib";
import { getCurrentWindow } from "@tauri-apps/api/window";

const RELEASE_URL = "https://github.com/zelon/wimygit/releases";
const LATEST_API = "https://api.github.com/repos/zelon/wimygit/releases/latest";
const APP_VERSION = "0.1.0"; // matches tauri.conf.json

interface HamburgerMenuProps {
  onPluginClick: () => void;
}

function Separator() {
  return <div className="my-1 border-t border-gray-200 dark:border-gray-700" />;
}

export function HamburgerMenu({ onPluginClick }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
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

  const closeAndRun = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const handleShowExecutable = async () => {
    try {
      const dir = await getExecutableDir();
      await openInFileManager(dir);
    } catch (e) {
      console.error("Failed to open executable dir:", e);
    }
  };

  const handleShowConfig = async () => {
    try {
      const dir = await getConfigDir();
      await openInFileManager(dir);
    } catch (e) {
      console.error("Failed to open config dir:", e);
    }
  };

  const handleReleasePage = async () => {
    try {
      await shellOpen(RELEASE_URL);
    } catch {
      window.open(RELEASE_URL, "_blank");
    }
  };

  const handleCheckVersion = async () => {
    setChecking(true);
    try {
      const response = await fetch(LATEST_API, {
        method: "GET",
        headers: { "User-Agent": "WimyGitUpdateChecker" },
      });
      const data = await response.json() as { tag_name?: string; html_url?: string };
      const latestTag = data.tag_name ?? "unknown";
      const latestVersion = latestTag.replace(/^v/, "");

      if (latestVersion > APP_VERSION) {
        const go = confirm(
          `New version available: ${APP_VERSION} → ${latestVersion}\nOpen download page?`
        );
        if (go) {
          await shellOpen(data.html_url ?? RELEASE_URL).catch(() =>
            window.open(data.html_url ?? RELEASE_URL, "_blank")
          );
        }
      } else {
        alert(`Already up to date. Current version: ${APP_VERSION}`);
      }
    } catch (e) {
      alert(`Cannot check latest release: ${e}`);
    } finally {
      setChecking(false);
    }
  };

  const handleExit = () => {
    getCurrentWindow().close();
  };

  const itemClass =
    "w-full text-left px-4 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap";

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-10 h-full text-xl text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        title="Menu"
      >
        ≡
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1">
          <button
            className={itemClass}
            onClick={() => closeAndRun(onPluginClick)}
          >
            Plugin...
          </button>
          <button
            className={itemClass}
            onClick={() => closeAndRun(handleShowExecutable)}
          >
            Show WimyGit executable file in Explorer
          </button>
          <button
            className={itemClass}
            onClick={() => closeAndRun(handleShowConfig)}
          >
            Show WimyGit config file in Explorer
          </button>

          <Separator />

          <button
            className={itemClass}
            onClick={() => closeAndRun(handleReleasePage)}
          >
            Show WimyGit Release page on Github
          </button>
          <button
            className={itemClass}
            disabled={checking}
            onClick={() => closeAndRun(handleCheckVersion)}
          >
            {checking ? "Checking..." : "Check Latest Version"}
          </button>

          <Separator />

          <button
            className={itemClass}
            onClick={() => closeAndRun(handleExit)}
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
}
