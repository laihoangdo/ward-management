# Start the local app: backend (8080) and Vite frontend (9000), each in its own PowerShell window.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 [-BackendOnly | -FrontendOnly]
# Needs the PostGIS and Keycloak containers already running (docker).
param([switch]$BackendOnly, [switch]$FrontendOnly)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Spring Boot refuses a temp dir created by another Windows owner (elevated vs normal shell).
# Its session-store dir is a 40-hex-char folder holding only an empty "servlet-sessions"; remove such stale ones.
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent()
# New files get the token's default owner: the user in a normal shell, BUILTIN\Administrators when elevated.
$expected = $me.Owner.Translate([System.Security.Principal.NTAccount]).Value
Get-ChildItem -LiteralPath $env:TEMP -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^[0-9A-F]{40}$' } |
    ForEach-Object {
        $items = @(Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue)
        $onlySessions = $items.Count -eq 1 -and $items[0].Name -eq 'servlet-sessions' -and $items[0].PSIsContainer
        $owner = (Get-Acl -LiteralPath $_.FullName).Owner
        if ($onlySessions -and $owner -ne $expected) {
            Write-Host "Removing stale Spring temp dir $($_.FullName) (owner $owner)"
            Remove-Item -LiteralPath $_.FullName -Recurse -Force
        }
    }

if (-not $FrontendOnly) {
    Start-Process powershell.exe -WorkingDirectory $root -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'scripts\start-backend-runtime.ps1')
    Write-Host 'Backend starting in a new window -> http://localhost:8080'
}
if (-not $BackendOnly) {
    Start-Process powershell.exe -WorkingDirectory $root -ArgumentList '-NoExit', '-Command', 'npm start'
    Write-Host 'Frontend starting in a new window -> http://localhost:9000'
}
