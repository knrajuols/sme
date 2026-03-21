# =============================================================================
#  kill-ghosts.ps1 — SME Platform | Ghost Process Killer
#
#  Kills orphaned node.exe processes tied to this SME project.
#  Safe to run anytime; skips VS Code, Docker, and non-SME node processes.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File scripts\kill-ghosts.ps1
# =============================================================================
param(
    [switch]$DryRun,
    [switch]$All   # Kill ALL node.exe processes (nuclear option)
)

$ROOT = Split-Path $PSScriptRoot -Parent
$killed = 0
$skipped = 0

Write-Host "`n  SME Ghost Process Killer" -ForegroundColor Cyan
Write-Host "  ========================`n" -ForegroundColor DarkCyan

if ($All) {
    Write-Host "  [WARN] Nuclear mode: killing ALL node.exe processes." -ForegroundColor Yellow
    $procs = Get-Process -Name node -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if ($DryRun) {
            Write-Host "  [DRY] Would kill PID $($p.Id)" -ForegroundColor DarkGray
        } else {
            try { Stop-Process -Id $p.Id -Force; Write-Host "  [KILL] PID $($p.Id)" -ForegroundColor Red }
            catch { Write-Host "  [SKIP] PID $($p.Id) — $($_.Exception.Message)" -ForegroundColor Yellow }
        }
        $killed++
    }
} else {
    # Targeted: only kill node.exe whose command line references this project
    $escapedRoot = [regex]::Escape($ROOT)
    $wmiProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue

    foreach ($proc in $wmiProcs) {
        $cmdLine = $proc.CommandLine
        if (-not $cmdLine) { $skipped++; continue }

        # Skip VS Code internal node processes
        if ($cmdLine -match 'extensionHost|vscode|electron') {
            $skipped++
            continue
        }

        # Only target processes from this project root
        if ($cmdLine -match $escapedRoot) {
            $desc = if ($cmdLine.Length -gt 80) { $cmdLine.Substring(0, 80) + '...' } else { $cmdLine }
            if ($DryRun) {
                Write-Host "  [DRY] Would kill PID $($proc.ProcessId): $desc" -ForegroundColor DarkGray
            } else {
                try {
                    Stop-Process -Id $proc.ProcessId -Force
                    Write-Host "  [KILL] PID $($proc.ProcessId): $desc" -ForegroundColor Red
                } catch {
                    Write-Host "  [SKIP] PID $($proc.ProcessId) — $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
            $killed++
        } else {
            $skipped++
        }
    }
}

# Also release SME ports (3000-3005, 3101, 3102)
$smePorts = @(3000, 3001, 3002, 3003, 3004, 3005, 3101, 3102)
$portKills = 0

foreach ($port in $smePorts) {
    $binding = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    foreach ($b in $binding) {
        $pid = $b.OwningProcess
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc -and $proc.Name -eq 'node') {
            if ($DryRun) {
                Write-Host "  [DRY] Would free port $port (PID $pid)" -ForegroundColor DarkGray
            } else {
                try {
                    Stop-Process -Id $pid -Force
                    Write-Host "  [PORT] Freed :$port (PID $pid)" -ForegroundColor Magenta
                } catch {}
            }
            $portKills++
        }
    }
}

Write-Host ""
if ($DryRun) {
    Write-Host "  DRY RUN: $killed process(es) would be killed, $portKills port(s) freed, $skipped skipped." -ForegroundColor Yellow
} else {
    $total = $killed + $portKills
    if ($total -eq 0) {
        Write-Host "  No ghost SME processes found. System is clean." -ForegroundColor Green
    } else {
        Write-Host "  Done: $killed process(es) killed, $portKills port(s) freed, $skipped skipped." -ForegroundColor Green
    }
}
Write-Host ""
