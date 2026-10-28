param(
    [string]$Container = '',
    [string]$Database = 'Monolithic',
    [string]$KeyFile = '.tc2-private/data.key'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'active-database.ps1')
$Container=(Get-PoliceDatabaseContext -Container $Container).Container
if ($Database -notmatch '^[A-Za-z0-9_]+$') { throw 'Invalid database name' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destination = Join-Path (Get-Location) "backups/tc2-roster-$stamp"
New-Item -ItemType Directory -Path $destination | Out-Null
$remote = "/tmp/tc2-roster-$stamp.dump"
& docker exec $Container pg_dump -U Monolithic -d $Database -Fc -f $remote
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
& docker cp "${Container}:$remote" (Join-Path $destination 'database.dump')
if ($LASTEXITCODE -ne 0) { throw 'Copying dump failed' }
Copy-Item -LiteralPath $KeyFile -Destination (Join-Path $destination 'data.key')
$dumpHash = (Get-FileHash -LiteralPath (Join-Path $destination 'database.dump') -Algorithm SHA256).Hash
$remoteHash = & docker exec $Container sha256sum $remote
if ($LASTEXITCODE -ne 0 -or ($remoteHash -split '\s+')[0] -ne $dumpHash) { throw 'Container and copied backup checksums differ; temporary dump retained for investigation' }
@{ database = $Database; createdAt = (Get-Date).ToString('o'); dumpSha256 = $dumpHash; includes = @('all database schemas', 'TC2 encryption key'); restore = 'Restore into a NEW database; do not overwrite the current database.' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
& docker exec $Container rm -f -- $remote
if ($LASTEXITCODE -ne 0) { Write-Warning 'Backup is saved, but its temporary container dump could not be removed' }
Write-Output "Backup completed: $destination"
