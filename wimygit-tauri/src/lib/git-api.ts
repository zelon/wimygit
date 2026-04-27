import { invoke } from "@tauri-apps/api/core";
import type {
  GitResult,
  GitStatus,
  BranchInfo,
  RemoteInfo,
  StashEntry,
  CommitInfo,
  CommitFile,
  TagInfo,
  WorktreeInfo,
  DirEntry,
  PluginInfo,
  PluginArgument,
  FileCommit,
  BlameEntry,
} from "./git-types";

// ============= Git Executor =============

export async function findGitPath(): Promise<string> {
  return invoke<string>("find_git_path");
}

export async function runGit(args: string[], cwd: string): Promise<GitResult> {
  return invoke<GitResult>("run_git", { args, cwd });
}

export async function runGitSimple(
  args: string[],
  cwd: string
): Promise<string> {
  const result = await runGit(args, cwd);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || `git ${args[0]} failed`);
  }
  return result.stdout;
}

export async function isGitRepository(path: string): Promise<boolean> {
  return invoke<boolean>("is_git_repository", { path });
}

export async function getRepositoryRoot(path: string): Promise<string> {
  return invoke<string>("get_repository_root", { path });
}

export async function getGitAuthor(
  cwd: string
): Promise<{ name: string; email: string }> {
  const [name, email] = await invoke<[string, string]>("get_git_author", {
    cwd,
  });
  return { name, email };
}

// ============= TimeLapse =============

/** Get all commits that touched a file, following renames. Newest first. */
export async function getFileCommits(
  cwd: string,
  filePath: string
): Promise<FileCommit[]> {
  return invoke<FileCommit[]>("get_file_commits", { cwd, filePath });
}

/** Get blame for every line of a file at the given commit (or HEAD if empty). */
export async function getBlameAtCommit(
  cwd: string,
  commitHash: string,
  filePath: string
): Promise<BlameEntry[]> {
  return invoke<BlameEntry[]>("get_blame_at_commit", { cwd, commitHash, filePath });
}

// ============= Git Status =============

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  return invoke<GitStatus>("parse_git_status", { cwd });
}

// ============= Git Branches =============

export async function getBranches(cwd: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>("get_branches", { cwd });
}

export async function getCurrentBranch(cwd: string): Promise<string> {
  return invoke<string>("get_current_branch", { cwd });
}

// ============= Git Remotes =============

export async function getRemotes(cwd: string): Promise<RemoteInfo[]> {
  return invoke<RemoteInfo[]>("get_remotes", { cwd });
}

export async function addRemote(
  cwd: string,
  name: string,
  url: string
): Promise<void> {
  return invoke<void>("add_remote", { cwd, name, url });
}

export async function removeRemote(cwd: string, name: string): Promise<void> {
  return invoke<void>("remove_remote", { cwd, name });
}

// ============= Git Stash =============

export async function getStashList(cwd: string): Promise<StashEntry[]> {
  return invoke<StashEntry[]>("get_stash_list", { cwd });
}

export async function stashPush(
  cwd: string,
  message?: string,
  includeUntracked: boolean = false
): Promise<void> {
  return invoke<void>("stash_push", {
    cwd,
    message,
    include_untracked: includeUntracked,
  });
}

export async function stashApply(cwd: string, index: number): Promise<void> {
  return invoke<void>("stash_apply", { cwd, index });
}

export async function stashPop(cwd: string, index: number): Promise<void> {
  return invoke<void>("stash_pop", { cwd, index });
}

export async function stashDrop(cwd: string, index: number): Promise<void> {
  return invoke<void>("stash_drop", { cwd, index });
}

// ============= Git Operations =============

export async function gitFetch(
  cwd: string,
  remote: string = "origin"
): Promise<string> {
  return runGitSimple(["fetch", remote], cwd);
}

export async function gitFetchAll(cwd: string): Promise<string> {
  return runGitSimple(["fetch", "--all"], cwd);
}

export async function gitPull(
  cwd: string,
  remote: string = "origin",
  branch?: string
): Promise<string> {
  const args = ["pull", remote];
  if (branch) args.push(branch);
  return runGitSimple(args, cwd);
}

export async function gitPush(
  cwd: string,
  remote: string = "origin",
  branch?: string,
  setUpstream: boolean = false
): Promise<string> {
  const args = ["push"];
  if (setUpstream) args.push("-u");
  args.push(remote);
  if (branch) args.push(branch);
  return runGitSimple(args, cwd);
}

export async function gitCommit(
  cwd: string,
  message: string,
  amend: boolean = false
): Promise<string> {
  const args = ["commit"];
  if (amend) args.push("--amend");
  args.push("-m", message);
  return runGitSimple(args, cwd);
}

export async function getLastCommitMessage(cwd: string): Promise<string> {
  return runGitSimple(["log", "-1", "--pretty=format:%B"], cwd);
}

export async function gitStage(cwd: string, files: string[]): Promise<string> {
  return runGitSimple(["add", ...files], cwd);
}

export async function gitUnstage(
  cwd: string,
  files: string[]
): Promise<string> {
  return runGitSimple(["reset", "HEAD", "--", ...files], cwd);
}

export async function gitDiscard(
  cwd: string,
  files: string[]
): Promise<string> {
  return runGitSimple(["checkout", "--", ...files], cwd);
}

export async function gitCheckout(
  cwd: string,
  branch: string
): Promise<string> {
  return runGitSimple(["checkout", branch], cwd);
}

export async function gitCreateBranch(
  cwd: string,
  name: string,
  checkout: boolean = true
): Promise<string> {
  if (checkout) {
    return runGitSimple(["checkout", "-b", name], cwd);
  }
  return runGitSimple(["branch", name], cwd);
}

export async function gitDeleteBranch(
  cwd: string,
  name: string,
  force: boolean = false
): Promise<string> {
  const flag = force ? "-D" : "-d";
  return runGitSimple(["branch", flag, name], cwd);
}

export async function gitMerge(
  cwd: string,
  branch: string
): Promise<string> {
  return runGitSimple(["merge", branch], cwd);
}

export async function gitLog(
  cwd: string,
  count: number = 50,
  format: string = "%H|%an|%ae|%at|%s"
): Promise<string> {
  return runGitSimple(
    ["log", `-${count}`, `--pretty=format:${format}`],
    cwd
  );
}

export async function gitDiff(
  cwd: string,
  file?: string,
  staged: boolean = false
): Promise<string> {
  const args = ["diff"];
  if (staged) args.push("--cached");
  if (file) args.push(file);
  return runGitSimple(args, cwd);
}

// ============= Git History =============

export async function getHistory(
  cwd: string,
  path: string = "",
  skip: number = 0,
  count: number = 100
): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("get_history", { cwd, path, skip, count });
}

export async function getCommitFiles(
  cwd: string,
  commitId: string
): Promise<CommitFile[]> {
  return invoke<CommitFile[]>("get_commit_files", { cwd, commitId: commitId });
}

export async function getCommitDiff(
  cwd: string,
  commitId: string,
  filePath: string,
  filePath2?: string,
  parentHash?: string,
  contextLines?: number,
): Promise<string> {
  return invoke<string>("get_commit_diff", {
    cwd,
    commitId,
    filePath,
    filePath2: filePath2 ?? null,
    parentHash: parentHash ?? null,
    contextLines: contextLines ?? null,
  });
}

export async function getDiff(
  cwd: string,
  staged: boolean = false,
  filePath?: string,
  contextLines?: number,
  parent?: string,
): Promise<string> {
  return invoke<string>("get_diff", {
    cwd,
    staged,
    filePath: filePath ?? null,
    contextLines: contextLines ?? null,
    parent: parent ?? null,
  });
}

export async function getCommitParents(cwd: string, commitId: string): Promise<string[]> {
  return invoke<string[]>("get_commit_parents", { cwd, commitId });
}

export async function runDifftool(cwd: string, args: string[]): Promise<void> {
  return invoke<void>("run_difftool", { cwd, args });
}

// ============= Git Tags =============

export async function getTags(cwd: string): Promise<TagInfo[]> {
  return invoke<TagInfo[]>("get_tags", { cwd });
}

export async function createTag(
  cwd: string,
  name: string,
  target?: string,
  message?: string
): Promise<void> {
  return invoke<void>("create_tag", {
    cwd,
    name,
    target: target ?? null,
    message: message ?? null,
  });
}

export async function deleteTag(cwd: string, name: string): Promise<void> {
  return invoke<void>("delete_tag", { cwd, name });
}

export async function pushTag(
  cwd: string,
  remote: string,
  name: string
): Promise<void> {
  return invoke<void>("push_tag", { cwd, remote, name });
}

// ============= Git Worktrees =============

export async function getWorktrees(cwd: string): Promise<WorktreeInfo[]> {
  return invoke<WorktreeInfo[]>("get_worktrees", { cwd });
}

export async function addWorktree(
  cwd: string,
  path: string,
  branch: string,
  isNewBranch: boolean
): Promise<void> {
  return invoke<void>("add_worktree", {
    cwd,
    path,
    branch,
    isNewBranch,
  });
}

export async function removeWorktree(cwd: string, path: string): Promise<void> {
  return invoke<void>("remove_worktree", { cwd, path });
}

// ============= Filesystem =============

export async function listDirEntries(dirPath: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_dir_entries", { dirPath });
}

export async function openInFileManager(path: string): Promise<void> {
  return invoke<void>("open_in_file_manager", { path });
}

export async function openInTerminal(path: string): Promise<void> {
  return invoke<void>("open_in_terminal", { path });
}

// ============= Plugins =============

export async function getPluginDir(): Promise<string> {
  return invoke<string>("get_plugin_dir");
}

export async function loadPlugins(pluginDir: string): Promise<PluginInfo[]> {
  return invoke<PluginInfo[]>("load_plugins", { pluginDir });
}

export async function runPlugin(
  command: string,
  args: PluginArgument[],
  executionType: string,
  repoPath: string
): Promise<string> {
  return invoke<string>("run_plugin", {
    command,
    arguments: args,
    executionType,
    repoPath,
  });
}

export async function removePluginDir(pluginDir: string): Promise<void> {
  return invoke<void>("remove_plugin_dir", { pluginDir });
}

export async function installPlugin(
  pluginsDir: string,
  gitUrl: string
): Promise<string> {
  return invoke<string>("run_git_simple", {
    args: ["clone", gitUrl],
    cwd: pluginsDir,
  });
}

export async function updatePlugin(pluginDir: string): Promise<string> {
  return invoke<string>("run_git_simple", { args: ["pull"], cwd: pluginDir });
}

// ============= App commands =============

export async function getExecutableDir(): Promise<string> {
  return invoke<string>("get_executable_dir");
}

export async function getConfigDir(): Promise<string> {
  return invoke<string>("get_config_dir");
}
