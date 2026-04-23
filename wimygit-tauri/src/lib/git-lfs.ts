import { invoke } from "@tauri-apps/api/core";

export interface LfsLock {
  filename: string;
  lock_id: string;
  owner: string;
}

export async function hasLfsAttributes(repoPath: string): Promise<boolean> {
  return invoke("has_lfs_attributes", { repoPath });
}

export async function getLfsLockableExtensions(repoPath: string): Promise<string[]> {
  return invoke("get_lfs_lockable_extensions_cmd", { repoPath });
}

export async function checkLfsInstalled(repoPath: string): Promise<boolean> {
  return invoke("check_lfs_installed", { repoPath });
}

export async function getLfsLocks(repoPath: string): Promise<LfsLock[]> {
  return invoke("get_lfs_locks", { repoPath });
}

export async function lfsLockFile(repoPath: string, filename: string): Promise<string> {
  return invoke("lfs_lock_file", { repoPath, filename });
}

export async function lfsUnlockFile(repoPath: string, filename: string): Promise<string> {
  return invoke("lfs_unlock_file", { repoPath, filename });
}

export async function getLfsLocksForFile(repoPath: string, filename: string): Promise<LfsLock[]> {
  return invoke("get_lfs_locks_for_file", { repoPath, filename });
}
