import type { DirEntry } from "../../lib";

// ─── tree node ────────────────────────────────────────────────────────────────

export interface TreeNode extends DirEntry {
  children: TreeNode[];
  expanded: boolean;
  loaded: boolean;
}

export function makeNode(entry: DirEntry): TreeNode {
  return { ...entry, children: [], expanded: false, loaded: false };
}

export function patchNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode
): TreeNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) return updater(n);
    if (n.children.length > 0)
      return { ...n, children: patchNode(n.children, targetPath, updater) };
    return n;
  });
}
