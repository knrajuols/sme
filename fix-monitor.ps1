$f = Get-Content C:\projects\SME\sme-monitor.js -Raw -Encoding UTF8

# --- 1. Replace synchronous buildPortPidMap with async PowerShell version ---
$old1 = "function buildPortPidMap() {`r`n  const map = {};" 
if ($f.Contains($old1)) { Write-Host "Found CRLF variant" } else {
  $old1 = "function buildPortPidMap() {`n  const map = {};"
  if ($f.Contains($old1)) { Write-Host "Found LF variant" } else { Write-Host "NOT FOUND"; exit 1 }
}

$new1 = @"
function buildPortPidMap() {
  return new Promise(function (resolve) {
    var psCmd = "Get-NetTCPConnection -State Listen | Select-Object LocalPort,OwningProcess | ConvertTo-Json -Compress";
    require('child_process').exec(
      'powershell -NoProfile -NonInteractive -Command "' + psCmd + '"',
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
      function (err, stdout) {
        var map = {};
        if (!err && stdout && stdout.trim()) {
          try {
            var raw  = JSON.parse(stdout.trim());
            var rows = Array.isArray(raw) ? raw : [raw];
            for (var i = 0; i < rows.length; i++) {
              var port = parseInt(rows[i].LocalPort,     10);
              var pid  = parseInt(rows[i].OwningProcess, 10);
              if (port && pid && !map[port]) map[port] = pid;
            }
          } catch (e) {}
        }
        resolve(map);
      }
    );
  });
}
"@

# Find the end of the old function to replace only it
$startIdx = $f.IndexOf("function buildPortPidMap() {")
if ($startIdx -lt 0) { Write-Host "buildPortPidMap not found"; exit 1 }

# Find "}" that closes it — count braces
$depth = 0
$endIdx = $startIdx
for ($i = $startIdx; $i -lt $f.Length; $i++) {
  if ($f[$i] -eq '{') { $depth++ }
  elseif ($f[$i] -eq '}') {
    $depth--
    if ($depth -eq 0) { $endIdx = $i; break }
  }
}

$oldBlock = $f.Substring($startIdx, $endIdx - $startIdx + 1)
Write-Host "Old block length: $($oldBlock.Length)"
Write-Host "First 60 chars of old: $($oldBlock.Substring(0, [Math]::Min(60, $oldBlock.Length)))"

$f2 = $f.Replace($oldBlock, $new1.Trim())

# --- 2. Fix handleAction: make async ---
$f2 = $f2.Replace("function handleAction(name, action) {", "async function handleAction(name, action) {")

# --- 3. Await the pidMap call in handleAction ---
$f2 = $f2.Replace("    const pidMap = buildPortPidMap();", "    const pidMap = await buildPortPidMap();")

if ($f2 -eq $f) {
  Write-Host "WARNING: No changes made!" -ForegroundColor Red
} else {
  [System.IO.File]::WriteAllText('C:\projects\SME\sme-monitor.js', $f2, [System.Text.UTF8Encoding]::new($false))
  $newLines = (Get-Content C:\projects\SME\sme-monitor.js).Count
  Write-Host "Done! File now has $newLines lines." -ForegroundColor Green
}
