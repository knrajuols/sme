# restart-portal.ps1
# Kills only the web-portal (port 3102) and restarts it with the current source.
# Must be run from an ELEVATED (Admin) PowerShell - same session that ran the backend boot.

Set-Location $PSScriptRoot
$ROOT   = $PSScriptRoot
$outLog = Join-Path $ROOT 'logs\services\web-portal.log'
$errLog = Join-Path $ROOT 'logs\services\web-portal.err.log'
$SvcDir = Join-Path $ROOT 'apps\web-portal'

# --- Clear stale .next cache --------------------------------------------------
$nextDir = Join-Path $SvcDir '.next'
if (Test-Path $nextDir) {
    Write-Host "[0/3] Clearing stale .next cache..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force $nextDir
    Write-Host "      .next cache cleared." -ForegroundColor Green
} else {
    Write-Host "[0/3] .next cache already absent - skipping." -ForegroundColor DarkGray
}

# --- Kill port 3102 -----------------------------------------------------------
Write-Host "[1/3] Stopping web-portal (port 3102)..." -ForegroundColor Cyan
$conns = Get-NetTCPConnection -LocalPort 3102 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) {
        Write-Host "      Killing PID $($c.OwningProcess)"
        taskkill /F /PID $($c.OwningProcess) /T 2>&1 | Out-Null
        Stop-Process -Id $($c.OwningProcess) -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "      Port 3102 already free." -ForegroundColor DarkGray
}

# Verify the port is now free
$still = Get-NetTCPConnection -LocalPort 3102 -State Listen -ErrorAction SilentlyContinue
if ($still) {
    Write-Host "      [FAIL] Port 3102 is still occupied! Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "      Port 3102 cleared." -ForegroundColor Green

# --- Restart web-portal -------------------------------------------------------
Write-Host ""
Write-Host "[2/3] Starting web-portal..." -ForegroundColor Cyan

# Ensure log directory exists
if (-not (Test-Path (Split-Path $outLog))) {
    New-Item -ItemType Directory -Path (Split-Path $outLog) -Force | Out-Null
}

$proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory $SvcDir `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError  $errLog `
    -NoNewWindow -PassThru

Write-Host "      Wrapper PID=$($proc.Id) -- waiting for port 3102 (up to 90s)..."

# --- Wait for port 3102 to open -----------------------------------------------
$deadline = (Get-Date).AddSeconds(90)
$up = $false
while ((Get-Date) -lt $deadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar  = $tcp.BeginConnect('127.0.0.1', 3102, $null, $null)
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
    Write-Host "[FAIL] web-portal did not open port 3102 within 90s." -ForegroundColor Red
    Write-Host "       Check logs at: $errLog" -ForegroundColor Red
    exit 1
}

# --- Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] web-portal is UP on port 3102." -ForegroundColor Green
Write-Host "      stdout: $outLog" -ForegroundColor DarkGray
Write-Host "      stderr: $errLog" -ForegroundColor DarkGray
