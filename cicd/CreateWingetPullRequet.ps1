
param(
    [Parameter(Mandatory)]    
    [string]$packageIdentifier,

    [Parameter(Mandatory)]    
    [string]$newVersion,

    [Parameter(Mandatory)]    
    [string]$newDownloadUrl,

    [string]$method
)

if (-not $method) {
    $method = "dry-run"
}
if ($method.ToLower() -eq "submit") {
    $method = "Submit"
}

Write-Host "PackageIdentifier: $packageIdentifier"
Write-Host "NewVersion       : $newVersion"
Write-Host "DownloadUrl      : $newDownloadUrl"
Write-Host "Method           : $method"

# download winget-create if not exists
$exeFilename = "wingetcreate.exe"
if (-not (Test-Path $exeFilename)) {
    $repo = "microsoft/winget-create"
    $latestUrl = "https://api.github.com/repos/$repo/releases/latest"
    $releaseContent = Invoke-RestMethod -Uri $latestUrl -Method Get
    $asset = $releaseContent.assets | Where-Object { $_.name -eq $exeFilename }
    if (-not $asset) {
        Write-Error "Cannot download wingetcreate.exe"
        exit 1
    }

    $url = $asset.browser_download_url
    Write-Host "Starting Download $exeFilename from $url"
    Invoke-WebRequest -Uri $url -OutFile $exeFilename
}

# using wingetcreate.exe, update version
Write-Host Starting wingetcreate.exe...
if ($method -eq "submit") {
    .\wingetcreate.exe update --submit --urls $newDownloadUrl --version $newVersion $packageIdentifier
} else {
    .\wingetcreate.exe update --urls $newDownloadUrl --version $newVersion $packageIdentifier
}

if ($method -eq "dry-run") {
    Write-Host "-----------------------------------------------------------------"
    Write-Host "| If you want to submit PullRequest, run with 'submit' argument |"
    Write-Host "-----------------------------------------------------------------"
}
