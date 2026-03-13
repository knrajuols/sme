$lines = [System.IO.File]::ReadAllLines('c:\projects\SME\scripts\launch-local.ps1', [System.Text.Encoding]::UTF8)
foreach ($idx in @(136,137,138,139,207,208,209,210)) {
    $l = $lines[$idx - 1]
    $codes = ($l.ToCharArray() | ForEach-Object {
        $cp = [int]$_
        if ($cp -gt 127) { "[U+{0:X4}]" -f $cp } else { "$_" }
    }) -join ''
    Write-Host "L${idx}: $codes"
}
