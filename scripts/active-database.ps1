function Get-PoliceDatabaseContext {
    param([string]$Container = '')
    $path=Join-Path $PSScriptRoot '..\.rbac\active-database.json'
    $active=if(Test-Path -LiteralPath $path){Get-Content -LiteralPath $path -Raw | ConvertFrom-Json}else{$null}
    $runtime=Join-Path $PSScriptRoot '..\.rbac\database-runtime.properties'
    if(-not $Container -and -not $active -and (Test-Path -LiteralPath $runtime) -and
        (Select-String -LiteralPath $runtime -Pattern '^spring\.datasource\.url=jdbc:postgresql://localhost:5433/' -Quiet)){
        throw 'Runtime uses PostGIS but active-database.json is missing; restore metadata or explicitly select the intended container'
    }
    if (-not $Container) { $Container=if($active){[string]$active.container}else{'monolithic-postgresql-1'} }
    if ($Container -notmatch '^[A-Za-z0-9_-]+$') { throw 'Invalid database container name' }
    $port=if($active -and $Container -eq $active.container){[int]$active.port}elseif($Container -eq 'police-postgis-1'){5433}else{5432}
    if($port -lt 1 -or $port -gt 65535){throw 'Invalid database port'}
    [pscustomobject]@{Container=$Container;Port=$port;JdbcUrl="jdbc:postgresql://localhost:$port/Monolithic"}
}
