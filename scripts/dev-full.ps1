$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

function Write-Ok([string]$message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Write-Warn([string]$message) { Write-Host "[WARN] $message" -ForegroundColor Yellow }
function Write-Err([string]$message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

Write-Host '=== SME Stable Full Startup ===' -ForegroundColor Cyan

try {
  Push-Location $repoRoot

  & powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir 'ports-guard.ps1')
  if ($LASTEXITCODE -ne 0) {
    throw 'ports-guard failed.'
  }

  & powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir 'infra-check.ps1')
  if ($LASTEXITCODE -ne 0) {
    throw 'infra-check failed.'
  }

  Write-Host 'Starting backend services (npm run dev:all)...'
  $backend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:all') -WorkingDirectory $repoRoot -PassThru
  Start-Sleep -Seconds 3
  if ($backend.HasExited) {
    throw "Backend process exited early with code $($backend.ExitCode)."
  }
  Write-Ok "Backend started (PID $($backend.Id))."

  & powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir 'wait-health.ps1') -TimeoutSeconds 120 -IntervalSeconds 5
  if ($LASTEXITCODE -ne 0) {
    throw 'Backend health check did not pass in time.'
  }

  Write-Host 'Starting frontends (npm run dev:web)...'
  $web = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:web') -WorkingDirectory $repoRoot -PassThru
  Start-Sleep -Seconds 3
  if ($web.HasExited) {
    throw "Web process exited early with code $($web.ExitCode)."
  }
  Write-Ok "Web started (PID $($web.Id))."

  Write-Host ''
  Write-Host 'SME local startup complete.' -ForegroundColor Green
  Write-Host 'Admin UI : http://localhost:3101/login' -ForegroundColor Green
  Write-Host 'Portal UI: http://localhost:3102/login' -ForegroundColor Green
  exit 0
}
catch {
  Write-Err $_.Exception.Message
  exit 1
}
finally {
  Pop-Location
}
