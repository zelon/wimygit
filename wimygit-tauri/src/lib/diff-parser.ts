export interface ParsedLine {
  type: "added" | "removed" | "context";
  content: string;
  oldLineNum: number; // 0 if not applicable (added line)
  newLineNum: number; // 0 if not applicable (removed line)
  blockId: number;    // -1 for context; >=0 groups consecutive changed lines
}

export interface ParsedHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: ParsedLine[];
}

export interface FileDiff {
  filename: string;
  header: string[]; // diff --git, index, ---, +++ lines
  hunks: ParsedHunk[];
}

function parseHunkCoords(header: string) {
  const m = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!m) return { oldStart: 1, oldCount: 0, newStart: 1, newCount: 0 };
  return {
    oldStart: parseInt(m[1]),
    oldCount: m[2] !== undefined ? parseInt(m[2]) : 1,
    newStart: parseInt(m[3]),
    newCount: m[4] !== undefined ? parseInt(m[4]) : 1,
  };
}

export function parseDiffIntoHunks(diff: string): FileDiff[] {
  const result: FileDiff[] = [];
  let current: FileDiff | null = null;
  let currentHunk: ParsedHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let blockId = -1;
  let inChangedBlock = false;

  const commitHunk = () => {
    if (currentHunk && current) {
      current.hunks.push(currentHunk);
      currentHunk = null;
    }
  };

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) {
      commitHunk();
      if (current) result.push(current);
      current = { filename: "", header: [line], hunks: [] };
      inChangedBlock = false;
    } else if (
      !currentHunk &&
      current &&
      (line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("index ") ||
        line.startsWith("new file") ||
        line.startsWith("deleted file") ||
        line.startsWith("rename ") ||
        line.startsWith("similarity ") ||
        line.startsWith("Binary "))
    ) {
      current.header.push(line);
      if (line.startsWith("+++ b/")) {
        current.filename = line.slice(6);
      } else if (line.startsWith("+++ /dev/null")) {
        const fromLine = current.header.find((h) => h.startsWith("--- a/"));
        if (fromLine) current.filename = fromLine.slice(6);
      }
    } else if (line.startsWith("@@") && current) {
      commitHunk();
      const coords = parseHunkCoords(line);
      oldLineNum = coords.oldStart;
      newLineNum = coords.newStart;
      blockId = -1;
      inChangedBlock = false;
      currentHunk = { header: line, ...coords, lines: [] };
    } else if (currentHunk) {
      if (line.startsWith("\\") || line === "") {
        // "\ No newline at end of file" and trailing empty from split — skip both
      } else if (line.startsWith("+")) {
        if (!inChangedBlock) {
          blockId++;
          inChangedBlock = true;
        }
        currentHunk.lines.push({
          type: "added",
          content: line.slice(1),
          oldLineNum: 0,
          newLineNum: newLineNum++,
          blockId,
        });
      } else if (line.startsWith("-")) {
        if (!inChangedBlock) {
          blockId++;
          inChangedBlock = true;
        }
        currentHunk.lines.push({
          type: "removed",
          content: line.slice(1),
          oldLineNum: oldLineNum++,
          newLineNum: 0,
          blockId,
        });
      } else {
        inChangedBlock = false;
        const content = line.startsWith(" ") ? line.slice(1) : line;
        currentHunk.lines.push({
          type: "context",
          content,
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++,
          blockId: -1,
        });
      }
    }
  }

  commitHunk();
  if (current) result.push(current);

  return result;
}

// Build a minimal valid patch for a single contiguous block of changed lines.
export function buildBlockPatch(
  fileDiff: FileDiff,
  hunkIdx: number,
  blockId: number
): string {
  const hunk = fileDiff.hunks[hunkIdx];
  const lines = hunk.lines;

  // Locate the contiguous block
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].blockId === blockId) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }
  if (firstIdx === -1) return "";

  // All context lines immediately before the block
  const contextBefore: ParsedLine[] = [];
  for (let i = firstIdx - 1; i >= 0 && lines[i].type === "context"; i--) {
    contextBefore.unshift(lines[i]);
  }

  // All context lines immediately after the block
  const contextAfter: ParsedLine[] = [];
  for (
    let i = lastIdx + 1;
    i < lines.length && lines[i].type === "context";
    i++
  ) {
    contextAfter.push(lines[i]);
  }

  const subLines = [
    ...contextBefore,
    ...lines.slice(firstIdx, lastIdx + 1),
    ...contextAfter,
  ];

  // oldCount = context + removed lines; newCount = context + added lines
  const oldCount = subLines.filter((l) => l.type !== "added").length;
  const newCount = subLines.filter((l) => l.type !== "removed").length;

  const firstOldLine = subLines.find((l) => l.type !== "added");
  const firstNewLine = subLines.find((l) => l.type !== "removed");
  const oldStart = firstOldLine?.oldLineNum ?? hunk.oldStart;
  const newStart = firstNewLine?.newLineNum ?? hunk.newStart;

  const hunkHeader = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
  const hunkLines = subLines.map((l) => {
    if (l.type === "added") return `+${l.content}`;
    if (l.type === "removed") return `-${l.content}`;
    return ` ${l.content}`;
  });

  const fileHeader = fileDiff.header.join("\n");
  return `${fileHeader}\n${hunkHeader}\n${hunkLines.join("\n")}\n`;
}
