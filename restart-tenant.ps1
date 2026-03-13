# restart-tenant.ps1
# Kills only the tenant-service (port 3002) and restarts it with the current source.
# Must be run from an ELEVATED (Admin) PowerShell — same session that ran the backend boot.

Set-Location $PSScriptRoot
$ROOT   = $PSScriptRoot
$outLog = Join-Path $ROOT 'logs\services\tenant-service.log'
$errLog = Join-Path $ROOT 'logs\services\tenant-service.err.log'
$SvcDir = Join-Path $ROOT 'apps\tenant-service'

# ─── Kill port 3002 ───────────────────────────────────────────────────────────
Write-Host "[1/3] Stopping tenant-service (port 3002)..." -ForegroundColor Cyan
$conns = Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) {
        Write-Host "      Killing PID $($c.OwningProcess)"
        taskkill /F /PID $($c.OwningProcess) /T 2>&1 | Out-Null
        Stop-Process -Id $($c.OwningProcess) -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "      Port 3002 already free." -ForegroundColor DarkGray
}

# Verify the port is now free
$still = Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue
if ($still) {
    Write-Host "      [FAIL] Port 3002 is still occupied! Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "      Port 3002 cleared." -ForegroundColor Green

# ─── Restart tenant-service ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Starting tenant-service..." -ForegroundColor Cyan

# Ensure log directory exists
if (-not (Test-Path (Split-Path $outLog))) {
    New-Item -ItemType Directory -Path (Split-Path $outLog) -Force | Out-Null
}

$proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run start:dev" `
    -WorkingDirectory $SvcDir `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError  $errLog `
    -NoNewWindow -PassThru

Write-Host "      Wrapper PID=$($proc.Id) -- waiting for port 3002 (up to 60s)..."

# ─── Wait for port 3002 to open ───────────────────────────────────────────────
$deadline = (Get-Date).AddSeconds(60)
$up = $false
while ((Get-Date) -lt $deadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar  = $tcp.BeginConnect('127.0.0.1', 3002, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne(400, $false) -and $tcp.Connected) {
            $tcp.Close(); $up = $true; break
        }
        $tcp.Close()
    } catch {}

    # Early crash detection
    if ($proc.HasExited) {
        Write-Host "      [FAIL] Process exited prematurely (code $($proc.ExitCode))." -ForegroundColor Red
        Write-Host "      Check: $errLog" -ForegroundColor Red
        exit 1
    }
    Start-Sleep -Milliseconds 900
}

if (-not $up) {
    Write-Host ""
    Write-Host "[FAIL] tenant-service did not open port 3002 within 60s." -ForegroundColor Red
    Write-Host "       Check logs at: $errLog" -ForegroundColor Red
    exit 1
}

# ─── Done ─────────────────────────────────────────────────────────────────────
$newOwner = (Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue |
             Select-Object -First 1 -ExpandProperty OwningProcess)
Write-Host ""
Write-Host "[3/3] tenant-service is UP on :3002  PID=$newOwner" -ForegroundColor Green
Write-Host ""
Write-Host "Smoke-test (expects 401 Unauthorized -- proves the route exists):" -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "http://localhost:3002/academic/years/seed" -Method POST -ErrorAction Stop
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) {
        Write-Host "  POST /academic/years/seed => 401 Unauthorized  [ROUTE EXISTS - OK]" -ForegroundColor Green
    } elseif ($code -eq 403) {
        Write-Host "  POST /academic/years/seed => 403 Forbidden     [ROUTE EXISTS - OK]" -ForegroundColor Green
    } elseif ($code -eq 404) {
        Write-Host "  POST /academic/years/seed => 404 NOT FOUND     [ROUTE MISSING - check source]" -ForegroundColor Red
    } else {
        Write-Host "  POST /academic/years/seed => HTTP $code" -ForegroundColor DarkYellow
    }
}
