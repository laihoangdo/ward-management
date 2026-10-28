param([string]$SourceDirectory = '.', [string]$JdbcUrl = '')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'active-database.ps1')
if(-not $JdbcUrl){$JdbcUrl=(Get-PoliceDatabaseContext).JdbcUrl}
$root=Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $root
try {
    & .\mvnw.cmd -ntp '-Dskip.installnodenpm' '-Dskip.npm' '-DskipTests' compile dependency:build-classpath '-Dmdep.outputFile=target/tc2-classpath.txt'
    if($LASTEXITCODE -ne 0){throw 'Build failed'}
    $rosterClasspath='target/classes;'+(Get-Content -LiteralPath target/tc2-classpath.txt -Raw).Trim()
    & java -cp $rosterClasspath com.policemanagement.com.service.roster.RosterMaintenance --import-authorized $SourceDirectory $JdbcUrl
    if($LASTEXITCODE -ne 0){throw 'Import failed; inspect the protected local operator log. Source stage and apply are separate transactions.'}
} finally { Pop-Location }
