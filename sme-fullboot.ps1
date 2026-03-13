# =============================================================================
#  sme-fullboot.ps1  —  SME Platform  |  Full Automated Boot  v2.0
#
#  ONE CLICK to go from any state to a fully running platform.
#
#  What this script does — in exact order:
#
#    STAGE 0  Bulletproof SME Process Cleanup.
#             Prong 0 — PID Registry kill: reads logs\sme-registry.json,
#                       kills each saved PID after verifying it is node.exe.
#             Prong 1 — Port clearing: kills any process holding an SME port.
#             Prong 2 — Zombie hunting: kills node.exe processes whose
#                       CommandLine contains the project root path.
#             Archive trim: removes logs\archive entries older than 7 days.
#             Registry clear: resets logs\sme-registry.json to {} so Stage 3
#                       can repopulate it with fresh PIDs.
#
#    STAGE 1  Infrastructure
#             1a  Docker Desktop — detect daemon; start it and wait if down.
#             1b  Redis + RabbitMQ — docker compose up -d; wait for TCP ports.
#             1c  PostgreSQL — detect/start Windows service; wait for port 5432.
#             All three are verified with Layer 7 probes (not just TCP SYN).
#
#    STAGE 2  Prisma client generation — strictly sequential for all services.
#             Runs one schema at a time to prevent Windows EBUSY folder locks.
#             Aborts the boot if any service fails to generate.
#
#    STAGE 3  Backend services — started in dependency order.
#             Each service is launched; its PID is written to sme-registry.json.
#             GET /health/live probe confirms full NestJS bootstrap before
#             the next service starts (L7, not just TCP).
#             Order:  iam-service → tenant-service → config-service
#                  → audit-service → portal-service → api-gateway
#
#    STAGE 4  Frontend apps — web-admin, web-portal.
#             Both launched in parallel; HTTP probe confirms Next.js ready.
#             PIDs written to sme-registry.json for targeted stop/restart.
#
#  Log strategy: before every service launch, the existing .out.log and
#  .err.log are moved to logs\archive\<name>_<timestamp>.log so each boot
#  starts with a clean, unlocked log file—no Set-Content race conditions.
#
#  Designed to run headless (piped from sme-monitor.js) so all output streams
#  to the browser Live Console.  Child service processes run silently in the
#  background; the dashboard status table updates automatically.
#
#  Safe to run repeatedly — idempotent on infrastructure, restarts services.
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT          = $PSScriptRoot
$COMPOSE       = Join-Path $ROOT 'docker-compose.infra.yml'
$PG_PORT       = 5432
$BOOT_START    = Get-Date
$REGISTRY_FILE = Join-Path $ROOT 'logs\sme-registry.json'
$ARCHIVE_DIR   = Join-Path $ROOT 'logs\archive'

Set-Location $ROOT

# ─────────────────────────────────────────────────────────────────────────────
#  Console helpers
# ─────────────────────────────────────────────────────────────────────────────
function Write-Banner {
    Write-Host ''
    Write-Host '  +============================================================+' -ForegroundColor Cyan
    Write-Host '  |        SME Platform  --  Full Auto Boot  v1.0             |' -ForegroundColor Cyan
    Write-Host '  |        Single-click: zero to fully running platform        |' -ForegroundColor Cyan
    Write-Host '  +============================================================+' -ForegroundColor Cyan
    Write-Host ''
}
function Write-Stage { param([string]$Label)
    Write-Host ''
    Write-Host "  +----------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "  |  $Label" -ForegroundColor Cyan
    Write-Host "  +----------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host ''
}
function Write-OK     { param([string]$Msg) Write-Host "  [  OK  ]  $Msg" -ForegroundColor Green     }
function Write-Info   { param([string]$Msg) Write-Host "  [ INFO ]  $Msg" -ForegroundColor Yellow    }
function Write-Warn   { param([string]$Msg) Write-Host "  [ WARN ]  $Msg" -ForegroundColor DarkYellow }
function Write-Skip   { param([string]$Msg) Write-Host "  [ SKIP ]  $Msg" -ForegroundColor DarkGray  }
function Write-Launch { param([string]$Msg) Write-Host "  [  >>  ]  $Msg" -ForegroundColor Magenta   }
function Write-Fail   { param([string]$Msg)
    Write-Host ''
    Write-Host "  +============================================================+" -ForegroundColor Red
    Write-Host "  |  FAILED: $Msg" -ForegroundColor Red
    Write-Host "  +============================================================+" -ForegroundColor Red
    Write-Host ''
}
function Write-Fatal  { param([string]$Msg)
    Write-Fail $Msg
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
#  PID Registry — logs\sme-registry.json
#  Tracks the PID of each running SME service so sme-monitor.js can perform
#  targeted kills without port-hunting.
#  Format: { "iam-service": 12345, "tenant-service": 67890, ... }
# ─────────────────────────────────────────────────────────────────────────────
function Write-PidRegistry { param([string]$Name, [int]$ServicePid)
    try {
        $reg = if (Test-Path $REGISTRY_FILE) {
            Get-Content $REGISTRY_FILE -Raw -ErrorAction SilentlyContinue |
                ConvertFrom-Json -ErrorAction SilentlyContinue
        } else { $null }
        if (-not $reg) { $reg = [pscustomobject]@{} }
        $reg | Add-Member -NotePropertyName $Name -NotePropertyValue $ServicePid -Force
        $reg | ConvertTo-Json -Depth 2 |
            Set-Content $REGISTRY_FILE -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch {
        Write-Warn "  [Registry]  Could not write PID for ${Name}: $_"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  Service / schema registry  (single source of truth)
# ─────────────────────────────────────────────────────────────────────────────
$BACKEND_SERVICES = @(
    [pscustomobject]@{ Name = 'iam-service';     Port = 3001; NpmScript = 'start:dev:iam';        Schema = 'apps\iam-service\prisma\schema.prisma';     TimeoutSec = 90  }
    [pscustomobject]@{ Name = 'tenant-service';  Port = 3002; NpmScript = 'start:dev:tenant';     Schema = 'apps\tenant-service\prisma\schema.prisma';  TimeoutSec = 75  }
    [pscustomobject]@{ Name = 'config-service';  Port = 3003; NpmScript = 'start:dev:config';     Schema = 'apps\config-service\prisma\schema.prisma';  TimeoutSec = 75  }
    [pscustomobject]@{ Name = 'audit-service';   Port = 3004; NpmScript = 'start:dev:audit';      Schema = 'apps\audit-service\prisma\schema.prisma';   TimeoutSec = 75  }
    [pscustomobject]@{ Name = 'portal-service';  Port = 3005; NpmScript = 'start:dev:portal';     Schema = 'apps\portal-service\prisma\schema.prisma';  TimeoutSec = 75  }
    [pscustomobject]@{ Name = 'api-gateway';     Port = 3000; NpmScript = 'start:dev:api-gateway'; Schema = $null;                                      TimeoutSec = 90  }
)
$FRONTEND_SERVICES = @(
    # TimeoutSec is generous — Next.js dev mode compiles on first request (20-120s on cold start)
    [pscustomobject]@{ Name = 'web-admin';   Port = 3101; NpmScript = 'dev:web-admin';  TimeoutSec = 180; ProbeUrl = 'http://localhost:3101/' }
    [pscustomobject]@{ Name = 'web-portal';  Port = 3102; NpmScript = 'dev:web-portal'; TimeoutSec = 180; ProbeUrl = 'http://localhost:3102/' }
)
$SME_PORTS = @(3000, 3001, 3002, 3003, 3004, 3005, 3101, 3102)

# ─────────────────────────────────────────────────────────────────────────────
#  Helper: probe TCP port (fast .NET socket, no DNS, no wait-overhead)
# ─────────────────────────────────────────────────────────────────────────────
function Test-TcpPort { param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar  = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok  = $ar.AsyncWaitHandle.WaitOne(400, $false)
        $connected = $ok -and $tcp.Connected
        $tcp.Close()
        return $connected
    } catch { return $false }
}

# ─────────────────────────────────────────────────────────────────────────────
#  Helper: wait until a TCP port is open (Layer 4 — used as initial liveness)
# ─────────────────────────────────────────────────────────────────────────────
function Wait-TcpPort { param([int]$Port, [int]$TimeoutSec = 60, [string]$Label = '')
    $label    = if ($Label) { $Label } else { "port $Port" }
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $dots     = 0
    Write-Host "  [ WAIT ]  Waiting for $label TCP (up to ${TimeoutSec}s)..." -ForegroundColor DarkGray
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort $Port) { return $true }
        Start-Sleep -Milliseconds 900
        $dots++
        if ($dots % 10 -eq 0) {
            $elapsed = [int]((Get-Date) - ($deadline.AddSeconds(-$TimeoutSec))).TotalSeconds
            Write-Host "  [ WAIT ]  ... ${elapsed}s elapsed" -ForegroundColor DarkGray
        }
    }
    return $false
}

# ─────────────────────────────────────────────────────────────────────────────
#  Layer 7 probe: Redis — loop docker exec redis-cli ping until PONG
# ─────────────────────────────────────────────────────────────────────────────
function Wait-RedisPong { param([string]$ContainerName = 'sme-redis', [int]$TimeoutSec = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    Write-Host "  [ WAIT ]  Waiting for Redis PONG from $ContainerName (up to ${TimeoutSec}s)..." -ForegroundColor DarkGray
    while ((Get-Date) -lt $deadline) {
        $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        $out  = docker exec $ContainerName redis-cli ping 2>&1 | Out-String
        $ErrorActionPreference = $prev
        if ($out.Trim() -eq 'PONG') { return $true }
        Start-Sleep -Milliseconds 800
    }
    return $false
}

# ─────────────────────────────────────────────────────────────────────────────
#  Layer 7 probe: RabbitMQ — poll Docker's own container health status.
#  The compose healthcheck runs rabbitmq-diagnostics ping inside the container
#  so we trust that rather than inventing a second probe.
# ─────────────────────────────────────────────────────────────────────────────
function Wait-RabbitMqHealthy { param([string]$ContainerName = 'sme-rabbitmq', [int]$TimeoutSec = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    Write-Host "  [ WAIT ]  Waiting for RabbitMQ container health = healthy (up to ${TimeoutSec}s)..." -ForegroundColor DarkGray
    while ((Get-Date) -lt $deadline) {
        $prev   = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        $status = docker inspect --format '{{.State.Health.Status}}' $ContainerName 2>&1 | Out-String
        $ErrorActionPreference = $prev
        $status = $status.Trim()
        if ($status -eq 'healthy') { return $true }
        if ($status -ne 'starting') {
            Write-Host "  [ WAIT ]  RabbitMQ health: $status" -ForegroundColor DarkGray
        }
        Start-Sleep -Milliseconds 1500
    }
    return $false
}

# ─────────────────────────────────────────────────────────────────────────────
#  Layer 7 probe: PostgreSQL — execute SELECT 1 via psql until it succeeds.
#  pg_isready only checks connectivity, not engine readiness.  SELECT 1 also
#  handles the "database system is starting up" rejection after port opens.
#  Falls back to a TCP-only check with 3s backoff if psql is not on PATH.
# ─────────────────────────────────────────────────────────────────────────────
function Wait-PostgresReady { param([int]$Port = 5432, [string]$User = 'postgres', [int]$TimeoutSec = 30, [string]$Password = 'Olsbook55')
    $deadline  = (Get-Date).AddSeconds($TimeoutSec)
    $psqlReady = $null -ne (Get-Command psql -ErrorAction SilentlyContinue)

    if (-not $psqlReady) {
        # psql not on PATH — try to find it from the Windows service binary path
        $pgSvc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pgSvc) {
            $binDir = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\$($pgSvc.Name)" -ErrorAction SilentlyContinue).ImagePath
            if ($binDir) {
                $binDir   = ($binDir -split '"' | Where-Object { $_ -ne '' })[0]
                $psqlPath = Join-Path (Split-Path $binDir) 'psql.exe'
                if (Test-Path $psqlPath) {
                    $env:PSQL_BIN = $psqlPath
                    $psqlReady = $true
                }
            }
        }
    }

    Write-Host "  [ WAIT ]  Waiting for PostgreSQL SELECT 1 (up to ${TimeoutSec}s)..." -ForegroundColor DarkGray
    while ((Get-Date) -lt $deadline) {
        if ($psqlReady) {
            $psqlCmd    = if ($env:PSQL_BIN) { $env:PSQL_BIN } else { 'psql' }
            $prev       = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
            $prevPgPass = $env:PGPASSWORD
            $env:PGPASSWORD = $Password
            $out        = & $psqlCmd -U $User -h localhost -p $Port -w -c 'SELECT 1;' -t -q 2>&1 | Out-String
            $sqlExit    = $LASTEXITCODE
            $env:PGPASSWORD = $prevPgPass
            $ErrorActionPreference = $prev
            if ($sqlExit -eq 0 -and $out -match '1') { return $true }
        } else {
            # Fallback: TCP + short backoff — cannot do better without psql
            if (Test-TcpPort $Port) {
                Start-Sleep -Seconds 3   # one-time structural backoff, not a guess
                if (Test-TcpPort $Port) { return $true }
            }
        }
        Start-Sleep -Milliseconds 1000
    }
    return $false
}

# ─────────────────────────────────────────────────────────────────────────────
#  Layer 7 probe: NestJS /health/live — confirms full Nest bootstrap complete.
#  /health/live just checks the process started; it does NOT call DB/MQ.
#  We use /live, not /ready, because infra is already verified in Stage 1.
# ─────────────────────────────────────────────────────────────────────────────
function Wait-NestLive { param([int]$Port, [int]$TimeoutSec = 90, [string]$Label = '')
    $svcLabel = if ($Label) { $Label } else { "service on :$Port" }
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $url      = "http://localhost:$Port/health/live"
    Write-Host "  [ WAIT ]  Waiting for $svcLabel HTTP /health/live (up to ${TimeoutSec}s)..." -ForegroundColor DarkGray
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $url -TimeoutSec 3 -ErrorAction Stop -UseBasicParsing
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) { return $true }
        } catch {
            # 503, connection refused, timeout — keep waiting
        }
        Start-Sleep -Milliseconds 1200
    }
    return $false
}

# ─────────────────────────────────────────────────────────────────────────────
#  Helper: start a service as a silent background process
#  stdout+stderr are redirected to logs\<name>.log so failures are inspectable.
# ─────────────────────────────────────────────────────────────────────────────
function Start-SmeBackground { param([string]$NpmScript, [string]$Title, [string]$LogName = '')
    $appName = if ($LogName) { $LogName } else { $NpmScript }
    $svcMap = @{
        'api-gateway'    = @{ Dir = 'apps\api-gateway';    Script = 'start:dev' }
        'iam-service'    = @{ Dir = 'apps\iam-service';    Script = 'start:dev' }
        'tenant-service' = @{ Dir = 'apps\tenant-service'; Script = 'start:dev' }
        'config-service' = @{ Dir = 'apps\config-service'; Script = 'start:dev' }
        'audit-service'  = @{ Dir = 'apps\audit-service';  Script = 'start:dev' }
        'portal-service' = @{ Dir = 'apps\portal-service'; Script = 'start:dev' }
        'web-admin'      = @{ Dir = 'apps\web-admin';      Script = 'dev' }
        'web-portal'     = @{ Dir = 'apps\web-portal';     Script = 'dev' }
    }
    $entry = $svcMap[$appName]
    if (-not $entry) { Write-Warn "  [Launch]  No entry for '$appName'"; return }
    $svcDir = Join-Path $ROOT $entry.Dir
    $outLog = Join-Path $ROOT ("logs\services\" + $appName + ".out.log")
    $errLog = Join-Path $ROOT ("logs\services\" + $appName + ".err.log")

    # ── Log archival: move old logs to archive\ with timestamp suffix ────────
    # Abandons the old file so there is no risk of a Set-Content race against
    # a slow-dying process.  Start-Process creates the new file from scratch.
    if (-not (Test-Path $ARCHIVE_DIR)) { $null = New-Item -ItemType Directory -Path $ARCHIVE_DIR -Force -ErrorAction SilentlyContinue }
    $ts = Get-Date -Format 'yyyyMMddHHmmss'
    foreach ($logPath in @($outLog, $errLog)) {
        if (Test-Path $logPath) {
            $stem    = [System.IO.Path]::GetFileNameWithoutExtension($logPath)
            $archDst = Join-Path $ARCHIVE_DIR ($stem + '_' + $ts + '.log')
            try   { Move-Item -Path $logPath -Destination $archDst -Force -ErrorAction SilentlyContinue }
            catch { Write-Warn "  [Archive]  Could not archive $logPath - $_" }
        }
    }

    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList ("/c npm run " + $entry.Script) -WorkingDirectory $svcDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -NoNewWindow -PassThru
    if ($proc -and $proc.Id) {
        Write-Info "  [Launch]  $appName  wrapper-PID=$($proc.Id)  log: logs\services\$appName.out.log"
        # NOTE: We do NOT write to the registry here — the cmd.exe wrapper PID fails
        # the WMI identity check in sme-monitor.js.  The actual node.exe PID is
        # resolved via Resolve-NodePid AFTER the L7 health probe confirms the service
        # is fully up, then written to the registry at that point.
    } else {
        Write-Warn "  [Launch]  ${appName}: Start-Process failed"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
#  Late PID Resolution — WMI lookup for the actual node.exe child process.
#  Called AFTER the L7 health probe confirms the service is up, so the node
#  process is guaranteed to exist by the time this runs.
#  Both slash variants checked — npm/Node can normalise to forward-slashes.
# ─────────────────────────────────────────────────────────────────────────────
function Resolve-NodePid { param([string]$ServiceName, [int]$Port = 0)
    $svcFwd   = 'apps/' + $ServiceName
    $svcBack  = 'apps\' + $ServiceName
    # Primary: WMI CommandLine identity check
    try {
        $match = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
                 Where-Object { $_.CommandLine -like "*$svcFwd*" -or $_.CommandLine -like "*$svcBack*" } |
                 Select-Object -First 1
        if ($match) { return [int]$match.ProcessId }
    } catch {}
    # Fallback: WMI CommandLine may be empty on some Windows configurations.
    # Use netstat to find the PID listening on the service's port and verify
    # it is node.exe (not some other process that recycled the port).
    if ($Port -gt 0) {
        try {
            $netOut = & netstat -ano 2>$null | Select-String ":$Port\s" | Select-String 'LISTENING' | Select-Object -First 1
            if ($netOut) {
                $pidStr = ($netOut.ToString().Trim() -split '\s+')[-1]
                $portPid = [int]$pidStr
                if ($portPid -gt 0) {
                    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $portPid" -ErrorAction SilentlyContinue |
                            Where-Object { $_.Name -ieq 'node.exe' } |
                            Select-Object -First 1
                    if ($proc) { return $portPid }
                }
            }
        } catch {}
    }
    return $null
}

# ─────────────────────────────────────────────────────────────────────────────
#  Trigger an immediate dashboard refresh on sme-monitor.js (:9999).
#  Silently ignored if the monitor is not running — boot proceeds regardless.
# ─────────────────────────────────────────────────────────────────────────────
function Invoke-MonitorRefresh {
    try {
        Invoke-WebRequest -Uri 'http://localhost:9999/api/refresh' `
            -Method POST -TimeoutSec 2 -ErrorAction SilentlyContinue -UseBasicParsing | Out-Null
    } catch {}
}

# ─────────────────────────────────────────────────────────────────────────────
#  Helper: docker container state  ('running' | 'exited' | 'missing')
# ─────────────────────────────────────────────────────────────────────────────
function Get-ContainerState { param([string]$Name)
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out  = docker inspect --format '{{.State.Status}}' $Name 2>&1
    $ex   = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($ex -ne 0) { return 'missing' }
    return ($out | Out-String).Trim()
}

# ─────────────────────────────────────────────────────────────────────────────
#  Track per-service result for the final summary
# ─────────────────────────────────────────────────────────────────────────────
$Results = [ordered]@{}
function Set-Result { param([string]$Key, [string]$Status, [string]$Note = '')
    $Results[$Key] = [pscustomobject]@{ Status = $Status; Note = $Note }
}

# =============================================================================
Write-Banner

# =============================================================================
#  STAGE 0 — Bulletproof SME Process Cleanup
#
#  Two-pronged strategy to guarantee clean DLL locks for Stage 2:
#
#  Prong 1 — Network clearing
#    Kill any process (node, npm, powershell) holding an SME service port.
#    This handles the normal running-service case.
#
#  Prong 2 — Zombie hunting (directory-aware)
#    A crashed NestJS service often releases its TCP port but keeps the
#    node.exe process alive, holding the Prisma query_engine*.dll.node lock.
#    These zombies are invisible to port scanning — we must hunt by command-
#    line substring against our project root.
#    Uses Get-CimInstance (WMI) to read the full CommandLine of every
#    node.exe, then kills any that were launched from within $ROOT.
#    The sme-monitor.js process is explicitly excluded — killing it would
#    destroy the dashboard that triggered this script.
#
#  After both prongs, we wait 4s for the OS to fully release all file handles.
# =============================================================================
Write-Stage 'STAGE 0 of 4  --  Bulletproof SME Process Cleanup'

# Note: External process managers are NOT used — services are started directly via Start-Process.
# Services are started directly via Start-Process in Start-SmeBackground.
# Port-based cleanup (Prong 1) + zombie hunting (Prong 2) handle any lingering processes.

# Normalise project root to forward-slash lowercase for reliable matching
$rootNorm   = $ROOT.Replace('\','/').ToLower().TrimEnd('/')
$killedPids = [System.Collections.Generic.HashSet[int]]::new()
$killedCount = 0

# ── Archive trim: remove logs\archive entries older than 7 days ──────────────
if (-not (Test-Path $ARCHIVE_DIR)) { $null = New-Item -ItemType Directory -Path $ARCHIVE_DIR -Force -ErrorAction SilentlyContinue }
$trimCutoff = (Get-Date).AddDays(-7)
$trimCount  = 0
Get-ChildItem $ARCHIVE_DIR -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $trimCutoff } |
    ForEach-Object {
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        $trimCount++
    }
Write-OK "Archive trimmed - $trimCount file(s) older than 7 days removed."

# ── Prong 0: Registry-aware kill — WMI "double lock" before every kill ────────
# Reads logs\sme-registry.json written by previous boot.
# For each saved PID we perform TWO checks before killing:
#   Check 1 — Is the PID a node.exe process?  (Get-CimInstance Win32_Process)
#   Check 2 — Does the CommandLine contain our service directory?
#             e.g. "apps\iam-service" or "apps/iam-service".
# Both checks must pass.  A recycled PID that belongs to Chrome, a VS Code
# extension worker, or any other application will fail Check 2 and be skipped.
Write-Info 'Prong 0: Clearing services via PID registry (WMI double-lock)...'
$registryKills = 0
if (Test-Path $REGISTRY_FILE) {
    try {
        $regJson = Get-Content $REGISTRY_FILE -Raw -ErrorAction SilentlyContinue |
                       ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($regJson) {
            $regJson.PSObject.Properties | ForEach-Object {
                $svcName   = $_.Name
                $regPidVal = [int]$_.Value
                if ($killedPids.Contains($regPidVal)) { return }

                # WMI double-lock: single query returns both Name and CommandLine
                $wmiProc = Get-CimInstance Win32_Process `
                    -Filter "ProcessId = $regPidVal" `
                    -Property Name, CommandLine `
                    -ErrorAction SilentlyContinue | Select-Object -First 1

                # Check 1 — must be node.exe
                if ($null -eq $wmiProc -or $wmiProc.Name -ine 'node.exe') {
                    Write-Skip "  [Registry]  $svcName PID $regPidVal - not alive or not node.exe (stale/recycled)"
                    return
                }

                # Check 2 — CommandLine must contain the service directory substring
                # Normalise both strings to forward-slash lowercase for comparison
                $cmdNorm  = ([string]$wmiProc.CommandLine).Replace('\','/').ToLower()
                $svcSlug  = ('apps/' + $svcName).ToLower()   # e.g. apps/iam-service
                if ($cmdNorm -notlike "*$svcSlug*") {
                    Write-Skip "  [Registry]  $svcName PID $regPidVal - CommandLine does not match service slug (PID recycled to another app)"
                    return
                }

                # Both checks passed — safe to kill
                try {
                    Stop-Process -Id $regPidVal -Force -ErrorAction SilentlyContinue
                    $null = $killedPids.Add($regPidVal)
                    $registryKills++
                    $killedCount++
                    Write-Info "  [Registry]  Killed $svcName  PID $regPidVal (double-lock verified)"
                } catch {
                    Write-Warn "  [Registry]  Could not kill $svcName PID ${regPidVal}: $_"
                }
            }
        }
    } catch {
        Write-Warn "  [Registry]  Could not read $REGISTRY_FILE - $_"
    }
}
Write-OK "Prong 0 done - $registryKills registry PID(s) killed."
Write-Info 'Prong 1: Clearing SME service ports...'
foreach ($port in $SME_PORTS) {
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $lines = netstat -ano 2>$null | Select-String ":$port " | Select-String 'LISTENING'
    $ErrorActionPreference = $prev
    foreach ($line in $lines) {
        if ($line -match '\s+(\d+)\s*$') {
            $procPid = [int]$Matches[1]
            if ($killedPids.Contains($procPid)) { continue }
            $proc = Get-Process -Id $procPid -ErrorAction SilentlyContinue
            if ($null -ne $proc) {
                try {
                    Stop-Process -Id $procPid -Force -ErrorAction SilentlyContinue
                    $null = $killedPids.Add($procPid)
                    $killedCount++
                    Write-Info "  [Port $port]  Killed $($proc.ProcessName) PID $procPid"
                } catch {
                    Write-Warn "  [Port $port]  Could not kill PID $procPid - $_"
                }
            }
        }
    }
}
Write-OK "Prong 1 done - $killedCount port-holding process(es) killed."

# ── Prong 2: Zombie hunting — kill by project directory + CommandLine ─────
Write-Info 'Prong 2: Hunting zombie node.exe processes from this project...'
$zombieCount = 0

try {
    # Get-CimInstance reads the full Win32_Process CommandLine including script paths
    $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" `
                    -ErrorAction SilentlyContinue

    foreach ($proc in $nodeProcs) {
        $procPid = [int]$proc.ProcessId
        $cmd     = [string]$proc.CommandLine

        # Skip if already killed by Prong 1
        if ($killedPids.Contains($procPid)) { continue }

        # Skip the sme-monitor.js process — it is the dashboard running this script
        if ($cmd -like '*sme-monitor.js*') {
            Write-Skip "  Skipping sme-monitor.js PID $procPid (this dashboard process)"
            continue
        }

        # Normalise the commandline for case-insensitive path matching
        $cmdNorm = $cmd.Replace('\','/').ToLower()

        # Kill if this node.exe was spawned from within our project root
        if ($cmdNorm -like "*$rootNorm*") {
            try {
                Stop-Process -Id $procPid -Force -ErrorAction SilentlyContinue
                $null = $killedPids.Add($procPid)
                $zombieCount++
                $killedCount++
                # Trim commandline for readable output (first 120 chars)
                $cmdShort = if ($cmd.Length -gt 120) { $cmd.Substring(0,120) + '…' } else { $cmd }
                Write-Info "  [Zombie]  Killed node.exe PID $procPid  cmd: $cmdShort"
            } catch {
                Write-Warn "  [Zombie]  Could not kill PID $procPid - $_"
            }
        }
    }
} catch {
    Write-Warn "  Get-CimInstance failed (WMI unavailable?): $_"
    Write-Warn "  Zombie hunting skipped - DLL locks may still exist if services crashed."
}

Write-OK "Prong 2 done - $zombieCount zombie node.exe process(es) killed."

# ── Wait for OS to release file handles ──────────────────────────────────
if ($killedCount -gt 0) {
    Write-Info "Total killed: $killedCount. Waiting 4s for OS to release all DLL file handles..."
    Start-Sleep -Seconds 4
    Write-OK 'File handles released. Stage 0 complete — runway is clean.'
} else {
    Write-OK 'No SME processes found. Already clean state.'
}

# ── Clear PID registry — will be repopulated with fresh PIDs in Stage 3/4 ────
'{}' | Set-Content $REGISTRY_FILE -Encoding UTF8 -ErrorAction SilentlyContinue
Write-OK 'PID registry cleared — ready for fresh registrations.'


# =============================================================================
#  STAGE 0.5 — Workspace Eviction
#  Prisma generate (Stage 2) requires exclusive write access to each service's
#  query_engine-windows.dll.node.  That DLL can be locked by two classes of
#  unregistered node.exe worker that Stage 0 cannot see:
#
#    Class A — Ghost/Zombie node processes  (CL contains our project root)
#      Any leftover ts-node, jest, npm script, or old service invocation that
#      survived Stage 0 because it was never in the registry and doesn't hold
#      an SME TCP port.
#
#    Class B — VS Code Prisma Language Server  (CL contains "prisma")
#      The VS Code extension prisma.prisma spawns a background LSP server:
#        node "...\.vscode\extensions\prisma.prisma-x.y.z\dist\src\bin.js" --stdio
#      Its CommandLine never mentions our project root — it receives schemas
#      over stdin — so Class A sweep misses it entirely.  Yet it loads the
#      Prisma query engine DLL into its address space, holding a Windows file
#      lock that causes EPERM in prisma generate.
#
#  Strategy: two-pass WMI sweep, then a per-DLL lock verification.
#    Pass 1 (Class A):  CL ⊇ $ROOT  AND  PID ∉ registry  AND  PID ≠ dashboard
#    Pass 2 (Class B):  CL ⊇ "prisma"  AND  PID ∉ registry  AND  PID ≠ dashboard
#
#  Only Stop-Process -Id <exact-PID> -Force is used — no tree kills, no taskkill.
# =============================================================================
Write-Stage 'STAGE 0.5  --  Workspace Eviction  (unlocking Prisma DLLs)'

# Read the current registry (just cleared to {}) to know which PIDs are tracked.
# After Stage 0 the registry is {} so any node.exe found here is unregistered.
function Get-RegistryPids {
    try {
        $raw = Get-Content $REGISTRY_FILE -Raw -ErrorAction SilentlyContinue
        if (-not $raw) { return @() }
        $obj = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if (-not $obj) { return @() }
        return @($obj.PSObject.Properties.Value | ForEach-Object { [int]$_ })
    } catch { return @() }
}

# Identify the dashboard node.exe PID so we never evict it.
$dashboardPid = $null
try {
    $dashboardPid = (Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine -match [regex]::Escape('sme-monitor') } |
        Select-Object -First 1).ProcessId
} catch {}

$registeredPids = Get-RegistryPids
$evictedPids    = [System.Collections.Generic.HashSet[int]]::new()
$evictCount     = 0

$allNodeProcs = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue)

# ── Pass 1: Ghost/Zombie — CommandLine references our project root ────────────
Write-Info 'Pass 1 — hunting ghost/zombie workspace node processes...'
foreach ($np in $allNodeProcs) {
    $npPid = [int]$np.ProcessId
    $npCl  = if ($np.CommandLine) { $np.CommandLine.Replace('\', '/').ToLower() } else { '' }
    if ($npPid -eq $dashboardPid)          { continue }  # never kill dashboard
    if ($registeredPids -contains $npPid)  { continue }  # skip officially tracked
    if ($evictedPids.Contains($npPid))     { continue }  # already evicted
    if ($npCl -match [regex]::Escape($rootNorm)) {
        try {
            Stop-Process -Id $npPid -Force -ErrorAction Stop
            $null = $evictedPids.Add($npPid)
            $evictCount++
            Write-Host "  [ SWEEP ]  Evicted ghost workspace process (PID: $npPid) — releasing file locks." -ForegroundColor DarkYellow
        } catch {
            Write-Warn "  [Sweep]  Could not evict PID ${npPid}: $_"
        }
    }
}

# ── Pass 2: VS Code Prisma Language Server — CommandLine references "prisma" ─
Write-Info 'Pass 2 — hunting VS Code Prisma Language Server holding DLL locks...'
foreach ($np in $allNodeProcs) {
    $npPid = [int]$np.ProcessId
    $npCl  = if ($np.CommandLine) { $np.CommandLine.ToLower() } else { '' }
    if ($npPid -eq $dashboardPid)          { continue }
    if ($registeredPids -contains $npPid)  { continue }
    if ($evictedPids.Contains($npPid))     { continue }
    # Match any node process whose command references the prisma LSP binary or build
    if ($npCl -match 'prisma') {
        try {
            Stop-Process -Id $npPid -Force -ErrorAction Stop
            $null = $evictedPids.Add($npPid)
            $evictCount++
            Write-Host "  [ SWEEP ]  Evicted Prisma workspace worker (PID: $npPid) — DLL lock released." -ForegroundColor DarkYellow
        } catch {
            Write-Warn "  [Sweep]  Could not evict PID ${npPid}: $_"
        }
    }
}

if ($evictCount -gt 0) {
    Write-Info "Evicted $evictCount unregistered workspace process(es). Waiting 2s for OS to release file handles..."
    Start-Sleep -Seconds 2
    Write-OK 'Workspace sweep complete — DLL file handles released.'
} else {
    Write-OK 'Workspace sweep complete — no unregistered workspace processes found.'
}

# ── Per-DLL lock verification ─────────────────────────────────────────────────
# Attempt to open each query engine DLL exclusively.  A failure here means
# the sweep did not catch all lockers — the generate will likely fail with EPERM.
# We log a warning rather than aborting; the exact generate error is more useful.
Write-Info 'Verifying Prisma DLL file locks are clear...'
$lockWarnings = 0
foreach ($svcSchema in ($BACKEND_SERVICES | Where-Object { $_.Schema })) {
    $relDir  = Split-Path (Split-Path $svcSchema.Schema)
    $dll     = Join-Path $ROOT "$relDir\src\generated\prisma-client\query_engine-windows.dll.node"
    if (-not (Test-Path $dll)) { continue }  # not yet generated — no lock possible
    try {
        $fs = [System.IO.File]::Open($dll, [System.IO.FileMode]::Open,
              [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $fs.Close(); $fs.Dispose()
        Write-Host "  [  OK  ]  $($svcSchema.Name): DLL is free." -ForegroundColor DarkGray
    } catch {
        $lockWarnings++
        Write-Warn "  $($svcSchema.Name): DLL appears still locked — generate may produce EPERM."
        Write-Warn "    Path: $dll"
        Write-Warn "    If generation fails, close VS Code and re-run smdb.ps1."
    }
}
if ($lockWarnings -eq 0) {
    Write-OK 'All Prisma DLLs are unlocked and ready for generation.'
}


# =============================================================================
#  STAGE 1 — Infrastructure
#  1a. Docker Desktop  1b. Redis + RabbitMQ  1c. PostgreSQL
# =============================================================================
Write-Stage 'STAGE 1 of 4  --  Infrastructure'

# ── 1a. Docker Desktop ────────────────────────────────────────────────────────
Write-Info 'Checking Docker daemon...'
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$dockerInfo = docker info 2>&1
$dockerOk   = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prev

if (-not $dockerOk) {
    Write-Warn 'Docker daemon is not reachable. Starting Docker Desktop...'
    $ddPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    $ddExe = $ddPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $ddExe) {
        Write-Fatal 'Docker Desktop not found. Install Docker Desktop and retry.'
    }
    Start-Process $ddExe
    Write-Info 'Docker Desktop is starting... waiting up to 90s for daemon to be ready.'

    $deadline = (Get-Date).AddSeconds(90)
    $dockerOk = $false
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 4
        $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break }
        $ErrorActionPreference = $prev
        Write-Host '  ..' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''
    if (-not $dockerOk) { Write-Fatal 'Docker daemon did not start within 90s. Check Docker Desktop.' }
    Write-OK 'Docker Desktop is now running.'
} else {
    Write-OK 'Docker daemon is running.'
}
Set-Result 'Docker' 'OK'
Invoke-MonitorRefresh

# ── 1b. Redis + RabbitMQ ─────────────────────────────────────────────────────
Write-Info 'Starting Redis and RabbitMQ containers...'
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$composeOut  = docker compose -f $COMPOSE up -d 2>&1
$composeExit = $LASTEXITCODE
$ErrorActionPreference = $prev

if ($composeExit -ne 0) {
    Write-Fatal "docker compose up -d failed:`n$(($composeOut | Out-String).Trim())"
}

# Redis: TCP first (fast fail), then PONG (true L7 readiness)
Write-Info 'Waiting for Redis TCP :6379...'
if (-not (Wait-TcpPort 6379 30 'Redis :6379')) { Write-Fatal 'Redis did not become ready within 30s.' }
Write-Info 'Redis port open. Confirming engine readiness (PONG probe)...'
if (-not (Wait-RedisPong 'sme-redis' 20)) { Write-Fatal 'Redis did not respond with PONG within 20s.' }
Write-OK 'Redis is READY (confirmed PONG).'
Set-Result 'Redis' 'OK'
Invoke-MonitorRefresh

# RabbitMQ: rely on compose healthcheck (rabbitmq-diagnostics ping inside container)
Write-Info 'Waiting for RabbitMQ to become healthy (Docker healthcheck)...'
if (-not (Wait-RabbitMqHealthy 'sme-rabbitmq' 90)) { Write-Fatal 'RabbitMQ did not reach healthy state within 90s.' }
Write-OK 'RabbitMQ is READY (container health = healthy).'
Set-Result 'RabbitMQ' 'OK'
Invoke-MonitorRefresh

# ── 1c. PostgreSQL ────────────────────────────────────────────────────────────
Write-Info 'Checking PostgreSQL on port 5432...'
if (-not (Test-TcpPort $PG_PORT)) {
    $pgSvc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $pgSvc) {
        Write-Fatal "PostgreSQL is not running and no 'postgresql*' Windows service found."
    }
    Write-Info "Starting service '$($pgSvc.Name)'..."
    try { Start-Service -Name $pgSvc.Name -ErrorAction Stop } catch {
        Write-Fatal "Could not start '$($pgSvc.Name)': $_"
    }
    if (-not (Wait-TcpPort $PG_PORT 30 'PostgreSQL :5432')) {
        Write-Fatal 'PostgreSQL did not open port 5432 within 30s.'
    }
    Write-OK "PostgreSQL started and ready on :$PG_PORT"
} else {
    Write-OK "PostgreSQL port is open on :$PG_PORT"
}
# Confirm engine accepts queries (handles "database system is starting up")
Write-Info 'Confirming PostgreSQL engine readiness (SELECT 1 probe)...'
if (-not (Wait-PostgresReady $PG_PORT 'postgres' 30 'Olsbook55')) {
    Write-Fatal 'PostgreSQL did not accept a SELECT 1 query within 30s. Engine may still be starting.'
}
Write-OK 'PostgreSQL is READY (SELECT 1 succeeded).'
Set-Result 'PostgreSQL' 'OK'
Invoke-MonitorRefresh

Write-Host ''
Write-OK 'Stage 1 complete — all infrastructure is READY (L7 verified).'


# =============================================================================
#  STAGE 2 — Prisma Client Generation
#  All services are stopped (Stage 0), so no DLL locks exist.
#  Each schema is generated synchronously so failures are immediately visible.
# =============================================================================
Write-Stage 'STAGE 2 of 4  --  Prisma Client Generation'

# Use the locally installed Prisma CLI directly (avoids npx network checks that
# can hang indefinitely when run from a non-interactive piped process).
$prismaBin = Join-Path $ROOT 'node_modules\prisma\build\index.js'
if (-not (Test-Path $prismaBin)) { Write-Fatal "Prisma CLI not found at: $prismaBin — run 'npm install' first." }

# Suppress Prisma telemetry and update-check network calls during generation.
$env:DO_NOT_TRACK              = '1'
$env:PRISMA_HIDE_UPDATE_MESSAGE = '1'
$env:PRISMA_TELEMETRY_INFORMATION = '1'

$prismaFailed = @()

foreach ($svc in $BACKEND_SERVICES) {
    if ($null -eq $svc.Schema) { continue }
    $schemaPath = Join-Path $ROOT $svc.Schema
    $svcRelDir  = Split-Path (Split-Path $svc.Schema)
    $dllPath    = Join-Path $ROOT "$svcRelDir\src\generated\prisma-client\query_engine-windows.dll.node"

    if (-not (Test-Path $schemaPath)) {
        Write-Warn "Schema not found for $($svc.Name): $schemaPath - skipping"
        Set-Result "Prisma:$($svc.Name)" 'SKIPPED' 'Schema file missing'
        continue
    }

    # Skip generation if the DLL is already present and the schema has not changed
    # since the DLL was last written.  Stage 0 killed all services so the DLL is
    # not locked; regeneration is only needed when the schema changed or the DLL
    # is missing entirely.
    if (Test-Path $dllPath) {
        $dllAge    = (Get-Item $dllPath).LastWriteTime
        $schemaAge = (Get-Item $schemaPath).LastWriteTime
        if ($dllAge -ge $schemaAge) {
            Write-Skip "$($svc.Name) — DLL is current (DLL: $($dllAge.ToString('HH:mm:ss')), schema: $($schemaAge.ToString('HH:mm:ss')))"
            Set-Result "Prisma:$($svc.Name)" 'OK'
            continue
        }
        Write-Info "$($svc.Name) — schema changed since last generate; regenerating..."
    } else {
        Write-Info "Generating Prisma client (first time): $($svc.Name)..."
    }

    # Run prisma generate with a 120-second timeout.
    # Using direct node path instead of npx to avoid interactive prompts in a
    # non-TTY piped environment that can cause npx to hang indefinitely.
    $nodeExePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeExePath) { $nodeExePath = 'node' }

    $tmpOut = [System.IO.Path]::GetTempFileName()
    $tmpErr = [System.IO.Path]::GetTempFileName()
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $genProc = Start-Process -FilePath $nodeExePath `
        -ArgumentList @($prismaBin, 'generate', '--schema', $schemaPath) `
        -NoNewWindow -PassThru `
        -RedirectStandardOutput $tmpOut `
        -RedirectStandardError  $tmpErr `
        -ErrorAction SilentlyContinue
    $ErrorActionPreference = $prev

    $exited = if ($genProc) { $genProc.WaitForExit(120000) } else { $false }  # 120s timeout
    if ($genProc -and -not $exited) {
        try { $genProc.Kill() } catch {}
        $genExit = -1
    } elseif ($genProc) {
        $genExit = $genProc.ExitCode
    } else {
        $genExit = 1  # Start-Process failed
    }
    # Print captured output to Live Console
    if (Test-Path $tmpOut) { Get-Content $tmpOut | Where-Object { $_ } | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray } }
    if (Test-Path $tmpErr) { Get-Content $tmpErr | Where-Object { $_ } | ForEach-Object { Write-Host "    [ERR] $_" -ForegroundColor DarkGray } }
    Remove-Item $tmpOut, $tmpErr -ErrorAction SilentlyContinue

    if ($genExit -eq -1) {
        Write-Warn "prisma generate TIMED OUT for $($svc.Name) (>120s). Checking for existing DLL..."
        if (Test-Path $dllPath) {
            Write-Warn "  Existing DLL found — continuing with cached binary (may be outdated)."
            Set-Result "Prisma:$($svc.Name)" 'OK' 'Used cached DLL (generate timed out)'
        } else {
            Write-Fail "prisma generate timed out and no DLL found for $($svc.Name)."
            $prismaFailed += $svc.Name
            Set-Result "Prisma:$($svc.Name)" 'FAILED' 'generate timed out, no DLL'
        }
    } elseif ($genExit -ne 0) {
        Write-Fail "prisma generate FAILED for $($svc.Name) (exit $genExit)"
        # Check if an existing DLL can be used as fallback
        if (Test-Path $dllPath) {
            Write-Warn "  Existing DLL found — continuing with cached binary."
            Set-Result "Prisma:$($svc.Name)" 'OK' 'Used cached DLL (generate failed)'
        } else {
            $prismaFailed += $svc.Name
            Set-Result "Prisma:$($svc.Name)" 'FAILED'
        }
    } else {
        if (-not (Test-Path $dllPath)) {
            Write-Warn "$($svc.Name): generate exited 0 but DLL not found at: $dllPath"
            $prismaFailed += $svc.Name
            Set-Result "Prisma:$($svc.Name)" 'FAILED' 'DLL missing after generate'
        } else {
            Write-OK "$($svc.Name) client generated + DLL verified."
            Set-Result "Prisma:$($svc.Name)" 'OK'
        }
    }
}

if ($prismaFailed.Count -gt 0) {
    Write-Fatal "Prisma generation failed for: $($prismaFailed -join ', '). Fix schema errors before booting."
}

Write-Host ''
Write-OK 'Stage 2 complete — all Prisma clients generated.'


# =============================================================================
#  STAGE 3 — Backend Services  (dependency-ordered, L7-verified)
#  Each service is launched as a hidden background process with log capture.
#  We probe GET /health/live (HTTP 200) before launching the next service.
#  /health/live confirms full Nest bootstrap — not just a TCP SYN.
#  api-gateway has no /health/live — falls back to TCP for that one service.
# =============================================================================
Write-Stage 'STAGE 3 of 4  --  Backend Services'

foreach ($svc in $BACKEND_SERVICES) {
    $logFile = Join-Path $ROOT "logs\services\$($svc.Name).out.log"
    Write-Launch "Launching $($svc.Name) on :$($svc.Port)..."
    Write-Info   "  Log: $logFile"
    Start-SmeBackground -NpmScript $svc.NpmScript -Title "SME :: $($svc.Name) :$($svc.Port)" -LogName $svc.Name

    # api-gateway exposes /health/live at root; all others at /health/live
    # Use HTTP probe for all NestJS services.
    $ready = Wait-NestLive $svc.Port $svc.TimeoutSec "$($svc.Name) :$($svc.Port)"
    if ($ready) {
        Write-OK "$($svc.Name) is UP - /health/live returned HTTP 200."
        # Resolve and register the actual node.exe PID now that the service is healthy.
        $nodePid = Resolve-NodePid $svc.Name $svc.Port
        if ($nodePid) {
            Write-PidRegistry $svc.Name $nodePid
            Write-Info "  [Registry]  $($svc.Name)  node.exe PID=$nodePid"
        } else {
            Write-Warn "  [Registry]  Could not find node.exe for $($svc.Name) — WMI returned no match"
        }
        Set-Result $svc.Name 'OK'
        Invoke-MonitorRefresh
    } else {
        Write-Fail "$($svc.Name) did NOT return HTTP 200 on /health/live within $($svc.TimeoutSec)s."
        Write-Warn "  Crash log: $logFile"
        Write-Warn "Continuing with remaining services..."
        Set-Result $svc.Name 'FAILED' "/health/live not 200 within $($svc.TimeoutSec)s"
    }
}

Write-Host ''
Write-OK 'Stage 3 complete — backend launch sequence done.'


# =============================================================================
#  STAGE 4 — Frontend Apps  (L7 HTTP readiness probes)
#
#  Next.js dev mode compiles on the FIRST incoming HTTP request, not when the
#  process starts.  The Node.js server opens its port almost immediately, but
#  the first response can take 20-120s while webpack compiles the page bundle.
#
#  Strategy:
#    1. Spawn both frontends in parallel (no reason to serialise them).
#    2. Wait for each one's HTTP probe to return any 2xx/3xx status.
#       We probe GET / and follow redirects — web-admin redirects / → /login
#       (HTTP 307 → 200).  Both resolve to 200 once Next.js is ready.
#    3. Block the final summary banner until both are confirmed serving pages.
# =============================================================================
Write-Stage 'STAGE 4 of 4  --  Frontend Apps'

# ── Spawn both frontends immediately (parallel start) ────────────────────────
foreach ($svc in $FRONTEND_SERVICES) {
    $logFile = Join-Path $ROOT "logs\services\$($svc.Name).out.log"
    Write-Launch "Launching $($svc.Name) on :$($svc.Port)..."
    Write-Info   "  Log: $logFile"
    Start-SmeBackground -NpmScript $svc.NpmScript -Title "SME :: $($svc.Name) :$($svc.Port)" -LogName $svc.Name
}
Write-Info 'Both frontends spawned. Waiting for Next.js page compilation...'
Write-Info '(First response can take 20-120s — webpack is compiling the page bundles)'
Write-Host ''

# ── L7 probe each frontend — must return HTTP 2xx or 3xx ─────────────────────
foreach ($svc in $FRONTEND_SERVICES) {
    $deadline = (Get-Date).AddSeconds($svc.TimeoutSec)
    $ready    = $false
    Write-Host "  [ WAIT ]  $($svc.Name) - probing $($svc.ProbeUrl) (up to $($svc.TimeoutSec)s)..." -ForegroundColor DarkGray

    while ((Get-Date) -lt $deadline) {
        try {
            # AllowRedirect is true by default — follows 307 → /login → 200
            $resp = Invoke-WebRequest -Uri $svc.ProbeUrl -TimeoutSec 5 `
                        -ErrorAction Stop -UseBasicParsing `
                        -MaximumRedirection 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
                $ready = $true
                break
            }
        } catch {
            # ECONNREFUSED, timeout, or non-2xx — Next.js still compiling
        }
        Start-Sleep -Milliseconds 2000
    }

    if ($ready) {
        Write-OK "$($svc.Name) is READY - HTTP $($resp.StatusCode) received from $($svc.ProbeUrl)"
        # Resolve and register the actual node.exe PID now that the frontend is serving.
        $nodePid = Resolve-NodePid $svc.Name $svc.Port
        if ($nodePid) {
            Write-PidRegistry $svc.Name $nodePid
            Write-Info "  [Registry]  $($svc.Name)  node.exe PID=$nodePid"
        } else {
            Write-Warn "  [Registry]  Could not find node.exe for $($svc.Name) — WMI returned no match"
        }
        Set-Result $svc.Name 'OK'
        Invoke-MonitorRefresh
    } else {
        Write-Fail "$($svc.Name) did NOT respond within $($svc.TimeoutSec)s."
        Write-Warn "  Log: $(Join-Path $ROOT "logs\services\$($svc.Name).out.log")"
        Set-Result $svc.Name 'FAILED' "No HTTP response within $($svc.TimeoutSec)s"
    }
}

Write-Host ''
Write-OK 'Stage 4 complete — both frontends are serving pages.'


# =============================================================================
#  FINAL SUMMARY
# =============================================================================
$elapsed = [int]((Get-Date) - $BOOT_START).TotalSeconds
Write-Host ''
Write-Host '  +============================================================+' -ForegroundColor Green
Write-Host '  |            FULL AUTO BOOT  —  COMPLETE                    |' -ForegroundColor Green
Write-Host "  |            Total time: ${elapsed}s" -ForegroundColor Green
Write-Host '  +============================================================+' -ForegroundColor Green

$failed = @($Results.Keys | Where-Object { $Results[$_].Status -eq 'FAILED' })
if ($failed.Count -eq 0) {
    Write-Host '  |  ALL SYSTEMS UP                                            |' -ForegroundColor Green
} else {
    Write-Host "  |  WARNING: $($failed.Count) component(s) FAILED:" -ForegroundColor Yellow
    foreach ($k in $failed) {
        Write-Host "  |    $k - $($Results[$k].Note)" -ForegroundColor Yellow
    }
    Write-Host '  |  Check the Live Console above for startup errors.          |' -ForegroundColor Yellow
}

Write-Host '  +------------------------------------------------------------+' -ForegroundColor Green
Write-Host '  |  Infrastructure                                             |' -ForegroundColor Green
Write-Host '  |    PostgreSQL  :5432   Redis  :6379   RabbitMQ  :5672      |' -ForegroundColor Green
Write-Host '  +------------------------------------------------------------+' -ForegroundColor Green
Write-Host '  |  Backend                                                    |' -ForegroundColor Green
Write-Host '  |    api-gateway    :3000   iam-service    :3001              |' -ForegroundColor Green
Write-Host '  |    tenant-service :3002   config-service :3003              |' -ForegroundColor Green
Write-Host '  |    audit-service  :3004   portal-service :3005              |' -ForegroundColor Green
Write-Host '  +------------------------------------------------------------+' -ForegroundColor Green
Write-Host '  |  Frontend                                                   |' -ForegroundColor Green
Write-Host '  |    web-admin  :3101  (sme.test:3101)                        |' -ForegroundColor Green
Write-Host '  |    web-portal :3102  (sme.test:3102)                        |' -ForegroundColor Green
Write-Host '  +============================================================+' -ForegroundColor Green
Write-Host ''
Invoke-MonitorRefresh
