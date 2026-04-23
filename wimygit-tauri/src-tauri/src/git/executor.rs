use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct GitResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Find git executable path based on platform
#[tauri::command]
pub fn find_git_path() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Try 'where git' on Windows
        let output = Command::new("where")
            .arg("git")
            .output()
            .map_err(|e| format!("Failed to execute 'where git': {}", e))?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }

        // Fallback: check common Windows paths
        let common_paths = [
            r"C:\Program Files\Git\bin\git.exe",
            r"C:\Program Files (x86)\Git\bin\git.exe",
            r"C:\Git\bin\git.exe",
        ];

        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Ok(path.to_string());
            }
        }

        Err("Git not found".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Try 'which git' on Unix-like systems
        let output = Command::new("which")
            .arg("git")
            .output()
            .map_err(|e| format!("Failed to execute 'which git': {}", e))?;

        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(path);
            }
        }

        // Fallback: check common Unix paths
        let common_paths = [
            "/usr/bin/git",
            "/usr/local/bin/git",
            "/opt/homebrew/bin/git",
        ];

        for path in common_paths {
            if PathBuf::from(path).exists() {
                return Ok(path.to_string());
            }
        }

        Err("Git not found".to_string())
    }
}

/// Run git command with given arguments in specified directory
#[tauri::command]
pub async fn run_git(args: Vec<String>, cwd: String) -> Result<GitResult, String> {
    let git_path = find_git_path()?;

    let output = Command::new(&git_path)
        .args(&args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    Ok(GitResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Run git command and return only stdout (convenience function)
#[tauri::command]
pub async fn run_git_simple(args: Vec<String>, cwd: String) -> Result<String, String> {
    let result = run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("Git command failed: {}", result.stderr));
    }

    Ok(result.stdout)
}

/// Check if a directory is a git repository
#[tauri::command]
pub async fn is_git_repository(path: String) -> Result<bool, String> {
    let result = run_git(vec!["rev-parse".to_string(), "--git-dir".to_string()], path).await?;
    Ok(result.exit_code == 0)
}

/// Get parent commit hashes of a given commit (or HEAD)
#[tauri::command]
pub async fn get_commit_parents(cwd: String, commit_id: String) -> Result<Vec<String>, String> {
    let result = run_git(
        vec![
            "log".to_string(),
            "-1".to_string(),
            "--format=%P".to_string(),
            commit_id,
        ],
        cwd,
    )
    .await?;

    if result.exit_code != 0 || result.stdout.trim().is_empty() {
        return Ok(vec![]);
    }

    Ok(result
        .stdout
        .trim()
        .split_whitespace()
        .map(|s| s.to_string())
        .collect())
}

/// Run git difftool (spawns external tool, does not wait)
#[tauri::command]
pub async fn run_difftool(cwd: String, args: Vec<String>) -> Result<(), String> {
    let git_path = find_git_path()?;
    let mut full_args = vec!["difftool".to_string(), "--no-prompt".to_string()];
    full_args.extend(args);

    std::process::Command::new(&git_path)
        .args(&full_args)
        .current_dir(&cwd)
        .spawn()
        .map_err(|e| format!("Failed to run difftool: {}", e))?;

    Ok(())
}

/// Get the root directory of a git repository
#[tauri::command]
pub async fn get_repository_root(path: String) -> Result<String, String> {
    let result = run_git_simple(
        vec!["rev-parse".to_string(), "--show-toplevel".to_string()],
        path,
    )
    .await?;
    Ok(result.trim().to_string())
}

/// Get commit history for a specific file (follows renames)
#[tauri::command]
pub async fn get_file_commits(cwd: String, file_path: String) -> Result<Vec<crate::git::parsers::FileCommit>, String> {
    let result = run_git(
        vec![
            "log".to_string(),
            "--follow".to_string(),
            "--format=%H|||%s|||%an|||%ae|||%ai".to_string(),
            "--".to_string(),
            file_path,
        ],
        cwd,
    )
    .await?;

    Ok(crate::git::parsers::parse_file_commits(&result.stdout))
}

/// Get blame info for a file at a specific commit (or HEAD if empty)
#[tauri::command]
pub async fn get_blame_at_commit(
    cwd: String,
    commit_hash: String,
    file_path: String,
) -> Result<Vec<crate::git::parsers::BlameEntry>, String> {
    let mut args = vec!["blame".to_string(), "--line-porcelain".to_string()];
    if !commit_hash.is_empty() {
        args.push(commit_hash);
    }
    args.push("--".to_string());
    args.push(file_path);

    let result = run_git(args, cwd).await?;

    if result.exit_code != 0 {
        return Err(format!("git blame failed: {}", result.stderr.trim()));
    }

    Ok(crate::git::parsers::parse_blame(&result.stdout))
}

/// Get git author info (user.name and user.email) for the given repository
#[tauri::command]
pub async fn get_git_author(cwd: String) -> Result<(String, String), String> {
    let name_result = run_git(
        vec!["config".to_string(), "user.name".to_string()],
        cwd.clone(),
    )
    .await?;
    let name = name_result.stdout.trim().to_string();

    let email_result = run_git(
        vec!["config".to_string(), "user.email".to_string()],
        cwd,
    )
    .await?;
    let email = email_result.stdout.trim().to_string();

    Ok((name, email))
}
