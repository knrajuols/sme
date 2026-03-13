$ErrorActionPreference = 'Stop'

$requiredPorts = @(3000, 3001, 3002, 3003, 3004, 3101, 3102)
$overallOk = $true

function Write-Ok([string]$message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Write-Warn([string]$message) { Write-Host "[WARN] $message" -ForegroundColor Yellow }
function Write-Err([string]$message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

function Get-ListenersForPort {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    return $pids
  }
  catch {
    return @()
  }
}

function Get-ProcessInfo {
  param([int]$ProcessId)

  try {
    $proc = Get-Process -Id $ProcessId -ErrorAction Stop
    $path = $null
    try { $path = $proc.Path } catch { $path = $null }

    return [pscustomobject]@{
      Id = $proc.Id
      Name = $proc.ProcessName
      Path = $path
    }
  }
  catch {
    return [pscustomobject]@{
      Id = $ProcessId
      Name = '<unknown>'
      Path = $null
    }
  }
}

Write-Host '=== Ports Guard (SME Local) ===' -ForegroundColor Cyan

foreach ($port in $requiredPorts) {
  $pids = Get-ListenersForPort -Port $port

  if (-not $pids -or $pids.Count -eq 0) {
    Write-Ok "Port $port is free."
    continue
  }

  foreach ($procId in $pids) {
    $procInfo = Get-ProcessInfo -ProcessId $procId
    $nameLower = $procInfo.Name.ToLowerInvariant()

    if ($nameLower -eq 'node') {
      try {
        Stop-Process -Id $procInfo.Id -Force -ErrorAction Stop
        Write-Ok "Stopped node process PID $($procInfo.Id) on port $port."
      }
      catch {
        $overallOk = $false
        Write-Err "Failed to stop node PID $($procInfo.Id) on port $port."
        Write-Warn $_.Exception.Message
      }
    }
    else {
      $overallOk = $false
      Write-Warn "Port $port occupied by non-node process PID $($procInfo.Id) ($($procInfo.Name)). Not killed."
      if ($procInfo.Path) {
        Write-Warn "Process path: $($procInfo.Path)"
      }
    }
  }
}

Start-Sleep -Milliseconds 700

Write-Host ''
Write-Host '=== Final Port Status ===' -ForegroundColor Cyan
$occupied = @()
$occupiedProcessIds = @()
foreach ($port in $requiredPorts) {
  $pids = Get-ListenersForPort -Port $port
  if (-not $pids -or $pids.Count -eq 0) {
    Write-Ok "Port ${port}: FREE"
  }
  else {
    $occupied += $port
    $overallOk = $false
    foreach ($procId in $pids) {
      $occupiedProcessIds += $procId
      $procInfo = Get-ProcessInfo -ProcessId $procId
      Write-Warn "Port ${port}: LISTENING by PID $($procInfo.Id) ($($procInfo.Name))"
    }
  }
}

$adobeNode = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
  try {
    $_.Path -like '*Adobe*'
  }
  catch {
    $false
  }
}

if ($adobeNode) {
  $adobePids = @($adobeNode | Select-Object -ExpandProperty Id)
  $adobeOnSmePorts = @($occupiedProcessIds | Where-Object { $adobePids -contains $_ })

  if ($adobeOnSmePorts.Count -eq 0) {
    Write-Ok 'Adobe node process detected but not binding SME ports; ignored.'
  }
  else {
    $uniquePids = $adobeOnSmePorts | Sort-Object -Unique
    foreach ($pid in $uniquePids) {
      Write-Warn "Adobe node process PID $pid is binding an SME port and was not killed automatically."
    }
  }
}

if ($overallOk) {
  Write-Host 'Ports Guard Result: GREEN' -ForegroundColor Green
  exit 0
}

Write-Host 'Ports Guard Result: RED' -ForegroundColor Red
exit 1
