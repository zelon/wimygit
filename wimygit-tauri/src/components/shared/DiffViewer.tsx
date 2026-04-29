interface DiffViewerProps {
  diff: string;
  placeholder?: string;
}

interface DiffLine {
  type: "added" | "removed" | "hunk" | "header" | "context";
  content: string;
  lineNum?: number;
}

function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      lines.push({ type: "header", content: line });
    } else if (line.startsWith("diff ") || line.startsWith("index ")) {
      lines.push({ type: "header", content: line });
    } else if (line.startsWith("@@")) {
      lines.push({ type: "hunk", content: line });
    } else if (line.startsWith("+")) {
      lines.push({ type: "added", content: line });
    } else if (line.startsWith("-")) {
      lines.push({ type: "removed", content: line });
    } else {
      lines.push({ type: "context", content: line });
    }
  }

  return lines;
}

const LINE_CLASSES: Record<DiffLine["type"], string> = {
  added:
    "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-l-2 border-green-400",
  removed:
    "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-l-2 border-red-400",
  hunk: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium",
  header: "text-gray-500 dark:text-gray-400",
  context: "text-gray-700 dark:text-gray-300",
};

export function DiffViewer({ diff, placeholder }: DiffViewerProps) {
  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        {placeholder ?? "No diff to display"}
      </div>
    );
  }

  const lines = parseDiff(diff);

  return (
    <div className="h-full overflow-auto">
      <pre className="text-xs font-mono leading-5 p-0 m-0">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-4 py-0 whitespace-pre-wrap break-all ${LINE_CLASSES[line.type]}`}
          >
            {line.content || "\u00a0"}
          </div>
        ))}
      </pre>
    </div>
  );
}
