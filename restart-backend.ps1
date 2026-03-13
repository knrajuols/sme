# restart-backend.ps1 - Kill + restart IAM, tenant-service, and api-gateway
# Run from the SAME elevated/admin PowerShell that ran sme-fullboot.ps1
Set-Location $PSScriptRoot
$ROOT    = $PSScriptRoot
$ARCHIVE = Join-Path $ROOT 'logs\archive'
$regFile = Join-Path $ROOT 'logs\sme-registry.json'

if (-not (Test-Path $ARCHIVE)) { New-Item -ItemType Directory -Path $ARCHIVE -Force | Out-Null }

# ─────────────────────────────────────────────────────────────────────────────
# Helper: kill all processes listening on a given port
# ─────────────────────────────────────────────────────────────────────────────
function Kill-Port {
    param([int]$Port, [string]$Label)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        $conns | ForEach-Object {
            $p = $_.OwningProcess
            Write-Host "      Killing PID $p ($Label)"
            taskkill /F /PID $p 2>$null | Out-Null
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
    # Belt-and-suspenders: also kill any node.exe whose commandline contains the service dir
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*$Label*" } |
        ForEach-Object {
            Write-Host "      Killing zombie node PID $($_.ProcessId) ($Label)"
            taskkill /F /PID $_.ProcessId 2>$null | Out-Null
        }
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper: archive old logs for a service
# ─────────────────────────────────────────────────────────────────────────────
function Archive-Logs {
    param([string]$Name)
    $ts = Get-Date -Format 'yyyyMMddHHmmss'
    foreach ($suffix in @('out', 'err')) {
        $log = Join-Path $ROOT "logs\pm2\$Name.$suffix.log"
        if (Test-Path $log) {
            Move-Item $log (Join-Path $ARCHIVE ($Name + "_$ts.$suffix.log")) -Force -ErrorAction SilentlyContinue
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Helper: start a service and wait for its port to open (up to 90s)
# ─────────────────────────────────────────────────────────────────────────────
function Start-Service-Wait {
    param([string]$Name, [string]$SvcDir, [int]$Port)
    $outLog = Join-Path $ROOT "logs\pm2\$Name.out.log"
    $errLog = Join-Path $ROOT "logs\pm2\$Name.err.log"

    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run start:dev" `
        -WorkingDirectory $SvcDir `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -NoNewWindow -PassThru

    Write-Host "      Wrapper PID=$($proc.Id) - waiting for port $Port (up to 90s)..."

    $deadline = (Get-Date).AddSeconds(90)
    $up = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $ar  = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
            if ($ar.AsyncWaitHandle.WaitOne(400, $false) -and $tcp.Connected) {
                $tcp.Close(); $up = $true; break
            }
            $tcp.Close()
        } catch {}
        Start-Sleep -Milliseconds 900
    }

    if (-not $up) {
        Write-Host "      [FAIL] Port $Port never opened. Check logs\pm2\$Name.out.log" -ForegroundColor Red
        return $null
    }

    Start-Sleep -Seconds 2
    $newPid = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
               Select-Object -First 1 -ExpandProperty OwningProcess)
    Write-Host "      $Name listening  PID=$newPid" -ForegroundColor Green

    # Update PID registry
    if (Test-Path $regFile) {
        $raw = Get-Content $regFile -Raw
        $raw = $raw -replace ('"' + $Name + '":\s*\d+'), ('"' + $Name + '": ' + $newPid)
        Set-Content $regFile $raw -Encoding UTF8
        Write-Host "      Registry updated: $Name=$newPid"
    }

    return $newPid
}

# =============================================================================
# STEP 1 — Kill all three services
# =============================================================================
Write-Host ""
Write-Host "[1/5] Stopping IAM service (port 3001)..." -ForegroundColor Cyan
Kill-Port -Port 3001 -Label "iam-service"

Write-Host ""
Write-Host "[2/5] Stopping tenant-service (port 3002)..." -ForegroundColor Cyan
Kill-Port -Port 3002 -Label "tenant-service"

Write-Host ""
Write-Host "[3/5] Stopping api-gateway (port 3000)..." -ForegroundColor Cyan
Kill-Port -Port 3000 -Label "api-gateway"

Write-Host ""
Write-Host "      Waiting 3s for ports to clear..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verify ports are clear
foreach ($portCheck in @(3001, 3002, 3000)) {
    $still = Get-NetTCPConnection -LocalPort $portCheck -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host "      [WARN] Port $portCheck still occupied!" -ForegroundColor Yellow
    } else {
        Write-Host "      Port $portCheck cleared OK" -ForegroundColor Green
    }
}

# =============================================================================
# STEP 2 — Archive logs
# =============================================================================
Write-Host ""
Write-Host "[4/5] Archiving old logs..." -ForegroundColor Cyan
Archive-Logs -Name "iam-service"
Archive-Logs -Name "tenant-service"
Archive-Logs -Name "api-gateway"
Write-Host "      Done."

# =============================================================================
# STEP 3 — Start services (order matters: IAM first, then tenant, then gateway)
# =============================================================================
Write-Host ""
Write-Host "[5/5] Starting services..." -ForegroundColor Cyan

Write-Host ""
Write-Host "  -> Starting IAM service..." -ForegroundColor White
$iamPid = Start-Service-Wait `
    -Name "iam-service" `
    -SvcDir (Join-Path $ROOT "apps\iam-service") `
    -Port 3001

Write-Host ""
Write-Host "  -> Starting tenant-service..." -ForegroundColor White
$tenantPid = Start-Service-Wait `
    -Name "tenant-service" `
    -SvcDir (Join-Path $ROOT "apps\tenant-service") `
    -Port 3002

Write-Host ""
Write-Host "  -> Starting api-gateway..." -ForegroundColor White
$gwPid = Start-Service-Wait `
    -Name "api-gateway" `
    -SvcDir (Join-Path $ROOT "apps\api-gateway") `
    -Port 3000

# =============================================================================
# STEP 4 — Verification
# =============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Start-Sleep -Seconds 3

# 4a. Login
Write-Host ""
Write-Host "  [CHECK 1] Login (knraju2828@gmail.com)..." -ForegroundColor White
try {
    $r = Invoke-RestMethod -Method POST `
        -Uri 'http://sme.test:3000/iam/auth/token' `
        -ContentType 'application/json' `
        -Body '{"email":"knraju2828@gmail.com"}' `
        -ErrorAction Stop
    $token = $r.data.accessToken
    Write-Host "      OK - token issued for $($r.data.claims.sub)" -ForegroundColor Green
    Write-Host "      Tenant: $($r.data.claims.tenantId)  Roles: $($r.data.claims.roles -join ', ')" -ForegroundColor Green
} catch {
    $errMsg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Host "      [FAIL] Login failed: $errMsg" -ForegroundColor Red
    Write-Host "      Last 10 lines of IAM log:"
    Get-Content (Join-Path $ROOT 'logs\pm2\iam-service.out.log') -Tail 10 -ErrorAction SilentlyContinue
    exit 1
}

# 4b. GET /school/profile (should return full profile now)
Write-Host ""
Write-Host "  [CHECK 2] GET /school/profile (full profile)..." -ForegroundColor White
try {
    $profile = Invoke-RestMethod -Uri 'http://sme.test:3000/school/profile' `
        -Headers @{ Authorization = "Bearer $token" } `
        -ErrorAction Stop
    $d = $profile.data
    Write-Host "      OK - schoolName: $($d.schoolName)" -ForegroundColor Green
    Write-Host "         udiseCode:   $($d.udiseCode)" -ForegroundColor Green
    Write-Host "         city:        $($d.city)" -ForegroundColor Green
    Write-Host "         board:       $($d.board)" -ForegroundColor Green
    Write-Host "         contactEmail:$($d.contactEmail)" -ForegroundColor Green
} catch {
    $errMsg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Host "      [FAIL] GET /school/profile: $errMsg" -ForegroundColor Red
}

# 4c. PATCH /school/profile (update city and contactEmail)
Write-Host ""
Write-Host "  [CHECK 3] PATCH /school/profile (update city=Hyderabad)..." -ForegroundColor White
try {
    $patch = Invoke-RestMethod -Method PATCH `
        -Uri 'http://sme.test:3000/school/profile' `
        -Headers @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } `
        -Body '{"city":"Hyderabad","board":"CBSE","contactPhone":"+91-9999999999"}' `
        -ErrorAction Stop
    Write-Host "      OK - updated: $($patch.data.updated)" -ForegroundColor Green
} catch {
    $errMsg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Host "      [FAIL] PATCH /school/profile: $errMsg" -ForegroundColor Red
}

# 4d. Direct tenant-service endpoint check
Write-Host ""
Write-Host "  [CHECK 4] GET /tenants/full-profile/:tenantId (direct)..." -ForegroundColor White
$tenantId = '08dec606-4f1b-425e-a668-be14993c2587'
try {
    $tp = Invoke-RestMethod -Uri "http://localhost:3002/tenants/full-profile/$tenantId" -ErrorAction Stop
    Write-Host "      OK - tenantCode: $($tp.data.tenantCode)  schoolName: $($tp.data.schoolName)" -ForegroundColor Green
} catch {
    $errMsg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Host "      [FAIL] Direct tenant endpoint: $errMsg" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Restart complete." -ForegroundColor Cyan
Write-Host "  IAM:            PID $iamPid    (port 3001)" -ForegroundColor Green
Write-Host "  tenant-service: PID $tenantPid  (port 3002)" -ForegroundColor Green
Write-Host "  api-gateway:    PID $gwPid    (port 3000)" -ForegroundColor Green
Write-Host ""
Write-Host "  Navigate to: http://ammulu.sme.test:3102/" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
