# Copy the VPS backup passphrase directly into Windows CurrentUser DPAPI protection.
# Never prints a passphrase and never stores plaintext on local disk.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$root=Split-Path $PSScriptRoot -Parent
$directory=Join-Path $root '.tc2-private'
$target=Join-Path $directory 'vps-backup-passphrase.dpapi'
if(Test-Path -LiteralPath $target) { throw 'Recovery escrow already exists; review rather than overwrite.' }
if(-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory | Out-Null }
$plain=$null
$bytes=$null
$roundtrip=$null
try {
    $result=& ssh -o BatchMode=yes -o ConnectTimeout=15 gcp-vps 'sudo -n cat /etc/police-management/secrets/local_backup_passphrase'
    if($LASTEXITCODE -ne 0) { throw 'Could not retrieve owned backup key over SSH.' }
    $plain=($result -join '').Trim()
    if($plain.Length -lt 40) { throw 'Unexpected backup passphrase length.' }
    $bytes=[Text.Encoding]::UTF8.GetBytes($plain)
    $entropy=[Text.Encoding]::UTF8.GetBytes('police-vps-backup-recovery-v1')
    $scope=[Security.Cryptography.DataProtectionScope]::CurrentUser
    $protected=[Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,$scope)
    $roundtrip=[Security.Cryptography.ProtectedData]::Unprotect($protected,$entropy,$scope)
    if([Convert]::ToBase64String($bytes) -ne [Convert]::ToBase64String($roundtrip)) { throw 'DPAPI validation failed.' }
    $file=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $file.Write($protected,0,$protected.Length) } finally { $file.Dispose() }
    Write-Output 'PASS: backup key escrowed with Windows CurrentUser DPAPI; no plaintext printed or written.'
    Write-Output 'Recovery requires this Windows user profile. Keep a separately approved vault/offline recovery copy as well.'
} finally {
    if($bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
    if($roundtrip) { [Array]::Clear($roundtrip,0,$roundtrip.Length) }
    $plain=$null
    $result=$null
}
