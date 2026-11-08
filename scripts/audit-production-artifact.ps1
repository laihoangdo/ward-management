param([Parameter(Mandatory=$true)][string]$Artifact)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Artifact).Path)
try {
    $names=@($archive.Entries | ForEach-Object FullName)
    foreach($name in $names) {
        if($name -match '(^|/)(\.rbac|\.tc2-private|backups)/|\.(p12|key|dump|map)$|config/application-(dev|secret-samples|tls)\.yml$') {
            throw 'Forbidden local/sample secret, key or debug material in artifact; upload blocked'
        }
        if($name -eq 'BOOT-INF/classes/static/staging-manifest.json') {
            throw 'Synthetic staging manifest present; this must never ship as a production artifact'
        }
        if($name -match '^BOOT-INF/classes/static/.*\.map$') {
            throw 'Source map in production artifact; upload blocked'
        }
    }
    if($names -notcontains 'org/springframework/boot/loader/launch/PropertiesLauncher.class') { throw 'Migration launcher absent' }
    if($names -notcontains 'BOOT-INF/classes/config/application-vps.yml') { throw 'VPS configuration absent' }
    if($names -notcontains 'BOOT-INF/classes/config/application-vps-prod.yml') { throw 'Production VPS configuration absent' }
    if($names -notcontains 'BOOT-INF/classes/static/index.html') { throw 'Frontend index absent' }
    Write-Output 'PRODUCTION_ARTIFACT_AUDIT_PASS'
} finally { $archive.Dispose() }
