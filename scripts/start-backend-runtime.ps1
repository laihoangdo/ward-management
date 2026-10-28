$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path -LiteralPath (Join-Path $root '.rbac/database-runtime.properties'))) {
    throw 'Run setup-database-runtime.ps1 after applying migrations; runtime credentials are missing'
}
Push-Location $root
try {
    & .\mvnw.cmd '-Dskip.installnodenpm' '-Dskip.npm' '-Dmaven.compiler.useIncrementalCompilation=false' '-Dspring-boot.run.profiles=dev,db-runtime' -ntp --batch-mode
    if ($LASTEXITCODE -ne 0) { throw 'Runtime backend exited unsuccessfully' }
} finally { Pop-Location }
