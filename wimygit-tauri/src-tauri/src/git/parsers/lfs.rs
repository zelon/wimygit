use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// git lfs locks --local 의 파싱 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LfsLock {
    pub filename: String, // "assets/model.psd"
    pub lock_id: String,  // "12345"
    pub owner: String,    // "alice"
}

/// .gitattributes에서 filter=lfs 라인 존재 여부 확인
pub fn has_lfs_git_attribute(repo_dir: &str) -> bool {
    let path = std::path::Path::new(repo_dir).join(".gitattributes");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return false;
    };
    content
        .lines()
        .filter(|l| !l.trim().starts_with('#') && !l.trim().is_empty())
        .any(|l| l.contains("filter=lfs"))
}

/// .gitattributes에서 lockable 확장자 목록 추출
/// 예: "*.psd filter=lfs diff=lfs merge=lfs -text lockable" → ".psd"
pub fn get_lfs_lockable_extensions(repo_dir: &str) -> HashSet<String> {
    let mut result = HashSet::new();
    let path = std::path::Path::new(repo_dir).join(".gitattributes");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return result;
    };
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        if trimmed.contains("lockable") && trimmed.contains("filter=lfs") {
            let pattern = trimmed.split_whitespace().next().unwrap_or("");
            if let Some(ext) = pattern.strip_prefix("*.") {
                result.insert(format!(".{}", ext));
            }
        }
    }
    result
}

/// git lfs locks --local 출력 파싱
///
/// git lfs locks 출력은 컬럼 정렬된 형태:
///   assets/model.psd        alice           ID:12345
/// 또는 탭 구분:
///   assets/model.psd\talice\tID:12345
pub fn parse_lfs_locks(output: &str) -> Vec<LfsLock> {
    let mut locks = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // 첫 번째 공백/탭 구분 토큰이 파일명
        let parts: Vec<&str> = trimmed.splitn(2, |c: char| c == '\t').collect();
        let (filename_raw, rest) = if parts.len() == 2 {
            // 탭 구분 형식
            (parts[0].trim(), parts[1])
        } else {
            // 공백 정렬 형식 — 첫 번째 연속 공백 전까지가 파일명
            match trimmed.find("  ") {
                Some(pos) => (&trimmed[..pos], &trimmed[pos..]),
                None => {
                    // 토큰이 하나뿐인 경우 — 파일명만 있는 행
                    let filename = trimmed
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .to_string();
                    if !filename.is_empty() {
                        locks.push(LfsLock {
                            filename,
                            lock_id: String::new(),
                            owner: String::new(),
                        });
                    }
                    continue;
                }
            }
        };

        let filename = filename_raw.trim().to_string();
        if filename.is_empty() {
            continue;
        }

        // ID: / Owner: 파싱 (어느 형식이든 공통 처리)
        let lock_id = extract_field(rest, "ID:");
        let owner = extract_field(rest, "Owner:");

        // Owner가 없으면 두 번째 공백-구분 토큰을 owner로 간주
        let owner = if owner.is_empty() {
            rest.split_whitespace()
                .find(|s| !s.starts_with("ID:"))
                .unwrap_or("")
                .to_string()
        } else {
            owner
        };

        locks.push(LfsLock {
            filename,
            lock_id,
            owner,
        });
    }
    locks
}

fn extract_field(line: &str, prefix: &str) -> String {
    line.split_whitespace()
        .find(|s| s.starts_with(prefix))
        .and_then(|s| s.strip_prefix(prefix))
        .unwrap_or("")
        .to_string()
}
