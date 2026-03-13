param(
  [int]$TimeoutSeconds = 90,
  [int]$IntervalSeconds = 5
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$verifyScript = Join-Path $repoRoot 'scripts\verify-health.js'
$gatewayHealthUrl = 'http://localhost:3000/health/ready'

function Write-Ok([string]$message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Write-Warn([string]$message) { Write-Host "[WARN] $message" -ForegroundColor Yellow }
function Write-Err([string]$message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

Write-Host '=== Wait Health (SME Local) ===' -ForegroundColor Cyan

$useVerifyScript = Test-Path $verifyScript
if ($useVerifyScript) {
  Write-Ok 'Using npm run verify:health for readiness checks.'
}
else {
  Write-Warn 'verify-health.js script not found. Falling back to gateway health polling.'
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$attempt = 0

Push-Location $repoRoot
try {
  while ((Get-Date) -lt $deadline) {
    $attempt++

    if ($useVerifyScript) {
      Write-Host "Attempt ${attempt}: npm run verify:health"
      & npm run verify:health | Out-Host
      if ($LASTEXITCODE -eq 0) {
        Write-Ok 'Health verification passed.'
        exit 0
      }
    }
    else {
      Write-Host "Attempt ${attempt}: GET $gatewayHealthUrl"
      try {
        $response = Invoke-WebRequest -Uri $gatewayHealthUrl -Method GET -UseBasicParsing -TimeoutSec 8
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
          Write-Ok "Gateway health check passed with status $($response.StatusCode)."
          exit 0
        }
      }
      catch {
      }
    }

    Write-Warn "Health verification failed (attempt $attempt). Retrying in $IntervalSeconds seconds..."
    Start-Sleep -Seconds $IntervalSeconds
  }
}
finally {
  Pop-Location
}

Write-Err "Health verification did not pass within $TimeoutSeconds seconds."
exit 1
