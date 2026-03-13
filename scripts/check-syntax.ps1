$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
    "c:\projects\SME\scripts\launch-local.ps1",
    [ref]$null,
    [ref]$errors
) | Out-Null
if ($errors.Count -gt 0) {
    $errors | ForEach-Object {
        Write-Host "Line $($_.Extent.StartLineNumber): $($_.Message)"
    }
} else {
    Write-Host "No syntax errors found"
}
