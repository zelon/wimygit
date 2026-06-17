import { useState, useEffect, useCallback, useRef } from "react";
import { type SelectedDiffInfo } from "../../lib";
import { WorkspaceTree } from "./WorkspaceTree";
import { SidebarQuickDiff, type PendingFilePreview, type BranchFileDiffInfo } from "./SidebarQuickDiff";

// ─── constants ────────────────────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 200;
const MIN_MAIN_PANEL_WIDTH = 200;

type LeftTab = "workspace" | "quickdiff";

// ─── LeftSidebar ─────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  repoPath: string;
  refreshKey: number;
  selectedDiff?: SelectedDiffInfo | null;
  pendingFilePreview?: PendingFilePreview | null;
  branchFileDiff?: BranchFileDiffInfo | null;
  onFileSelect?: (path: string | null) => void;
  onRefresh?: () => void;
  highlightPath?: { path: string; triggerCount: number } | null;
}

export function LeftSidebar({ repoPath, refreshKey, selectedDiff, pendingFilePreview, branchFileDiff, onFileSelect, onRefresh, highlightPath }: LeftSidebarProps) {
  const [width, setWidth] = useState(() => {
    const quarter = Math.round(window.innerWidth / 4);
    return Math.max(MIN_SIDEBAR_WIDTH, quarter);
  });
  const [activeTab, setActiveTab] = useState<LeftTab>(() =>
    (localStorage.getItem("sidebar_tab") as LeftTab | null) ?? "workspace"
  );

  // Auto-switch to Quick Diff when a commit file or pending file is selected
  const prevSelectedDiff = useRef<SelectedDiffInfo | null | undefined>(undefined);
  useEffect(() => {
    if (selectedDiff && selectedDiff !== prevSelectedDiff.current) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
    prevSelectedDiff.current = selectedDiff;
  }, [selectedDiff]);

  const prevPendingFilePreview = useRef<PendingFilePreview | null | undefined>(undefined);
  useEffect(() => {
    if (pendingFilePreview && pendingFilePreview !== prevPendingFilePreview.current) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
    prevPendingFilePreview.current = pendingFilePreview;
  }, [pendingFilePreview]);

  const prevBranchFileDiff = useRef<BranchFileDiffInfo | null | undefined>(undefined);
  useEffect(() => {
    if (branchFileDiff && branchFileDiff !== prevBranchFileDiff.current) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
    prevBranchFileDiff.current = branchFileDiff;
  }, [branchFileDiff]);

  // Auto-switch to Workspace tab when highlightPath is set
  useEffect(() => {
    if (highlightPath) {
      setActiveTab("workspace");
      localStorage.setItem("sidebar_tab", "workspace");
    }
  }, [highlightPath]); // object reference always changes on each click, so effect always fires

  // ── double-click to toggle 3:1 / 1:3 ratio ──
  const handleDoubleClick = useCallback(() => {
    const total = window.innerWidth;
    const quarter = Math.round(total / 4);
    const threeQuarter = Math.round((total * 3) / 4);
    const tolerance = 30;

    const is3to1 = Math.abs(width - threeQuarter) < tolerance;
    const is1to3 = Math.abs(width - quarter) < tolerance;

    let newW: number;
    if (is3to1) {
      newW = quarter;       // 3:1 → 1:3
    } else if (is1to3) {
      newW = threeQuarter;  // 1:3 → 3:1
    } else {
      // not at either ratio: left is smaller → 3:1, right is smaller → 1:3
      newW = width < total / 2 ? threeQuarter : quarter;
    }

    newW = Math.max(MIN_SIDEBAR_WIDTH, Math.min(total - MIN_MAIN_PANEL_WIDTH, newW));
    setWidth(newW);
  }, [width]);

  // ── horizontal resize ──
  const startHResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      const maxW = window.innerWidth - MIN_MAIN_PANEL_WIDTH;
      const newW = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxW, startW + ev.clientX - startX));
      setWidth(newW);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  // ── clamp sidebar when window shrinks ──
  useEffect(() => {
    const onResize = () => {
      setWidth((prev) => {
        const maxW = window.innerWidth - MIN_MAIN_PANEL_WIDTH;
        if (prev > maxW) return Math.max(MIN_SIDEBAR_WIDTH, maxW);
        return prev;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleTabChange = (tab: LeftTab) => {
    setActiveTab(tab);
    localStorage.setItem("sidebar_tab", tab);
  };

  return (
    <div style={{ width, minWidth: MIN_SIDEBAR_WIDTH }} className="flex shrink-0">
      {/* Panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">

        {/* ── Tab bar ── */}
        <div className="shrink-0 flex border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          {([
            { id: "workspace", label: "Workspace" },
            { id: "quickdiff", label: "Quick Diff" },
          ] as { id: LeftTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px
                ${activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "workspace" && (
            <WorkspaceTree repoPath={repoPath} refreshKey={refreshKey} onFileSelect={onFileSelect} onRefresh={onRefresh} selectPath={highlightPath} />
          )}
          {activeTab === "quickdiff" && (
            <SidebarQuickDiff
              repoPath={repoPath}
              selectedDiff={selectedDiff}
              pendingFilePreview={pendingFilePreview}
              branchFileDiff={branchFileDiff}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>

      {/* ── Horizontal drag handle (right edge) ── */}
      <div
        onMouseDown={startHResize}
        onDoubleClick={handleDoubleClick}
        className="w-3 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors shrink-0"
        title="Drag to resize / Double-click to toggle 3:1 ratio"
      />
    </div>
  );
}
