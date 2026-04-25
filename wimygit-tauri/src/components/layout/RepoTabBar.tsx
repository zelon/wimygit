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
  return (
    <div className="flex items-center bg-gray-200 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 shrink-0">
      <HamburgerMenu onPluginClick={onPluginClick} />
      <div className="flex items-center overflow-x-auto flex-1">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          title={tab.repoPath}
          onClick={() => onSelect(tab.id)}
          className={`
            flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer select-none shrink-0
            border-r border-gray-300 dark:border-gray-700
            ${
              tab.id === activeId
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750"
            }
          `}
        >
          <span className="max-w-32 truncate">{tab.repoName}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs leading-none"
            title="Close"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 hover:text-gray-800 dark:hover:text-gray-200 shrink-0"
        title="Open Repository"
      >
        +
      </button>
      </div>
    </div>
  );
}
