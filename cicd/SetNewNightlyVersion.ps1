
# Increase Nightly Version
$versionFilePath = "$PSScriptRoot\NightlyVersion.txt"
$pattern = '(\d+)\.(\d+)\.(\d+)'

$content = Get-Content $versionFilePath -Raw
$newVersion = [regex]::Replace($content, $pattern, {
    param($m)
    $major = $m.Groups[1].Value
    $minor = $m.Groups[2].Value
    $patch = [int]$m.Groups[3].Value + 1
    return "$major.$minor.$patch"
}).Trim()

Set-Content $versionFilePath $newVersion -Encoding UTF8

# Update Version String
$versionFilePath = "$PSScriptRoot\..\WimyGit\Properties\AssemblyInfo.cs"
$content = Get-Content $versionFilePath -Raw
$content = $content -replace 'AssemblyInformationalVersion\(".*?"\)', "AssemblyInformationalVersion(""$newVersion"")"
Set-Content $versionFilePath $content -Encoding UTF8

# Update Icon
Copy-Item .\WimyGit\IconNightly.ico .\WimyGit\Icon.ico
