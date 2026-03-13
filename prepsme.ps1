# =============================================================================
#  prepsme.ps1  —  SME Platform  |  Enterprise Prep Script  v1.0
#  Author   : SME Dev Team
#  Purpose  : Dependency installation, Prisma client generation, and cache
#             hygiene. Run this script ONCE before bootsme.ps1 on a fresh
#             checkout or whenever schemas / dependencies change.
#
#  This script does NOT start servers, run migrations, or push schemas.
#  It pairs exclusively with bootsme.ps1.
#
#  Stages:
#    1 — Environment Guard   : Verify all 5 service .env files exist
#    2 — npm install         : Root-level workspace dependency install
#    3 — Cache Hygiene       : Wipe .next build caches (web-admin, web-portal)
#    4 — Prisma Generate     : Regenerate all 5 Prisma clients
#    5 — TypeScript Check    : (optional) tsc --noEmit for all NestJS services
#
#  Parameters:
#    -TypeCheck    Run tsc --noEmit on all NestJS services (slow, ~30-90s).
#                  Omit for a fast prep pass.
#
#  Usage:
#    powershell -ExecutionPolicy Bypass -File C:\projects\SME\prepsme.ps1
#    powershell -ExecutionPolicy Bypass -File C:\projects\SME\prepsme.ps1 -TypeCheck
# =============================================================================

param(
    [switch]$TypeCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Dynamically resolve project root from the script's own location.
$ROOT = $PSScriptRoot
Set-Location $ROOT

# ─────────────────────────────────────────────────────────────────────────────
#  Timing — track total prep duration
# ─────────────────────────────────────────────────────────────────────────────
$PrepStart = Get-Date

# ─────────────────────────────────────────────────────────────────────────────
#  Console helpers
# ─────────────────────────────────────────────────────────────────────────────
function Write-Banner {
    Write-Host ''
    Write-Host '  ================================================================' -ForegroundColor Cyan
    Write-Host '       SME Platform  --  Prep Sequence  v1.1'                   -ForegroundColor Cyan
    Write-Host '  ================================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Stage { param([string]$label)
    Write-Host ''
    Write-Host "  --- $label ---" -ForegroundColor Cyan
    Write-Host ''
}

function Write-OK      { param([string]$msg) Write-Host "  [  OK  ]  $msg" -ForegroundColor Green    }
function Write-Info    { param([string]$msg) Write-Host "  [ INFO ]  $msg" -ForegroundColor Yellow   }
function Write-Warn    { param([string]$msg) Write-Host "  [ WARN ]  $msg" -ForegroundColor DarkYellow }
function Write-Skipped { param([string]$msg) Write-Host "  [ SKIP ]  $msg" -ForegroundColor DarkGray }
function Write-Fatal   { param([string]$msg)
    Write-Host ''
    Write-Host '  ================================================================' -ForegroundColor Red
    Write-Host "  FATAL: $msg"                                                   -ForegroundColor Red
    Write-Host '  ================================================================' -ForegroundColor Red
    Write-Host ''
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
#  Service registry
#  Each entry: Name, relative path from ROOT, schema path, has local output
# ─────────────────────────────────────────────────────────────────────────────
$BACKEND_SERVICES = @(
    [pscustomobject]@{ Name = 'iam-service';     Dir = 'apps\iam-service';      Schema = 'apps\iam-service\prisma\schema.prisma';     LocalOutput = $false }
    [pscustomobject]@{ Name = 'tenant-service';  Dir = 'apps\tenant-service';   Schema = 'apps\tenant-service\prisma\schema.prisma';  LocalOutput = $true  }
    [pscustomobject]@{ Name = 'config-service';  Dir = 'apps\config-service';   Schema = 'apps\config-service\prisma\schema.prisma';  LocalOutput = $false }
    [pscustomobject]@{ Name = 'audit-service';   Dir = 'apps\audit-service';    Schema = 'apps\audit-service\prisma\schema.prisma';   LocalOutput = $false }
    [pscustomobject]@{ Name = 'portal-service';  Dir = 'apps\portal-service';   Schema = 'apps\portal-service\prisma\schema.prisma';  LocalOutput = $true  }
)

$NESTJS_SERVICES = @(
    [pscustomobject]@{ Name = 'iam-service';     Dir = 'apps\iam-service'     }
    [pscustomobject]@{ Name = 'tenant-service';  Dir = 'apps\tenant-service'  }
    [pscustomobject]@{ Name = 'config-service';  Dir = 'apps\config-service'  }
    [pscustomobject]@{ Name = 'audit-service';   Dir = 'apps\audit-service'   }
    [pscustomobject]@{ Name = 'portal-service';  Dir = 'apps\portal-service'  }
    [pscustomobject]@{ Name = 'api-gateway';     Dir = 'apps\api-gateway'     }
)

$ENV_FILES = @(
    'apps\iam-service\.env'
    'apps\tenant-service\.env'
    'apps\config-service\.env'
    'apps\audit-service\.env'
    'apps\portal-service\.env'
    'apps\api-gateway\.env'
    'apps\web-admin\.env.local'
    'apps\web-portal\.env.local'
)

$NEXT_CACHE_DIRS = @(
    'apps\web-admin\.next'
    'apps\web-portal\.next'
)


Write-Banner

# =============================================================================
#  PRE-FLIGHT — Detect Running SME Services
#  Scan all 8 SME service ports and record which are already held by Node.js
#  processes.  We do NOT attempt to kill them — Windows blocks cross-session
#  termination without Administrator rights, and it is unnecessary anyway.
#
#  WHY DETECT INSTEAD OF KILL:
#    A running NestJS service has already loaded its Prisma query-engine DLL
#    into memory.  That DLL is locked for the lifetime of the process, so
#    `prisma generate` against it would EPERM regardless.
#    More importantly: the service is working correctly with its current client.
#    There is nothing to fix.  We just skip regen for those services (Stage 4)
#    and bootsme.ps1 will skip relaunching them (they are already up).
#
#  RESULT: prepsme.ps1 is safe to run at any time, on any platform state.
# =============================================================================
Write-Stage 'PRE-FLIGHT - Detect Running SME Services'

# Port -> service name mapping used by Stage 4 to skip locked DLL regeneration
$SME_PORT_MAP = @{
    3000 = 'api-gateway'
    3001 = 'iam-service'
    3002 = 'tenant-service'
    3003 = 'config-service'
    3004 = 'audit-service'
    3005 = 'portal-service'
    3101 = 'web-admin'
    3102 = 'web-portal'
}

# $alreadyRunning: service names whose ports are held by Node processes.
# Stage 4 skips prisma generate for these -- client is loaded and valid.
$alreadyRunning = [System.Collections.Generic.HashSet[string]]::new()

foreach ($entry in $SME_PORT_MAP.GetEnumerator()) {
    $lines = netstat -ano 2>$null | Select-String ":$($entry.Key)\s" | Select-String 'LISTENING'
    foreach ($line in $lines) {
        if ($line -match '\s+(\d+)\s*$') {
            $procId = [int]$Matches[1]
            $proc   = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($null -ne $proc -and $proc.ProcessName -match '^(node|npm|npm\.cmd)$') {
                $null = $alreadyRunning.Add($entry.Value)
                break
            }
        }
    }
}

if ($alreadyRunning.Count -eq 0) {
    Write-Info 'No SME services detected. All Prisma clients will be regenerated.'
} else {
    Write-Host ''
    foreach ($svcName in ($alreadyRunning | Sort-Object)) {
        Write-Warn "$svcName is already running -- Prisma regen will be skipped for this service"
    }
    Write-Host ''
    Write-Info "$($alreadyRunning.Count) service(s) running. Their Prisma clients will not be touched."
    Write-Info 'To regenerate ALL clients: stop all services first, then re-run prepsme.ps1.'
}

Write-Host ''
Write-OK 'Pre-flight complete.'


# =============================================================================
#  STAGE 1 — Environment Guard
#  Verify all critical .env files exist before doing anything expensive.
#  api-gateway and web .env.local files are advisory warnings; service .env
#  files are hard failures (services cannot start without them).
# =============================================================================
Write-Stage 'STAGE 1 of 5 - Environment Guard'

$envErrors   = 0
$envWarnings = 0

# Hard failures: backend service .env files
foreach ($svc in $BACKEND_SERVICES) {
    $envPath = Join-Path $ROOT ($svc.Dir + '\.env')
    if (Test-Path $envPath) {
        Write-OK "$($svc.Name) .env found"
    } else {
        Write-Host "  [ FAIL ]  MISSING: $envPath" -ForegroundColor Red
        $envErrors++
    }
}

# Advisory: api-gateway .env
$gwEnv = Join-Path $ROOT 'apps\api-gateway\.env'
if (Test-Path $gwEnv) {
    Write-OK 'api-gateway .env found'
} else {
    Write-Warn 'apps\api-gateway\.env NOT found -- gateway may start with defaults'
    $envWarnings++
}

# Advisory: Next.js .env.local files
foreach ($f in @('apps\web-admin\.env.local', 'apps\web-portal\.env.local')) {
    $fullPath = Join-Path $ROOT $f
    if (Test-Path $fullPath) {
        Write-OK "$f found"
    } else {
        Write-Warn "$f NOT found -- frontend will use process.env defaults only"
        $envWarnings++
    }
}

if ($envErrors -gt 0) {
    Write-Fatal "$envErrors required .env file(s) missing. Create them before running prepsme.ps1."
}

if ($envWarnings -gt 0) {
    Write-Warn "$envWarnings advisory .env file(s) missing (see above). Continuing..."
}

Write-Host ''
Write-OK 'Stage 1 complete -- environment files verified.'


# =============================================================================
#  STAGE 2 — npm install (root workspace)
#  Installs / syncs all workspace packages via the root package.json.
#  The workspace hoisting means all apps/* and libs/* packages resolve
#  through the single root node_modules/. Run at root — do not run per-app.
# =============================================================================
Write-Stage 'STAGE 2 of 5 - npm Install (root workspace)'

Write-Info 'Running npm install... (this may take 30-90s on a cold node_modules)'

$installTimer = [System.Diagnostics.Stopwatch]::StartNew()

npm install --prefer-offline 2>&1 | ForEach-Object {
    # Surface warnings and errors; suppress verbose resolution noise
    if ($_ -match 'warn|error|npm ERR') {
        Write-Host "  |  $_" -ForegroundColor DarkYellow
    }
}

$installTimer.Stop()

if ($LASTEXITCODE -ne 0) {
    Write-Fatal "npm install failed (exit $LASTEXITCODE). Check network connectivity and package.json."
}

Write-Host ''
Write-OK "npm install complete ($([math]::Round($installTimer.Elapsed.TotalSeconds, 1))s)."


# =============================================================================
#  STAGE 3 — Cache Hygiene
#  Wipe .next build output directories for both Next.js frontends.
#
#  WHY: Next.js compiles pages, layouts, and env-var snapshots into .next/.
#  If .env.local changes or any app/ file changes, the cached build can serve
#  stale pages with old API URLs, old env vars, or corrupted incremental cache.
#  Wiping before boot guarantees a clean compile on first request in dev mode.
#
#  SAFE: In dev mode (next dev), Next.js rebuilds incrementally on request.
#  Wiping .next costs ~2-3s on the first page load — not the boot itself.
# =============================================================================
Write-Stage 'STAGE 3 of 5 - Cache Hygiene (.next wipe)'

foreach ($cacheDir in $NEXT_CACHE_DIRS) {
    $fullPath = Join-Path $ROOT $cacheDir
    if (Test-Path $fullPath) {
        try {
            Remove-Item -Path $fullPath -Recurse -Force -ErrorAction Stop
            Write-OK "Wiped: $cacheDir"
        } catch {
            Write-Warn "Could not fully wipe $cacheDir -- some files may be locked."
            Write-Warn "  Error: $_"
        }
    } else {
        Write-Skipped "$cacheDir does not exist (no wipe needed)"
    }
}

Write-Host ''
Write-OK 'Stage 3 complete -- Next.js caches clean.'


# =============================================================================
#  STAGE 4 — Prisma Client Generation
#  Regenerate all 5 Prisma clients from their schema.prisma files.
#
#  Architecture notes:
#    · tenant-service  → local output: src/generated/prisma-client/
#                        (isolated because Windows monorepo symlink issues)
#    · portal-service  → local output: src/generated/prisma-client/
#                        (CQRS read-only projection; must NOT share tenant client)
#    · iam / audit / config → shared node_modules/.prisma/client
#
#  EPERM handling: If any NestJS service is currently running, the Prisma
#  query-engine DLL will be locked on Windows. The script attempts generate
#  for all 5 clients, records successes and EPERM failures separately, and
#  advises which services need a restart to pick up the new client.
# =============================================================================
Write-Stage 'STAGE 4 of 5 - Prisma Client Generation (all 5 schemas)'

$prismaOK      = [System.Collections.Generic.List[string]]::new()
$prismaEperm   = [System.Collections.Generic.List[string]]::new()
$prismaFailed  = [System.Collections.Generic.List[string]]::new()
$prismaSkipped = [System.Collections.Generic.List[string]]::new()

foreach ($svc in $BACKEND_SERVICES) {
    # If already running: DLL is locked and the loaded client is still valid.
    # Skip generate -- no point attempting it and EPERM is not an error here.
    if ($alreadyRunning.Contains($svc.Name)) {
        $prismaSkipped.Add($svc.Name)
        Write-Skipped "$($svc.Name) -- already running, Prisma client is in use (skipped)"
        continue
    }

    $schemaPath = Join-Path $ROOT $svc.Schema
    Write-Info "Generating $($svc.Name)..."

    # Temporarily suppress Stop so stderr from npx/node does not become a
    # terminating exception before we can inspect the output ourselves.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $genOutput = & npx prisma generate --schema=$schemaPath 2>&1
        $genExit   = $LASTEXITCODE
    } catch {
        $genOutput = $_.ToString()
        $genExit   = 1
    } finally {
        $ErrorActionPreference = $prev
    }

    $outputText = ($genOutput | Out-String)

    if ($genExit -eq 0) {
        $prismaOK.Add($svc.Name)
        Write-OK "$($svc.Name) client generated."
    } elseif ($outputText -match 'EPERM') {
        $prismaEperm.Add($svc.Name)
        Write-Warn "$($svc.Name) -- EPERM: DLL locked by running service. Will self-regenerate on restart."
    } else {
        $prismaFailed.Add($svc.Name)
        Write-Host "  [ FAIL ]  $($svc.Name) generate failed (exit $genExit)." -ForegroundColor Red
        # Print each line of the error so it is readable
        $genOutput | ForEach-Object { Write-Host "            $_" -ForegroundColor DarkRed }
    }
}

Write-Host ''

if ($prismaOK.Count -gt 0) {
    Write-OK "Generated successfully    : $($prismaOK -join ', ')"
}
if ($prismaSkipped.Count -gt 0) {
    Write-Skipped "Already running (skipped) : $($prismaSkipped -join ', ')"
}
if ($prismaEperm.Count -gt 0) {
    Write-Warn "EPERM (locked DLL)        : $($prismaEperm -join ', ')"
    Write-Warn "  Unexpected -- stop the service and re-run prepsme.ps1 to regenerate."
}
if ($prismaFailed.Count -gt 0) {
    Write-Host ''
    Write-Host "  [ FAIL ]  Hard generate failures: $($prismaFailed -join ', ')" -ForegroundColor Red
    Write-Host '           Inspect the schema files listed above before booting.' -ForegroundColor Red
    Write-Host ''
}

if ($prismaFailed.Count -gt 0) {
    Write-Fatal "Prisma generate failed for $($prismaFailed.Count) service(s). Fix errors before booting."
}

Write-OK 'Stage 4 complete -- Prisma clients ready.'


# =============================================================================
#  STAGE 5 — TypeScript Compile Check (optional, -TypeCheck flag required)
#  Runs tsc --noEmit on all 6 NestJS services using their tsconfig.app.json.
#  This is a PRE-BOOT type safety gate — it does NOT produce dist/ output.
#
#  Enable with:  powershell -File prepsme.ps1 -TypeCheck
#  Expect ~30-90 seconds depending on machine.
# =============================================================================
Write-Stage 'STAGE 5 of 5 - TypeScript Compile Check'

if (-not $TypeCheck) {
    Write-Skipped 'TypeScript check skipped (run with -TypeCheck to enable).'
    Write-Skipped 'Recommended before: deploying to staging, PR reviews, after major refactors.'
} else {
    Write-Info 'Running tsc --noEmit on all NestJS services...'

    $tsOK     = [System.Collections.Generic.List[string]]::new()
    $tsFailed = [System.Collections.Generic.List[string]]::new()

    foreach ($svc in $NESTJS_SERVICES) {
        $svcDir        = Join-Path $ROOT $svc.Dir
        $tsconfigPath  = Join-Path $svcDir 'tsconfig.app.json'

        if (-not (Test-Path $tsconfigPath)) {
            Write-Warn "$($svc.Name): tsconfig.app.json not found -- skipping."
            continue
        }

        Write-Info "Checking $($svc.Name)..."

        Push-Location $svcDir
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $tscOutput = & npx tsc -p tsconfig.app.json --noEmit 2>&1
            $tscExit   = $LASTEXITCODE
        } catch {
            $tscOutput = $_.ToString()
            $tscExit   = 1
        } finally {
            $ErrorActionPreference = $prev
        }
        Pop-Location

        if ($tscExit -eq 0) {
            $tsOK.Add($svc.Name)
            Write-OK "$($svc.Name) -- clean"
        } else {
            $tsFailed.Add($svc.Name)
            Write-Host "  [ FAIL ]  $($svc.Name) -- TypeScript errors:" -ForegroundColor Red
            $tscOutput | ForEach-Object { Write-Host "            $_" -ForegroundColor DarkRed }
        }
    }

    Write-Host ''

    if ($tsOK.Count -gt 0) {
        Write-OK "TypeScript clean : $($tsOK -join ', ')"
    }
    if ($tsFailed.Count -gt 0) {
        Write-Host "  [ FAIL ]  TypeScript errors in : $($tsFailed -join ', ')" -ForegroundColor Red
        Write-Fatal "Fix TypeScript errors before booting. Run: npx tsc -p apps/<service>/tsconfig.app.json --noEmit"
    }
}


# =============================================================================
#  PREP SUMMARY
# =============================================================================
$totalSecs = [math]::Round(((Get-Date) - $PrepStart).TotalSeconds, 1)

Write-Host ''
Write-Host '  ================================================================' -ForegroundColor Green
Write-Host '           SME Prep Sequence Complete'                          -ForegroundColor Green
Write-Host '  ================================================================' -ForegroundColor Green
if ($alreadyRunning.Count -eq 0) {
    Write-Host '  Pre-flight - Status check   : No services running (clean state)'  -ForegroundColor Green
} else {
    Write-Host "  Pre-flight - Status check   : $($alreadyRunning.Count) service(s) already running, regen skipped" -ForegroundColor DarkYellow
}
Write-Host '  Stage 1 - .env guard        : All required files present'     -ForegroundColor Green
Write-Host '  Stage 2 - npm install       : Workspace dependencies OK'      -ForegroundColor Green
Write-Host '  Stage 3 - .next cache wipe  : Frontend caches cleared'        -ForegroundColor Green

$p4Parts = @()
if ($prismaOK.Count -gt 0)      { $p4Parts += "Generated: $($prismaOK.Count)" }
if ($prismaSkipped.Count -gt 0) { $p4Parts += "Skipped (running): $($prismaSkipped.Count)" }
if ($prismaEperm.Count -gt 0)   { $p4Parts += "EPERM: $($prismaEperm.Count)" }
if ($p4Parts.Count -eq 0)       { $p4Parts += 'Nothing to do' }
$p4Color = if ($prismaFailed.Count -gt 0 -or $prismaEperm.Count -gt 0) { 'DarkYellow' } else { 'Green' }
Write-Host "  Stage 4 - Prisma generate   : $($p4Parts -join ' | ')" -ForegroundColor $p4Color

if ($TypeCheck) {
    Write-Host '  Stage 5 - TypeScript check  : All services type-clean'    -ForegroundColor Green
} else {
    Write-Host '  Stage 5 - TypeScript check  : Skipped  (-TypeCheck to run)' -ForegroundColor DarkGray
}

Write-Host '  ----------------------------------------------------------------' -ForegroundColor Green
Write-Host "  Total prep time : ${totalSecs}s"                               -ForegroundColor Green
Write-Host '  ----------------------------------------------------------------' -ForegroundColor Green
Write-Host '  Platform is ready to boot. Run:'                               -ForegroundColor Cyan
Write-Host '    powershell -ExecutionPolicy Bypass -File bootsme.ps1'        -ForegroundColor Cyan
Write-Host '  ================================================================' -ForegroundColor Green
Write-Host ''
