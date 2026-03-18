
param(
    [Parameter(Mandatory)]
    [string]$newVersion
)

$pattern = '(\d+)\.(\d+)\.(\d+)'
$content = $newVersion
$newVersion = [regex]::Replace($content, $pattern, {
    param($m)
    $major = $m.Groups[1].Value
    $minor = $m.Groups[2].Value
    $patch = $m.Groups[3].Value
    return "$major.$minor.$patch"
}).Trim()

# Update Version String
$versionFilePath = "$PSScriptRoot\..\WimyGit\Properties\AssemblyInfo.cs"
$content = Get-Content $versionFilePath -Raw
$content = $content -replace 'AssemblyInformationalVersion\(".*?"\)', "AssemblyInformationalVersion(""$newVersion"")"
$content = $content.Trim()
Set-Content $versionFilePath $content -Encoding UTF8
