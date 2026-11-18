param([string]$Container = 'monolithic-keycloak-1', [string]$BootstrapUser = 'admin')
$ErrorActionPreference = 'Stop'
function Invoke-Kc([string[]]$Arguments) {
  $result = & docker exec $Container /opt/keycloak/bin/kcadm.sh @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Keycloak admin command failed. Authenticate kcadm first.' }
  return ($result -join "`n")
}
# Requires an authenticated admin CLI session. No credentials are printed or saved in the repository.
$roles = Invoke-Kc @('get','roles','-r','jhipster','--fields','name') | ConvertFrom-Json
foreach ($name in @('ROLE_USER','ROLE_ADMIN','ROLE_SUB_ADMIN','ROLE_SUPERADMIN')) {
  if ($roles.name -notcontains $name) { $null = Invoke-Kc @('create','roles','-r','jhipster','-s',"name=$name") }
}
$clients = Invoke-Kc @('get','clients','-r','jhipster','--fields','id,clientId') | ConvertFrom-Json
$client = $clients | Where-Object clientId -eq 'rbac-admin'
if (-not $client) {
  $null = Invoke-Kc @('create','clients','-r','jhipster','-s','clientId=rbac-admin','-s','publicClient=false','-s','serviceAccountsEnabled=true','-s','standardFlowEnabled=false','-s','directAccessGrantsEnabled=false')
  $clients = Invoke-Kc @('get','clients','-r','jhipster','--fields','id,clientId') | ConvertFrom-Json
  $client = $clients | Where-Object clientId -eq 'rbac-admin'
}
$service = Invoke-Kc @('get',"clients/$($client.id)/service-account-user",'-r','jhipster') | ConvertFrom-Json
foreach ($role in @('manage-users','view-users','query-users','view-realm')) {
  $null = Invoke-Kc @('add-roles','-r','jhipster','--uid',$service.id,'--cclientid','realm-management','--rolename',$role)
}
$secret = Invoke-Kc @('get',"clients/$($client.id)/client-secret",'-r','jhipster') | ConvertFrom-Json
$directory = Join-Path $PSScriptRoot '../.rbac'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $directory 'keycloak.properties'), "rbac.keycloak.client-id=rbac-admin`nrbac.keycloak.client-secret=$($secret.value)`n", [Text.UTF8Encoding]::new($false))
# Bootstrap access deliberately names one existing identity; no email-based or frontend-based escalation.
$null = Invoke-Kc @('add-roles','-r','jhipster','--uusername',$BootstrapUser,'--rolename','ROLE_SUPERADMIN')
Write-Output 'RBAC roles and service account configured. Local secret saved under ignored .rbac/. Restart the backend and sign in again.'
