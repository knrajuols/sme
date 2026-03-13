# restart-iam.ps1 - Kill + restart iam-service, then verify login works
# Run from the SAME elevated/admin PowerShell that ran sme-fullboot.ps1
Set-Location $PSScriptRoot
$ROOT    = $PSScriptRoot
$outLog  = Join-Path $ROOT 'logs\pm2\iam-service.out.log'
$errLog  = Join-Path $ROOT 'logs\pm2\iam-service.err.log'
$svcDir  = Join-Path $ROOT 'apps\iam-service'
$ARCHIVE = Join-Path $ROOT 'logs\archive'

# --- 1. Kill existing IAM process(es) on port 3001 ---
Write-Host ""
Write-Host "[1/4] Killing existing IAM service..." -ForegroundColor Cyan
$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $conn | ForEach-Object {
        $pid_ = $_.OwningProcess
        Write-Host "      Killing PID $pid_"
        taskkill /F /PID $pid_ 2>$null | Out-Null
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
    }
}
# Also kill any node.exe with iam-service in commandline
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*iam-service*' } |
    ForEach-Object {
        Write-Host "      Killing zombie IAM node PID $($_.ProcessId)"
        taskkill /F /PID $_.ProcessId 2>$null | Out-Null
    }
Start-Sleep -Seconds 2

$stillUp = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($stillUp) {
    Write-Host "      [WARN] Port 3001 still occupied - attempting restart anyway" -ForegroundColor Yellow
} else {
    Write-Host "      Port 3001 cleared OK" -ForegroundColor Green
}

# --- 2. Archive old logs ---
Write-Host ""
Write-Host "[2/4] Archiving old logs..." -ForegroundColor Cyan
if (-not (Test-Path $ARCHIVE)) { New-Item -ItemType Directory -Path $ARCHIVE -Force | Out-Null }
$ts = Get-Date -Format 'yyyyMMddHHmmss'
foreach ($log in @($outLog, $errLog)) {
    if (Test-Path $log) {
        $stem = [System.IO.Path]::GetFileNameWithoutExtension($log)
        Move-Item $log (Join-Path $ARCHIVE ($stem + '_' + $ts + '.log')) -Force -ErrorAction SilentlyContinue
    }
}

# --- 3. Start IAM service ---
Write-Host ""
Write-Host "[3/4] Starting IAM service (npm run start:dev)..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run start:dev" `
    -WorkingDirectory $svcDir `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -NoNewWindow -PassThru

Write-Host "      Wrapper PID=$($proc.Id) - waiting for port 3001 (up to 90s)..."

$deadline = (Get-Date).AddSeconds(90)
$up = $false
while ((Get-Date) -lt $deadline) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar  = $tcp.BeginConnect('127.0.0.1', 3001, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne(400, $false) -and $tcp.Connected) {
            $tcp.Close(); $up = $true; break
        }
        $tcp.Close()
    } catch {}
    Start-Sleep -Milliseconds 900
}

if (-not $up) {
    Write-Host "      [FAIL] Port 3001 never opened. Check logs\pm2\iam-service.out.log" -ForegroundColor Red
    exit 1
}

# Resolve actual node.exe PID
Start-Sleep -Seconds 2
$newPid = (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
           Select-Object -First 1 -ExpandProperty OwningProcess)
Write-Host "      IAM listening  PID=$newPid" -ForegroundColor Green

# Update registry
$regFile = Join-Path $ROOT 'logs\sme-registry.json'
if (Test-Path $regFile) {
    $raw = Get-Content $regFile -Raw
    $raw = $raw -replace '"iam-service":\s*\d+', ('"iam-service": ' + $newPid)
    Set-Content $regFile $raw -Encoding UTF8
    Write-Host "      Registry updated: iam-service=$newPid"
}

# --- 4. Verify login works ---
Write-Host ""
Write-Host "[4/4] Verifying login for knraju2828@gmail.com..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
try {
    $r = Invoke-RestMethod -Method POST `
        -Uri 'http://sme.test:3000/iam/auth/token' `
        -ContentType 'application/json' `
        -Body '{"email":"knraju2828@gmail.com"}' `
        -ErrorAction Stop
    Write-Host "      LOGIN OK - token issued for $($r.data.claims.sub)" -ForegroundColor Green
    Write-Host "      Tenant: $($r.data.claims.tenantId)  Roles: $($r.data.claims.roles -join ', ')" -ForegroundColor Green
} catch {
    $errMsg = $_.ErrorDetails.Message
    if (-not $errMsg) { $errMsg = $_.Exception.Message }
    Write-Host "      [FAIL] Login still failing: $errMsg" -ForegroundColor Red
    Write-Host "      Last 10 lines of log:"
    Get-Content $outLog -Tail 10 -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done. Navigate to http://ammulu.sme.test:3102/login" -ForegroundColor Cyan
Write-Host ""