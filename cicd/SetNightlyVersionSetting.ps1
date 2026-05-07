Copy-Item (Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "icons-nightly" "*") (Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "icons") -Recurse -Force

$tauriConfPath = Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "tauri.conf.json"
$tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
$tauriConf.productName = "Wimygit Nightly"
$tauriConf.identifier = "com.wimysoft.wimygit.nightly"
$tauriConf.app.windows[0].title = "WimyGit Nightly"
$tauriConf | ConvertTo-Json -Depth 100 | Set-Content $tauriConfPath
