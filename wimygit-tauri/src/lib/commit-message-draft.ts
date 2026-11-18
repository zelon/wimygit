// Shared, in-memory view of the commit message currently typed in the Pending
// tab, keyed by repository path. The Pending tab owns the actual state and
// publishes it here so other tabs (e.g. History's Revert) can check it.

const drafts = new Map<string, string>();

export function setCommitMessageDraft(repoPath: string, message: string): void {
  if (message) drafts.set(repoPath, message);
  else drafts.delete(repoPath);
}

export function getCommitMessageDraft(repoPath: string): string {
  return drafts.get(repoPath) ?? "";
}
