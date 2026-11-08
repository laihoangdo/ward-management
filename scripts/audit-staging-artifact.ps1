param([Parameter(Mandatory=$true)][string]$Artifact)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Artifact).Path)
try {
    $names=@($archive.Entries | ForEach-Object FullName)
    foreach($name in $names) {
        if($name -match '(^|/)(\.rbac|\.tc2-private|backups)/|\.(p12|key|dump)$|config/application-(dev|secret-samples|tls)\.yml$|static/assets/.*\.map$') {
            throw 'Forbidden local/sample secret or debug material in artifact; upload blocked'
        }
    }
    if($names -notcontains 'org/springframework/boot/loader/launch/PropertiesLauncher.class') { throw 'Migration launcher absent' }
    $marker=$archive.GetEntry('BOOT-INF/classes/static/staging-manifest.json')
    if(-not $marker) { throw 'Synthetic staging manifest missing; upload blocked' }
    $reader=[System.IO.StreamReader]::new($marker.Open())
    try {$manifest=$reader.ReadToEnd() | ConvertFrom-Json} finally {$reader.Dispose()}
    if($manifest.syntheticOnly -ne $true) { throw 'Not a synthetic staging build' }
    $root=Split-Path $PSScriptRoot -Parent
    $phones=[System.Collections.Generic.HashSet[string]]::new()
    foreach($file in @('baDiemBoundaryGis.json','baDiemBuildingsGis.backup.json')) {
        $data=Get-Content -Raw -LiteralPath (Join-Path $root "src/main/webapp/app/gis/data/$file") | ConvertFrom-Json
        foreach($feature in $data.features) {
            foreach($field in @('phone','owner_phone')) {
                $value=[string]$feature.properties.$field
                if($value.Length -ge 7) {$null=$phones.Add($value)}
            }
        }
    }
    foreach($entry in $archive.Entries) {
        if($entry.FullName -match '^BOOT-INF/classes/static/.*\.(js|json)$') {
            $reader=[System.IO.StreamReader]::new($entry.Open())
            try {$text=$reader.ReadToEnd()} finally {$reader.Dispose()}
            foreach($phone in $phones) { if($text.Contains($phone)) { throw 'Legacy contact value found in public static output; upload blocked' } }
        }
    }
    [pscustomobject]@{result='PASS';syntheticOnly=$true;archiveEntries=$names.Count;legacyContactCandidatesChecked=$phones.Count;sha256=(Get-FileHash -LiteralPath $Artifact -Algorithm SHA256).Hash}
} finally { $archive.Dispose() }
