
param(
    [Parameter(Mandatory)]
    [string]$newVersion
)

function Set-TauriVersion {
    param(
        [string]$FilePath,
        [string]$NewVersion
    )

    $json = Get-Content $FilePath -Raw | ConvertFrom-Json

    # 보통 여기 있음
    $json.version = $NewVersion

    $json | ConvertTo-Json -Depth 100 | Set-Content $FilePath
}

Push-Location

$pattern = '(\d+)\.(\d+)\.(\d+)'
$content = $newVersion
$newVersion = [regex]::Replace($content, $pattern, {
    param($m)
    $major = $m.Groups[1].Value
    $minor = $m.Groups[2].Value
    $patch = $m.Groups[3].Value
    return "$major.$minor.$patch"
}).Trim()

# Update Cargo.toml version (replace cargo-edit to avoid requiring Rust in CI prepare step)
# Only replaces `version = "..."` within the [package] section, before the next section header.
$cargoTomlPath = Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "Cargo.toml"
$cargoToml = Get-Content $cargoTomlPath -Raw
$cargoToml = $cargoToml -replace '(?ms)(\[package\].*?)^version = "[^"]*"', "`$1version = `"$newVersion`""
Set-Content $cargoTomlPath $cargoToml -NoNewline -Encoding UTF8

Set-Location (Join-Path $PSScriptRoot ".." "wimygit-tauri")
npm version $newVersion

Set-TauriVersion -FilePath (Join-Path $PSScriptRoot ".." "wimygit-tauri" "src-tauri" "tauri.conf.json") -NewVersion $newVersion

Pop-Location