use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagInfo {
    pub name: String,
    pub commit_id: String,
    pub is_annotated: bool,
}

/// Parse `git tag -l --sort=-version:refname --format="%(refname:short)|%(objectname:short)|%(objecttype)"` output
pub fn parse_tags(output: &str) -> Vec<TagInfo> {
    let mut tags = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(3, '|').collect();
        if parts.len() < 2 {
            continue;
        }
        let name = parts[0].to_string();
        let commit_id = parts[1].to_string();
        let is_annotated = parts.get(2).map_or(false, |t| *t == "tag");

        tags.push(TagInfo {
            name,
            commit_id,
            is_annotated,
        });
    }

    tags
}

#[tauri::command]
pub async fn get_tags(cwd: String) -> Result<Vec<TagInfo>, String> {
    let result = crate::git::run_git(
        vec![
            "tag".to_string(),
            "-l".to_string(),
            "--sort=-version:refname".to_string(),
            "--format=%(refname:short)|%(objectname:short)|%(objecttype)".to_string(),
        ],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Git tag list failed: {}", result.stderr));
    }

    Ok(parse_tags(&result.stdout))
}

#[tauri::command]
pub async fn create_tag(
    cwd: String,
    name: String,
    target: Option<String>,
    message: Option<String>,
) -> Result<(), String> {
    let mut args = vec!["tag".to_string()];

    if let Some(msg) = message {
        args.push("-a".to_string());
        args.push(name);
        args.push("-m".to_string());
        args.push(msg);
    } else {
        args.push(name);
    }

    if let Some(t) = target {
        args.push(t);
    }

    let result = crate::git::run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to create tag: {}", result.stderr));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_tag(cwd: String, name: String) -> Result<(), String> {
    let result = crate::git::run_git(
        vec!["tag".to_string(), "-d".to_string(), name],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to delete tag: {}", result.stderr));
    }
    Ok(())
}

#[tauri::command]
pub async fn push_tag(cwd: String, remote: String, name: String) -> Result<(), String> {
    let result = crate::git::run_git(
        vec!["push".to_string(), remote, name],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Failed to push tag: {}", result.stderr));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tags() {
        let output = "v2.0|abc1234|tag\nv1.0|def5678|commit\n";
        let tags = parse_tags(output);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "v2.0");
        assert!(tags[0].is_annotated);
        assert_eq!(tags[1].name, "v1.0");
        assert!(!tags[1].is_annotated);
    }
}
