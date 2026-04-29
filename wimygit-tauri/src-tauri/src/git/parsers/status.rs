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

            // Unquote C-style quoted filenames (e.g. non-ASCII or spaces)
            let filename = unquote_git_filename(filename);

            // Handle renamed files (format: "R  old -> new")
            let (filename, original) = if filename.contains(" -> ") {
                let parts: Vec<&str> = filename.split(" -> ").collect();
                (parts[1].to_string(), Some(parts[0].to_string()))
            } else {
                (filename, None)
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

/// Unquote a git C-style quoted filename.
/// Git quotes filenames containing spaces or non-ASCII characters like:
///   "path/\354\203\210 \355\205\215\354\212\244\355\212\270.txt"
/// This function strips the surrounding quotes and decodes octal escape sequences.
fn unquote_git_filename(s: &str) -> String {
    if !(s.starts_with('"') && s.ends_with('"')) {
        return s.to_string();
    }
    let inner = &s[1..s.len() - 1];
    let raw = inner.as_bytes();
    let len = raw.len();
    let mut bytes: Vec<u8> = Vec::with_capacity(len);
    let mut i = 0;
    while i < len {
        if raw[i] == b'\\' && i + 1 < len {
            i += 1;
            match raw[i] {
                b'\\' => { bytes.push(b'\\'); i += 1; }
                b'"'  => { bytes.push(b'"');  i += 1; }
                b'n'  => { bytes.push(b'\n'); i += 1; }
                b't'  => { bytes.push(b'\t'); i += 1; }
                b'a'  => { bytes.push(0x07);  i += 1; }
                b'b'  => { bytes.push(0x08);  i += 1; }
                b'f'  => { bytes.push(0x0c);  i += 1; }
                b'r'  => { bytes.push(b'\r'); i += 1; }
                b'v'  => { bytes.push(0x0b);  i += 1; }
                d @ b'0'..=b'7' => {
                    let mut val = (d - b'0') as u16;
                    for _ in 0..2 {
                        if i + 1 < len && raw[i + 1] >= b'0' && raw[i + 1] <= b'7' {
                            i += 1;
                            val = val * 8 + (raw[i] - b'0') as u16;
                        } else {
                            break;
                        }
                    }
                    bytes.push(val as u8);
                    i += 1;
                }
                other => {
                    bytes.push(b'\\');
                    bytes.push(other);
                    i += 1;
                }
            }
        } else {
            bytes.push(raw[i]);
            i += 1;
        }
    }
    String::from_utf8(bytes).unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).to_string())
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

    #[test]
    fn test_unquote_plain() {
        assert_eq!(unquote_git_filename("hello.txt"), "hello.txt");
    }

    #[test]
    fn test_unquote_spaces() {
        assert_eq!(unquote_git_filename("\"file with spaces.txt\""), "file with spaces.txt");
    }

    #[test]
    fn test_unquote_korean_octal() {
        // "새 텍스트 문서.txt" encoded as octal by git
        let quoted = "\"\\354\\203\\210 \\355\\205\\215\\354\\212\\244\\355\\212\\270 \\353\\254\\270\\354\\204\\234.txt\"";
        assert_eq!(unquote_git_filename(quoted), "새 텍스트 문서.txt");
    }

    #[test]
    fn test_unquote_escape_sequences() {
        assert_eq!(unquote_git_filename("\"a\\\\b\""), "a\\b");
        assert_eq!(unquote_git_filename("\"a\\\"b\""), "a\"b");
        assert_eq!(unquote_git_filename("\"a\\nb\""), "a\nb");
        assert_eq!(unquote_git_filename("\"a\\tb\""), "a\tb");
    }

    #[test]
    fn test_parse_quoted_untracked() {
        // git status --porcelain output for a Korean filename
        let output = "?? \"\\354\\203\\210 \\355\\205\\215\\354\\212\\244\\355\\212\\270 \\353\\254\\270\\354\\204\\234.txt\"\n";
        let status = GitStatus::parse(output);
        assert_eq!(status.untracked.len(), 1);
        assert_eq!(status.untracked[0].filename, "새 텍스트 문서.txt");
    }
}
