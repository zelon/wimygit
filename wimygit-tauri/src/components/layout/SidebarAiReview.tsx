import { useEffect, useRef, useState } from "react";
import {
  aiModelLabel,
  type AiReviewIssue,
  type AiReviewKind,
  type AiReviewSeverity,
  type AiReviewState,
} from "../../lib";

const SEVERITY_STYLE: Record<AiReviewSeverity, { label: string; cls: string }> = {
  error: { label: "ERROR", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  warning: { label: "WARN", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  info: { label: "INFO", cls: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
};

const SEVERITY_ORDER: Record<AiReviewSeverity, number> = { error: 0, warning: 1, info: 2 };

interface SidebarAiReviewProps {
  review: AiReviewState;
  onFileClick?: (filename: string, kind: AiReviewKind, isUntracked: boolean) => void;
}

function groupByFile(issues: AiReviewIssue[]): [string, AiReviewIssue[]][] {
  const map = new Map<string, AiReviewIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.file) ?? [];
    list.push(issue);
    map.set(issue.file, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.line ?? 0) - (b.line ?? 0));
  }
  return [...map.entries()];
}

function issueLocation(issue: AiReviewIssue): string {
  const file = issue.file || "(general)";
  return issue.line !== undefined ? `${file}:${issue.line}` : file;
}

function formatIssue(issue: AiReviewIssue): string {
  return `[${SEVERITY_STYLE[issue.severity].label}] ${issueLocation(issue)}\n${issue.message}`;
}

function formatReview(review: AiReviewState, groups: [string, AiReviewIssue[]][]): string {
  const { kind, fileCount, at, result } = review;
  const lines = [
    `AI review of ${kind} changes (${fileCount} file${fileCount === 1 ? "" : "s"}, ${new Date(at).toLocaleString()})`,
  ];
  if (!result) return lines.join("\n");
  if (result.truncated) lines.push("Note: diff was truncated (first 100k chars reviewed)");
  if (result.summary) lines.push("", `Summary: ${result.summary}`);
  if (groups.length === 0) lines.push("", "No issues found");
  for (const [, issues] of groups) {
    for (const issue of issues) lines.push("", formatIssue(issue));
  }
  return lines.join("\n");
}

// Small copy-to-clipboard button that briefly shows "Copied".
function CopyButton({ text, label, title, className = "" }: { text: string; label: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <button
      onClick={handleClick}
      title={title}
      className={`shrink-0 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-[10px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap ${className}`}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

export function SidebarAiReview({ review, onFileClick }: SidebarAiReviewProps) {
  const { kind, status, result, error, fileCount, at, untrackedFiles, providerName } = review;
  const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const kindLabel = kind === "staged" ? "Staged changes" : "Unstaged changes";

  const groups = status === "done" && result ? groupByFile(result.issues) : [];

  const handleClick = (file: string) => {
    if (!file) return;
    onFileClick?.(file, kind, untrackedFiles.includes(file));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="shrink-0 px-3 py-1.5 text-xs border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-1.5">
        <span className="text-purple-600 dark:text-purple-400">✦</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">{kindLabel}</span>
        <span className="flex-1 truncate text-gray-400">· by {providerName} - {aiModelLabel(review)} · {fileCount} file{fileCount === 1 ? "" : "s"} · {time}</span>
        {status === "done" && result && (
          <CopyButton text={formatReview(review, groups)} label="Copy all" title="Copy the whole review to the clipboard" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto text-xs">
        {status === "loading" && (
          <div className="px-3 py-3 text-gray-500 dark:text-gray-400 animate-pulse">
            Reviewing {kind} changes…
          </div>
        )}

        {status === "error" && (
          <div className="px-3 py-3 text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
            {error}
          </div>
        )}

        {status === "done" && result && (
          <>
            {result.truncated && (
              <div className="px-3 py-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                ⚠ Diff truncated (first 100k chars reviewed)
              </div>
            )}
            {result.summary && (
              <div className="px-3 py-2 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                {result.summary}
              </div>
            )}
            {result.issues.length === 0 ? (
              <div className="px-3 py-3 text-green-600 dark:text-green-400">✓ No issues found</div>
            ) : (
              groups.map(([file, issues]) => (
                <div key={file} className="border-b border-gray-100 dark:border-gray-800">
                  {/* div, not button: it contains the Copy button */}
                  <div
                    onClick={() => handleClick(file)}
                    title={file ? "Show diff" : undefined}
                    className="w-full flex items-center gap-1 px-3 py-1 cursor-pointer font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="flex-1 truncate font-mono">{file || "(general)"}</span>
                    <span className="text-gray-400 shrink-0">({issues.length})</span>
                    <CopyButton
                      text={issues.map(formatIssue).join("\n\n")}
                      label="Copy"
                      title={`Copy all ${issues.length} issue${issues.length === 1 ? "" : "s"} for this file`}
                      className="ml-1"
                    />
                  </div>
                  {issues.map((issue, idx) => {
                    const sev = SEVERITY_STYLE[issue.severity];
                    return (
                      <div
                        key={idx}
                        onClick={() => handleClick(file)}
                        className="group pl-5 pr-3 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1 rounded text-[10px] font-bold ${sev.cls}`}>{sev.label}</span>
                          {issue.line !== undefined && (
                            <span className="text-gray-400 font-mono">L{issue.line}</span>
                          )}
                          <CopyButton
                            text={formatIssue(issue)}
                            label="Copy"
                            title="Copy file, line and message"
                            className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100"
                          />
                        </div>
                        <div className="mt-0.5 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                          {issue.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
