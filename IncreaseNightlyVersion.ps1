$scriptFilePath = "SetNightlyVersion.ps1"
$pattern = 'AssemblyInformationalVersion\("(\d+)\.(\d+)\.(\d+)"\)'

$content = Get-Content $scriptFilePath -Raw
$content = [regex]::Replace($content, $pattern, {
    param($m)
    $major = $m.Groups[1].Value
    $minor = $m.Groups[2].Value
    $patch = [int]$m.Groups[3].Value + 1
    return "AssemblyInformationalVersion(`"$major.$minor.$patch`")"
}).Trim()

Set-Content $scriptFilePath $content -Encoding UTF8
