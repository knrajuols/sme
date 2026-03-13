$env:PGPASSWORD = 'Olsbook55'
$q = "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename;"

$dbs = @('sme_tenant','sme_iam','sme_audit','sme_config')
$results = @()

foreach ($db in $dbs) {
    $tables = psql -U postgres -d $db -t -c $q 2>&1 | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' -and $_ -notmatch '^psql:' }
    $results += [PSCustomObject]@{
        Database = $db
        Count    = $tables.Count
        Tables   = if ($tables.Count -gt 0) { $tables -join ', ' } else { '(none)' }
    }
}

Write-Host ""
Write-Host "=============================================================="
Write-Host "   DATABASE TABLE VERIFICATION REPORT"
Write-Host "=============================================================="
$results | Format-Table -AutoSize
Write-Host "=============================================================="
