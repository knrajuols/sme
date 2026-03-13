# ─────────────────────────────────────────────────────────────────────────────
# scripts\setup-sme-local.ps1
#
# Sets up your Windows hosts file for the sme.test development approach.
# Run this script as Administrator.
#
# Why sme.test and NOT sme.local?
#   The .local TLD is hijacked by mDNS (Bonjour/Zeroconf) on Windows.
#   Chrome and Edge bypass the hosts file for .local domains and try
#   multicast DNS instead — which fails. Use .test (IANA reserved for testing).
#
# Usage:
#   # Add base sme.test entry
#   .\scripts\setup-sme-local.ps1
#
#   # Add a school subdomain (e.g. after a school is approved in Platform Admin)
#   .\scripts\setup-sme-local.ps1 -AddSchool "greenvalley"
#
#   # Remove a school subdomain
#   .\scripts\setup-sme-local.ps1 -RemoveSchool "greenvalley"
#
# TODO (Production Migration):
#   This script is ONLY needed for local development.
#   In production, configure wildcard DNS (*.yourplatform.com → server IP)
#   at your DNS provider — no hosts file changes needed anywhere.
# ─────────────────────────────────────────────────────────────────────────────

param(
    [string]$AddSchool    = '',
    [string]$RemoveSchool = ''
)

$HostsFile = 'C:\Windows\System32\drivers\etc\hosts'

# ── Ensure running as Administrator ──────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Please run this script as Administrator."
    exit 1
}

# ── Helper: add a line to hosts if it doesn't already exist ──────────────────
function Add-HostEntry([string]$ip, [string]$hostname) {
    $entry   = "$ip`t$hostname"
    $current = Get-Content $HostsFile -Raw
    if ($current -notmatch [regex]::Escape($hostname)) {
        Add-Content -Path $HostsFile -Value $entry
        Write-Host "  Added: $entry" -ForegroundColor Green
    } else {
        Write-Host "  Already exists: $hostname" -ForegroundColor Yellow
    }
}

# ── Helper: remove a hosts entry ─────────────────────────────────────────────
function Remove-HostEntry([string]$hostname) {
    $lines = Get-Content $HostsFile
    $filtered = $lines | Where-Object { $_ -notmatch [regex]::Escape($hostname) }
    $filtered | Set-Content $HostsFile
    Write-Host "  Removed: $hostname" -ForegroundColor Cyan
}

# ── Always ensure the base sme.test entry exists ───────────────────────────────
Write-Host "`nSetting up sme.test base entries..." -ForegroundColor White
Add-HostEntry '127.0.0.1' 'sme.test'

# ── Add school subdomain ─────────────────────────────────────────────
if ($AddSchool -ne '') {
    $schoolHostname = "$AddSchool.sme.test"
    Write-Host "`nAdding school subdomain: $schoolHostname" -ForegroundColor White
    Add-HostEntry '127.0.0.1' $schoolHostname
}

# ── Remove school subdomain ──────────────────────────────────────────
if ($RemoveSchool -ne '') {
    $schoolHostname = "$RemoveSchool.sme.test"
    Write-Host "`nRemoving school subdomain: $schoolHostname" -ForegroundColor White
    Remove-HostEntry $schoolHostname
}

Write-Host "`nDone. Current sme.test entries in hosts file:" -ForegroundColor White
Get-Content $HostsFile | Where-Object { $_ -match 'sme\.test' }
