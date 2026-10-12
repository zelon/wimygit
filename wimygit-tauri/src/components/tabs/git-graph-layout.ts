import type { CommitInfo } from "../../lib";

// ─── constants ───────────────────────────────────────────────────────────────

const GRAPH_COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#22c55e", // green
  "#ef4444", // red
  "#ec4899", // pink
  "#f97316", // orange
];

// ─── types ───────────────────────────────────────────────────────────────────

interface GraphLine {
  fromCol: number;
  toCol: number;
  color: string;
  convergent?: boolean; // ends at node (cy) instead of bottom (ROW_H)
  noTop?: boolean;      // vertical line starts at cy instead of y=0 (first commit in lane)
}

export interface GraphRow {
  col: number;           // which column this commit sits in
  color: string;         // node color
  lines: GraphLine[];    // lines going DOWN from this row to next
  maxCol: number;        // max column index (for SVG width)
  isMerge: boolean;      // true if commit has 2+ parents
}

// ─── layout algorithm ────────────────────────────────────────────────────────

export function computeGraphLayout(commits: CommitInfo[]): GraphRow[] {
  // lanes[i] = hash of the commit expected at lane i, or null if empty
  const lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];

  for (let r = 0; r < commits.length; r++) {
    const commit = commits[r];
    const hash = commit.hash;
    const parentHashes = commit.parents;

    // Find which lane this commit occupies
    let col = lanes.indexOf(hash);
    let isNewLane = false;
    if (col === -1) {
      // New branch: find first empty slot or append
      isNewLane = true;
      const empty = lanes.indexOf(null);
      col = empty !== -1 ? empty : lanes.length;
      lanes[col] = hash;
    }

    const color = GRAPH_COLORS[col % GRAPH_COLORS.length];

    // Lines going from this row down to the next row
    const lines: GraphLine[] = [];
    const newLanes = new Set<number>(); // lanes created in THIS row (no upward line)

    // Close any OTHER lanes that also point to this commit (ghost lane fix)
    for (let i = 0; i < lanes.length; i++) {
      if (i !== col && lanes[i] === hash) {
        lines.push({ fromCol: i, toCol: col, color: GRAPH_COLORS[i % GRAPH_COLORS.length], convergent: true });
        lanes[i] = null;
      }
    }

    // Handle parents
    if (parentHashes.length === 0) {
      // Root commit: close this lane
      lanes[col] = null;
    } else {
      // First parent continues in the same lane
      lanes[col] = parentHashes[0];

      // Additional parents (merge)
      for (let p = 1; p < parentHashes.length; p++) {
        const parentHash = parentHashes[p];
        const existingLane = lanes.indexOf(parentHash);
        if (existingLane !== -1) {
          // Parent already has a lane — draw merge line to it
          lines.push({ fromCol: col, toCol: existingLane, color: GRAPH_COLORS[existingLane % GRAPH_COLORS.length] });
        } else {
          // Parent needs a new lane
          const emptySlot = lanes.indexOf(null);
          const newLane = emptySlot !== -1 ? emptySlot : lanes.length;
          lanes[newLane] = parentHash;
          newLanes.add(newLane);
          lines.push({ fromCol: col, toCol: newLane, color: GRAPH_COLORS[newLane % GRAPH_COLORS.length] });
        }
      }
    }

    // Draw continuation lines for active lanes that EXISTED before this row
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] !== null && i !== col && !newLanes.has(i)) {
        lines.push({ fromCol: i, toCol: i, color: GRAPH_COLORS[i % GRAPH_COLORS.length] });
      }
    }
    // The current lane also continues if it has a parent
    if (parentHashes.length > 0) {
      lines.push({ fromCol: col, toCol: col, color, noTop: isNewLane });
    }

    // Trim trailing nulls from lanes
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
    }

    const maxCol = Math.max(col, lanes.length - 1, ...lines.map(l => Math.max(l.fromCol, l.toCol)));

    rows.push({ col, color, lines, maxCol: Math.max(maxCol, 0), isMerge: parentHashes.length >= 2 });
  }

  return rows;
}

// ─── linear layout (path-filtered history) ───────────────────────────────────

export function computeLinearLayout(count: number): GraphRow[] {
  const color = GRAPH_COLORS[0];
  return Array.from({ length: count }, (_, i) => ({
    col: 0,
    color,
    lines: i < count - 1 ? [{ fromCol: 0, toCol: 0, color }] : [],
    maxCol: 0,
    isMerge: false,
  }));
}
