param(
    [string]$SourceContainer='monolithic-postgresql-1',
    [string]$TargetContainer='police-postgis-1',
    [string]$SourceDatabase='Monolithic',
    [string]$TargetDatabase='Monolithic'
)
$ErrorActionPreference='Stop'
foreach($name in @($SourceContainer,$TargetContainer,$SourceDatabase,$TargetDatabase)){
    if($name -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid comparison identifier'}
}
$list="SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname IN ('public','tc2_roster','database_repair','legacy_mock_20261027') AND tablename NOT IN ('databasechangelog','databasechangeloglock','spatial_ref_sys') ORDER BY 1"
$tables=@($list | & docker exec -i $SourceContainer psql -X -q -At -U Monolithic -d $SourceDatabase -v ON_ERROR_STOP=1)
if($LASTEXITCODE-ne0){throw 'Source table discovery failed'}
$targetTables=@($list | & docker exec -i $TargetContainer psql -X -q -At -U Monolithic -d $TargetDatabase -v ON_ERROR_STOP=1)
if($LASTEXITCODE-ne0 -or ($tables-join "`n") -ne ($targetTables-join "`n")){throw 'Application table sets differ'}
$statements=@('BEGIN READ ONLY;','SET LOCAL timezone=''UTC'';','SET LOCAL statement_timeout=''60s'';')
foreach($table in $tables){
    if($table -notmatch '^[a-z0-9_]+\.[a-z0-9_]+$'){throw 'Unexpected table identifier'}
    $row="(to_jsonb(t)-ARRAY['location_geom','footprint_geom','line_geom','boundary_geom'])::text"
    $statements+="SELECT '$table',count(*),coalesce(md5(string_agg(md5($row),'' ORDER BY md5($row))),'EMPTY') FROM $table t;"
}
$sql=($statements+@('COMMIT;'))-join "`n"
$source=@($sql | & docker exec -i $SourceContainer psql -X -q -At -U Monolithic -d $SourceDatabase -v ON_ERROR_STOP=1)
if($LASTEXITCODE-ne0){throw 'Source fingerprint query failed'}
$target=@($sql | & docker exec -i $TargetContainer psql -X -q -At -U Monolithic -d $TargetDatabase -v ON_ERROR_STOP=1)
if($LASTEXITCODE-ne0){throw 'Target fingerprint query failed'}
if(($source-join "`n") -ne ($target-join "`n")){
    $different=Compare-Object $source $target | ForEach-Object {($_.InputObject -split '\|')[0]} | Sort-Object -Unique
    throw "Application content differs in: $($different-join ', '); do not cut over"
}
Write-Output "PASS: counts and ordered JSONB fingerprints match for $($tables.Count) application/archive tables (derived spatial columns excluded)."
