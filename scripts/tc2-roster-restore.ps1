param(
    [Parameter(Mandatory = $true)][string]$BackupDirectory,
    [string]$Container = '',
    [string]$TargetDatabase = ('tc2_restore_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'active-database.ps1')
$Container=(Get-PoliceDatabaseContext -Container $Container).Container
if ($TargetDatabase -notmatch '^tc2_restore_[A-Za-z0-9_]+$') { throw 'Restore target must start with tc2_restore_; current application databases cannot be overwritten' }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupDirectory).Path
$dump = Join-Path $resolvedBackup 'database.dump'
if (-not (Test-Path -LiteralPath $dump)) { throw 'database.dump missing' }
if (-not (Test-Path -LiteralPath (Join-Path $resolvedBackup 'data.key'))) { throw 'Encryption key missing' }
$manifestPath=Join-Path $resolvedBackup 'manifest.json'
if (Test-Path -LiteralPath $manifestPath) {
    $manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $manifest.dumpSha256) { throw 'Backup checksum mismatch' }
}
$exists = & docker exec $Container psql -U Monolithic -d postgres -At -c "SELECT count(*) FROM pg_database WHERE datname='$TargetDatabase'"
if ($LASTEXITCODE -ne 0 -or $exists.Trim() -ne '0') { throw 'Target database already exists or cannot be checked; no overwrite allowed' }
& docker exec $Container createdb -U Monolithic $TargetDatabase
if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }
$remote="/tmp/$TargetDatabase.dump"
& docker cp $dump "${Container}:$remote"
if ($LASTEXITCODE -ne 0) { throw 'Copying dump failed' }
& docker exec $Container pg_restore -U Monolithic -d $TargetDatabase --no-owner --no-privileges --exit-on-error $remote
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; current database was not changed' }
& docker exec $Container psql -U Monolithic -d $TargetDatabase -c 'SELECT (SELECT count(*) FROM tc2_roster.resident) residents,(SELECT count(*) FROM tc2_roster.household) households,(SELECT count(*) FROM tc2_roster.import_row) source_rows,(SELECT count(*) FROM tc2_roster.change_event) history_events;'
if ($LASTEXITCODE -ne 0) { throw 'Restore reconciliation failed' }
& docker exec $Container rm -f -- $remote
if ($LASTEXITCODE -ne 0) { Write-Warning 'Restore succeeded, but its temporary container dump could not be removed' }
Write-Output "Restored into $TargetDatabase. To open encrypted sources use the data.key from this backup via application.roster.key-file. The active database has not been switched."
