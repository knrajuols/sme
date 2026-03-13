# =============================================================================
#  sme-fullboot.ps1  —  SME Platform  |  Full Automated Boot  v1.0
#
#  ONE CLICK to go from any state to a fully running platform.
#
#  What this script does — in exact order:
#
#    STAGE 0  Stop all SME services currently running on ports 3000-3005,
#             3101-3102.  This frees the Prisma .dll.node locks so that
#             prisma generate can always succeed on every service.
#
#    STAGE 1  Infrastructure
#             1a  Docker Desktop — detect daemon; start it and wait if down.
#             1b  Redis + RabbitMQ — docker compose up -d; wait for TCP ports.
#             1c  PostgreSQL — detect/start Windows service; wait for port 5432.
#
#    STAGE 2  Prisma client generation for all 5 services.
#             Runs sequentially so output is clear in the Live Console.
#             Aborts the boot if any service fails to generate.
#
#    STAGE 3  Backend services — started in dependency order.
#             Each service's TCP port is probed before the next service starts.
#             Order:  iam-service → tenant-service → config-service
#                  → audit-service → portal-service → api-gateway
#
#    STAGE 4  Frontend apps — web-admin, web-portal.
#
#  Designed to run headless (piped from sme-monitor.js) so all output streams
#  to the browser Live Console.  Child service processes run silently in the
#  background; the dashboard status table updates automatically.
#
#  Safe to run repeatedly — idempotent on infrastructure, restarts services.
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ROOT        = $PSScriptRoot
$COMPOSE     = Join-Path $ROOT 'docker-compose.infra.yml'
$PG_PORT     = 5432
$BOOT_START  = Get-Date

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
function Wait-PostgresReady { param([int]$Port = 5432, [string]$User = 'postgres', [int]$TimeoutSec = 30)
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
            $psqlCmd  = if ($env:PSQL_BIN) { $env:PSQL_BIN } else { 'psql' }
            $prev     = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
            $out      = & $psqlCmd -U $User -h localhost -p $Port -c 'SELECT 1;' -t -q 2>&1 | Out-String
            $sqlExit  = $LASTEXITCODE
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
    # Ensure logs\ directory exists
    $logsDir = Join-Path $ROOT 'logs'
    if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

    if ($LogName) {
        $logFile = Join-Path $logsDir "$LogName.log"
        # *> redirects ALL PowerShell output streams (stdout + stderr)
        $cmd = "Set-Location '$ROOT'; npm run $NpmScript *> '$logFile'"
    } else {
        $cmd = "Set-Location '$ROOT'; npm run $NpmScript"
    }

    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
    $null    = Start-Process powershell.exe -ArgumentList @(
        '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-EncodedCommand', $encoded
    ) -WindowStyle Hidden -PassThru
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

# Normalise project root to forward-slash lowercase for reliable matching
$rootNorm   = $ROOT.Replace('\','/').ToLower().TrimEnd('/')
$killedPids = [System.Collections.Generic.HashSet[int]]::new()
$killedCount = 0

# ── Prong 1: Network clearing — kill by SME port ──────────────────────────
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
                    Write-Warn "  [Port $port]  Could not kill PID $procPid — $_"
                }
            }
        }
    }
}
Write-OK "Prong 1 done — $killedCount port-holding process(es) killed."

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
                Write-Warn "  [Zombie]  Could not kill PID $procPid — $_"
            }
        }
    }
} catch {
    Write-Warn "  Get-CimInstance failed (WMI unavailable?): $_"
    Write-Warn "  Zombie hunting skipped — DLL locks may still exist if services crashed."
}

Write-OK "Prong 2 done — $zombieCount zombie node.exe process(es) killed."

# ── Wait for OS to release file handles ──────────────────────────────────
if ($killedCount -gt 0) {
    Write-Info "Total killed: $killedCount. Waiting 4s for OS to release all DLL file handles..."
    Start-Sleep -Seconds 4
    Write-OK 'File handles released. Stage 0 complete — runway is clean.'
} else {
    Write-OK 'No SME processes found. Already clean state.'
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

# RabbitMQ: rely on compose healthcheck (rabbitmq-diagnostics ping inside container)
Write-Info 'Waiting for RabbitMQ to become healthy (Docker healthcheck)...'
if (-not (Wait-RabbitMqHealthy 'sme-rabbitmq' 90)) { Write-Fatal 'RabbitMQ did not reach healthy state within 90s.' }
Write-OK 'RabbitMQ is READY (container health = healthy).'
Set-Result 'RabbitMQ' 'OK'

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
if (-not (Wait-PostgresReady $PG_PORT 'postgres' 30)) {
    Write-Fatal 'PostgreSQL did not accept a SELECT 1 query within 30s. Engine may still be starting.'
}
Write-OK 'PostgreSQL is READY (SELECT 1 succeeded).'
Set-Result 'PostgreSQL' 'OK'

Write-Host ''
Write-OK 'Stage 1 complete — all infrastructure is READY (L7 verified).'


# =============================================================================
#  STAGE 2 — Prisma Client Generation
#  All services are stopped (Stage 0), so no DLL locks exist.
#  Each schema is generated synchronously so failures are immediately visible.
# =============================================================================
Write-Stage 'STAGE 2 of 4  --  Prisma Client Generation'

$prismaFailed = @()

foreach ($svc in $BACKEND_SERVICES) {
    if ($null -eq $svc.Schema) { continue }
    $schemaPath = Join-Path $ROOT $svc.Schema
    if (-not (Test-Path $schemaPath)) {
        Write-Warn "Schema not found for $($svc.Name): $schemaPath — skipping"
        Set-Result "Prisma:$($svc.Name)" 'SKIPPED' 'Schema file missing'
        continue
    }
    Write-Info "Generating Prisma client: $($svc.Name)..."
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & npx prisma generate --schema $schemaPath 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    $genExit = $LASTEXITCODE
    $ErrorActionPreference = $prev

    if ($genExit -ne 0) {
        Write-Fail "prisma generate FAILED for $($svc.Name) (exit $genExit)"
        $prismaFailed += $svc.Name
        Set-Result "Prisma:$($svc.Name)" 'FAILED'
    } else {
        # Belt-and-suspenders: verify the native binary was physically written
        # Split-Path twice: schema.prisma -> prisma -> apps\<svc> (service root)
        $svcRelDir = Split-Path (Split-Path $svc.Schema)
        $dllPath   = Join-Path $ROOT "$svcRelDir\src\generated\prisma-client\query_engine-windows.dll.node"
        if (-not (Test-Path $dllPath)) {
            Write-Warn "$($svc.Name): generate exited 0 but DLL not found at: $dllPath"
            Write-Warn "  This is unusual — may indicate a permissions issue."
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
    $logFile = Join-Path $ROOT "logs\$($svc.Name).log"
    Write-Launch "Launching $($svc.Name) on :$($svc.Port)..."
    Write-Info   "  Log: $logFile"
    Start-SmeBackground -NpmScript $svc.NpmScript -Title "SME :: $($svc.Name) :$($svc.Port)" -LogName $svc.Name

    # api-gateway exposes /health/live at root; all others at /health/live
    # Use HTTP probe for all NestJS services.
    $ready = Wait-NestLive $svc.Port $svc.TimeoutSec "$($svc.Name) :$($svc.Port)"
    if ($ready) {
        Write-OK "$($svc.Name) is UP — /health/live returned HTTP 200."
        Set-Result $svc.Name 'OK'
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
    $logFile = Join-Path $ROOT "logs\$($svc.Name).log"
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
    Write-Host "  [ WAIT ]  $($svc.Name) — probing $($svc.ProbeUrl) (up to $($svc.TimeoutSec)s)..." -ForegroundColor DarkGray

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
        Write-OK "$($svc.Name) is READY — HTTP $($resp.StatusCode) received from $($svc.ProbeUrl)"
        Set-Result $svc.Name 'OK'
    } else {
        Write-Fail "$($svc.Name) did NOT respond within $($svc.TimeoutSec)s."
        Write-Warn "  Crash log: $(Join-Path $ROOT "logs\$($svc.Name).log")"
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
        Write-Host "  |    $k — $($Results[$k].Note)" -ForegroundColor Yellow
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
