use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// ─── data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginArgument {
    /// "string" | "repository_directory" | "inputbox"
    pub arg_type: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub name: String,
    pub title: String,
    pub description: String,
    /// Resolved for current platform (command_windows / command_macos / command_linux / command)
    pub command: String,
    pub arguments: Vec<PluginArgument>,
    /// "WithoutShellAndNoWaiting" | "KeepShellAndNoWaiting" | "WimyGitInnerShellAndRefreshRepositoryStatus"
    pub execution_type: String,
    /// Absolute path to icon file, if available
    pub icon_path: Option<String>,
    /// Base64-encoded data URL for the icon (data:image/png;base64,...)
    pub icon_data_url: Option<String>,
    /// Directory containing Plugin.xml
    pub plugin_dir: String,
}

// ─── XML parsing ─────────────────────────────────────────────────────────────

fn child_text<'a>(node: roxmltree::Node<'a, 'a>, tag: &str) -> Option<String> {
    node.children()
        .find(|n| n.tag_name().name() == tag)
        .and_then(|n| n.text())
        .map(|t| t.trim().to_string())
}

fn icon_to_data_url(icon_path: &str) -> Option<String> {
    let path = Path::new(icon_path);
    let bytes = fs::read(path).ok()?;
    let mime = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("bmp") => "image/bmp",
        _ => "image/png",
    };
    Some(format!("data:{};base64,{}", mime, BASE64.encode(&bytes)))
}

fn parse_plugin_xml(xml_path: &Path) -> Result<PluginInfo, String> {
    let xml = fs::read_to_string(xml_path)
        .map_err(|e| format!("Cannot read {}: {}", xml_path.display(), e))?;

    let doc = roxmltree::Document::parse(&xml)
        .map_err(|e| format!("XML parse error in {}: {}", xml_path.display(), e))?;

    let root = doc.root_element();
    let plugin_dir = xml_path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    // Platform-specific command overrides generic <command>
    #[cfg(target_os = "windows")]
    let platform_cmd = child_text(root, "command_windows");
    #[cfg(target_os = "macos")]
    let platform_cmd = child_text(root, "command_macos");
    #[cfg(target_os = "linux")]
    let platform_cmd = child_text(root, "command_linux");

    let command = platform_cmd
        .or_else(|| child_text(root, "command"))
        .unwrap_or_default();

    // <icon> block
    let icon_path = root
        .children()
        .find(|n| n.tag_name().name() == "icon")
        .and_then(|icon_node| {
            let icon_type = child_text(icon_node, "type")?;
            let icon_file = child_text(icon_node, "path")?;
            match icon_type.as_str() {
                "plugin_directory" => Some(format!("{}/{}", plugin_dir, icon_file)),
                _ => None,
            }
        });

    // <arguments> block
    let arguments = root
        .children()
        .find(|n| n.tag_name().name() == "arguments")
        .map(|args_node| {
            args_node
                .children()
                .filter(|n| n.tag_name().name() == "argument")
                .map(|arg_node| PluginArgument {
                    arg_type: child_text(arg_node, "type").unwrap_or_default(),
                    value: child_text(arg_node, "value").unwrap_or_default(),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let icon_data_url = icon_path.as_deref().and_then(icon_to_data_url);

    Ok(PluginInfo {
        name: child_text(root, "name").unwrap_or_default(),
        title: child_text(root, "title").unwrap_or_default(),
        description: child_text(root, "description").unwrap_or_default(),
        command,
        arguments,
        execution_type: child_text(root, "execution_type").unwrap_or_default(),
        icon_path,
        icon_data_url,
        plugin_dir,
    })
}

// ─── argument resolution ──────────────────────────────────────────────────────

/// Resolve a single plugin argument value against the repo path.
fn resolve_arg_tokens(arg: &PluginArgument, repo_path: &str) -> Vec<String> {
    match arg.arg_type.as_str() {
        "string" => {
            // Split on whitespace to get individual tokens (e.g. "status --short")
            arg.value
                .split_whitespace()
                .map(|s| s.to_string())
                .collect()
        }
        "repository_directory" => {
            let path = PathBuf::from(repo_path).join(&arg.value);
            vec![path.to_string_lossy().to_string()]
        }
        // inputbox handled on frontend
        _ => vec![arg.value.clone()],
    }
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// Returns the platform-specific plugins directory:
///   Windows:  %APPDATA%\wimygit\Plugins
///   macOS:    ~/Library/Application Support/wimygit/Plugins
///   Linux:    ~/.config/wimygit/Plugins
#[tauri::command]
pub fn get_plugin_dir() -> Result<String, String> {
    let base = dirs_plugin_base()?;
    let plugins = base.join("Plugins");
    fs::create_dir_all(&plugins)
        .map_err(|e| format!("Cannot create plugins directory: {}", e))?;
    Ok(plugins.to_string_lossy().to_string())
}

fn dirs_plugin_base() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "APPDATA not set".to_string())?;
        Ok(PathBuf::from(appdata).join("wimygit"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME not set".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("wimygit"))
    }
    #[cfg(target_os = "linux")]
    {
        let config = std::env::var("XDG_CONFIG_HOME")
            .unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_default();
                format!("{}/.config", home)
            });
        Ok(PathBuf::from(config).join("wimygit"))
    }
}

/// Scan `plugin_dir` for subdirectories containing Plugin.xml.
/// Returns one entry per plugin (including those that failed to load, with error info).
#[tauri::command]
pub fn load_plugins(plugin_dir: String) -> Vec<serde_json::Value> {
    let dir = Path::new(&plugin_dir);
    if !dir.is_dir() {
        return Vec::new();
    }

    let mut results = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let sub = entry.path();
            if !sub.is_dir() {
                continue;
            }
            let xml_path = sub.join("Plugin.xml");
            if !xml_path.exists() {
                continue;
            }

            match parse_plugin_xml(&xml_path) {
                Ok(plugin) => results.push(serde_json::to_value(&plugin).unwrap()),
                Err(e) => results.push(serde_json::json!({
                    "name": entry.file_name().to_string_lossy(),
                    "title": entry.file_name().to_string_lossy(),
                    "description": "",
                    "command": "",
                    "arguments": [],
                    "execution_type": "",
                    "icon_path": null,
                    "plugin_dir": sub.to_string_lossy(),
                    "load_error": e,
                })),
            }
        }
    }

    results
}

/// Execute a plugin command in the context of `repo_path`.
/// Returns captured stdout+stderr for `WimyGitInnerShellAndRefreshRepositoryStatus`,
/// empty string otherwise.
#[tauri::command]
pub async fn run_plugin(
    command: String,
    arguments: Vec<PluginArgument>,
    execution_type: String,
    repo_path: String,
) -> Result<String, String> {
    if command.is_empty() {
        return Err("Plugin has no command".to_string());
    }

    // Resolve all arguments into tokens
    let resolved: Vec<String> = arguments
        .iter()
        .flat_map(|a| resolve_arg_tokens(a, &repo_path))
        .filter(|s| !s.is_empty())
        .collect();

    match execution_type.as_str() {
        "WimyGitInnerShellAndRefreshRepositoryStatus" => {
            // Run and capture output, then return it for display
            let mut cmd = Command::new(&command);
            cmd.args(&resolved).current_dir(&repo_path);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            let output = cmd
                .output()
                .map_err(|e| format!("Failed to run '{}': {}", command, e))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let combined = if stderr.is_empty() {
                stdout
            } else if stdout.is_empty() {
                stderr
            } else {
                format!("{}\n--- stderr ---\n{}", stdout, stderr)
            };
            Ok(combined)
        }

        "KeepShellAndNoWaiting" => {
            // Open a persistent shell window running the command
            #[cfg(target_os = "windows")]
            {
                let args_str = resolved.join(" ");
                let full_cmd = format!("{} {}", command, args_str);
                Command::new("cmd.exe")
                    .args(["/K", &full_cmd])
                    .current_dir(&repo_path)
                    .spawn()
                    .map_err(|e| format!("Failed to spawn shell: {}", e))?;
            }
            #[cfg(target_os = "macos")]
            {
                let args_str = resolved.join(" ");
                let script = format!(
                    "tell application \"Terminal\" to do script \"cd '{}' && {} {}\"",
                    repo_path, command, args_str
                );
                Command::new("osascript")
                    .args(["-e", &script])
                    .spawn()
                    .map_err(|e| format!("Failed to open Terminal: {}", e))?;
            }
            #[cfg(target_os = "linux")]
            {
                let args_str = resolved.join(" ");
                let full_cmd = format!("cd '{}' && {} {}; read", repo_path, command, args_str);
                for term in &["x-terminal-emulator", "gnome-terminal", "xterm"] {
                    if Command::new(term)
                        .args(["-e", "bash", "-c", &full_cmd])
                        .spawn()
                        .is_ok()
                    {
                        break;
                    }
                }
            }
            Ok(String::new())
        }

        // "WithoutShellAndNoWaiting" and anything else
        _ => {
            let mut cmd = Command::new(&command);
            cmd.args(&resolved).current_dir(&repo_path);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.spawn()
                .map_err(|e| format!("Failed to spawn '{}': {}", command, e))?;
            Ok(String::new())
        }
    }
}

/// Remove a plugin directory (uninstall).
#[tauri::command]
pub fn remove_plugin_dir(plugin_dir: String) -> Result<(), String> {
    let path = Path::new(&plugin_dir);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", plugin_dir));
    }
    // Clear read-only flags before deleting (Windows git repos set them)
    clear_readonly_recursive(path);
    fs::remove_dir_all(path)
        .map_err(|e| format!("Failed to remove '{}': {}", plugin_dir, e))
}

fn clear_readonly_recursive(path: &Path) {
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                clear_readonly_recursive(&p);
            } else if let Ok(meta) = fs::metadata(&p) {
                let mut perms = meta.permissions();
                #[allow(clippy::permissions_set_readonly_false)]
                perms.set_readonly(false);
                let _ = fs::set_permissions(&p, perms);
            }
        }
    }
}
