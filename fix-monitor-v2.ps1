# fix-monitor-v2.ps1 — fix real bottleneck: async docker + fast netstat
$f = [System.IO.File]::ReadAllText('C:\projects\SME\sme-monitor.js', [System.Text.Encoding]::UTF8)

# ── 1. Replace Get-NetTCPConnection (slow) back to async netstat (171ms) ──
$oldNetTCP = @'
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
'@

$newNetstat = @'
function buildPortPidMap() {
  return new Promise(function (resolve) {
    require('child_process').exec(
      'netstat -ano',
      { encoding: 'utf8', timeout: 8000, windowsHide: true },
      function (err, stdout) {
        var map = {};
        if (!err && stdout) {
          var lines = stdout.split('\n');
          for (var i = 0; i < lines.length; i++) {
            var m = lines[i].trim().match(
              /^TCP\s+(?:[\d.]+|\[[\da-f:%]+\]):(\d+)\s+\S+\s+LISTENING\s+(\d+)/i
            );
            if (m) {
              var port = parseInt(m[1], 10);
              var pid  = parseInt(m[2], 10);
              if (port && pid && !map[port]) map[port] = pid;
            }
          }
        }
        resolve(map);
      }
    );
  });
}
'@

# ── 2. Make getDockerStatus async (exec instead of execSync) ──
$oldDocker = @'
function getDockerStatus(containerName) {
  try {
    return execSync(
      'docker inspect --format "{{.State.Status}}" ' + containerName,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
  } catch (_) {
    return null; // container not found or Docker daemon not running
  }
}
'@

$newDocker = @'
function getDockerStatus(containerName) {
  return new Promise(function (resolve) {
    require('child_process').exec(
      'docker inspect --format "{{.State.Status}}" ' + containerName,
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
      function (err, stdout) {
        if (err || !stdout) resolve(null);
        else resolve(stdout.trim());
      }
    );
  });
}
'@

# ── 3. Fix the call site: await getDockerStatus ──
$oldCallSite = @'
    // Docker check (synchronous â€" fast docker CLI call)
    let dockerStatus = null;
    if (c.docker) {
      dockerStatus = getDockerStatus(c.docker);
    }
'@

$newCallSite = @'
    // Docker check (async - non-blocking)
    let dockerStatus = null;
    if (c.docker) {
      dockerStatus = await getDockerStatus(c.docker);
    }
'@

# Apply substitutions
$f2 = $f
if ($f2.Contains($oldNetTCP.Trim())) {
    $f2 = $f2.Replace($oldNetTCP.Trim(), $newNetstat.Trim())
    Write-Host "OK: buildPortPidMap replaced" -ForegroundColor Green
} else {
    Write-Host "WARN: buildPortPidMap old text not found" -ForegroundColor Yellow
}

if ($f2.Contains($oldDocker.Trim())) {
    $f2 = $f2.Replace($oldDocker.Trim(), $newDocker.Trim())
    Write-Host "OK: getDockerStatus replaced" -ForegroundColor Green
} else {
    Write-Host "WARN: getDockerStatus old text not found" -ForegroundColor Yellow
}

if ($f2.Contains($oldCallSite.Trim())) {
    $f2 = $f2.Replace($oldCallSite.Trim(), $newCallSite.Trim())
    Write-Host "OK: docker call site replaced" -ForegroundColor Green
} else {
    # Try without the mojibake comment
    $oldCallSite2 = "    // Docker check (synchronous"
    $idx = $f2.IndexOf($oldCallSite2)
    if ($idx -ge 0) {
        # Find the closing brace of the if block - simple text replacement
        $snippet = "    let dockerStatus = null;`r`n    if (c.docker) {`r`n      dockerStatus = getDockerStatus(c.docker);`r`n    }"
        $replacement = "    let dockerStatus = null;`r`n    if (c.docker) {`r`n      dockerStatus = await getDockerStatus(c.docker);`r`n    }"
        $f2 = $f2.Replace($snippet, $replacement)
        Write-Host "OK: docker call site replaced (fallback)" -ForegroundColor Green
    } else {
        Write-Host "WARN: docker call site not found" -ForegroundColor Yellow
    }
}

if ($f2 -ne $f) {
    [System.IO.File]::WriteAllText('C:\projects\SME\sme-monitor.js', $f2, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Saved. Lines: $((Get-Content C:\projects\SME\sme-monitor.js).Count)" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: No changes written!" -ForegroundColor Red
}
