interface Tab {
  id: string;
  label: string;
  icon?: string;
  closeable?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange, onTabClose }: TabBarProps) {
  return (
    <div className="flex items-end border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 px-1 pt-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-1.5 px-4 text-sm transition-colors rounded-t-lg -mb-px
            ${
              activeTab === tab.id
                ? "py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-b-white dark:border-b-gray-800 text-gray-900 dark:text-white"
                : "py-2 mt-1 font-medium border border-gray-300/40 dark:border-gray-600/40 border-b-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/50"
            }
          `}
        >
          {tab.icon && <span className="mr-1">{tab.icon}</span>}
          {tab.label}
          {tab.closeable && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onTabClose?.(tab.id); }}
              className="ml-1 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs leading-none"
            >
              ✕
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
