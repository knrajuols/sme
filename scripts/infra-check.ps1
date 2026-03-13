$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

$overallOk = $true
$postgresReady = $false
$dockerReady = $false
$redisReady = $false
$rabbitReady = $false

function Write-Ok([string]$message) { Write-Host "[OK] $message" -ForegroundColor Green }
function Write-Warn([string]$message) { Write-Host "[WARN] $message" -ForegroundColor Yellow }
function Write-Err([string]$message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

function Invoke-External {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [switch]$Silent
  )

  if ($Silent) {
    & $FilePath @Arguments | Out-Null
  }
  else {
    & $FilePath @Arguments | Out-Host
  }

  return $LASTEXITCODE
}

function Get-EnvValue {
  param(
    [string]$FilePath,
    [string]$Key
  )

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  $line = Get-Content $FilePath | Where-Object {
    ($_ -match '^\s*' + [regex]::Escape($Key) + '\s*=') -and ($_ -notmatch '^\s*#')
  } | Select-Object -First 1

  if (-not $line) {
    return $null
  }

  $raw = ($line -split '=', 2)[1].Trim()
  if (($raw.StartsWith('"') -and $raw.EndsWith('"')) -or ($raw.StartsWith("'") -and $raw.EndsWith("'"))) {
    return $raw.Substring(1, $raw.Length - 2)
  }

  return $raw
}

function Get-PasswordFromDatabaseUrl {
  param([string]$DatabaseUrl)

  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    return $null
  }

  try {
    $uri = [System.Uri]$DatabaseUrl
    if ([string]::IsNullOrWhiteSpace($uri.UserInfo)) {
      return $null
    }

    $parts = $uri.UserInfo.Split(':', 2)
    if ($parts.Count -lt 2) {
      return $null
    }

    return [System.Uri]::UnescapeDataString($parts[1])
  }
  catch {
    return $null
  }
}

function Resolve-PostgresPassword {
  $envScopes = @('Process', 'User', 'Machine')
  foreach ($scope in $envScopes) {
    $devPassword = [Environment]::GetEnvironmentVariable('POSTGRES_PASSWORD_DEV', $scope)
    if (-not [string]::IsNullOrWhiteSpace($devPassword)) {
      return $devPassword
    }
  }

  $envFile = Join-Path $repoRoot '.env'
  $candidateKeys = @('POSTGRES_PASSWORD', 'DB_PASSWORD', 'DATABASE_PASSWORD')

  foreach ($key in $candidateKeys) {
    $value = Get-EnvValue -FilePath $envFile -Key $key
    if (-not [string]::IsNullOrWhiteSpace($value) -and $value.StartsWith('Ols')) {
      return $value
    }
  }

  $databaseUrl = Get-EnvValue -FilePath $envFile -Key 'DATABASE_URL'
  $urlPassword = Get-PasswordFromDatabaseUrl -DatabaseUrl $databaseUrl
  if (-not [string]::IsNullOrWhiteSpace($urlPassword) -and $urlPassword.StartsWith('Ols')) {
    return $urlPassword
  }

  return $null
}

Write-Host '=== Infra Check (SME Local) ===' -ForegroundColor Cyan

$serviceName = 'postgresql-x64-18'
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
  Write-Warn "Postgres Windows service '$serviceName' not found."
}
else {
  if ($service.Status -ne 'Running') {
    try {
      Start-Service -Name $serviceName -ErrorAction Stop
      Write-Ok "Started Windows service '$serviceName'."
    }
    catch {
      $overallOk = $false
      Write-Err "Failed to start Windows service '$serviceName'."
      Write-Warn 'Run terminal as Administrator to manage Windows services.'
      Write-Warn $_.Exception.Message
    }
  }
  else {
    Write-Ok "Windows service '$serviceName' is already running."
  }
}

$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path $psqlPath)) {
  $overallOk = $false
  Write-Err "psql not found at: $psqlPath"
  Write-Warn 'Install PostgreSQL 18 client tools or update this script path.'
}
else {
  $password = Resolve-PostgresPassword
  $previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD')

  if (-not [string]::IsNullOrWhiteSpace($password)) {
    $env:PGPASSWORD = $password
    Write-Ok 'Using password from POSTGRES_PASSWORD_DEV/.env for psql check.'
  }
  else {
    Write-Warn 'No dev password found (POSTGRES_PASSWORD_DEV or .env value starting with Ols). psql may prompt for password.'
  }

  Push-Location $repoRoot
  try {
    $psqlExit = Invoke-External -FilePath $psqlPath -Arguments @('-w', '-U', 'postgres', '-d', 'sme_tenant', '-c', 'select 1;')
    if ($psqlExit -eq 0) {
      $postgresReady = $true
      Write-Ok 'Postgres readiness check passed.'
    }
    else {
      $overallOk = $false
      Write-Err "Postgres readiness check failed (exit code $psqlExit)."
    }
  }
  catch {
    $overallOk = $false
    Write-Err 'Postgres readiness check failed with exception.'
    Write-Warn $_.Exception.Message
  }
  finally {
    if ($null -ne $previousPassword) {
      $env:PGPASSWORD = $previousPassword
    }
    else {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
    Pop-Location
  }
}

try {
  $dockerPsExit = Invoke-External -FilePath 'docker' -Arguments @('ps') -Silent
  if ($dockerPsExit -eq 0) {
    $dockerReady = $true
    Write-Ok 'Docker is available.'
  }
  else {
    $overallOk = $false
    Write-Err "Docker command failed with exit code $dockerPsExit. Ensure Docker Desktop is running."
  }
}
catch {
  $overallOk = $false
  Write-Err 'Docker command failed. Ensure Docker Desktop is running and docker CLI is available.'
  Write-Warn $_.Exception.Message
}

if ($dockerReady) {
  $runningContainers = docker ps --format '{{.Names}}'
  $targets = @('sme-redis', 'sme-rabbitmq')

  foreach ($container in $targets) {
    if ($runningContainers -contains $container) {
      Write-Ok "$container is already running."
    }
    else {
      try {
        $startExit = Invoke-External -FilePath 'docker' -Arguments @('start', $container)
        if ($startExit -eq 0) {
          Write-Ok "Started $container."
        }
        else {
          $overallOk = $false
          Write-Err "Failed to start container $container (exit code $startExit)."
        }
      }
      catch {
        $overallOk = $false
        Write-Err "Failed to start container $container."
        Write-Warn $_.Exception.Message
      }
    }

    try {
      $updateExit = Invoke-External -FilePath 'docker' -Arguments @('update', '--restart', 'unless-stopped', $container)
      if ($updateExit -eq 0) {
        Write-Ok "Set restart policy for $container to unless-stopped."
      }
      else {
        $overallOk = $false
        Write-Err "Failed to set restart policy for $container (exit code $updateExit)."
      }
    }
    catch {
      $overallOk = $false
      Write-Err "Failed to set restart policy for $container."
      Write-Warn $_.Exception.Message
    }
  }

  $finalRunning = docker ps --format '{{.Names}}'
  $redisReady = $finalRunning -contains 'sme-redis'
  $rabbitReady = $finalRunning -contains 'sme-rabbitmq'
  if (-not $redisReady) {
    $overallOk = $false
    Write-Err 'sme-redis is not running.'
  }
  if (-not $rabbitReady) {
    $overallOk = $false
    Write-Err 'sme-rabbitmq is not running.'
  }
}

Write-Host ''
Write-Host '=== Infra Summary ===' -ForegroundColor Cyan
Write-Host ("Postgres Ready : " + ($(if ($postgresReady) { 'GREEN' } else { 'RED' }))) -ForegroundColor $(if ($postgresReady) { 'Green' } else { 'Red' })
Write-Host ("Docker Ready   : " + ($(if ($dockerReady) { 'GREEN' } else { 'RED' }))) -ForegroundColor $(if ($dockerReady) { 'Green' } else { 'Red' })
Write-Host ("Redis Running  : " + ($(if ($redisReady) { 'GREEN' } else { 'RED' }))) -ForegroundColor $(if ($redisReady) { 'Green' } else { 'Red' })
Write-Host ("Rabbit Running : " + ($(if ($rabbitReady) { 'GREEN' } else { 'RED' }))) -ForegroundColor $(if ($rabbitReady) { 'Green' } else { 'Red' })

if ($overallOk) {
  Write-Host 'Overall: GREEN' -ForegroundColor Green
  exit 0
}

Write-Host 'Overall: RED' -ForegroundColor Red
exit 1
