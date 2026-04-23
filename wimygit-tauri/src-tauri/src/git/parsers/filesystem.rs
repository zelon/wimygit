use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub has_children: bool,
}

/// List immediate children of `dir_path`, skipping `.git` and system entries.
#[tauri::command]
pub fn list_dir_entries(dir_path: String) -> Result<Vec<DirEntry>, String> {
    let path = Path::new(&dir_path);

    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }

    let read_dir = fs::read_dir(path)
        .map_err(|e| format!("Cannot read directory: {}", e))?;

    let mut dirs: Vec<DirEntry> = Vec::new();
    let mut files: Vec<DirEntry> = Vec::new();

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip .git — not useful to browse in a Git GUI
        if name == ".git" {
            continue;
        }

        let entry_path = entry.path();
        let path_str = entry_path.to_string_lossy().to_string();
        let is_dir = entry_path.is_dir();

        let has_children = if is_dir {
            fs::read_dir(&entry_path)
                .map(|mut d| d.next().is_some())
                .unwrap_or(false)
        } else {
            false
        };

        let de = DirEntry {
            name,
            path: path_str,
            is_dir,
            has_children,
        };

        if is_dir {
            dirs.push(de);
        } else {
            files.push(de);
        }
    }

    // Directories first, then files; each group sorted by name
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    dirs.extend(files);

    Ok(dirs)
}

/// Open a path in the platform's file manager.
#[tauri::command]
pub fn open_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // git returns forward-slash paths on Windows; explorer.exe needs backslashes
        let win_path = path.replace('/', "\\");
        let entry_path = Path::new(&win_path);
        if entry_path.is_file() {
            // /select,<path> must be a single argument (no space between flag and path)
            std::process::Command::new("explorer.exe")
                .arg(format!("/select,{}", win_path))
                .spawn()
                .map_err(|e| format!("Failed to open explorer: {}", e))?;
        } else {
            std::process::Command::new("explorer.exe")
                .arg(&win_path)
                .spawn()
                .map_err(|e| format!("Failed to open explorer: {}", e))?;
        }
    }
    #[cfg(target_os = "macos")]
    {
        let entry_path = Path::new(&path);
        let arg = if entry_path.is_file() { "-R" } else { "" };
        if arg.is_empty() {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open Finder: {}", e))?;
        } else {
            std::process::Command::new("open")
                .args(["-R", &path])
                .spawn()
                .map_err(|e| format!("Failed to open Finder: {}", e))?;
        }
    }
    #[cfg(target_os = "linux")]
    {
        let dir = if Path::new(&path).is_file() {
            Path::new(&path)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or(path)
        } else {
            path
        };
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    Ok(())
}

/// Open a path in a terminal.
#[tauri::command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    let dir = if Path::new(&path).is_file() {
        Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path)
    } else {
        path
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd.exe")
            .args(["/K", &format!("cd /d \"{}\"", dir)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Terminal", &dir])
            .spawn()
            .map_err(|e| format!("Failed to open Terminal: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Try common terminals in order
        let terminals = ["x-terminal-emulator", "gnome-terminal", "xterm"];
        let mut launched = false;
        for term in &terminals {
            if std::process::Command::new(term).arg(&dir).spawn().is_ok() {
                launched = true;
                break;
            }
        }
        if !launched {
            return Err("No supported terminal emulator found".to_string());
        }
    }
    Ok(())
}
