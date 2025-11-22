# Update Version String
$versionFilePath = "WimyGit\Properties\AssemblyInfo.cs"
$content = Get-Content $versionFilePath -Raw
$content = $content -replace 'AssemblyInformationalVersion\(".*?"\)', 'AssemblyInformationalVersion("1.50.3")'
Set-Content $versionFilePath $content -Encoding UTF8

# Update Icon
Copy-Item .\WimyGit\IconNightly.ico .\WimyGit\Icon.ico
