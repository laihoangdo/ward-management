# Cutover only after restore + migrations + regression tests. Does not start the backend.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$private=Join-Path $root '.rbac'
$config=Join-Path $private 'database-runtime.properties'
$previous=Join-Path $private 'database-runtime-before-postgis.properties'
$manifest=Join-Path $private 'active-database.json'
if(Test-Path -LiteralPath $previous){throw 'Previous runtime config already archived; no overwrite allowed'}
if(Test-Path -LiteralPath $manifest){throw 'Active database manifest already exists; review an existing cutover first'}
if(Get-NetTCPConnection -LocalPort 8080,8081 -State Listen -ErrorAction SilentlyContinue){throw 'Stop application and migration backends before cutover'}
$verified=@'
SELECT count(*) FROM databasechangelog WHERE id='20261029000000-1' AND exectype='EXECUTED';
'@ | & docker exec -i police-postgis-1 psql -X -q -At -U Monolithic -d Monolithic -v ON_ERROR_STOP=1
if($LASTEXITCODE-ne0 -or $verified.Trim()-ne'1'){throw 'PostGIS migration is not verified'}
& (Join-Path $PSScriptRoot 'compare-database-content.ps1')
$acl=Get-Acl -LiteralPath $config
Copy-Item -LiteralPath $config -Destination $previous
Set-Acl -LiteralPath $previous -AclObject $acl
$lines=@(Get-Content -LiteralPath $config | Where-Object {$_ -notmatch '^(spring\.datasource\.url|gis\.postgis\.enabled)='})
$lines+=@('spring.datasource.url=jdbc:postgresql://localhost:5433/Monolithic','gis.postgis.enabled=true')
[System.IO.File]::WriteAllText($config,($lines-join "`n")+"`n",(New-Object System.Text.UTF8Encoding($false)))
Set-Acl -LiteralPath $config -AclObject $acl
$state=@{container='police-postgis-1';port=5433;database='Monolithic';previousContainer='monolithic-postgresql-1';previousPort=5432;activatedAt=(Get-Date).ToString('o');image='postgis/postgis:18-3.6';postgres='18.6';postgis='3.6.4'}
[System.IO.File]::WriteAllText($manifest,($state|ConvertTo-Json),(New-Object System.Text.UTF8Encoding($false)))
@'
ALTER DATABASE "Monolithic" SET default_transaction_read_only=on;
'@ | & docker exec -i monolithic-postgresql-1 psql -X -q -U Monolithic -d postgres -v ON_ERROR_STOP=1
if($LASTEXITCODE-ne0){throw 'Runtime config switched, but legacy DB freeze failed; inspect before starting the app'}
Write-Output 'PostGIS activated on 5433. Original runtime config is private and preserved; legacy Monolithic defaults to read-only.'
Write-Output 'Start scripts/start-backend-runtime.ps1 and verify health plus actual database sessions before using the app.'
