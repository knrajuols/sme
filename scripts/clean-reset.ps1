$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$requiredPorts = @(3000, 3001, 3002, 3003, 3004, 3101, 3102)

function Write-Ok([string]$message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Write-Warn([string]$message) { Write-Host "[WARN] $message" -ForegroundColor Yellow }
function Write-Err([string]$message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

function Get-ListenersForPort {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return $connections | Select-Object -ExpandProperty OwningProcess -Unique
  }
  catch {
    return @()
  }
}

Write-Host '=== SME Clean Reset ===' -ForegroundColor Cyan

Write-Host 'Stopping node listeners bound to SME ports...'
foreach ($port in $requiredPorts) {
  $pids = Get-ListenersForPort -Port $port
  foreach ($procId in $pids) {
    try {
      $proc = Get-Process -Id $procId -ErrorAction Stop
      $isNode = $proc.ProcessName -eq 'node'
      if ($isNode) {
        $path = $null
        try { $path = $proc.Path } catch { $path = $null }

        if ($path -and $path -like '*Adobe*') {
          Write-Warn "Skipping Adobe node process PID $procId on port $port."
        }
        else {
          Stop-Process -Id $procId -Force -ErrorAction Stop
          Write-Ok "Stopped node PID $procId on port $port."
        }
      }
      else {
        Write-Warn "Port $port owned by non-node PID $procId ($($proc.ProcessName)); not killed."
      }
    }
    catch {
      Write-Warn "Could not inspect or stop PID $procId on port $port."
    }
  }
}

Write-Host 'Stopping remaining non-Adobe node processes...'
$allNode = Get-Process node -ErrorAction SilentlyContinue
foreach ($proc in $allNode) {
  $path = $null
  try { $path = $proc.Path } catch { $path = $null }

  if ($path -and $path -like '*Adobe*') {
    Write-Warn "Skipping Adobe node PID $($proc.Id)."
    continue
  }

  try {
    Stop-Process -Id $proc.Id -Force -ErrorAction Stop
    Write-Ok "Stopped node PID $($proc.Id)."
  }
  catch {
    Write-Warn "Could not stop node PID $($proc.Id)."
  }
}

Push-Location $repoRoot
try {
  & powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir 'ports-guard.ps1')
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Clean reset completed with remaining occupied ports.'
    exit 1
  }
}
finally {
  Pop-Location
}

Write-Host 'Clean reset completed successfully.' -ForegroundColor Green
exit 0
