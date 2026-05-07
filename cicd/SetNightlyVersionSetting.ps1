Copy-Item (Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "icons-nightly" "*") (Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "icons") -Recurse -Force

$WIMYGIT_TITLE = "WimyGit Nightly"

$tauriConfPath = Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "tauri.conf.json"
$tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
$tauriConf.productName = "Wimygit Nightly"
$tauriConf.identifier = "com.wimysoft.wimygit.nightly"
$tauriConf.app.windows[0].title = $WIMYGIT_TITLE
$tauriConf | ConvertTo-Json -Depth 100 | Set-Content $tauriConfPath

$filePath = Join-Path $PSScriptRoot ".." "wimygit-tauri" "src" "constants.ts"
$content = Get-Content $filePath -Raw
$content = $content -replace 'APP_NAME\s*=\s*"WimyGit"', ('APP_NAME = "' + $WIMYGIT_TITLE + '"')
Set-Content $filePath $content -Encoding UTF8