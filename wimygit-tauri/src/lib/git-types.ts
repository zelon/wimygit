// Git execution result
export interface GitResult {
  stdout: string;
  stderr: string;
  exit_code: number;
}

// File status types
export type FileStatusType =
  | "Added"
  | "Modified"
  | "Deleted"
  | "Renamed"
  | "Copied"
  | "Untracked"
  | "Ignored"
  | "Unmerged";

// Single file status
export interface FileStatus {
  filename: string;
  original_filename: string | null;
  staged_status: FileStatusType | null;
  unstaged_status: FileStatusType | null;
  is_unmerged: boolean;
}

// Overall git status
export interface GitStatus {
  staged: FileStatus[];
  modified: FileStatus[];
  untracked: FileStatus[];
  unmerged: FileStatus[];
}

// Branch information
export interface BranchInfo {
  name: string;
  commit_id: string;
  commit_message: string;
  is_current: boolean;
  is_remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

// Remote information
export interface RemoteInfo {
  name: string;
  fetch_url: string;
  push_url: string;
}

// Stash entry
export interface StashEntry {
  index: number;
  branch: string;
  message: string;
  full_ref: string;
}

// Plugin argument
export interface PluginArgument {
  arg_type: "string" | "repository_directory" | "inputbox";
  value: string;
}

// Plugin definition loaded from Plugin.xml
export interface PluginInfo {
  name: string;
  title: string;
  description: string;
  command: string;
  arguments: PluginArgument[];
  execution_type:
    | "WithoutShellAndNoWaiting"
    | "KeepShellAndNoWaiting"
    | "WimyGitInnerShellAndRefreshRepositoryStatus";
  icon_path: string | null;
  plugin_dir: string;
  load_error?: string;
}

// Tag information
export interface TagInfo {
  name: string;
  commit_id: string;
  is_annotated: boolean;
}

// Worktree information
export interface WorktreeInfo {
  path: string;
  commit_hash: string;
  branch: string;
  is_main: boolean;
  is_locked: boolean;
  is_bare: boolean;
}

// Directory entry (for file tree)
export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  has_children: boolean;
}

// Selected diff info — shared between HistoryTab and QuickDiff sidebar
export interface SelectedDiffInfo {
  commitId: string;
  commit: CommitInfo;
  file: CommitFile;
  parents: string[];
}

// Commit history entry
export interface CommitInfo {
  hash: string;
  short_hash: string;
  author: string;
  timestamp: number;
  message: string;
  ref_names: string;
  graph: string;
}

// File changed in a commit
export interface CommitFile {
  status: string;
  filename: string;
  filename2: string | null;
  display: string;
}

// A commit that touched a specific file (from git log --follow)
export interface FileCommit {
  hash: string;
  short_hash: string;
  summary: string;
  author_name: string;
  author_email: string;
  /** ISO 8601: "2024-03-12 09:15:23 +0900" */
  author_date: string;
}

// A single blamed line (from git blame --line-porcelain)
export interface BlameEntry {
  commit_hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  /** Unix timestamp in seconds */
  author_time: number;
  summary: string;
  /** 1-based line number */
  line_no: number;
  content: string;
}
