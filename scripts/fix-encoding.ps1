$bytes = [System.IO.File]::ReadAllBytes('c:\projects\SME\scripts\launch-local.ps1')
Write-Host ("First 3 bytes: 0x{0:X2} 0x{1:X2} 0x{2:X2}" -f $bytes[0], $bytes[1], $bytes[2])
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "File has UTF-8 BOM - encoding is correct"
} else {
    Write-Host "MISSING UTF-8 BOM - PowerShell 5.1 will mis-read Unicode chars"
    # Re-write file with BOM
    $content = [System.IO.File]::ReadAllText('c:\projects\SME\scripts\launch-local.ps1', [System.Text.Encoding]::UTF8)
    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText('c:\projects\SME\scripts\launch-local.ps1', $content, $utf8Bom)
    Write-Host "Fixed: UTF-8 BOM written to file"
}
