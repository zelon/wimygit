use regex::Regex;
use serde::{Deserialize, Serialize};

/// Represents a git remote
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

/// Parse git remote -v output
pub fn parse_remotes(output: &str) -> Vec<RemoteInfo> {
    let re = Regex::new(r"^(\S+)\s+(\S+)\s+\((\w+)\)$").unwrap();
    let mut remotes_map: std::collections::HashMap<String, RemoteInfo> = std::collections::HashMap::new();

    for line in output.lines() {
        if let Some(caps) = re.captures(line) {
            let name = caps.get(1).map_or("", |m| m.as_str()).to_string();
            let url = caps.get(2).map_or("", |m| m.as_str()).to_string();
            let remote_type = caps.get(3).map_or("", |m| m.as_str());

            let entry = remotes_map.entry(name.clone()).or_insert(RemoteInfo {
                name,
                fetch_url: String::new(),
                push_url: String::new(),
            });

            match remote_type {
                "fetch" => entry.fetch_url = url,
                "push" => entry.push_url = url,
                _ => {}
            }
        }
    }

    remotes_map.into_values().collect()
}

/// Tauri command to get all remotes
#[tauri::command]
pub async fn get_remotes(cwd: String) -> Result<Vec<RemoteInfo>, String> {
    let result = crate::git::run_git(
        vec!["remote".to_string(), "-v".to_string()],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Git remote failed: {}", result.stderr));
    }

    Ok(parse_remotes(&result.stdout))
}

/// Add a new remote
#[tauri::command]
pub async fn add_remote(cwd: String, name: String, url: String) -> Result<(), String> {
    let result = crate::git::run_git(
        vec!["remote".to_string(), "add".to_string(), name, url],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to add remote: {}", result.stderr));
    }

    Ok(())
}

/// Remove a remote
#[tauri::command]
pub async fn remove_remote(cwd: String, name: String) -> Result<(), String> {
    let result = crate::git::run_git(
        vec!["remote".to_string(), "remove".to_string(), name],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to remove remote: {}", result.stderr));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_remotes() {
        let output = "origin\thttps://github.com/user/repo.git (fetch)\norigin\thttps://github.com/user/repo.git (push)\n";
        let remotes = parse_remotes(output);
        assert_eq!(remotes.len(), 1);
        assert_eq!(remotes[0].name, "origin");
        assert_eq!(remotes[0].fetch_url, "https://github.com/user/repo.git");
        assert_eq!(remotes[0].push_url, "https://github.com/user/repo.git");
    }

    #[test]
    fn test_parse_multiple_remotes() {
        let output = "origin\thttps://github.com/user/repo.git (fetch)\norigin\thttps://github.com/user/repo.git (push)\nupstream\thttps://github.com/upstream/repo.git (fetch)\nupstream\thttps://github.com/upstream/repo.git (push)\n";
        let remotes = parse_remotes(output);
        assert_eq!(remotes.len(), 2);
    }
}
