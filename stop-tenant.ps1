# stop-tenant.ps1
# Finds and forcefully kills the tenant-service process listening on Port 3002.
# Releases all file locks (including Prisma engine binaries) so prisma db push can proceed.
# Must be run from an ELEVATED (Admin) PowerShell.

Write-Host "Stopping tenant-service (port 3002)..." -ForegroundColor Cyan

$conns = Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue

if ($conns) {
    foreach ($c in $conns) {
        Write-Host "  Killing PID $($c.OwningProcess)" -ForegroundColor Yellow
        taskkill /F /PID $($c.OwningProcess) /T 2>&1 | Out-Null
        Stop-Process -Id $($c.OwningProcess) -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2

    # Verify port is now free
    $still = Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host "  [FAIL] Port 3002 is still occupied. Try running as Administrator." -ForegroundColor Red
        exit 1
    }
    Write-Host "  tenant-service stopped. Port 3002 is now free." -ForegroundColor Green
} else {
    Write-Host "  Port 3002 is already free." -ForegroundColor DarkGray
}
