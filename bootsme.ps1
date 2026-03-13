# =============================================================================
#  bootsme.ps1  —  SME Platform  |  Enterprise Boot Script  v1.0
#  Author   : SME Dev Team
#  Purpose  : Infrastructure pre-flight + service ignition ONLY.
#             This script does NOT build code, run migrations, or generate
#             Prisma clients. It is a pure ignition switch.
#
#  Services launched:
#    Backend  (6) : iam-service :3001 | tenant-service :3002
#                   config-service :3003 | audit-service :3004
#                   portal-service :3005 | api-gateway :3000
#    Frontend (2) : web-admin :3101 | web-portal :3102
#
#  Prerequisites:
#    - PostgreSQL must be running (local Windows service)
#    - Docker Desktop must be running
#    - npm install must have been run (node_modules present)
#    - All .env files must be configured
#
#  Usage:
#    powershell -ExecutionPolicy Bypass -File C:\projects\SME\bootsme.ps1
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────
# Dynamically resolve project root from the script's own location.
# Works regardless of where the project is cloned or which drive it lives on.
$ROOT       = $PSScriptRoot
$COMPOSE    = 'docker-compose.infra.yml'
$PG_PORT    = 5432
$PG_TIMEOUT = 10   # seconds before aborting if Postgres is unreachable

# Detect when stdout is piped (e.g. launched by sme-monitor via startTrackedProcess).
# In headless mode all windows are suppressed; output streams back to the browser.
$Headless = [Console]::IsOutputRedirected

# ─────────────────────────────────────────────────────────────────────────────
#  Console helpers
# ─────────────────────────────────────────────────────────────────────────────
function Write-Banner {
    Write-Host ''
    Write-Host '  +======================================================+' -ForegroundColor Cyan
    Write-Host '  |         SME Platform  --  Boot Sequence v1.0         |' -ForegroundColor Cyan
    Write-Host '  +======================================================+' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Stage  { param([string]$label)
    Write-Host ''
    Write-Host "  +---------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "  |  $label" -ForegroundColor Cyan
    Write-Host "  +---------------------------------------------" -ForegroundColor DarkCyan
    Write-Host ''
}

function Write-OK     { param([string]$msg) Write-Host "  [  OK  ]  $msg" -ForegroundColor Green      }
function Write-Info    { param([string]$msg) Write-Host "  [ INFO ]  $msg" -ForegroundColor Yellow     }
function Write-Skipped { param([string]$msg) Write-Host "  [ SKIP ]  $msg" -ForegroundColor DarkGray   }
function Write-Launch  { param([string]$msg) Write-Host "  [  >>  ]  $msg" -ForegroundColor Magenta    }
function Write-Fatal   { param([string]$msg)
    Write-Host ''
        Write-Host "  +================================================+" -ForegroundColor Yellow
        Write-Host "  |  FATAL: $msg" -ForegroundColor Yellow
        Write-Host "  +================================================+" -ForegroundColor Yellow
    Write-Host ''
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
#  Helper: launch a service in Windows Terminal (preferred) or new PS window
# ─────────────────────────────────────────────────────────────────────────────
$script:WtAvailable   = $null   # lazy-evaluated once
$script:WtFirstOpened = $false  # tracks whether the first wt tab is open

function Invoke-ServiceWindow {
    param(
        # window/tab title
        [string]$Title,
        # root-level npm script name  e.g. "start:dev:iam"
        [string]$NpmScript,
        # optional wt tab color  e.g. "#0078d4"
        [string]$Color = '',
        # show window (true) or run hidden (false)
        [bool]$ShowWindow = $false
    )

    $cmd = "Set-Location '$ROOT'; `$host.UI.RawUI.WindowTitle = '$Title'; npm run $NpmScript"

    # Encode the command as Base64 so no quoting/escaping issues can occur
    # regardless of titles, paths, or npm script names that contain spaces/quotes.
    $encodedCmd = [Convert]::ToBase64String(
        [Text.Encoding]::Unicode.GetBytes($cmd)
    )

    # ── Headless mode: running piped from sme-monitor ─────────────────────────
    # Suppress ALL windows so output stays in the browser Live Console.
    if ($Headless) {
        Start-Process powershell -ArgumentList @(
            '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-WindowStyle', 'Hidden',
            '-EncodedCommand', $encodedCmd
        ) -WindowStyle Hidden
        Start-Sleep -Milliseconds 400
        return
    }

    if ($null -eq $script:WtAvailable) {
        $script:WtAvailable = $null -ne (Get-Command wt -ErrorAction SilentlyContinue)
    }

    if ($script:WtAvailable) {
        # ── Windows Terminal: single pre-quoted string so wt.exe receives
        #    --title "..." as one token.  Array form does NOT add quotes around
        #    elements, so multi-word titles break wt's own argument parser.
        $verb      = if (-not $script:WtFirstOpened) { 'new-tab' } else { 'nt' }
        $colorPart = if ($Color) { "--tabColor $Color" } else { '' }

        # Title is double-quoted inside the string so wt treats it as one token.
        $wtArgs = "$verb --title `"$Title`" $colorPart powershell -NoExit -EncodedCommand $encodedCmd"
        Start-Process wt -ArgumentList $wtArgs

        if (-not $script:WtFirstOpened) {
            $script:WtFirstOpened = $true
            Start-Sleep -Milliseconds 800   # give WT time to open before appending tabs
        }
    } else {
        # ── Fallback: individual PowerShell windows ───────────────────────────
        $windowStyle = if ($ShowWindow) { 'Normal' } else { 'Hidden' }
        Start-Process powershell -ArgumentList @(
            '-NoExit',
            '-EncodedCommand',
            $encodedCmd
        ) -WindowStyle $windowStyle
    }

    Start-Sleep -Milliseconds 400   # slight stagger to prevent npm workspace lock contention
}


# =============================================================================
#  BOOT SEQUENCE START
# =============================================================================
Set-Location $ROOT
Write-Banner

# =============================================================================
#  STAGE 1 — Infrastructure Pre-Flight
#
#  Three independent responsibilities:
#    1a. Docker Desktop  — ensure the Docker daemon is reachable.
#                          If not running, start it and wait (up to 60s).
#    1b. Redis + RabbitMQ — ensure containers are up via docker compose.
#                          A container already running is NOT an error.
#    1c. PostgreSQL      — runs as a Windows service (NOT in Docker).
#                          If the service is stopped, start it automatically.
# =============================================================================
Write-Stage 'STAGE 1 of 3 -- Infrastructure Pre-Flight'

# ── 1a. Docker Desktop ────────────────────────────────────────────────────────
Write-Info 'Checking Docker daemon...'

$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$dockerCheck = docker info 2>&1
$dockerExit  = $LASTEXITCODE
$ErrorActionPreference = $prev

if ($dockerExit -ne 0) {
    Write-Warning 'Docker daemon is not reachable. Attempting to start Docker Desktop...'

    # Common install paths for Docker Desktop on Windows
    $dockerPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    $dockerExe = $dockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($null -eq $dockerExe) {
        Write-Fatal 'Docker Desktop executable not found. Install Docker Desktop and retry.'
    }

    Start-Process $dockerExe
    Write-Info 'Docker Desktop starting... waiting up to 60s for daemon.'

    $dockerReady    = $false
    $dockerDeadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $dockerDeadline) {
        Start-Sleep -Seconds 3
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $chk = docker info 2>&1
        $chkExit = $LASTEXITCODE
        $ErrorActionPreference = $prev
        if ($chkExit -eq 0) { $dockerReady = $true; break }
        Write-Host '  ..' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''

    if (-not $dockerReady) {
        Write-Fatal 'Docker daemon did not become ready within 60s. Check Docker Desktop and retry.'
    }
    Write-OK 'Docker Desktop is now running.'
} else {
    Write-OK 'Docker daemon is running.'
}

# ── 1b. Redis + RabbitMQ containers ──────────────────────────────────────────
Write-Info 'Checking Redis and RabbitMQ containers...'

# Check container state before calling compose so we can give clear status
function Get-ContainerState { param([string]$Name)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $state = docker inspect --format '{{.State.Status}}' $Name 2>&1
    $exit  = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($exit -ne 0) { return 'missing' }
    return $state.Trim()
}

$redisState   = Get-ContainerState 'sme-redis'
$rabbitState  = Get-ContainerState 'sme-rabbitmq'

$needCompose  = ($redisState -ne 'running') -or ($rabbitState -ne 'running')

if (-not $needCompose) {
    Write-OK "Redis     is running  (container: sme-redis)"
    Write-OK "RabbitMQ  is running  (container: sme-rabbitmq)"
} else {
    Write-Info "Redis state: $redisState  |  RabbitMQ state: $rabbitState"
    Write-Info 'Running docker compose up -d...'

    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $composeOut  = docker compose -f $COMPOSE up -d 2>&1
    $composeExit = $LASTEXITCODE
    $ErrorActionPreference = $prev

    if ($composeExit -ne 0) {
        $errText = ($composeOut | Out-String).Trim()
        Write-Fatal "docker compose up -d failed (exit $composeExit).`n         $errText"
    }

    # Give containers a moment to reach running state
    Start-Sleep -Seconds 3

    $redisState  = Get-ContainerState 'sme-redis'
    $rabbitState = Get-ContainerState 'sme-rabbitmq'
    Write-OK "Redis     -> $redisState"
    Write-OK "RabbitMQ  -> $rabbitState"
}

Write-Info "  RabbitMQ  amqp://localhost:5672  (mgmt: http://localhost:15672)"
Write-Info "  Redis     redis://localhost:6379"

# ── 1c. PostgreSQL (Windows service — NOT in Docker) ─────────────────────────
Write-Info 'Checking PostgreSQL...'

function Test-PgPort {
    return (Test-NetConnection -ComputerName 'localhost' -Port $PG_PORT `
                -InformationLevel Quiet -WarningAction SilentlyContinue)
}

if (-not (Test-PgPort)) {
    # Not listening — find and start the Windows service
    $pgSvc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($null -eq $pgSvc) {
        Write-Fatal "PostgreSQL is not running and no 'postgresql*' Windows service was found.`n         Install PostgreSQL or start it manually, then retry."
    }

    if ($pgSvc.Status -eq 'Running') {
        # Service says running but port not open yet — just wait
        Write-Info "Service '$($pgSvc.Name)' is starting... waiting for port $PG_PORT."
    } else {
        Write-Info "Service '$($pgSvc.Name)' is $($pgSvc.Status). Starting it now..."
        try {
            Start-Service -Name $pgSvc.Name -ErrorAction Stop
            Write-OK "Service '$($pgSvc.Name)' start command sent."
        } catch {
            Write-Fatal "Could not start '$($pgSvc.Name)': $_`n         Try: Start-Service '$($pgSvc.Name)' in an elevated shell."
        }
    }

    # Wait up to $PG_TIMEOUT seconds for port to open
    $pgReady    = $false
    $pgDeadline = (Get-Date).AddSeconds($PG_TIMEOUT)
    while ((Get-Date) -lt $pgDeadline) {
        Start-Sleep -Seconds 1
        if (Test-PgPort) { $pgReady = $true; break }
        Write-Host '  ..' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ''

    if (-not $pgReady) {
        Write-Fatal "PostgreSQL did not open port $PG_PORT within ${PG_TIMEOUT}s.`n         Check the service logs: Get-EventLog -LogName Application -Source '*postgres*' -Newest 10"
    }
    Write-OK "PostgreSQL started and is READY on port $PG_PORT."
} else {
    Write-OK "PostgreSQL is READY on port $PG_PORT."
}

# ── 1c. Detect SME services already running ───────────────────────────────────
Write-Info 'Checking SME service ports...'
$servicePorts = @{
    3000 = 'api-gateway'
    3001 = 'iam-service'
    3002 = 'tenant-service'
    3003 = 'config-service'
    3004 = 'audit-service'
    3005 = 'portal-service'
    3101 = 'web-admin'
    3102 = 'web-portal'
}

# Services already listening -- Stages 2 and 3 skip these (already up).
$alreadyUp = [System.Collections.Generic.HashSet[string]]::new()

foreach ($entry in $servicePorts.GetEnumerator()) {
    $lines = netstat -ano 2>$null | Select-String ":$($entry.Key)\s" | Select-String 'LISTENING'
    foreach ($line in $lines) {
        if ($line -match '\s+(\d+)\s*$') {
            $procId = [int]$Matches[1]
            $proc   = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($null -ne $proc -and $proc.ProcessName -match '^(node|npm|npm\.cmd)$') {
                $null = $alreadyUp.Add($entry.Value)
                break
            }
        }
    }
}

if ($alreadyUp.Count -eq 0) {
    Write-OK 'All service ports are free -- clean boot.'
} else {
    Write-Host ''
    Write-Host '  [ INFO ]  Services already running (will be skipped):' -ForegroundColor Yellow
    foreach ($s in ($alreadyUp | Sort-Object)) { Write-Host "           $s" -ForegroundColor Yellow }
    Write-Host ''
}

Write-Host ''
Write-OK 'Stage 1 complete -- infrastructure is READY.'


# =============================================================================
#  STAGE 2 — Backend Service Invocation
#  Launch order follows dependency chain:
#    iam → [+2s] tenant → config → audit → portal → [+2s] api-gateway
#  IAM is first because all other services validate JWTs against it at startup.
#  api-gateway is last because it requires all upstream services to be alive.
# =============================================================================
Write-Stage 'STAGE 2 of 3 -- Backend Service Ignition'

if ($alreadyUp.Contains('iam-service')) {
    Write-Skipped 'iam-service :3001 -- already running'
} else {
    Write-Launch 'Launching iam-service         :3001'
    Invoke-ServiceWindow -Title 'SME :: iam-service :3001' `
                         -NpmScript 'start:dev:iam' `
                         -Color '#0078d4'
}

Write-Info 'Pausing 2s -- IAM must be initialising before dependants start...'
Start-Sleep -Seconds 2

if ($alreadyUp.Contains('tenant-service')) {
    Write-Skipped 'tenant-service :3002 -- already running'
} else {
    Write-Launch 'Launching tenant-service       :3002'
    Invoke-ServiceWindow -Title 'SME :: tenant-service :3002' `
                         -NpmScript 'start:dev:tenant' `
                             -Color '#107c10' `
                             -ShowWindow $false
}

if ($alreadyUp.Contains('config-service')) {
    Write-Skipped 'config-service :3003 -- already running'
} else {
    Write-Launch 'Launching config-service       :3003'
    Invoke-ServiceWindow -Title 'SME :: config-service :3003' `
                         -NpmScript 'start:dev:config' `
                             -Color '#b146c2' `
                             -ShowWindow $false
}

if ($alreadyUp.Contains('audit-service')) {
    Write-Skipped 'audit-service :3004 -- already running'
} else {
    Write-Launch 'Launching audit-service        :3004'
    Invoke-ServiceWindow -Title 'SME :: audit-service :3004' `
                         -NpmScript 'start:dev:audit' `
                             -Color '#d83b01' `
                             -ShowWindow $false
}

if ($alreadyUp.Contains('portal-service')) {
    Write-Skipped 'portal-service :3005 -- already running'
} else {
    Write-Launch 'Launching portal-service       :3005'
    Invoke-ServiceWindow -Title 'SME :: portal-service :3005' `
                         -NpmScript 'start:dev:portal' `
                             -Color '#ca5010' `
                             -ShowWindow $false
}

Write-Info 'Pausing 2s -- waiting for all microservices before gateway...'
Start-Sleep -Seconds 2

if ($alreadyUp.Contains('api-gateway')) {
    Write-Skipped 'api-gateway :3000 -- already running'
} else {
    Write-Launch 'Launching api-gateway          :3000'
    Invoke-ServiceWindow -Title 'SME :: api-gateway :3000' `
                         -NpmScript 'start:dev:api-gateway' `
                             -Color '#005a9e' `
                             -ShowWindow $false
}

Write-Host ''
Write-OK 'Stage 2 complete -- all 6 backend services handled.'


# =============================================================================
#  STAGE 3 — Frontend Invocation
#  Frontends are launched last so Next.js does not attempt to call APIs
#  before the gateway is initialising.
# =============================================================================
Write-Stage 'STAGE 3 of 3 -- Frontend Service Ignition'

if ($alreadyUp.Contains('web-admin')) {
    Write-Skipped 'web-admin :3101 -- already running'
} else {
    Write-Launch 'Launching web-admin            :3101'
    Invoke-ServiceWindow -Title 'SME :: web-admin :3101' `
                         -NpmScript 'dev:web-admin' `
                             -Color '#008272' `
                             -ShowWindow $true
}

if ($alreadyUp.Contains('web-portal')) {
    Write-Skipped 'web-portal :3102 -- already running'
} else {
    Write-Launch 'Launching web-portal           :3102'
    Invoke-ServiceWindow -Title 'SME :: web-portal :3102' `
                         -NpmScript 'dev:web-portal' `
                             -Color '#744da9' `
                             -ShowWindow $true
}

Write-Host ''
Write-OK 'Stage 3 complete -- both frontends handled.'


# =============================================================================
#  BOOT SUMMARY
# =============================================================================
Write-Host ''
Write-Host '  +================================================================+' -ForegroundColor Green
Write-Host '  |                   SME Boot Sequence Complete                   |' -ForegroundColor Green
Write-Host '  +================================================================+' -ForegroundColor Green
Write-Host '  |  Infrastructure                                                 |' -ForegroundColor Green
Write-Host '  |    PostgreSQL     -> localhost:5432       (pre-existing)        |' -ForegroundColor Green
Write-Host '  |    RabbitMQ       -> amqp://localhost:5672                      |' -ForegroundColor Green
Write-Host '  |    Redis          -> redis://localhost:6379                     |' -ForegroundColor Green
Write-Host '  +================================================================+' -ForegroundColor Green
Write-Host '  |  Backend Services                                               |' -ForegroundColor Green
Write-Host '  |    api-gateway    -> http://localhost:3000                      |' -ForegroundColor Green
Write-Host '  |    iam-service    -> http://localhost:3001                      |' -ForegroundColor Green
Write-Host '  |    tenant-service -> http://localhost:3002                      |' -ForegroundColor Green
Write-Host '  |    config-service -> http://localhost:3003                      |' -ForegroundColor Green
Write-Host '  |    audit-service  -> http://localhost:3004                      |' -ForegroundColor Green
Write-Host '  |    portal-service -> http://localhost:3005                      |' -ForegroundColor Green
Write-Host '  +================================================================+' -ForegroundColor Green
Write-Host '  |  Frontends                                                      |' -ForegroundColor Green
Write-Host '  |    web-admin      -> http://localhost:3101  (sme.test:3101)     |' -ForegroundColor Green
Write-Host '  |    web-portal     -> http://localhost:3102  (sme.test:3102)     |' -ForegroundColor Green
Write-Host '  +================================================================+' -ForegroundColor Green
Write-Host '  |  NOTE: Services are still warming up. Allow 15-30s before      |' -ForegroundColor DarkYellow
Write-Host '  |  hitting endpoints. Run scripts/verify-health.js to confirm.   |' -ForegroundColor DarkYellow
Write-Host '  +================================================================+' -ForegroundColor Green
Write-Host ''
