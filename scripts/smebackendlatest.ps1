# ==============================================================================
# SME MASTER BACKEND BOOT SCRIPT (backendsmelatest.ps1)
# ==============================================================================

# 1. AUTO-ELEVATE TO ADMINISTRATOR (No more "Run As Admin" manual clicks)
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting Administrator privileges..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "SilentlyContinue"
Set-Location -Path "C:\projects\SME"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SME Master Backend Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 2. CONFIGURE DNS ROUTING (Replacing setup-sme-local.ps1)
Write-Host "`n[1/5] Checking Local DNS Routing..." -ForegroundColor Yellow
$HostsFile = "$env:windir\System32\drivers\etc\hosts"
$BaseEntry = "127.0.0.1`tsme.test"
if ((Get-Content $HostsFile -Raw) -notmatch [regex]::Escape("sme.test")) {
    Add-Content -Path $HostsFile -Value "`n$BaseEntry"
    Write-Host "--> Added sme.test to Windows hosts file." -ForegroundColor DarkGray
} else {
    Write-Host "--> DNS routing for sme.test is already active." -ForegroundColor DarkGray
}

# 3. SCORCHED EARTH CLEANUP
Write-Host "`n[2/5] Cleaning background processes and containers..." -ForegroundColor Yellow
taskkill /F /IM node.exe /T 2>&1 | Out-Null
taskkill /F /IM prisma.exe /T 2>&1 | Out-Null
taskkill /F /IM ts-node.exe /T 2>&1 | Out-Null
docker rm -f sme-rabbitmq sme-redis 2>&1 | Out-Null
docker compose -f docker-compose.infra.yml down -v --remove-orphans 2>&1 | Out-Null

# 4. DATABASE & SCHEMA SYNC (The Missing Tenant Fix)
Write-Host "`n[3/5] Syncing Database & Generating Client..." -ForegroundColor Yellow
Write-Host "--> Pushing schema to native Postgres database (Creating tables)..." -ForegroundColor DarkGray
npx prisma db push --schema=apps/tenant-service/prisma/schema.prisma

Write-Host "--> Generating Prisma TypeScript client..." -ForegroundColor DarkGray
npx prisma generate --schema=apps/tenant-service/prisma/schema.prisma

# 5. BOOT ENGINE & RECORD LOGS
Write-Host "`n[4/5] Booting Microservices & Recording Logs..." -ForegroundColor Yellow
Write-Host "--> Live log file saved to: C:\projects\SME\logs\backend_master.log" -ForegroundColor DarkGray
npm run smeapplocal | Tee-Object -FilePath "logs\backend_master.log"

# 6. KEEP-ALIVE ANCHOR
Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "[5/5] Execution completed or halted." -ForegroundColor Green
Write-Host "DO NOT CLOSE THIS WINDOW. It keeps the backend alive." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

Read-Host "`nPress Enter to close this window..."