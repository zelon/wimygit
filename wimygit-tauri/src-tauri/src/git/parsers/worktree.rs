use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub commit_hash: String,
    pub branch: String,
    pub is_main: bool,
    pub is_locked: bool,
    pub is_bare: bool,
}

/// Parse `git worktree list --porcelain` output.
/// Each worktree block is separated by a blank line.
pub fn parse_worktrees(output: &str) -> Vec<WorktreeInfo> {
    let mut worktrees = Vec::new();
    let mut current: Option<WorktreeInfo> = None;
    let mut is_first = true;

    for line in output.lines() {
        let line = line.trim();

        if line.is_empty() {
            if let Some(w) = current.take() {
                worktrees.push(w);
            }
            continue;
        }

        if line.starts_with("worktree ") {
            let path = line["worktree ".len()..].trim().to_string();
            current = Some(WorktreeInfo {
                path,
                commit_hash: String::new(),
                branch: String::new(),
                is_main: is_first,
                is_locked: false,
                is_bare: false,
            });
            is_first = false;
        } else if let Some(ref mut w) = current {
            if line.starts_with("HEAD ") {
                let full = line["HEAD ".len()..].trim();
                w.commit_hash = full[..full.len().min(7)].to_string();
            } else if line.starts_with("branch ") {
                let refname = line["branch ".len()..].trim();
                const PREFIX: &str = "refs/heads/";
                w.branch = if refname.starts_with(PREFIX) {
                    refname[PREFIX.len()..].to_string()
                } else {
                    refname.to_string()
                };
            } else if line == "bare" {
                w.is_bare = true;
                w.branch = "(bare)".to_string();
            } else if line == "detached" {
                w.branch = "(detached)".to_string();
            } else if line.starts_with("locked") {
                w.is_locked = true;
            }
        }
    }

    // Handle case where file ends without trailing blank line
    if let Some(w) = current {
        worktrees.push(w);
    }

    worktrees
}

#[tauri::command]
pub async fn get_worktrees(cwd: String) -> Result<Vec<WorktreeInfo>, String> {
    let result = crate::git::run_git(
        vec!["worktree".to_string(), "list".to_string(), "--porcelain".to_string()],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Git worktree list failed: {}", result.stderr));
    }

    Ok(parse_worktrees(&result.stdout))
}

#[tauri::command]
pub async fn add_worktree(
    cwd: String,
    path: String,
    branch: String,
    is_new_branch: bool,
) -> Result<(), String> {
    let mut args = vec!["worktree".to_string(), "add".to_string()];

    if is_new_branch {
        args.push("-b".to_string());
        args.push(branch);
        args.push(path);
    } else {
        args.push(path);
        args.push(branch);
    }

    let result = crate::git::run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to add worktree: {}", result.stderr));
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_worktree(cwd: String, path: String) -> Result<(), String> {
    let result = crate::git::run_git(
        vec!["worktree".to_string(), "remove".to_string(), path],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to remove worktree: {}", result.stderr));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_worktrees() {
        let output = "\
worktree /path/main
HEAD abc1234def5678
branch refs/heads/main

worktree /path/feature
HEAD 9876543210ab
branch refs/heads/feature
locked

worktree /path/detached
HEAD 111222333444
detached

";
        let wts = parse_worktrees(output);
        assert_eq!(wts.len(), 3);
        assert!(wts[0].is_main);
        assert_eq!(wts[0].branch, "main");
        assert_eq!(wts[0].commit_hash, "abc1234");
        assert!(wts[1].is_locked);
        assert_eq!(wts[1].branch, "feature");
        assert_eq!(wts[2].branch, "(detached)");
    }
}
