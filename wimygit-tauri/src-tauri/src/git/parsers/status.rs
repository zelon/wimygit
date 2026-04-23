use serde::{Deserialize, Serialize};

/// File status from git status --porcelain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileStatusType {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Ignored,
    Unmerged,
}

/// Represents a single file's git status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStatus {
    pub filename: String,
    pub original_filename: Option<String>, // For renamed files
    pub staged_status: Option<FileStatusType>,
    pub unstaged_status: Option<FileStatusType>,
    pub is_unmerged: bool,
}

/// Overall git status result
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitStatus {
    pub staged: Vec<FileStatus>,
    pub modified: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
    pub unmerged: Vec<FileStatus>,
}

impl GitStatus {
    /// Parse git status --porcelain output
    pub fn parse(output: &str) -> Self {
        let mut status = GitStatus::default();

        for line in output.lines() {
            if line.len() < 3 {
                continue;
            }

            let index_status = line.chars().nth(0).unwrap_or(' ');
            let worktree_status = line.chars().nth(1).unwrap_or(' ');
            let filename = &line[3..];

            // Handle renamed files (format: "R  old -> new")
            let (filename, original) = if filename.contains(" -> ") {
                let parts: Vec<&str> = filename.split(" -> ").collect();
                (parts[1].to_string(), Some(parts[0].to_string()))
            } else {
                (filename.to_string(), None)
            };

            let file_status = FileStatus {
                filename: filename.clone(),
                original_filename: original,
                staged_status: parse_status_char(index_status),
                unstaged_status: parse_status_char(worktree_status),
                is_unmerged: is_unmerged_status(index_status, worktree_status),
            };

            // Categorize the file
            if file_status.is_unmerged {
                status.unmerged.push(file_status);
            } else if index_status == '?' && worktree_status == '?' {
                status.untracked.push(file_status);
            } else if index_status != ' ' && index_status != '?' {
                status.staged.push(file_status.clone());
                // Also add to modified if there are unstaged changes
                if worktree_status != ' ' && worktree_status != '?' {
                    status.modified.push(file_status);
                }
            } else if worktree_status != ' ' && worktree_status != '?' {
                status.modified.push(file_status);
            }
        }

        status
    }
}

fn parse_status_char(c: char) -> Option<FileStatusType> {
    match c {
        'M' => Some(FileStatusType::Modified),
        'A' => Some(FileStatusType::Added),
        'D' => Some(FileStatusType::Deleted),
        'R' => Some(FileStatusType::Renamed),
        'C' => Some(FileStatusType::Copied),
        '?' => Some(FileStatusType::Untracked),
        '!' => Some(FileStatusType::Ignored),
        'U' => Some(FileStatusType::Unmerged),
        _ => None,
    }
}

fn is_unmerged_status(index: char, worktree: char) -> bool {
    matches!(
        (index, worktree),
        ('D', 'D') | ('A', 'U') | ('U', 'D') | ('U', 'A') | ('D', 'U') | ('A', 'A') | ('U', 'U')
    )
}

/// Tauri command to parse git status
#[tauri::command]
pub async fn parse_git_status(cwd: String) -> Result<GitStatus, String> {
    let result = crate::git::run_git(
        vec![
            "status".to_string(),
            "--porcelain".to_string(),
            "-u".to_string(),
        ],
        cwd,
    )
    .await?;

    if result.exit_code != 0 {
        return Err(format!("Git status failed: {}", result.stderr));
    }

    Ok(GitStatus::parse(&result.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_untracked() {
        let output = "?? newfile.txt\n";
        let status = GitStatus::parse(output);
        assert_eq!(status.untracked.len(), 1);
        assert_eq!(status.untracked[0].filename, "newfile.txt");
    }

    #[test]
    fn test_parse_modified() {
        let output = " M modified.txt\n";
        let status = GitStatus::parse(output);
        assert_eq!(status.modified.len(), 1);
        assert_eq!(status.modified[0].filename, "modified.txt");
    }

    #[test]
    fn test_parse_staged() {
        let output = "M  staged.txt\n";
        let status = GitStatus::parse(output);
        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].filename, "staged.txt");
    }

    #[test]
    fn test_parse_renamed() {
        let output = "R  old.txt -> new.txt\n";
        let status = GitStatus::parse(output);
        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].filename, "new.txt");
        assert_eq!(status.staged[0].original_filename, Some("old.txt".to_string()));
    }
}
