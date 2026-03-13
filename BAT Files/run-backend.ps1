$ErrorActionPreference = "SilentlyContinue"
Set-Location -Path "C:\projects\SME"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SME Backend Environment Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[1/4] Cleaning environment..." -ForegroundColor Yellow
taskkill /F /IM node.exe /T | Out-Null
taskkill /F /IM prisma.exe /T | Out-Null
taskkill /F /IM ts-node.exe /T | Out-Null
docker compose -f docker-compose.infra.yml down -v --remove-orphans | Out-Null

Write-Host "`n[2/4] Generating Database Client..." -ForegroundColor Yellow
npx prisma generate --schema=apps/tenant-service/prisma/schema.prisma

Write-Host "`n[3/4] Booting Microservices & Recording Logs..." -ForegroundColor Yellow
Write-Host "--> Logging everything to: C:\projects\SME\logs\backend_master.log" -ForegroundColor DarkGray

# Tee-Object forces logs to the screen AND writes them to the file simultaneously
npm run smeapplocal | Tee-Object -FilePath "logs\backend_master.log"

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host "[4/4] Execution completed or halted." -ForegroundColor Green
Write-Host "DO NOT CLOSE THIS WINDOW. It keeps the backend alive." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

Read-Host "`nPress Enter to close this window..."