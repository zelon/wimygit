use serde::{Deserialize, Serialize};

/// A single commit entry from `git log --follow` for a specific file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCommit {
    pub hash: String,
    pub short_hash: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    /// ISO 8601 date string, e.g. "2024-03-12 09:15:23 +0900"
    pub author_date: String,
}

/// Parse output of:
/// `git log --follow --format="%H|||%s|||%an|||%ae|||%ai" -- <file>`
///
/// Returns commits in the order git outputs them (newest first).
pub fn parse_file_commits(output: &str) -> Vec<FileCommit> {
    output
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(5, "|||").collect();
            if parts.len() < 5 {
                return None;
            }
            let hash = parts[0].trim().to_string();
            if hash.len() < 7 {
                return None;
            }
            let short_hash = hash[..7].to_string();
            Some(FileCommit {
                short_hash,
                hash,
                summary: parts[1].trim().to_string(),
                author_name: parts[2].trim().to_string(),
                author_email: parts[3].trim().to_string(),
                author_date: parts[4].trim().to_string(),
            })
        })
        .collect()
}
