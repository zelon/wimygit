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

export const COL_W = 16;   // horizontal spacing per lane
export const ROW_H = 28;   // row height (must match the commit row height)
const NODE_R = 4;           // commit node radius

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

    rows.push({ col, color, lines, maxCol: Math.max(maxCol, 0) });
  }

  return rows;
}

// ─── SVG component ───────────────────────────────────────────────────────────

export function GraphSvg({ row }: { row: GraphRow }) {
  const w = (row.maxCol + 1) * COL_W + NODE_R * 2;
  const cx = row.col * COL_W + COL_W / 2;
  const cy = ROW_H / 2;

  return (
    <svg width={w} height={ROW_H} className="shrink-0 select-none" style={{ minWidth: w }}>
      {/* Lines */}
      {row.lines.map((line, i) => {
        const x1 = line.fromCol * COL_W + COL_W / 2;
        const x2 = line.toCol * COL_W + COL_W / 2;
        if (x1 === x2) {
          // Straight vertical line (noTop: start at node instead of top)
          const y1 = line.noTop ? cy : 0;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={ROW_H} stroke={line.color} strokeWidth={2} />;
        } else if (line.convergent) {
          // Convergence: lane from above (y=0) curves into the commit node (cy)
          return (
            <path key={i}
              d={`M ${x1} 0 C ${x1} ${cy}, ${x2} 0, ${x2} ${cy}`}
              fill="none" stroke={line.color} strokeWidth={2} />
          );
        } else {
          // Branch/merge from node: starts at commit node (cy), curves to target at bottom
          return (
            <path key={i}
              d={`M ${x1} ${cy} C ${x1} ${ROW_H}, ${x2} ${cy}, ${x2} ${ROW_H}`}
              fill="none" stroke={line.color} strokeWidth={2} />
          );
        }
      })}
      {/* Commit node */}
      <circle cx={cx} cy={cy} r={NODE_R} fill={row.color} />
    </svg>
  );
}
