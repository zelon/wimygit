use serde::{Deserialize, Serialize};

/// A single blamed line from `git blame --line-porcelain`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameEntry {
    pub commit_hash: String,
    pub short_hash: String,
    pub author_name: String,
    pub author_email: String,
    /// Unix timestamp (seconds since epoch)
    pub author_time: i64,
    pub summary: String,
    /// 1-based line number in the final file
    pub line_no: u32,
    pub content: String,
}

/// Returns true if `line` looks like a blame header:
/// `<40-hex-chars> <orig-no> <final-no> [<count>]`
fn is_header(line: &str) -> bool {
    let parts: Vec<&str> = line.splitn(4, ' ').collect();
    parts.len() >= 3
        && parts[0].len() == 40
        && parts[0].chars().all(|c| c.is_ascii_hexdigit())
        && parts[1].parse::<u32>().is_ok()
        && parts[2].parse::<u32>().is_ok()
}

/// Parse output of `git blame --line-porcelain [<commit>] -- <file>`.
///
/// With `--line-porcelain`, every blamed line has its own full metadata block:
/// ```
/// <40-hash> <orig-line> <final-line>
/// author <name>
/// author-mail <<email>>
/// author-time <unix-ts>
/// author-tz <tz>
/// committer ...
/// summary <msg>
/// filename <name>
/// \t<line content>
/// ```
pub fn parse_blame(output: &str) -> Vec<BlameEntry> {
    let mut entries: Vec<BlameEntry> = Vec::new();
    let lines: Vec<&str> = output.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];

        if !is_header(line) {
            i += 1;
            continue;
        }

        // Parse header fields
        let parts: Vec<&str> = line.splitn(4, ' ').collect();
        let hash = parts[0].to_string();
        let final_line_no: u32 = parts[2].parse().unwrap_or(0);

        let mut author_name = String::new();
        let mut author_email = String::new();
        let mut author_time: i64 = 0;
        let mut summary = String::new();
        let mut content = String::new();

        i += 1;
        while i < lines.len() {
            let l = lines[i];
            if let Some(rest) = l.strip_prefix('\t') {
                // Tab-prefixed line = actual code content
                content = rest.to_string();
                i += 1;
                break;
            } else if let Some(rest) = l.strip_prefix("author ") {
                author_name = rest.to_string();
            } else if let Some(rest) = l.strip_prefix("author-mail ") {
                // Strip surrounding angle brackets: <email@example.com>
                author_email = rest
                    .trim_matches(|c| c == '<' || c == '>')
                    .to_string();
            } else if let Some(rest) = l.strip_prefix("author-time ") {
                author_time = rest.parse().unwrap_or(0);
            } else if let Some(rest) = l.strip_prefix("summary ") {
                summary = rest.to_string();
            }
            i += 1;
        }

        let short_hash = hash[..hash.len().min(7)].to_string();

        entries.push(BlameEntry {
            commit_hash: hash,
            short_hash,
            author_name,
            author_email,
            author_time,
            summary,
            line_no: final_line_no,
            content,
        });
    }

    // Ensure correct line order (git blame output is already sorted, but be safe)
    entries.sort_by_key(|e| e.line_no);
    entries
}
