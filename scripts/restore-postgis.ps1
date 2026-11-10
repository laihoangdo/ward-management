param(
    [Parameter(Mandatory=$true)][string]$BackupDirectory,
    [string]$Container = 'police-postgis-1',
    [string]$TargetDatabase = 'Monolithic'
)
$ErrorActionPreference='Stop'
if ($Container -eq 'monolithic-postgresql-1') { throw 'Never restore the PostGIS cutover over the legacy cluster' }
if ($TargetDatabase -notmatch '^(Monolithic|tc2_restore_[A-Za-z0-9_]+)$') { throw 'Invalid restore target' }
$backup=(Resolve-Path -LiteralPath $BackupDirectory).Path
$manifest=Get-Content -LiteralPath (Join-Path $backup 'manifest.json') -Raw | ConvertFrom-Json
$dump=Join-Path $backup 'database.dump'
if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne $manifest.dumpSha256) { throw 'Backup checksum mismatch' }
if (-not (Test-Path -LiteralPath (Join-Path $backup 'data.key'))) { throw 'Recovery key is missing' }
$available=& docker exec $Container psql -X -U Monolithic -d postgres -At -c "SELECT count(*) FROM pg_available_extensions WHERE name='postgis'"
if ($LASTEXITCODE -ne 0 -or $available.Trim() -ne '1') { throw 'Target does not support PostGIS' }
$exists=& docker exec $Container psql -X -U Monolithic -d postgres -At -c "SELECT count(*) FROM pg_database WHERE datname='$TargetDatabase'"
if ($LASTEXITCODE -ne 0 -or $exists.Trim() -ne '0') { throw 'Target exists; no overwrite or cleanup is allowed' }
& docker exec $Container createdb -U Monolithic -T template0 -E UTF8 $TargetDatabase
if ($LASTEXITCODE -ne 0) { throw 'Creating fresh restore database failed' }
$remote="/tmp/$TargetDatabase-postgis-restore.dump"
& docker cp $dump "${Container}:$remote"
if ($LASTEXITCODE -ne 0) { throw 'Copying verified dump failed' }
& docker exec $Container pg_restore -U Monolithic -d $TargetDatabase --no-owner --no-privileges --exit-on-error $remote
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; legacy database has not been touched' }
& docker exec $Container rm -f -- $remote
if ($LASTEXITCODE -ne 0) { Write-Warning 'Restore succeeded, but its temporary container dump could not be removed' }
Write-Output "Restored $TargetDatabase into $Container. Migrations, reconciliation and runtime grants are still required before cutover."
