import { useState, useEffect, useCallback } from "react";
import { type SelectedDiffInfo, type AiReviewKind, type AiReviewState } from "../../lib";
import { WorkspaceTree } from "./WorkspaceTree";
import { SidebarQuickDiff, type PendingFilePreview, type BranchFileDiffInfo } from "./SidebarQuickDiff";
import { SidebarAiReview } from "./SidebarAiReview";

// ─── constants ────────────────────────────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 200;
const MIN_MAIN_PANEL_WIDTH = 200;

type BaseTab = "workspace" | "quickdiff";
// AI review tabs are keyed by review id: `ai:<id>`.
type LeftTab = BaseTab | `ai:${string}`;

const aiTabId = (id: string): LeftTab => `ai:${id}`;

// Stable default: the open-tab tracking below compares `aiReviews` by reference.
const EMPTY_AI_REVIEWS: AiReviewState[] = [];

function savedBaseTab(): BaseTab {
  const saved = localStorage.getItem("sidebar_tab");
  return saved === "quickdiff" ? "quickdiff" : "workspace";
}

// ─── AI review tab status ─────────────────────────────────────────────────────

function aiReviewStatusText(review: AiReviewState): string {
  if (review.status === "loading") return "reviewing…";
  if (review.status === "error") return "failed";
  const n = review.result?.issues.length ?? 0;
  return n === 0 ? "no issues" : `${n} issue${n === 1 ? "" : "s"}`;
}

function AiReviewStatusIcon({ review }: { review: AiReviewState }) {
  if (review.status === "loading") {
    return (
      <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
    );
  }
  if (review.status === "error") return <span className="text-red-500">⚠</span>;
  return <span className="text-purple-500">✦</span>;
}

function AiReviewResultBadge({ review }: { review: AiReviewState }) {
  if (review.status !== "done" || !review.result) return null;
  const { issues } = review.result;
  if (issues.length === 0) return <span className="text-green-600 dark:text-green-400">✓</span>;
  const hasError = issues.some((i) => i.severity === "error");
  return (
    <span className={hasError ? "text-red-500" : "text-gray-400"}>({issues.length})</span>
  );
}

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
  aiReviews?: AiReviewState[];
  onAiReviewClose?: (id: string) => void;
  onAiReviewFileClick?: (filename: string, kind: AiReviewKind, isUntracked: boolean) => void;
}

export function LeftSidebar({ repoPath, refreshKey, selectedDiff, pendingFilePreview, branchFileDiff, onFileSelect, onRefresh, highlightPath, aiReviews = EMPTY_AI_REVIEWS, onAiReviewClose, onAiReviewFileClick }: LeftSidebarProps) {
  const [width, setWidth] = useState(() => {
    const quarter = Math.round(window.innerWidth / 4);
    return Math.max(MIN_SIDEBAR_WIDTH, quarter);
  });
  const [activeTab, setActiveTab] = useState<LeftTab>(savedBaseTab);
  // A closed review's tab falls back to the last non-AI tab.
  const activeReview = aiReviews.find((r) => aiTabId(r.id) === activeTab);
  const visibleTab: LeftTab =
    activeTab.startsWith("ai:") && !activeReview ? savedBaseTab() : activeTab;

  // Focus a review's tab only when it is opened (an id not seen before) — not
  // when a review finishes or another one is closed; the user may be on a
  // different tab by then.
  const [prevAiReviews, setPrevAiReviews] = useState(aiReviews);
  if (aiReviews !== prevAiReviews) {
    setPrevAiReviews(aiReviews);
    const prevIds = new Set(prevAiReviews.map((r) => r.id));
    const opened = aiReviews.filter((r) => !prevIds.has(r.id));
    if (opened.length > 0) setActiveTab(aiTabId(opened[opened.length - 1].id));
  }

  // Auto-switch to Quick Diff when a commit file or pending file is selected.
  // Adjusted during render (not in an effect) per the React-recommended
  // "storing the previous value in state to react to a prop change" pattern —
  // this fires synchronously before paint, with no extra render/flicker.
  const [prevSelectedDiff, setPrevSelectedDiff] = useState<SelectedDiffInfo | null | undefined>(undefined);
  if (selectedDiff !== prevSelectedDiff) {
    setPrevSelectedDiff(selectedDiff);
    if (selectedDiff) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
  }

  const [prevPendingFilePreview, setPrevPendingFilePreview] = useState<PendingFilePreview | null | undefined>(undefined);
  if (pendingFilePreview !== prevPendingFilePreview) {
    setPrevPendingFilePreview(pendingFilePreview);
    if (pendingFilePreview) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
  }

  const [prevBranchFileDiff, setPrevBranchFileDiff] = useState<BranchFileDiffInfo | null | undefined>(undefined);
  if (branchFileDiff !== prevBranchFileDiff) {
    setPrevBranchFileDiff(branchFileDiff);
    if (branchFileDiff) {
      setActiveTab("quickdiff");
      localStorage.setItem("sidebar_tab", "quickdiff");
    }
  }

  // Auto-switch to Workspace tab when highlightPath is set.
  // highlightPath is a new object reference on every click (even for the same
  // path), so comparing by reference reproduces the original "fires on every
  // click" behavior.
  const [prevHighlightPath, setPrevHighlightPath] = useState(highlightPath);
  if (highlightPath !== prevHighlightPath) {
    setPrevHighlightPath(highlightPath);
    if (highlightPath) {
      setActiveTab("workspace");
      localStorage.setItem("sidebar_tab", "workspace");
    }
  }

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
    if (!tab.startsWith("ai:")) localStorage.setItem("sidebar_tab", tab);
  };

  return (
    <div style={{ width, minWidth: MIN_SIDEBAR_WIDTH }} className="flex shrink-0">
      {/* Panel */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">

        {/* ── Tab bar ── */}
        <div className="shrink-0 flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          {([
            { id: "workspace", label: "Workspace" },
            { id: "quickdiff", label: "Quick Diff" },
            ...aiReviews.map((r) => ({
              id: aiTabId(r.id),
              label: `AI Review for ${r.kind}`,
              title: `AI review of ${r.kind} changes · ${new Date(r.at).toLocaleTimeString()} · ${aiReviewStatusText(r)}`,
              review: r,
            })),
          ] as { id: LeftTab; label: string; title?: string; review?: AiReviewState }[]).map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              title={tab.title}
              className={`
                shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer select-none transition-colors border-b-2 -mb-px
                ${visibleTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                }
              `}
            >
              {tab.review && <AiReviewStatusIcon review={tab.review} />}
              <span>{tab.label}</span>
              {tab.review && <AiReviewResultBadge review={tab.review} />}
              {tab.review && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAiReviewClose?.(tab.review!.id);
                  }}
                  title={tab.review.status === "loading" ? "Cancel review and close" : "Close"}
                  className="-mr-1 px-0.5 rounded leading-none text-gray-400 hover:text-gray-700 hover:bg-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {visibleTab === "workspace" && (
            <WorkspaceTree repoPath={repoPath} refreshKey={refreshKey} onFileSelect={onFileSelect} onRefresh={onRefresh} selectPath={highlightPath} />
          )}
          {visibleTab === "quickdiff" && (
            <SidebarQuickDiff
              repoPath={repoPath}
              selectedDiff={selectedDiff}
              pendingFilePreview={pendingFilePreview}
              branchFileDiff={branchFileDiff}
              onRefresh={onRefresh}
            />
          )}
          {visibleTab === activeTab && activeReview && (
            <SidebarAiReview review={activeReview} onFileClick={onAiReviewFileClick} />
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
