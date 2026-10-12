import type { GraphRow } from "./git-graph-layout";

// ─── constants ───────────────────────────────────────────────────────────────

export const COL_W = 16;   // horizontal spacing per lane
export const ROW_H = 28;   // row height (must match the commit row height)
const NODE_R = 4;           // commit node radius

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
      {row.isMerge ? (
        <>
          <circle cx={cx} cy={cy} r={NODE_R + 2} className="fill-white dark:fill-gray-900" />
          <circle cx={cx} cy={cy} r={NODE_R + 1} fill="none" stroke={row.color} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={1.5} fill={row.color} />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={NODE_R} fill={row.color} />
      )}
    </svg>
  );
}
