# =============================================================================
#  SME Platform — Zero-Touch Cold Start Orchestrator  v3.0
#  Host-Aware · Environment-Dominant · Clean-Room Guaranteed
#
#  Stages:
#    0   — Force-Purge      : Port-to-PID mapping → recursive tree-kill →
#                             verified port-release before advancing
#    0b  — Deep Audit       : Prisma query-engine locks, ts-node workers,
#                             orphan cmd.exe npm shells, stale caches
#    1   — Infra Bootstrap  : PostgreSQL Windows service auto-start,
#                             Docker Desktop auto-launch, RabbitMQ + Redis
#                             docker compose up -d (Cold-Boot capable)
#    2   — DB Sync          : prisma db push per service (idempotent)
#    3   — Code Gen         : prisma generate all clients ONCE
#    4   — Launch           : IAM → Audit(+3s) → Tenant/Config/Portal/Gateway
#    5   — Dashboard        : HTTP health + Pre-Flight Cleanup Summary
# =============================================================================

param([switch]$SkipDbSync)

Set-StrictMode -Version Latest
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
[console]::InputEncoding = [console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# ─── Cleanup Telemetry ────────────────────────────────────────────────────────
$Script:Stats = [pscustomobject]@{
    ZombiesKilled      = 0
    PortsFreed         = [System.Collections.Generic.List[int]]::new()
    LockFilesCleared   = 0
    CacheDirsCleared   = 0
    OrphanShellsKilled = 0
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
function Write-Stage { param([string]$t)
    Write-Host "`n  ══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host "  ══════════════════════════════════════════════════`n" -ForegroundColor Cyan
}
function Write-OK   { param([string]$t) Write-Host "  [OK]   $t" -ForegroundColor Green      }
function Write-INFO { param([string]$t) Write-Host "  [-->]  $t" -ForegroundColor Yellow     }
function Write-WARN { param([string]$t) Write-Host "  [WARN] $t" -ForegroundColor DarkYellow }
function Write-ERR  { param([string]$t) Write-Host "  [FAIL] $t" -ForegroundColor Red        }

# ─── Recursive process-tree collector (CimInstance — no deprecated WMI) ───────
function Get-ProcessTree {
    param([int]$RootPid)
    $result = [System.Collections.Generic.List[int]]::new()
    $result.Add($RootPid)
    try {
        $children = Get-CimInstance -ClassName Win32_Process `
            -Filter "ParentProcessId = $RootPid" -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            foreach ($id in (Get-ProcessTree -RootPid ([int]$child.ProcessId))) {
                if (-not $result.Contains($id)) { $result.Add($id) }
            }
        }
    } catch { }
    return $result
}

# Kill every process in the tree rooted at $RootPid — leaves first (bottom-up)
function Invoke-TreeKill {
    param([int]$RootPid, [string]$Context)
    $tree = Get-ProcessTree -RootPid $RootPid
    foreach ($id in ($tree | Sort-Object -Descending)) {
        try {
            $name = (Get-Process -Id $id -ErrorAction Stop).ProcessName
            Stop-Process -Id $id -Force -ErrorAction Stop
            $Script:Stats.ZombiesKilled++
            Write-INFO "  Killed PID $id ($name) [$Context]"
        } catch { }   # already gone — fine
    }
}

# $true when no LISTEN socket exists on the port
function Test-PortFree {
    param([int]$Port)
    $r = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return (-not $r -or @($r).Count -eq 0)
}

# Poll until port is free; returns $true on success
function Wait-PortFree {
    param([int]$Port, [int]$MaxRetries = 14, [int]$IntervalMs = 500)
    for ($i = 0; $i -lt $MaxRetries; $i++) {
        if (Test-PortFree $Port) { return $true }
        Start-Sleep -Milliseconds $IntervalMs
    }
    return $false
}

# TCP connect probe — used to wait for services to open their port
function Test-TcpPort {
    param([int]$Port)
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $ok    = $async.AsyncWaitHandle.WaitOne(800, $false)
        return ($ok -and $tcp.Connected)
    } catch { return $false } finally { $tcp.Close() }
}

# ── Dump a log file to the console with a bracketed prefix ──────────────────
function Show-CrashLog {
    param([string]$Path, [string]$Prefix, [System.ConsoleColor]$Color = 'Red')
    if (-not (Test-Path $Path)) { return }
    $lines = Get-Content $Path -ErrorAction SilentlyContinue
    if (-not $lines) { return }
    Write-Host "" 
    Write-Host "  $Prefix ──── crash output from: $Path" -ForegroundColor $Color
    foreach ($line in $lines) {
        Write-Host "  $Prefix $line" -ForegroundColor $Color
    }
    Write-Host "  $Prefix ──── end of output" -ForegroundColor $Color
    Write-Host ""
}

function Wait-ForPort {
    param(
        [int]$Port,
        [string]$Name,
        [int]$MaxSec = 30,
        # Optional: when supplied, the function detects early process exit and
        # immediately surfaces the captured stderr/stdout logs to the console.
        [System.Diagnostics.Process]$Process = $null,
        [string]$LogName = ''
    )
    $logsDir = Join-Path $ProjectRoot "logs"
    Write-INFO "Waiting for $Name on :$Port ..."
    for ($i = 0; $i -lt $MaxSec; $i++) {
        if (Test-TcpPort $Port) { Write-OK "$Name is ready"; return $true }
        # ── Crash detection: if the child process already exited without
        #    opening the port, surface its logs immediately instead of
        #    hanging for the full timeout.
        if ($Process -ne $null -and $Process.HasExited) {
            Write-ERR "$Name process (PID $($Process.Id)) exited prematurely (code $($Process.ExitCode)) — dumping logs"
            if ($LogName) {
                Show-CrashLog -Path (Join-Path $logsDir "$LogName.err.log") -Prefix "[$($Name.ToUpper()) ERR]"
                Show-CrashLog -Path (Join-Path $logsDir "$LogName.log")     -Prefix "[$($Name.ToUpper()) OUT]" -Color DarkYellow
            }
            return $false
        }
        Start-Sleep -Seconds 1
    }
    Write-ERR "$Name did not open :$Port after ${MaxSec}s — dumping last logs"
    if ($LogName) {
        Show-CrashLog -Path (Join-Path $logsDir "$LogName.err.log") -Prefix "[$($Name.ToUpper()) ERR]"
        Show-CrashLog -Path (Join-Path $logsDir "$LogName.log")     -Prefix "[$($Name.ToUpper()) OUT]" -Color DarkYellow
    }
    return $false
}

function Read-EnvValue {
    param([string]$File, [string]$Key)
    if (-not (Test-Path $File)) { return $null }
    $line = Get-Content $File -ErrorAction SilentlyContinue |
            Where-Object { $_ -match "^${Key}=" } | Select-Object -First 1
    if ($line) { return ($line -split "=", 2)[1].Trim() }
    return $null
}

# Launch a NestJS service with a 512 MB V8 heap cap per process.
# 6 services × 512 MB = 3 GB max; safe on any 8 GB+ dev machine.
function Start-SmeService {
    param([string]$Workspace, [string]$LogName)

    $logsDir = Join-Path $ProjectRoot "logs"
    if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

    $out = Join-Path $logsDir "$LogName.log"
    $err = Join-Path $logsDir "$LogName.err.log"

    $savedNodeOpts      = $env:NODE_OPTIONS
    $env:NODE_OPTIONS   = "--max-old-space-size=512"

    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run start:dev -w $Workspace" `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $out `
        -RedirectStandardError  $err `
        -WindowStyle Hidden -PassThru

    # Restore parent-process env so successive calls are isolated
    if ($null -ne $savedNodeOpts) { $env:NODE_OPTIONS = $savedNodeOpts }
    else { Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue }

    # Return the Process object so callers can detect premature exit
    return $proc
}

# ─── Service manifest ─────────────────────────────────────────────────────────
$Manifest = @(
    [ordered]@{ Name="iam-service";    Schema="apps/iam-service/prisma/schema.prisma";    Env="apps/iam-service/.env";    Workspace="@sme/iam-service";    Port=3001; HealthPath="/health/live" }
    [ordered]@{ Name="audit-service";  Schema="apps/audit-service/prisma/schema.prisma";  Env="apps/audit-service/.env";  Workspace="@sme/audit-service";  Port=3004; HealthPath="/health/live" }
    [ordered]@{ Name="tenant-service"; Schema="apps/tenant-service/prisma/schema.prisma"; Env="apps/tenant-service/.env"; Workspace="@sme/tenant-service"; Port=3002; HealthPath="/health/live" }
    [ordered]@{ Name="config-service"; Schema="apps/config-service/prisma/schema.prisma"; Env="apps/config-service/.env"; Workspace="@sme/config-service"; Port=3003; HealthPath="/health/live" }
    [ordered]@{ Name="portal-service"; Schema="apps/portal-service/prisma/schema.prisma"; Env="apps/portal-service/.env"; Workspace="@sme/portal-service"; Port=3005; HealthPath="/health/live" }
    [ordered]@{ Name="api-gateway";    Schema=$null;                                       Env="apps/api-gateway/.env";    Workspace="@sme/api-gateway";    Port=3000; HealthPath="/health/live" }
)

$ServicePorts = @(3000, 3001, 3002, 3003, 3004, 3005)

# ==============================================================================
#  STAGE 0 — Host-Aware Force-Purge
#  a) Exact port-to-PID mapping via Get-NetTCPConnection
#  b) Recursive tree-kill per offending PID (catches all forked children)
#  c) Verified port-release loop (polls 7 s) — no blind sleep
#  d) Residual node.exe sweep — skips known safe hosts (VSCode, Adobe, etc.)
# ==============================================================================
Write-Stage "STAGE 0 — Host-Aware Force-Purge (Clean-Room Guarantee)"

Write-INFO "Scanning ports $($ServicePorts -join ', ') for zombie bindings..."

$portsStillOccupied = [System.Collections.Generic.List[int]]::new()

foreach ($port in $ServicePorts) {
    $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($conns.Count -eq 0) { Write-OK "Port $port — free"; continue }

    foreach ($procId in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $pname = try { (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { "<exited>" }
        Write-WARN "Port $port occupied by PID $procId ($pname) — recursive tree-kill"
        Invoke-TreeKill -RootPid $procId -Context "port $port zombie"
    }

    Write-INFO "Verifying port $port is released..."
    if (Wait-PortFree -Port $port -MaxRetries 14 -IntervalMs 500) {
        Write-OK "Port $port confirmed FREE"
        $Script:Stats.PortsFreed.Add($port)
    } else {
        Write-ERR "Port $port STILL occupied after kill — service start will surface the conflict"
        $portsStillOccupied.Add($port)
    }
}

# Residual sweep: node.exe not caught by port scan
# Guard: skip well-known safe hosts (VSCode, Adobe, Electron-based apps)
#        AND skip our own launcher ancestor tree (the npm/node that invoked this script).
$safeFragments = @("*\Microsoft VS Code\*", "*\Adobe\*", "*\electron\*", "*\chrome\*", "*\firefox\*")

# Walk up the process tree from this PowerShell process to collect every ancestor PID.
# This protects the node.exe running "npm run smeapplocal" from being self-killed.
$launcherSafePids = [System.Collections.Generic.HashSet[int]]::new()
$walkerPid = $PID
for ($depth = 0; $depth -lt 20; $depth++) {
    $row = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $walkerPid" -ErrorAction SilentlyContinue
    if (-not $row -or [int]$row.ParentProcessId -eq 0) { break }
    $walkerPid = [int]$row.ParentProcessId
    [void]$launcherSafePids.Add($walkerPid)
}

foreach ($p in @(Get-Process -Name "node" -ErrorAction SilentlyContinue)) {
    # Ancestor protection — never kill the npm node that launched us
    if ($launcherSafePids.Contains($p.Id)) {
        Write-INFO "Skipping launcher node PID $($p.Id) (ancestor — self-kill guard)"
        continue
    }
    $path   = try { $p.Path } catch { $null }
    $isSafe = $safeFragments | Where-Object { $path -and $path -like $_ }
    if ($isSafe) { Write-INFO "Skipping safe node PID $($p.Id) ($path)"; continue }
    Write-WARN "Residual node PID $($p.Id) — tree-killing"
    Invoke-TreeKill -RootPid $p.Id -Context "residual node sweep"
}

if ($Script:Stats.ZombiesKilled -gt 0) {
    Write-OK "Force-Purge — $($Script:Stats.ZombiesKilled) process(es) eliminated"
} else {
    Write-OK "Force-Purge — environment was already clean"
}

# ==============================================================================
#  STAGE 0b — Deep System Audit (Invisible Blockers)
#  1) ts-node / ts-jest worker processes
#  2) Orphan cmd.exe / pwsh shells running npm start:dev or nest start
#  3) Prisma query-engine .tmp/.lock files (Windows DLL locks outlive node kill)
#  4) NestJS ts-jest cache + node_modules/.cache (stale bytecode → crash on load)
#  5) Previous run logs rotated to logs/prev/ (preserved for post-mortem)
# ==============================================================================
Write-Stage "STAGE 0b — Deep System Audit (Invisible Blockers)"

# 1. ts-node / ts-jest workers ─────────────────────────────────────────────────
foreach ($wn in @("ts-node","ts-jest")) {
    foreach ($w in @(Get-Process -Name $wn -ErrorAction SilentlyContinue)) {
        try { Stop-Process -Id $w.Id -Force -ErrorAction Stop
              $Script:Stats.ZombiesKilled++
              Write-INFO "Killed $wn worker PID $($w.Id)" } catch { }
    }
}

# 2. Orphan cmd.exe / powershell shells with npm start:dev ────────────────────
$shellFilter = "Name = 'cmd.exe' OR Name = 'powershell.exe' OR Name = 'pwsh.exe'"
foreach ($sh in @(Get-CimInstance -ClassName Win32_Process -Filter $shellFilter -ErrorAction SilentlyContinue)) {
    $cl = $sh.CommandLine
    if ($cl -and ($cl -like "*npm run start:dev*" -or $cl -like "*nest start*" -or $cl -like "*ts-node*")) {
        try {
            Stop-Process -Id ([int]$sh.ProcessId) -Force -ErrorAction Stop
            $Script:Stats.OrphanShellsKilled++
            Write-INFO "Killed orphan shell PID $($sh.ProcessId) ($($cl.Substring(0,[math]::Min(72,$cl.Length)))...)"
        } catch { }
    }
}

# 3. Prisma query-engine lock/tmp files ────────────────────────────────────────
$prismaClientDirs = [System.Collections.Generic.List[string]]::new()
$rootPrismaDir = Join-Path $ProjectRoot "node_modules\.prisma\client"
if (Test-Path $rootPrismaDir) { $prismaClientDirs.Add($rootPrismaDir) }
Get-ChildItem -Path (Join-Path $ProjectRoot "apps") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $d = Join-Path $_.FullName "node_modules\.prisma\client"
    if (Test-Path $d) { $prismaClientDirs.Add($d) }
}
foreach ($dir in $prismaClientDirs) {
    Get-ChildItem -Path $dir -File -Include "*.tmp","*.lock","*.pid" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            Remove-Item $_.FullName -Force -ErrorAction Stop
            $Script:Stats.LockFilesCleared++
            Write-INFO "Removed Prisma lock artefact: $($_.Name)"
        } catch { Write-WARN "Could not remove $($_.FullName) — $($_.Exception.Message)" }
    }
}

# 4. Stale TypeScript / NestJS caches ─────────────────────────────────────────
$cachePaths = [System.Collections.Generic.List[string]]::new()
foreach ($rc in @((Join-Path $ProjectRoot "node_modules\.cache"), (Join-Path $ProjectRoot ".ts-jest"))) {
    $cachePaths.Add($rc)
}
Get-ChildItem -Path (Join-Path $ProjectRoot "apps") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $c = Join-Path $_.FullName "node_modules\.cache"
    if (Test-Path $c) { $cachePaths.Add($c) }
}
foreach ($cp in $cachePaths) {
    if (-not (Test-Path $cp)) { continue }
    try {
        Remove-Item $cp -Recurse -Force -ErrorAction Stop
        $Script:Stats.CacheDirsCleared++
        Write-INFO "Cleared cache: $(Split-Path $cp -Leaf) ($cp)"
    } catch { Write-WARN "Could not clear $cp — $($_.Exception.Message)" }
}

# 5. Rotate previous run logs (preserve; never blind-delete) ───────────────────
$logsDir     = Join-Path $ProjectRoot "logs"
$prevLogsDir = Join-Path $logsDir "prev"
foreach ($d in @($logsDir, $prevLogsDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}
# Root-level stale logs (legacy v2.0 path)
Get-ChildItem -Path $ProjectRoot -Filter "*.log" -File -ErrorAction SilentlyContinue |
    ForEach-Object { Move-Item $_.FullName (Join-Path $prevLogsDir $_.Name) -Force -ErrorAction SilentlyContinue }
# logs\ logs from previous run
Get-ChildItem -Path $logsDir -Filter "*.log" -File -ErrorAction SilentlyContinue |
    ForEach-Object { Move-Item $_.FullName (Join-Path $prevLogsDir $_.Name) -Force -ErrorAction SilentlyContinue }

Write-OK ("Deep Audit — lock files: {0} | caches: {1} | orphan shells: {2}" -f `
    $Script:Stats.LockFilesCleared, $Script:Stats.CacheDirsCleared, $Script:Stats.OrphanShellsKilled)

# Brief settle after all kills before any TCP probes
Start-Sleep -Milliseconds 800

# ==============================================================================
#  STAGE 1 — Infrastructure Bootstrap (Cold-Boot Capable)
#
#  1a) PostgreSQL Windows Service  — find by wildcard, Start-Service if stopped
#  1b) Docker Desktop / Daemon     — launch if not running, wait for pipe ready
#  1c) RabbitMQ + Redis            — docker compose up -d via infra compose file
#
#  Graceful Exits: each failure emits a precise, actionable error message and
#  exits with code 1 before any timeout ambiguity can occur.
# ==============================================================================
Write-Stage "STAGE 1 — Infrastructure Bootstrap (Cold-Boot Capable)"

# ─── 1a: PostgreSQL Windows Service ──────────────────────────────────────────
Write-INFO "[1a] Checking PostgreSQL Windows service..."
$pgSvc = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pgSvc) {
    Write-ERR "PostgreSQL Windows service not found."
    Write-ERR "Install PostgreSQL (https://www.postgresql.org/download/windows/) and ensure it registers as a Windows service, then re-run."
    exit 1
}
if ($pgSvc.Status -ne 'Running') {
    Write-INFO "PostgreSQL service '$($pgSvc.Name)' is '$($pgSvc.Status)' — attempting Start-Service..."
    try {
        Start-Service -Name $pgSvc.Name -ErrorAction Stop
        Write-OK "Start-Service issued for '$($pgSvc.Name)'."
    } catch {
        Write-ERR "Failed to start PostgreSQL service '$($pgSvc.Name)': $($_.Exception.Message)"
        Write-ERR "TIP: Re-run this script as Administrator (right-click → Run as administrator), or start the '$($pgSvc.Name)' Windows service manually, then retry."
        exit 1
    }
}
Write-INFO "Waiting for PostgreSQL to open port 5432..."
if (-not (Wait-ForPort -Port 5432 -Name "PostgreSQL" -MaxSec 30)) {
    Write-ERR "PostgreSQL service '$($pgSvc.Name)' was started but port 5432 is still not listening after 30s."
    Write-ERR "Check Windows Event Viewer → Application logs for PostgreSQL startup errors."
    exit 1
}
Write-OK "PostgreSQL is ready on :5432"

# ─── 1b: Docker Desktop / Daemon ─────────────────────────────────────────────
Write-INFO "[1b] Checking Docker daemon..."
$dockerPipes = @(
    "\\.\pipe\dockerDesktopLinuxEngine",
    "\\.\pipe\docker_engine",
    "\\.\pipe\dockerDesktopWindowsEngine"
)
$dockerRunning = $dockerPipes | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $dockerRunning) {
    $ddExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $ddExe)) {
        Write-ERR "Docker Desktop executable not found at '$ddExe'."
        Write-ERR "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ then re-run."
        exit 1
    }
    Write-INFO "Docker Desktop is not running — launching it now..."
    Write-INFO "(First-boot may take 30–90s for Docker Desktop to fully initialise)"
    try {
        Start-Process -FilePath $ddExe -ErrorAction Stop
    } catch {
        Write-ERR "Cannot launch Docker Desktop: $($_.Exception.Message)"
        Write-ERR "TIP: Open Docker Desktop manually, wait for the tray icon to show 'Engine running', then re-run."
        exit 1
    }
    Write-INFO "Polling for Docker daemon pipe (max 90s)..."
    $ddReady = $false
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 1
        $ddReady = ($dockerPipes | Where-Object { Test-Path $_ } | Select-Object -First 1) -ne $null
        if ($ddReady) { break }
        if ($i -gt 0 -and $i % 15 -eq 0) { Write-INFO "  Still waiting for Docker... ($i s elapsed)" }
    }
    if (-not $ddReady) {
        Write-ERR "Docker daemon pipe not available after 90s. Docker Desktop may have failed to start."
        Write-ERR "TIP: Open Docker Desktop manually, wait for the tray icon to show 'Engine running', then re-run."
        exit 1
    }
    Write-INFO "Daemon pipe detected — waiting 5s for full API readiness..."
    Start-Sleep -Seconds 5
}
Write-OK "Docker daemon is reachable."

# ─── 1c: RabbitMQ + Redis via docker compose ─────────────────────────────────
Write-INFO "[1c] Checking RabbitMQ (:5672) and Redis (:6379)..."
$needRabbit = -not (Test-TcpPort 5672)
$needRedis  = -not (Test-TcpPort 6379)

if ($needRabbit -or $needRedis) {
    $InfraCompose = Join-Path $ProjectRoot "docker-compose.infra.yml"
    if (-not (Test-Path $InfraCompose)) {
        Write-ERR "docker-compose.infra.yml not found at '$InfraCompose'."
        Write-ERR "RabbitMQ (:5672)$(if($needRabbit){' UNREACHABLE'}) / Redis (:6379)$(if($needRedis){' UNREACHABLE'}) and no compose file exists to start them."
        Write-ERR "Ensure 'docker-compose.infra.yml' is present in the project root, then re-run."
        exit 1
    }
    Write-INFO "Starting infrastructure containers (docker compose up -d)..."
    $composeCmd = "docker compose -f `"$InfraCompose`" up -d"
    $composeOut = cmd.exe /c $composeCmd
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-ERR "docker compose up failed (exit code $exitCode):"
        $composeOut | ForEach-Object { Write-ERR "  $_" }
        Write-ERR "TIP: Run 'docker compose -f docker-compose.infra.yml up -d' manually to see the full error."
        exit 1
    }
    $composeOut | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
    Write-OK "docker compose up -d succeeded."
}

if ($needRabbit) {
    Write-INFO "Waiting for RabbitMQ AMQP port 5672..."
    if (-not (Wait-ForPort -Port 5672 -Name "RabbitMQ" -MaxSec 60)) {
        Write-ERR "RabbitMQ container started but port 5672 is still dark after 60s."
        Write-ERR "Diagnose with: docker logs sme-rabbitmq"
        exit 1
    }
} else {
    Write-OK "RabbitMQ already listening on :5672"
}

if ($needRedis) {
    Write-INFO "Waiting for Redis port 6379..."
    if (-not (Wait-ForPort -Port 6379 -Name "Redis" -MaxSec 30)) {
        Write-ERR "Redis container started but port 6379 is still dark after 30s."
        Write-ERR "Diagnose with: docker logs sme-redis"
        exit 1
    }
} else {
    Write-OK "Redis already listening on :6379"
}

Write-OK "Infrastructure Bootstrap complete — PostgreSQL + RabbitMQ + Redis all ready."

# ==============================================================================
#  STAGE 2 — Database Schema Sync (prisma db push — schema is master, idempotent)
# ==============================================================================
Write-Stage "STAGE 2 — Database Schema Sync (prisma db push)"

if ($SkipDbSync) {
    Write-INFO "SkipDbSync flag set — skipping schema sync"
} else {
    foreach ($svc in ($Manifest | Where-Object { $_.Schema })) {
        $dbUrl = Read-EnvValue -File (Join-Path $ProjectRoot $svc.Env) -Key "DATABASE_URL"
        if (-not $dbUrl) { Write-ERR "DATABASE_URL missing in $($svc.Env)"; exit 1 }
        $env:DATABASE_URL = $dbUrl
        Write-INFO "Syncing $($svc.Name)..."
        $prismaCmd = "npx prisma db push --schema=`"$($svc.Schema)`" --accept-data-loss --skip-generate"
        $prismaOut = cmd.exe /c $prismaCmd
        $prismaExit = $LASTEXITCODE
        if ($prismaExit -eq 0) {
            $prismaOut | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
            Write-OK "$($svc.Name) schema in sync"
        } else {
            Write-ERR "$($svc.Name) db push failed (exit code $prismaExit) — check DATABASE_URL and DB connectivity"
            $prismaOut | ForEach-Object { Write-ERR "  $_" }
            exit 1
        }
    }
}

# ==============================================================================
#  STAGE 3 — Prisma Client Generation (sequential to avoid DLL-write contention)
# ==============================================================================
Write-Stage "STAGE 3 — Prisma Client Generation"

foreach ($svc in ($Manifest | Where-Object { $_.Schema })) {
    $dbUrl = Read-EnvValue -File (Join-Path $ProjectRoot $svc.Env) -Key "DATABASE_URL"
    if ($dbUrl) { $env:DATABASE_URL = $dbUrl }
    Write-INFO "Generating client for $($svc.Name)..."
    $prismaGenCmd = "npx prisma generate --schema=`"$($svc.Schema)`""
    $prismaGenOut = cmd.exe /c $prismaGenCmd
    $prismaGenExit = $LASTEXITCODE
    if ($prismaGenExit -eq 0) {
        $prismaGenOut | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        Write-OK "$($svc.Name) Prisma client ready"
    } else {
        Write-ERR "$($svc.Name) generate failed (exit code $prismaGenExit) — services may not start cleanly"
        $prismaGenOut | ForEach-Object { Write-ERR "  $_" }
    }
}

# ==============================================================================
#  STAGE 4 — Staged Service Launch
#  IAM first (seeds roles/permissions; all others depend on it)
#  Audit +3 s  (independent DB; avoids simultaneous AMQP handshake with IAM)
#  App layer   +5 s each (eases connection-pool ramp-up)
# ==============================================================================
Write-Stage "STAGE 4 — Staged Service Launch"

Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

$logsDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }

# ── IAM — kernel layer ────────────────────────────────────────────────────────
Write-INFO "Launching IAM Service (kernel layer)..."
$iamProc = Start-SmeService -Workspace "@sme/iam-service" -LogName "iam"
if (-not (Wait-ForPort -Port 3001 -Name "IAM" -MaxSec 600 -Process $iamProc -LogName "iam")) {
    Write-ERR "IAM Service failed to start — inspect logs\iam.log and logs\iam.err.log"
    exit 1
}
Write-OK "IAM Service live on :3001"

# ── Audit (+3 s stagger) ─────────────────────────────────────────────────────
Start-Sleep -Seconds 3
Write-INFO "Launching Audit Service..."
$auditProc = Start-SmeService -Workspace "@sme/audit-service" -LogName "audit"
if (-not (Wait-ForPort -Port 3004 -Name "Audit" -MaxSec 600 -Process $auditProc -LogName "audit")) {
    Write-ERR "Audit Service failed — inspect logs\audit.log"
    exit 1
}
Write-OK "Audit Service live on :3004"

# ── Application layer (+5 s stagger each) ────────────────────────────────────
$AppLayer = @(
    @{ Workspace="@sme/tenant-service"; Port=3002; Log="tenant";  Name="Tenant"  }
    @{ Workspace="@sme/config-service"; Port=3003; Log="config";  Name="Config"  }
    @{ Workspace="@sme/portal-service"; Port=3005; Log="portal";  Name="Portal"  }
    @{ Workspace="@sme/api-gateway";    Port=3000; Log="gateway"; Name="Gateway" }
)
foreach ($app in $AppLayer) {
    Start-Sleep -Seconds 5
    Write-INFO "Launching $($app.Name) Service..."
    $appProc = Start-SmeService -Workspace $app.Workspace -LogName $app.Log
    if (-not (Wait-ForPort -Port $app.Port -Name $app.Name -MaxSec 600 -Process $appProc -LogName $app.Log)) {
        Write-ERR "$($app.Name) failed — check logs\$($app.Log).log. Continuing to next service..."
    } else {
        Write-OK "$($app.Name) Service live on :$($app.Port)"
    }
}

# ==============================================================================
#  STAGE 5 — SME Platform Health Dashboard
#  Includes Pre-Flight Cleanup Summary + colour-coded 6/6 service table
# ==============================================================================
Write-Stage "STAGE 5 — SME Platform Health Dashboard"

Write-INFO "Allowing services to fully settle (5s)..."
Start-Sleep -Seconds 5

$allGreen = $true
$rows     = @()
foreach ($svc in @(@{Name="Gateway";Port=3000},@{Name="IAM";Port=3001},@{Name="Tenant";Port=3002},@{Name="Config";Port=3003},@{Name="Audit";Port=3004},@{Name="Portal";Port=3005})) {
    $url = "http://localhost:$($svc.Port)/health/live"
    try {
        $r     = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
        $state = if ($r.StatusCode -eq 200) { "UP  " } else { "WARN" }
        $ok    = ($r.StatusCode -eq 200)
    } catch {
        $state = "DOWN"; $ok = $false
    }
    if (-not $ok) { $allGreen = $false }
    $rows += [pscustomobject]@{ Name=$svc.Name; Port=$svc.Port; State=$state; Ok=$ok; Url=$url }
}

# ── Pre-Flight Cleanup Summary ────────────────────────────────────────────────
$freePorts = if ($Script:Stats.PortsFreed.Count -gt 0) {
    ($Script:Stats.PortsFreed | ForEach-Object { ":$_" }) -join ", "
} else { "none" }

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║            PRE-FLIGHT CLEANUP SUMMARY                       ║" -ForegroundColor DarkCyan
Write-Host "  ╠══════════════════════════════════════════════════════════════╣" -ForegroundColor DarkCyan
Write-Host ("  ║  Zombies killed    : {0,-41}║" -f $Script:Stats.ZombiesKilled)        -ForegroundColor Cyan
Write-Host ("  ║  Ports freed       : {0,-41}║" -f $freePorts)                          -ForegroundColor Cyan
Write-Host ("  ║  Lock files cleared: {0,-41}║" -f $Script:Stats.LockFilesCleared)     -ForegroundColor Cyan
Write-Host ("  ║  Cache dirs purged : {0,-41}║" -f $Script:Stats.CacheDirsCleared)     -ForegroundColor Cyan
Write-Host ("  ║  Orphan shells     : {0,-41}║" -f $Script:Stats.OrphanShellsKilled)   -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan

if ($portsStillOccupied.Count -gt 0) {
    Write-Host ("  ⚠  Ports still occupied post-purge: {0}" -f ($portsStillOccupied -join ", ")) -ForegroundColor Red
}

# ── Service Health Table ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +-------------+------+--------+--------------------------------+" -ForegroundColor White
Write-Host "  | Service     | Port | Status | Health URL                     |" -ForegroundColor White
Write-Host "  +-------------+------+--------+--------------------------------+" -ForegroundColor White
foreach ($row in $rows) {
    $color = if ($row.Ok) { "Green" } else { "Red" }
    Write-Host ("  | {0,-11} | {1,-4} | {2,-6} | {3,-30} |" -f $row.Name, $row.Port, $row.State, $row.Url) -ForegroundColor $color
}
Write-Host "  +-------------+------+--------+--------------------------------+" -ForegroundColor White
Write-Host ""

$upCount = ($rows | Where-Object { $_.Ok }).Count
if ($allGreen) {
    Write-Host "  SME Platform: $upCount/6 SERVICES GREEN — Zero-Touch startup complete.`n" -ForegroundColor Green
    Write-Host "  Logs  → $(Join-Path $ProjectRoot 'logs')" -ForegroundColor DarkGray
    Write-Host "  Prev  → $(Join-Path $ProjectRoot 'logs\prev')`n" -ForegroundColor DarkGray
} else {
    Write-Host "  SME Platform: $upCount/6 GREEN — one or more services DOWN." -ForegroundColor Red
    Write-Host "  Inspect logs\*.log and logs\*.err.log in the project root.`n" -ForegroundColor Red
    exit 1
}
