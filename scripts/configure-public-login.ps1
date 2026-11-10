param([Parameter(Mandatory=$true)][string]$PublicOrigin)
$ErrorActionPreference='Stop'
$uri=[Uri]$PublicOrigin
if($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') { throw 'Supply only an HTTPS origin, e.g. https://app.example.com' }
$origin=$uri.GetLeftPart([UriPartial]::Authority)
$root=Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $root
try {
    $recovery=Join-Path $root ('.rbac/oidc-recovery/'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path $recovery | Out-Null
    $propertiesPath=Join-Path $root '.rbac/keycloak.properties'
    if(Test-Path -LiteralPath $propertiesPath){Copy-Item -LiteralPath $propertiesPath -Destination (Join-Path $recovery 'keycloak.properties')}
    $realm=& docker exec monolithic-keycloak-1 /opt/keycloak/bin/kcadm.sh get realms/jhipster
    if($LASTEXITCODE -ne 0){throw 'Keycloak admin session missing/expired. Authenticate kcadm locally before running this script.'}
    [IO.File]::WriteAllText((Join-Path $recovery 'realm.json'),($realm -join "`n"),[Text.UTF8Encoding]::new($false))
    & docker exec monolithic-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/jhipster -s "attributes.frontendUrl=$origin"
    if($LASTEXITCODE -ne 0){throw 'Updating realm public URL failed'}
    $clientJson=& docker exec monolithic-keycloak-1 /opt/keycloak/bin/kcadm.sh get clients -r jhipster -q clientId=web_app
    if($LASTEXITCODE -ne 0){throw 'Reading web_app failed'}
    $client=@(($clientJson -join "`n") | ConvertFrom-Json)[0]
    if(-not $client.id){throw 'web_app client missing'}
    $body=@{redirectUris=@(@($client.redirectUris)+"$origin/login/oauth2/code/oidc" | Select-Object -Unique);webOrigins=@(@($client.webOrigins)+$origin | Select-Object -Unique)} | ConvertTo-Json -Depth 4
    $clientPath=Join-Path $recovery 'client-public-origin.json'
    [IO.File]::WriteAllText($clientPath,$body,[Text.UTF8Encoding]::new($false))
    & docker cp $clientPath monolithic-keycloak-1:/tmp/public-login-client.json
    if($LASTEXITCODE -ne 0){throw 'Copying client update failed'}
    & docker exec monolithic-keycloak-1 /opt/keycloak/bin/kcadm.sh update "clients/$($client.id)" -r jhipster -f /tmp/public-login-client.json
    if($LASTEXITCODE -ne 0){throw 'Updating client redirect URI failed'}
    $properties=if(Test-Path -LiteralPath $propertiesPath){[IO.File]::ReadAllText($propertiesPath)}else{''}
    $values=@{'APP_OIDC_ISSUER'="$origin/realms/jhipster";'spring.security.oauth2.client.provider.oidc.issuer-uri'="$origin/realms/jhipster";'rbac.keycloak.issuer-uri'='http://localhost:9080/realms/jhipster'}
    foreach($key in $values.Keys){$pattern='(?m)^'+[regex]::Escape($key)+'=.*$';$line=$key+'='+$values[$key];if($properties -match $pattern){$properties=[regex]::Replace($properties,$pattern,$line)}else{$properties+="`n$line`n"}}
    [IO.File]::WriteAllText($propertiesPath,$properties,[Text.UTF8Encoding]::new($false))
    Write-Output "Public issuer configured: $origin/realms/jhipster. Restart the backend to load it. Local rollback configuration saved in $recovery."
} finally {Pop-Location}
