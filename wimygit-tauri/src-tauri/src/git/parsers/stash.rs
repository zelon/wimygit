use regex::Regex;
use serde::{Deserialize, Serialize};

/// Represents a git stash entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: i32,
    pub branch: String,
    pub message: String,
    pub full_ref: String,
}

/// Parse git stash list output
pub fn parse_stash_list(output: &str) -> Vec<StashEntry> {
    let re = Regex::new(r"^stash@\{(\d+)\}:\s+(?:WIP on|On)\s+(\S+):\s*(.*)$").unwrap();
    let mut stashes = Vec::new();

    for line in output.lines() {
        if let Some(caps) = re.captures(line) {
            let index: i32 = caps.get(1).map_or(0, |m| m.as_str().parse().unwrap_or(0));
            let branch = caps.get(2).map_or("", |m| m.as_str()).to_string();
            let message = caps.get(3).map_or("", |m| m.as_str()).to_string();

            stashes.push(StashEntry {
                index,
                branch,
                message,
                full_ref: format!("stash@{{{}}}", index),
            });
        }
    }

    stashes
}

/// Tauri command to get stash list
#[tauri::command]
pub async fn get_stash_list(cwd: String) -> Result<Vec<StashEntry>, String> {
    let result = crate::git::run_git(
        vec!["stash".to_string(), "list".to_string()],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Git stash list failed: {}", result.stderr));
    }

    Ok(parse_stash_list(&result.stdout))
}

/// Create a new stash
#[tauri::command]
pub async fn stash_push(cwd: String, message: Option<String>, include_untracked: bool) -> Result<(), String> {
    let mut args = vec!["stash".to_string(), "push".to_string()];

    if include_untracked {
        args.push("-u".to_string());
    }

    if let Some(msg) = message {
        args.push("-m".to_string());
        args.push(msg);
    }

    let result = crate::git::run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to create stash: {}", result.stderr));
    }

    Ok(())
}

/// Apply a stash
#[tauri::command]
pub async fn stash_apply(cwd: String, index: i32) -> Result<(), String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let result = crate::git::run_git(
        vec!["stash".to_string(), "apply".to_string(), stash_ref],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to apply stash: {}", result.stderr));
    }

    Ok(())
}

/// Pop a stash (apply and remove)
#[tauri::command]
pub async fn stash_pop(cwd: String, index: i32) -> Result<(), String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let result = crate::git::run_git(
        vec!["stash".to_string(), "pop".to_string(), stash_ref],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to pop stash: {}", result.stderr));
    }

    Ok(())
}

/// Drop a stash
#[tauri::command]
pub async fn stash_drop(cwd: String, index: i32) -> Result<(), String> {
    let stash_ref = format!("stash@{{{}}}", index);
    let result = crate::git::run_git(
        vec!["stash".to_string(), "drop".to_string(), stash_ref],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to drop stash: {}", result.stderr));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_stash_list() {
        let output = "stash@{0}: WIP on main: abc1234 Some commit message\nstash@{1}: On feature: def5678 Another message\n";
        let stashes = parse_stash_list(output);
        assert_eq!(stashes.len(), 2);
        assert_eq!(stashes[0].index, 0);
        assert_eq!(stashes[0].branch, "main");
        assert_eq!(stashes[1].index, 1);
        assert_eq!(stashes[1].branch, "feature");
    }
}
