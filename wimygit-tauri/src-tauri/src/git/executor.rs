use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// Store the app handle so run_git can emit events without requiring it as a parameter.
pub fn init_app_handle(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows: CREATE_NO_WINDOW flag prevents a console window from flashing open
/// when spawning child processes in a release (Windows-subsystem) build.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

static GIT_PATH_CACHE: OnceLock<String> = OnceLock::new();

fn find_git_path_inner() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Try 'where git' on Windows
        let output = Command::new("where")
            .arg("git")
            .creation_flags(CREATE_NO_WINDOW)
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

/// Find git executable path based on platform (cached after first call)
#[tauri::command]
pub fn find_git_path() -> Result<String, String> {
    let path = GIT_PATH_CACHE.get_or_init(|| {
        find_git_path_inner().unwrap_or_default()
    });
    if path.is_empty() {
        Err("Git not found".to_string())
    } else {
        Ok(path.clone())
    }
}

/// Run git command with given arguments in specified directory
#[tauri::command]
pub async fn run_git(args: Vec<String>, cwd: String) -> Result<GitResult, String> {
    let git_path = find_git_path()?;

    let mut cmd = Command::new(&git_path);
    cmd.args(&args).current_dir(&cwd);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    let result = GitResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    };

    // Emit event so the frontend can log every git command
    if let Some(handle) = APP_HANDLE.get() {
        #[derive(Clone, Serialize)]
        struct GitLogEvent {
            command: String,
            stdout: String,
            stderr: String,
            exit_code: i32,
        }
        let _ = handle.emit("git-log", GitLogEvent {
            command: format!("git {}", args.join(" ")),
            stdout: result.stdout.clone(),
            stderr: result.stderr.clone(),
            exit_code: result.exit_code,
        });
    }

    Ok(result)
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

    let mut cmd = std::process::Command::new(&git_path);
    cmd.args(&full_args).current_dir(&cwd);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.spawn()
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
    let result = run_git(
        vec![
            "config".to_string(),
            "--get-regexp".to_string(),
            r"^user\.(name|email)$".to_string(),
        ],
        cwd,
    )
    .await?;

    let mut name = String::new();
    let mut email = String::new();
    for line in result.stdout.lines() {
        if let Some(val) = line.strip_prefix("user.name ") {
            name = val.to_string();
        } else if let Some(val) = line.strip_prefix("user.email ") {
            email = val.to_string();
        }
    }
    Ok((name, email))
}
