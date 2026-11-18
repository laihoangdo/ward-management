param(
    [string]$Container = '',
    [string]$Database = 'Monolithic',
    [int]$Port = 0
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'active-database.ps1')
$context=Get-PoliceDatabaseContext -Container $Container
$Container=$context.Container
if($Port -eq 0){$Port=$context.Port}
if($Port -lt 1 -or $Port -gt 65535){throw 'Invalid database port'}
if ($Database -notmatch '^[A-Za-z0-9_]+$') { throw 'Invalid database name' }
$private = Join-Path $PSScriptRoot '..\.rbac'
$destination = Join-Path $private 'database-runtime.properties'
if (Test-Path -LiteralPath $destination) { throw 'Runtime config already exists; no overwrite allowed' }
New-Item -ItemType Directory -Force -Path $private | Out-Null
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$password = [Convert]::ToBase64String($bytes)
$sql = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'database-runtime-role.sql') -Raw
"\set runtime_password '$password'`n$sql" | & docker exec -i $Container psql -X -q -U Monolithic -d $Database -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Provisioning failed; application configuration was not switched' }
$content = "spring.datasource.url=jdbc:postgresql://localhost:$Port/$Database`nspring.datasource.username=police_runtime`nspring.datasource.password=$password`nspring.liquibase.enabled=false`n"
[System.IO.File]::WriteAllText($destination, $content, (New-Object System.Text.UTF8Encoding($false)))
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $destination /inheritance:r /grant:r "${identity}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict credential file permissions; review ACL before running the app' }
Write-Output 'Runtime role provisioned. Credentials saved to ignored .rbac/database-runtime.properties (current user only).'
Write-Output 'Use profile dev,db-runtime AFTER applying migrations with the admin/migration account.'
