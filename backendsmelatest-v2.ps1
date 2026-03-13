# ==============================================================================
# SME ENTERPRISE BACKEND MASTER (backendsmelatest.ps1)
# Version: 3.0 - The "Zero-Touch" Production Boot
# ==============================================================================

# 1. PRIVILEGE ELEVATION (No manual "Run as Admin" needed)
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting Administrator privileges..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop" # Stop immediately on any critical failure
Set-Location -Path "C:\projects\SME"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   SME PLATFORM: SECURE BOOT SEQUENCE STARTING" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 2. ENVIRONMENT & LOCK CLEANUP (Aggressive Zombie Killing)
Write-Host "`n[1/5] Clearing Process Locks & Environment..." -ForegroundColor Yellow
$processList = @("node", "prisma", "ts-node")
foreach ($proc in $processList) {
    Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Critical: Wait for Windows to release file handles on .dll.node files
Write-Host "--> Waiting for system to release file locks..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# 3. SMART ENVIRONMENT VARIABLE INJECTION (Microservice Aware)
Write-Host "`n[2/5] Injecting Microservice Environment Variables..." -ForegroundColor Yellow

# We explicitly load the DB keys from the tenant and iam services
$targetEnvPaths = @(
    "C:\projects\SME\apps\tenant-service\.env",
    "C:\projects\SME\apps\iam-service\.env"
)

$envLoaded = $false
foreach ($path in $targetEnvPaths) {
    if (Test-Path $path) {
        Write-Host "--> Loading keys from: $path" -ForegroundColor DarkGray
        Get-Content $path | Where-Object { $_ -match '^[^#\s]+=' } | ForEach-Object {
            $name, $value = $_.Split('=', 2)
            [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
        }
        $envLoaded = $true
	break # <--- ADD THIS LINE HERE
    }
}

if (-not $envLoaded) {
    Write-Error "CRITICAL: Could not find .env files in the microservice folders. Deployment aborted."
    exit
}

# 4. INFRASTRUCTURE & DATABASE SYNC (Headless & Safe)
Write-Host "`n[3/5] Deploying Infrastructure & SQL Migrations..." -ForegroundColor Yellow

# Reset Docker containers (Infrastructure only - Native Postgres DB remains 100% safe)
$tempErr = $ErrorActionPreference
$ErrorActionPreference = "Continue"

docker compose -f docker-compose.infra.yml down 2>&1 | Out-Null
docker compose -f docker-compose.infra.yml up -d 2>&1 | Out-Null

$ErrorActionPreference = $tempErr

# Deploy Migrations (Headless - No Y/N prompts - Never deletes data)
$schemas = @(
    "apps\tenant-service\prisma\schema.prisma",
    "apps\academic-service\prisma\schema.prisma"
)

foreach ($schema in $schemas) {
    if (Test-Path $schema) {
        Write-Host "--> Validating and Syncing: $schema" -ForegroundColor DarkGray
        npx prisma migrate deploy --schema=$schema
        npx prisma generate --schema=$schema
    } else {
        Write-Host "--> Skipping $schema (File not found)" -ForegroundColor DarkGray
    }
}

# 5. SERVICE BOOT ENGINE
Write-Host "`n[4/5] Starting SME Microservices..." -ForegroundColor Yellow
Write-Host "--> Monitoring logs at C:\projects\SME\logs\backend_master.log" -ForegroundColor DarkGray

# Ensure log directory exists so it doesn't crash on write
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

# Launch main backend engine
npm run smeapplocal | Tee-Object -FilePath "logs\backend_master.log"

# 6. ANCHOR
Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "   BACKEND ACTIVE - DO NOT CLOSE THIS WINDOW" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Read-Host "Press Enter to stop services..."