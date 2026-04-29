use regex::Regex;
use serde::{Deserialize, Serialize};

/// Represents a git branch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub commit_id: String,
    pub commit_message: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: i32,
    pub behind: i32,
}

/// Parse git branch -vv output
pub fn parse_branches(output: &str) -> Vec<BranchInfo> {
    let mut branches = Vec::new();

    // Pattern: (* or space) branch_name commit_id [upstream: ahead/behind] message
    let re = Regex::new(r"^([\s\*])\s+(\S+)\s+([a-f0-9]+)\s*(.*)$").unwrap();
    let upstream_re = Regex::new(r"\[([^\]]+)\]").unwrap();
    let ahead_behind_re = Regex::new(r"ahead (\d+)|behind (\d+)").unwrap();

    for line in output.lines() {
        if let Some(caps) = re.captures(line) {
            let is_current = caps.get(1).map_or(false, |m| m.as_str() == "*");
            let name = caps.get(2).map_or("", |m| m.as_str()).to_string();
            let commit_id = caps.get(3).map_or("", |m| m.as_str()).to_string();
            let rest = caps.get(4).map_or("", |m| m.as_str());

            // Parse upstream and ahead/behind info
            let (upstream, ahead, behind, commit_message) = if let Some(upstream_caps) = upstream_re.captures(rest) {
                let upstream_info = upstream_caps.get(1).map_or("", |m| m.as_str());
                let mut ahead = 0;
                let mut behind = 0;

                for cap in ahead_behind_re.captures_iter(upstream_info) {
                    if let Some(a) = cap.get(1) {
                        ahead = a.as_str().parse().unwrap_or(0);
                    }
                    if let Some(b) = cap.get(2) {
                        behind = b.as_str().parse().unwrap_or(0);
                    }
                }

                // Extract upstream branch name (before any ':' or tracking info)
                let upstream_name = upstream_info
                    .split(':')
                    .next()
                    .map(|s| s.trim().to_string());

                // Get commit message (after the upstream info)
                let msg_start = rest.find(']').map_or(0, |i| i + 1);
                let commit_message = rest[msg_start..].trim().to_string();

                (upstream_name, ahead, behind, commit_message)
            } else {
                (None, 0, 0, rest.trim().to_string())
            };

            branches.push(BranchInfo {
                name,
                commit_id,
                commit_message,
                is_current,
                is_remote: false,
                upstream,
                ahead,
                behind,
            });
        }
    }

    branches
}

/// Parse git branch -r output for remote branches
pub fn parse_remote_branches(output: &str) -> Vec<BranchInfo> {
    let mut branches = Vec::new();
    let re = Regex::new(r"^\s*(\S+)\s+([a-f0-9]+)\s*(.*)$").unwrap();

    for line in output.lines() {
        // Skip HEAD pointer lines
        if line.contains("->") {
            continue;
        }

        if let Some(caps) = re.captures(line) {
            let name = caps.get(1).map_or("", |m| m.as_str()).to_string();
            let commit_id = caps.get(2).map_or("", |m| m.as_str()).to_string();
            let commit_message = caps.get(3).map_or("", |m| m.as_str()).trim().to_string();

            branches.push(BranchInfo {
                name,
                commit_id,
                commit_message,
                is_current: false,
                is_remote: true,
                upstream: None,
                ahead: 0,
                behind: 0,
            });
        }
    }

    branches
}

/// Tauri command to get all branches
#[tauri::command]
pub async fn get_branches(cwd: String) -> Result<Vec<BranchInfo>, String> {
    // Get local branches with verbose info
    let local_result = crate::git::run_git(
        vec!["branch".to_string(), "-vv".to_string()],
        cwd.clone(),
    )
    .await?;

    if local_result.exit_code != 0 {
        return Err(format!("Git branch failed: {}", local_result.stderr));
    }

    let mut branches = parse_branches(&local_result.stdout);

    // Get remote branches
    let remote_result = crate::git::run_git(
        vec!["branch".to_string(), "-r".to_string(), "-v".to_string()],
        cwd,
    )
    .await?;

    if remote_result.exit_code == 0 {
        branches.extend(parse_remote_branches(&remote_result.stdout));
    }

    Ok(branches)
}

/// Get current branch name
#[tauri::command]
pub async fn get_current_branch(cwd: String) -> Result<String, String> {
    let result = crate::git::run_git_simple(
        vec!["branch".to_string(), "--show-current".to_string()],
        cwd,
    )
    .await?;

    Ok(result.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_current_branch() {
        let output = "* main       abc1234 Initial commit\n  feature    def5678 Add feature\n";
        let branches = parse_branches(output);
        assert_eq!(branches.len(), 2);
        assert!(branches[0].is_current);
        assert_eq!(branches[0].name, "main");
        assert!(!branches[1].is_current);
    }

    #[test]
    fn test_parse_branch_with_upstream() {
        let output = "* main abc1234 [origin/main: ahead 2, behind 1] Some message\n";
        let branches = parse_branches(output);
        assert_eq!(branches.len(), 1);
        assert_eq!(branches[0].upstream, Some("origin/main".to_string()));
        assert_eq!(branches[0].ahead, 2);
        assert_eq!(branches[0].behind, 1);
    }
}
