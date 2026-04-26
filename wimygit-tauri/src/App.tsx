import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Header, TabBar, RepoTabBar, GitLogPanel, LeftSidebar } from "./components/layout";
import { PendingTab } from "./components/tabs";

// Lazy-loaded tabs (not needed at startup)
const HistoryTab = lazy(() => import("./components/tabs/HistoryTab").then(m => ({ default: m.HistoryTab })));
const BranchTab = lazy(() => import("./components/tabs/BranchTab").then(m => ({ default: m.BranchTab })));
const RemoteTab = lazy(() => import("./components/tabs/RemoteTab").then(m => ({ default: m.RemoteTab })));
const StashTab = lazy(() => import("./components/tabs/StashTab").then(m => ({ default: m.StashTab })));
const TagTab = lazy(() => import("./components/tabs/TagTab").then(m => ({ default: m.TagTab })));
const WorktreeTab = lazy(() => import("./components/tabs/WorktreeTab").then(m => ({ default: m.WorktreeTab })));
const PluginTab = lazy(() => import("./components/tabs/PluginTab").then(m => ({ default: m.PluginTab })));
const TimeLapsePanel = lazy(() => import("./components/layout/TimeLapsePanel").then(m => ({ default: m.TimeLapsePanel })));
import {
  isGitRepository,
  getRepositoryRoot,
  getPluginDir,
  loadPlugins,
  hasLfsAttributes,
  checkLfsInstalled,
  type PluginInfo,
  type SelectedDiffInfo,
} from "./lib";

const BASE_INNER_TABS = [
  { id: "pending", label: "Pending" },
  { id: "history", label: "History" },
  { id: "branches", label: "Branches" },
  { id: "remotes", label: "Remotes" },
  { id: "tags", label: "Tags" },
  { id: "worktrees", label: "Worktrees" },
  { id: "stash", label: "Stash" },
];

interface RepoTabState {
  id: string;
  repoPath: string;
  repoName: string;
  activeTab: string;
  refreshKey: number;
}

const STORAGE_KEY = "repoTabs_v2";

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function repoNameFromPath(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

function loadStoredTabs(): Pick<RepoTabState, "id" | "repoPath" | "repoName">[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveStoredTabs(tabs: RepoTabState[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(tabs.map(({ id, repoPath, repoName }) => ({ id, repoPath, repoName })))
  );
}

function App() {
  const [repoTabs, setRepoTabs] = useState<RepoTabState[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string>("");
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [openError, setOpenError] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<SelectedDiffInfo | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<{ filename: string; staged: boolean } | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [showTimeLapse, setShowTimeLapse] = useState(false);
  const [lfsWarning, setLfsWarning] = useState<string | null>(null);
  const [lfsLockCount, setLfsLockCount] = useState(0);
  const [showPluginModal, setShowPluginModal] = useState(false);

  // Restore previously opened repos on startup
  useEffect(() => {
    const stored = loadStoredTabs();
    if (stored.length === 0) return;

    // Show tabs immediately, only validate active repo on startup
    const tabs: RepoTabState[] = stored.map((s) => ({
      id: s.id,
      repoPath: s.repoPath,
      repoName: s.repoName,
      activeTab: "pending",
      refreshKey: 0,
    }));
    setRepoTabs(tabs);
    const lastActive = localStorage.getItem("activeRepoId");
    const firstId = tabs.find((t) => t.id === lastActive)?.id ?? tabs[0].id;
    setActiveRepoId(firstId);

    // Only validate the active repo on startup
    const activeTab = tabs.find((t) => t.id === firstId);
    if (activeTab) {
      isGitRepository(activeTab.repoPath).then((ok) => {
        if (!ok) {
          setRepoTabs((prev) => {
            const next = prev.filter((t) => t.id !== firstId);
            saveStoredTabs(next);
            const newActive = next[0]?.id ?? "";
            setActiveRepoId(newActive);
            localStorage.setItem("activeRepoId", newActive);
            return next;
          });
        }
      }).catch(() => {
        // ignore validation errors on startup
      });
    }
  }, []);

  const activeRepo = repoTabs.find((t) => t.id === activeRepoId) ?? null;

  const updateActiveRepo = useCallback(
    (updater: (tab: RepoTabState) => Partial<RepoTabState>) => {
      setRepoTabs((prev) => {
        const next = prev.map((t) =>
          t.id === activeRepoId ? { ...t, ...updater(t) } : t
        );
        saveStoredTabs(next);
        return next;
      });
    },
    [activeRepoId]
  );

  const handleRefresh = useCallback(() => {
    updateActiveRepo((t) => ({ refreshKey: t.refreshKey + 1 }));
  }, [updateActiveRepo]);

  // F5 키를 앱 전체 새로고침 대신 현재 repo Refresh로 동작하게 변경
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRefresh]);

  const handleTabChange = useCallback(
    (tabId: string) => {
      updateActiveRepo(() => ({ activeTab: tabId }));
    },
    [updateActiveRepo]
  );

  const handleSelectRepo = useCallback((id: string) => {
    setActiveRepoId(id);
    localStorage.setItem("activeRepoId", id);

    // Validate and refresh repo when activated
    const tab = repoTabs.find((t) => t.id === id);
    if (tab) {
      isGitRepository(tab.repoPath).then((ok) => {
        if (!ok) {
          setRepoTabs((prev) => {
            const next = prev.filter((t) => t.id !== id);
            saveStoredTabs(next);
            return next;
          });
          setActiveRepoId((prev) => {
            if (prev !== id) return prev;
            const remaining = repoTabs.filter((t) => t.id !== id);
            const newId = remaining[remaining.length - 1]?.id ?? "";
            localStorage.setItem("activeRepoId", newId);
            return newId;
          });
        } else {
          // Trigger refresh to load latest repo info
          setRepoTabs((prev) =>
            prev.map((t) =>
              t.id === id ? { ...t, refreshKey: t.refreshKey + 1 } : t
            )
          );
        }
      }).catch(() => {
        // ignore validation errors
      });
    }
  }, [repoTabs]);

  const handleCloseRepo = useCallback(
    (id: string) => {
      setRepoTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        saveStoredTabs(next);
        return next;
      });
      setActiveRepoId((prev) => {
        if (prev !== id) return prev;
        const remaining = repoTabs.filter((t) => t.id !== id);
        const newId = remaining[remaining.length - 1]?.id ?? "";
        localStorage.setItem("activeRepoId", newId);
        return newId;
      });
    },
    [repoTabs]
  );

  const handleOpenRepo = useCallback(
    async (pathOverride?: string) => {
      setOpenError(null);
      try {
        let selectedPath = pathOverride;
        if (!selectedPath) {
          const picked = await open({
            directory: true,
            multiple: false,
            title: "Select Git Repository",
          });
          if (!picked || typeof picked !== "string") return;
          selectedPath = picked;
        }

        const isRepo = await isGitRepository(selectedPath);
        if (!isRepo) {
          setOpenError("Selected folder is not a git repository");
          return;
        }

        const root = await getRepositoryRoot(selectedPath);

        // If already open, just switch to it
        const existing = repoTabs.find((t) => t.repoPath === root);
        if (existing) {
          handleSelectRepo(existing.id);
          return;
        }

        const newTab: RepoTabState = {
          id: makeId(),
          repoPath: root,
          repoName: repoNameFromPath(root),
          activeTab: "pending",
          refreshKey: 0,
        };

        setRepoTabs((prev) => {
          const next = [...prev, newTab];
          saveStoredTabs(next);
          return next;
        });
        setActiveRepoId(newTab.id);
        localStorage.setItem("activeRepoId", newTab.id);
      } catch (e) {
        setOpenError(String(e));
      }
    },
    [repoTabs, handleSelectRepo]
  );

  // Clear file selections when switching repos
  useEffect(() => {
    setSelectedDiff(null);
    setPendingFilePreview(null);
    setSelectedFilePath(null);
    setShowTimeLapse(false);
    setLfsWarning(null);
    setLfsLockCount(0);
  }, [activeRepoId]);

  // LFS 설치 여부 확인 (레포 변경 시)
  useEffect(() => {
    if (!activeRepo?.repoPath) return;
    const repoPath = activeRepo.repoPath;
    (async () => {
      try {
        const hasAttr = await hasLfsAttributes(repoPath);
        if (!hasAttr) { setLfsWarning(null); return; }
        const installed = await checkLfsInstalled(repoPath);
        setLfsWarning(
          installed
            ? null
            : "Git LFS is not installed, but this repository uses LFS attributes."
        );
      } catch {
        setLfsWarning(null);
      }
    })();
  }, [activeRepo?.repoPath]);

  // Load plugins whenever active repo changes
  const reloadPlugins = useCallback(async () => {
    try {
      const dir = await getPluginDir();
      const list = await loadPlugins(dir);
      setPlugins(list.filter((p) => !p.load_error));
    } catch {
      // plugins are optional
    }
  }, []);

  useEffect(() => {
    reloadPlugins();
  }, [activeRepoId, reloadPlugins]);

  // No repos open
  if (repoTabs.length === 0 || !activeRepo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">WimyGit</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Cross-platform Git GUI Client</p>
          {openError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded max-w-md">
              {openError}
            </div>
          )}
          <button
            onClick={() => handleOpenRepo()}
            className="px-6 py-3 text-lg bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Open Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top: repository tabs */}
      <RepoTabBar
        tabs={repoTabs}
        activeId={activeRepoId}
        onSelect={handleSelectRepo}
        onClose={handleCloseRepo}
        onAdd={() => handleOpenRepo()}
        onPluginClick={() => setShowPluginModal(true)}
      />

      {/* LFS 경고 배너 */}
      {lfsWarning && (
        <div className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex justify-between shrink-0">
          <span>⚠ {lfsWarning}</span>
          <button onClick={() => setLfsWarning(null)} className="ml-2 text-amber-500 hover:text-amber-700">✕</button>
        </div>
      )}

      {/* Per-repo header */}
      <Header
        repoPath={activeRepo.repoPath}
        refreshKey={activeRepo.refreshKey}
        onRefresh={handleRefresh}
        plugins={plugins}
        selectedFilePath={selectedFilePath}
        onTimeLapse={() => setShowTimeLapse(true)}
      />

      {/* Body: left sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Workspace tree + Quick Diff */}
        <LeftSidebar
          repoPath={activeRepo.repoPath}
          refreshKey={activeRepo.refreshKey}
          selectedDiff={selectedDiff}
          pendingFilePreview={pendingFilePreview}
          onFileSelect={setSelectedFilePath}
          onRefresh={handleRefresh}
        />

        {/* Right panel: tab bar + tab content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900 relative">
          <TabBar
            tabs={BASE_INNER_TABS.map((tab) =>
              tab.id === "pending" && lfsLockCount > 0
                ? { ...tab, label: `Pending [${lfsLockCount} Locked]` }
                : tab
            )}
            activeTab={activeRepo.activeTab}
            onTabChange={handleTabChange}
          />
          {activeRepo.activeTab === "pending" && (
            <PendingTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onFilePreview={(filename, staged) => setPendingFilePreview({ filename, staged })}
              onLfsLockCountChange={setLfsLockCount}
            />
          )}
          <Suspense fallback={null}>
          {activeRepo.activeTab === "history" && (
            <HistoryTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onRefresh={handleRefresh}
              onFileSelect={setSelectedDiff}
            />
          )}
          {activeRepo.activeTab === "branches" && (
            <BranchTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onRefresh={handleRefresh}
            />
          )}
          {activeRepo.activeTab === "remotes" && (
            <RemoteTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onRefresh={handleRefresh}
            />
          )}
          {activeRepo.activeTab === "tags" && (
            <TagTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onRefresh={handleRefresh}
            />
          )}
          {activeRepo.activeTab === "worktrees" && (
            <WorktreeTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onRefresh={handleRefresh}
              onOpenRepo={(path) => handleOpenRepo(path)}
            />
          )}
          {activeRepo.activeTab === "stash" && (
            <StashTab
              repoPath={activeRepo.repoPath}
              refreshKey={activeRepo.refreshKey}
              onRefresh={handleRefresh}
            />
          )}
          </Suspense>
          {/* TimeLapse overlay */}
          {showTimeLapse && selectedFilePath && (
            <Suspense fallback={null}>
            <div className="absolute inset-0 z-40">
              <TimeLapsePanel
                repoPath={activeRepo.repoPath}
                filePath={selectedFilePath}
                onClose={() => setShowTimeLapse(false)}
              />
            </div>
            </Suspense>
          )}
        </main>
      </div>

      <GitLogPanel />

      <footer className="px-4 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => handleOpenRepo()}
          className="hover:text-blue-600 hover:underline"
        >
          {activeRepo.repoPath}
        </button>
      </footer>

      {/* Plugin modal overlay */}
      {showPluginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-[90vw] h-[85vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Plugins</h2>
              <button
                onClick={() => setShowPluginModal(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Suspense fallback={null}>
              <PluginTab
                repoPath={activeRepo.repoPath}
                onRefresh={() => {
                  handleRefresh();
                  reloadPlugins();
                }}
                onPluginChanged={reloadPlugins}
              />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
