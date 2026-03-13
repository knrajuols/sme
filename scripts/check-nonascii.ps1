$lines = [System.IO.File]::ReadAllLines('c:\projects\SME\scripts\launch-local.ps1', [System.Text.Encoding]::UTF8)
# Show all lines that have non-ASCII characters
for ($i = 0; $i -lt $lines.Count; $i++) {
    $l = $lines[$i]
    $hasNonAscii = $false
    foreach ($c in $l.ToCharArray()) {
        if ([int]$c -gt 127) { $hasNonAscii = $true; break }
    }
    if ($hasNonAscii) {
        $idx = $i + 1
        $codes = ($l.ToCharArray() | ForEach-Object {
            $cp = [int]$_
            if ($cp -gt 127) { "[U+{0:X4}]" -f $cp } else { "$_" }
        }) -join ''
        Write-Host "L${idx}: $codes"
    }
}
