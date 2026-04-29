use serde::{Deserialize, Serialize};

const COMMIT_MARKER: &str = "COMMIT||";

/// Represents a single commit entry in the history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub timestamp: i64,
    pub message: String,
    pub ref_names: String,
    pub graph: String,
}

/// Represents a file changed in a commit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitFile {
    pub status: String,
    pub filename: String,
    pub filename2: Option<String>,
    pub display: String,
}

/// Parse `git log --graph --pretty=format:"COMMIT||%H||%h||%an||%at||%s||%D"` output.
/// Lines with COMMIT_MARKER contain commit data; other lines are graph-only (skipped).
pub fn parse_history_output(output: &str) -> Vec<CommitInfo> {
    let mut commits = Vec::new();

    for line in output.lines() {
        if let Some(pos) = line.find(COMMIT_MARKER) {
            let graph = line[..pos].to_string();
            let data = &line[pos + COMMIT_MARKER.len()..];
            let parts: Vec<&str> = data.splitn(6, "||").collect();

            if parts.len() >= 5 {
                commits.push(CommitInfo {
                    hash: parts[0].trim().to_string(),
                    short_hash: parts[1].trim().to_string(),
                    author: parts[2].trim().to_string(),
                    timestamp: parts[3].trim().parse::<i64>().unwrap_or(0),
                    message: parts[4].trim().to_string(),
                    ref_names: if parts.len() >= 6 {
                        parts[5].trim().to_string()
                    } else {
                        String::new()
                    },
                    graph,
                });
            }
        }
    }

    commits
}

/// Parse `git show --name-status --format= <commit>` output.
/// Each line is: `<status>\t<file>` or `<status>\t<old_file>\t<new_file>` for renames.
pub fn parse_commit_files(output: &str) -> Vec<CommitFile> {
    let mut files = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.splitn(3, '\t').collect();
        if parts.len() < 2 {
            continue;
        }

        // Status may have a similarity number appended (e.g. R100, C85) — normalize it
        let status_raw = parts[0];
        let status = if status_raw.starts_with('R') || status_raw.starts_with('C') {
            status_raw[..1].to_string()
        } else {
            status_raw.to_string()
        };

        if parts.len() == 3 {
            let filename = parts[1].to_string();
            let filename2 = parts[2].to_string();
            let display = format!("{} -> {}", filename, filename2);
            files.push(CommitFile {
                status,
                filename,
                filename2: Some(filename2),
                display,
            });
        } else {
            let filename = parts[1].to_string();
            let display = filename.clone();
            files.push(CommitFile {
                status,
                filename,
                filename2: None,
                display,
            });
        }
    }

    files
}

/// Get commit history with optional path filter
#[tauri::command]
pub async fn get_history(
    cwd: String,
    path: String,
    skip: u32,
    count: u32,
) -> Result<Vec<CommitInfo>, String> {
    let format_str = format!("{}%H||%h||%an||%at||%s||%D", COMMIT_MARKER);
    let mut args = vec![
        "log".to_string(),
        "--graph".to_string(),
        format!("--pretty=format:{}", format_str),
        format!("-{}", count),
        format!("--skip={}", skip),
    ];

    if !path.is_empty() {
        args.push("--".to_string());
        args.push(path);
    }

    let result = crate::git::run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Git log failed: {}", result.stderr));
    }

    Ok(parse_history_output(&result.stdout))
}

/// List files changed in a specific commit
#[tauri::command]
pub async fn get_commit_files(cwd: String, commit_id: String) -> Result<Vec<CommitFile>, String> {
    let result = crate::git::run_git(
        vec![
            "show".to_string(),
            "--name-status".to_string(),
            "--diff-filter=ACDMRT".to_string(),
            "--format=".to_string(),
            commit_id,
        ],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Git show failed: {}", result.stderr));
    }

    Ok(parse_commit_files(&result.stdout))
}

/// Get diff for a specific file in a specific commit.
/// When `parent_hash` is provided, runs `git diff <parent_hash> <commit_id> -- <file>`.
/// Otherwise runs `git show <commit_id> -- <file>` (combined diff for merge commits).
#[tauri::command]
pub async fn get_commit_diff(
    cwd: String,
    commit_id: String,
    file_path: String,
    file_path2: Option<String>,
    parent_hash: Option<String>,
    context_lines: Option<u32>,
) -> Result<String, String> {
    let ctx = context_lines.unwrap_or(3);

    let args = if let Some(parent) = parent_hash {
        // Diff specific parent vs commit
        let mut args = vec![
            "diff".to_string(),
            format!("-U{}", ctx),
            parent,
            commit_id,
            "--".to_string(),
        ];
        if let Some(p2) = file_path2 { args.push(p2); }
        args.push(file_path);
        args
    } else {
        // git show: combined diff (works for both regular and merge commits)
        let mut args = vec![
            "show".to_string(),
            format!("-U{}", ctx),
            commit_id,
            "--".to_string(),
        ];
        if let Some(p2) = file_path2 { args.push(p2); }
        args.push(file_path);
        args
    };

    let result = crate::git::run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Git diff failed: {}", result.stderr));
    }

    Ok(result.stdout)
}

/// Get working tree or staged diff.
/// `context_lines` controls the number of context lines around each hunk (default 3).
/// `parent` is an optional ref to diff against (e.g. "HEAD^1", "HEAD^2").
#[tauri::command]
pub async fn get_diff(
    cwd: String,
    staged: bool,
    file_path: Option<String>,
    context_lines: Option<u32>,
    parent: Option<String>,
) -> Result<String, String> {
    let ctx = context_lines.unwrap_or(3);
    let mut args = vec!["diff".to_string(), format!("-U{}", ctx)];

    if staged {
        args.push("--cached".to_string());
    }

    if let Some(p) = parent {
        args.push(p);
    }

    if let Some(path) = file_path {
        args.push("--".to_string());
        args.push(path);
    }

    let result = crate::git::run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Git diff failed: {}", result.stderr));
    }

    Ok(result.stdout)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_history_output() {
        let output = "* COMMIT||abc123||abc||John||1700000000||Initial commit||HEAD -> main, origin/main\n| COMMIT||def456||def||Jane||1699999000||Add feature||\n";
        let commits = parse_history_output(output);
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].short_hash, "abc");
        assert_eq!(commits[0].author, "John");
        assert!(commits[0].ref_names.contains("main"));
        assert_eq!(commits[1].author, "Jane");
    }

    #[test]
    fn test_parse_commit_files() {
        let output = "M\tsrc/main.rs\nA\tsrc/new.rs\nD\tsrc/old.rs\nR100\told.txt\tnew.txt\n";
        let files = parse_commit_files(output);
        assert_eq!(files.len(), 4);
        assert_eq!(files[0].status, "M");
        assert_eq!(files[2].status, "D");
        assert_eq!(files[3].status, "R");
        assert_eq!(files[3].filename2, Some("new.txt".to_string()));
    }
}
