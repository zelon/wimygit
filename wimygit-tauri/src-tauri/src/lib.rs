mod git;
mod plugin;

use git::parsers::lfs::{
    has_lfs_git_attribute, get_lfs_lockable_extensions, parse_lfs_locks, LfsLock,
};

/// .gitattributes에 filter=lfs 존재 여부
#[tauri::command]
fn has_lfs_attributes(repo_path: String) -> Result<bool, String> {
    Ok(has_lfs_git_attribute(&repo_path))
}

/// lockable LFS 확장자 목록
#[tauri::command]
fn get_lfs_lockable_extensions_cmd(repo_path: String) -> Result<Vec<String>, String> {
    let set = get_lfs_lockable_extensions(&repo_path);
    Ok(set.into_iter().collect())
}

/// LFS 설치 여부 확인 (git lfs version)
#[tauri::command]
async fn check_lfs_installed(repo_path: String) -> Result<bool, String> {
    let result = git::run_git(
        vec!["lfs".into(), "version".into()],
        repo_path,
    )
    .await?;
    Ok(result.stdout.starts_with("git-lfs/"))
}

/// LFS lock 목록 조회 (모든 사용자 포함)
#[tauri::command]
async fn get_lfs_locks(repo_path: String) -> Result<Vec<LfsLock>, String> {
    let result = git::run_git(
        vec!["lfs".into(), "locks".into()],
        repo_path,
    )
    .await?;
    Ok(parse_lfs_locks(&result.stdout))
}

/// 파일 LFS lock
#[tauri::command]
async fn lfs_lock_file(repo_path: String, filename: String) -> Result<String, String> {
    let result = git::run_git(
        vec!["lfs".into(), "lock".into(), filename],
        repo_path,
    )
    .await?;
    if result.exit_code != 0 {
        return Err(result.stderr);
    }
    Ok(result.stdout)
}

/// 파일 LFS unlock
#[tauri::command]
async fn lfs_unlock_file(repo_path: String, filename: String) -> Result<String, String> {
    let result = git::run_git(
        vec!["lfs".into(), "unlock".into(), filename],
        repo_path,
    )
    .await?;
    if result.exit_code != 0 {
        return Err(result.stderr);
    }
    Ok(result.stdout)
}

/// 현재 인증된 사용자가 소유한 LFS lock만 반환 (git lfs locks --local)
#[tauri::command]
async fn get_lfs_local_locks(repo_path: String) -> Result<Vec<LfsLock>, String> {
    let result = git::run_git(
        vec!["lfs".into(), "locks".into(), "--local".into()],
        repo_path,
    )
    .await?;
    Ok(parse_lfs_locks(&result.stdout))
}

/// 특정 파일의 lock 소유자 조회 (lock 실패 시 오류 메시지 보완용)
#[tauri::command]
async fn get_lfs_locks_for_file(repo_path: String, filename: String) -> Result<Vec<LfsLock>, String> {
    let result = git::run_git(
        vec!["lfs".into(), "locks".into(), filename],
        repo_path,
    )
    .await?;
    Ok(parse_lfs_locks(&result.stdout))
}

/// Read text content from a file
#[tauri::command]
fn read_text_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read {}: {}", file_path, e))
}

/// Write text content to a file (used for .gitignore etc.)
#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write {}: {}", file_path, e))
}

/// Returns the directory containing the running executable
#[tauri::command]
fn get_executable_dir() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Cannot get executable path: {}", e))?;
    let dir = exe.parent()
        .ok_or_else(|| "Cannot get executable directory".to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// Returns the wimygit config directory (parent of Plugins dir)
#[tauri::command]
fn get_config_dir() -> Result<String, String> {
    // Reuse plugin's base directory logic – config dir is the wimygit app data root
    let plugin_dir = plugin::get_plugin_dir()?;
    let path = std::path::Path::new(&plugin_dir);
    let parent = path.parent()
        .ok_or_else(|| "Cannot get config directory".to_string())?;
    Ok(parent.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      // Git executor commands
      git::find_git_path,
      git::run_git,
      git::run_git_simple,
      git::get_repo_state,
      git::is_git_repository,
      git::get_repository_root,
      git::get_git_author,
      git::get_file_commits,
      git::get_blame_at_commit,
      git::get_commit_parents,
      git::run_difftool,
      git::run_mergetool,
      // Git status commands
      git::parse_git_status,
      // Git branch commands
      git::get_branches,
      git::get_current_branch,
      git::get_local_only_branches,
      git::get_stale_remote_branches,
      // Git remote commands
      git::get_remotes,
      git::add_remote,
      git::remove_remote,
      // Git stash commands
      git::get_stash_list,
      git::stash_push,
      git::stash_apply,
      git::stash_pop,
      git::stash_drop,
      // Git history commands
      git::get_history,
      git::get_commit_files,
      git::get_commit_diff,
      git::get_diff,
      git::get_git_file_blob,
      git::smudge_lfs_pointer,
      git::apply_patch,
      // Git tag commands
      git::get_tags,
      git::create_tag,
      git::delete_tag,
      git::push_tag,
      // Git worktree commands
      git::get_worktrees,
      git::add_worktree,
      git::remove_worktree,
      // Filesystem commands
      git::list_dir_entries,
      git::open_in_file_manager,
      git::open_in_terminal,
      // Plugin commands
      plugin::get_plugin_dir,
      plugin::load_plugins,
      plugin::run_plugin,
      plugin::remove_plugin_dir,
      // App commands
      read_text_file,
      write_text_file,
      get_executable_dir,
      get_config_dir,
      // LFS commands
      has_lfs_attributes,
      get_lfs_lockable_extensions_cmd,
      check_lfs_installed,
      get_lfs_locks,
      get_lfs_local_locks,
      lfs_lock_file,
      lfs_unlock_file,
      get_lfs_locks_for_file,
    ])
    .setup(|app| {
      git::init_app_handle(app.handle().clone());
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
