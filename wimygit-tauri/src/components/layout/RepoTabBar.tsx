import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion, getName } from "@tauri-apps/api/app";
import { HamburgerMenu } from "./HamburgerMenu";

interface RepoTabItem {
  id: string;
  repoName: string;
  repoPath: string;
}

interface RepoTabBarProps {
  tabs: RepoTabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
  onPluginClick: () => void;
}

export function RepoTabBar({ tabs, activeId, onSelect, onClose, onAdd, onPluginClick }: RepoTabBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [version, setVersion] = useState("");
  const [appName, setAppName] = useState("WimyGit");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    getName().then(setAppName).catch(() => {});
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setIsMaximized).catch(() => {});

    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <div
      data-tauri-drag-region
      className="flex items-end h-9 bg-gray-100 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shrink-0 select-none"
    >
      {/* Left: hamburger + logo */}
      <div className="self-center"><HamburgerMenu onPluginClick={onPluginClick} /></div>
      <span
        data-tauri-drag-region
        className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide px-2 shrink-0 self-center"
      >
        {appName}
        {version && <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">v{version}</span>}
      </span>

      {/* Repo tabs */}
      <div className="flex items-end overflow-x-auto overflow-y-hidden flex-1 gap-0.5 ml-1" data-tauri-drag-region>
        {tabs.map((tab) => (
          <div key={tab.id} className="flex items-center shrink-0">
            <div
              title={tab.repoPath}
              onClick={() => onSelect(tab.id)}
              className={`
                group flex items-center gap-1 px-2.5 text-xs rounded-t-md cursor-pointer transition-all -mb-px
                ${
                  tab.id === activeId
                    ? "py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 border-b-white dark:border-b-gray-800"
                    : "py-1 mt-1 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/50 border border-gray-300/40 dark:border-gray-600/40 border-b-transparent"
                }
              `}
            >
              <span className="max-w-28 truncate">{tab.repoName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className={`
                  w-4 h-4 flex items-center justify-center rounded-sm text-[10px] leading-none transition-colors
                  ${
                    tab.id === activeId
                      ? "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                      : "text-transparent group-hover:text-gray-400 hover:!text-gray-700 dark:hover:!text-gray-200 hover:!bg-gray-300 dark:hover:!bg-gray-700"
                  }
                `}
                title="Close"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* Add repo button */}
        <button
          onClick={onAdd}
          className="ml-1 w-5 h-5 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 text-xs transition-colors shrink-0"
          title="Open Repository"
        >
          +
        </button>

        {/* Drag region spacer */}
        <div className="flex-1 h-full" data-tauri-drag-region />
      </div>

      {/* Window controls */}
      <div className="flex items-center shrink-0 self-stretch">
        <button
          onClick={handleMinimize}
          className="w-11 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={handleToggleMaximize}
          className="w-11 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" rx="0.5" />
              <rect x="0" y="2" width="8" height="8" rx="0.5" fill="var(--tw-bg-opacity, currentColor)" fillOpacity="0" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
