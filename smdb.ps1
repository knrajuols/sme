# =============================================================================
# monitor.ps1  -  SME Mission Control Dashboard Launcher
# Usage: .\monitor.ps1
# Opens: http://localhost:9999
# =============================================================================
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$ScriptDir     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$MonitorScript = Join-Path $ScriptDir 'sme-monitor.js'
$Port          = 9999
$Url           = "http://localhost:$Port"

# ── Log file (cleared on each run) ────────────────────────────────────────────
$LogFile = Join-Path $ScriptDir 'monitor-run.log'
Set-Content -Path $LogFile -Value '' -Encoding UTF8

function Write-Log {
    param([string]$Msg, [string]$Color = 'Gray')
    $ts  = Get-Date -Format 'HH:mm:ss'
    $line = "[$ts] $Msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host "  $line" -ForegroundColor $Color
}

Write-Log 'monitor.ps1 started' 'Cyan'

# ── Verify prerequisites ──────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Log '[ERROR] Node.js is not installed or not in PATH.' 'Red'
    Write-Log '        Please install Node.js from https://nodejs.org' 'Red'
    exit 1
}

# ── Ensure logs\pm2 directory exists (services log here) ─────────────────────
$pm2LogDir = Join-Path $ScriptDir 'logs\pm2'
if (-not (Test-Path $pm2LogDir)) {
    New-Item -ItemType Directory -Path $pm2LogDir -Force | Out-Null
    Write-Log "Created service log directory: $pm2LogDir" 'Green'
}

Write-Log 'Services are started directly (PM2 bypassed — incompatible with Node.js v24).' 'Gray'

if (-not (Test-Path $MonitorScript)) {
    Write-Log "[ERROR] sme-monitor.js not found at: $MonitorScript" 'Red'
    exit 1
}

# ── Kill any existing process already holding port 9999 ──────────────────────
Write-Log "Checking for existing instances on port $Port..."

$existingPids = @(
    netstat -ano 2>$null |
    Select-String (":$Port\s+\S+\s+LISTENING") |
    ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] } |
    Where-Object  { $_ -match '^\d+$' } |
    Select-Object -Unique
)

foreach ($ePid in $existingPids) {
    $ePid = $ePid.Trim()
    if ([string]::IsNullOrWhiteSpace($ePid)) { continue }
    try {
        $proc = Get-Process -Id ([int]$ePid) -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Log "Stopping previous instance (PID $ePid - $($proc.Name))..." 'Yellow'
            # Try normal Stop-Process first; fall back to taskkill /F for elevated processes
            $killed = $false
            try {
                Stop-Process -Id ([int]$ePid) -Force -ErrorAction Stop
                $killed = $true
            } catch { }
            if (-not $killed) {
                $result = (taskkill /F /PID $ePid 2>&1)
                $killed = ($LASTEXITCODE -eq 0)
            }
            if (-not $killed) {
                # Last resort: wmic (works even when running as a different user)
                $null = (wmic process where "processid=$ePid" delete 2>&1)
            }
        }
    } catch { }
}

if ($existingPids.Count -gt 0) { Start-Sleep -Milliseconds 700 }

# ── Start sme-monitor.js in a new console window ──────────────────────────────
Write-Log 'Starting Node.js monitor server...' 'Green'

$nodeExe = (Get-Command node).Source

# Start-Process opens a new visible console window so the user can see server logs
$proc = Start-Process `
    -FilePath          $nodeExe `
    -ArgumentList      "`"$MonitorScript`"" `
    -WorkingDirectory  $ScriptDir `
    -PassThru

Write-Log "Monitor PID : $($proc.Id)" 'Green'

# ── Wait for the server to accept HTTP connections (up to ~10 s) ─────────────
Write-Log 'Waiting for server to be ready...'

$ready    = $false
$attempts = 0
$maxTries = 20          # 20 × 700 ms ≈ 14 s

while (-not $ready -and $attempts -lt $maxTries) {
    Start-Sleep -Milliseconds 700
    $attempts++
    try {
        $null = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
        $ready = $true
        Write-Log "Server responded after $attempts attempt(s)" 'Green'
    } catch { }
}

# ── Open browser ──────────────────────────────────────────────────────────────
if ($ready) {
    Write-Log 'Server is ready. Opening dashboard...' 'Cyan'
} else {
    Write-Log 'Server is still starting - opening browser anyway.' 'Yellow'
}

Start-Process $Url

Write-Log "Dashboard -> $Url" 'Cyan'

# ── Auto-trigger Full Boot so services start on every fresh launch ────────────
if ($ready) {
    Write-Log 'Triggering Full Boot via monitor API...' 'Cyan'
    Start-Sleep -Milliseconds 1500   # give the browser a moment to connect SSE
    try {
        $body = '{"script":"fullboot"}'
        $null = Invoke-WebRequest -Uri "http://localhost:$Port/api/run-script" `
            -Method POST `
            -Body $body `
            -ContentType 'application/json' `
            -TimeoutSec 10 `
            -UseBasicParsing `
            -ErrorAction Stop
        Write-Log 'Full Boot started — watch progress in the Live Console on the dashboard.' 'Green'
    } catch {
        Write-Log "[WARN] Could not auto-trigger Full Boot: $_" 'Yellow'
        Write-Log '       Open the dashboard and click the Full Boot button manually.' 'Yellow'
    }
} else {
    Write-Log 'Monitor did not respond in time — open the dashboard and click Full Boot manually.' 'Yellow'
}

Write-Log 'Close the Node.js console window to stop the server.' 'Gray'
