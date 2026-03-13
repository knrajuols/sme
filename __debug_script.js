
/* ============================================================
   Utilities
   ============================================================ */
function ts() {
  return new Date().toLocaleTimeString();
}

function log(msg, type) {
  type = type || 'info';
  var box   = document.getElementById('log-box');
  var cls   = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : 'log-info';
  var entry = document.createElement('div');
  entry.innerHTML = '<span class="log-ts">' + ts() + '</span><span class="' + cls + '">' + escHtml(msg) + '</span>';
  box.appendChild(entry);
  box.scrollTop = box.scrollHeight;
}

function clearLog() {
  document.getElementById('log-box').innerHTML = '';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Toast Ã¢â€â‚¬Ã¢â€â‚¬ */
function showToast(title, msg, type) {
  type = type || 'info';
  var area = document.getElementById('toast-area');
  var ico  = type === 'ok'  ? '&#10003;' :
             type === 'err' ? '&#10005;' : '&#9432;';
  var el   = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML  = '<span class="toast-ico">' + ico + '</span>'
    + '<div class="toast-body"><div class="toast-title">' + escHtml(title) + '</div>'
    + '<div class="toast-msg">'  + escHtml(msg)   + '</div></div>';
  area.appendChild(el);
  setTimeout(function () {
    el.classList.add('fade-out');
    setTimeout(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }, 400);
  }, 4500);
}

/* ============================================================
   Rendering helpers
   ============================================================ */
function typeBadge(t) {
  var map = { Infra: 'bi', Backend: 'bb', Frontend: 'bf', Code: 'bc' };
  return '<span class="badge ' + (map[t] || 'bc') + '">' + t + '</span>';
}

function statusCell(s) {
  var dotCls = { running: 'dr', stopped: 'ds', warning: 'dw' };
  var label  = {
    running: '<span class="c-run">Running</span>',
    stopped: '<span class="c-stop">Stopped</span>',
    warning: '<span class="c-warn">Warning</span>'
  };
  return '<span class="sd"><span class="dot ' + (dotCls[s] || 'du') + '"></span>'
       + (label[s] || '<span>Unknown</span>') + '</span>';
}

function healthCell(h) {
  if (!h) return '<span class="hn">&mdash;</span>';
  var parts = h.split(' ');
  var code  = parts.length > 1 ? (parseInt(parts[1], 10) || 9999) : 9999;
  if (h === 'TCP OK' || (h.indexOf('HTTP') === 0 && code < 400)) {
    return '<span class="ho">&#10003; ' + h + '</span>';
  }
  if (h === 'Timeout' || (h.indexOf('HTTP') === 0 && code >= 400 && code < 500)) {
    return '<span class="hw">&#9888; ' + h + '</span>';
  }
  return '<span class="he">&#10007; ' + h + '</span>';
}

function pidCell(p) {
  if (!p) return '<span class="pid-none">&mdash;</span>';
  return '<span class="pid">' + p + '</span>';
}

function siteCell(site, type) {
  if (!site) return '<span class="site-addr">&mdash;</span>';
  if (type === 'Backend' || type === 'Frontend') {
    return '<a class="site-link" href="http://' + site + '" target="_blank" rel="noopener">' + site + '</a>';
  }
  return '<span class="site-addr">' + site + '</span>';
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Row-level action buttons Ã¢â€â‚¬Ã¢â€â‚¬ */
function actionBtns(row) {
  var isRunning = row.status === 'running';
  var startBtn  = '<button class="btn btn-green btn-sm" onclick="doAction(\'start\',\'' + escHtml(row.name) + '\',this)" '
                + (isRunning ? 'disabled' : '') + '>&#9654; Start</button>';
  var stopBtn   = '<button class="btn btn-red btn-sm" onclick="doAction(\'stop\',\'' + escHtml(row.name) + '\',this)" '
                + (!isRunning ? 'disabled' : '') + '>&#9632; Stop</button>';
  return '<div class="row-actions">' + startBtn + stopBtn + '</div>';
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Table builder: components Ã¢â€â‚¬Ã¢â€â‚¬ */
function buildComponentTable(rows) {
  var thead = '<thead><tr>'
    + '<th>Type</th><th>Component</th><th>Port</th>'
    + '<th>Site Address</th><th>PID</th><th>Status</th><th>Health</th><th>Actions</th>'
    + '</tr></thead>';
  var tbody = '<tbody>';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    tbody += '<tr>'
      + '<td>' + typeBadge(r.type) + '</td>'
      + '<td class="name-cell">' + escHtml(r.name) + '</td>'
      + '<td class="port-num">:' + r.port + '</td>'
      + '<td>' + siteCell(r.site, r.type) + '</td>'
      + '<td>' + pidCell(r.pid) + '</td>'
      + '<td>' + statusCell(r.status) + '</td>'
      + '<td>' + healthCell(r.health) + '</td>'
      + '<td>' + actionBtns(r) + '</td>'
      + '</tr>';
  }
  return '<table>' + thead + tbody + '</tbody></table>';
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Table builder: Prisma Ã¢â€â‚¬Ã¢â€â‚¬ */
function buildPrismaTable(prisma) {
  var thead = '<thead><tr>'
    + '<th>Type</th><th>Service</th><th>Generated Client Path</th><th>Status</th>'
    + '</tr></thead>';
  var tbody = '<tbody>';
  for (var i = 0; i < prisma.length; i++) {
    var p  = prisma[i];
    var ok = p.status === 'generated';
    tbody += '<tr>'
      + '<td>' + typeBadge('Code') + '</td>'
      + '<td class="name-cell">' + escHtml(p.service) + '</td>'
      + '<td class="ppath">' + escHtml(p.path) + '</td>'
      + '<td class="' + (ok ? 'pg' : 'pm') + '">'
      +   (ok ? '&#10003; Generated' : '&#10007; Missing')
      + '</td>'
      + '</tr>';
  }
  return '<table>' + thead + tbody + '</tbody></table>';
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Section header with optional side buttons Ã¢â€â‚¬Ã¢â€â‚¬ */
function sectionHdr(icon, title, extraBtns) {
  var btns = extraBtns
    ? '<div class="section-actions">' + extraBtns + '</div>'
    : '';
  return '<div class="section-hdr">'
       + '<div class="section-title">' + icon + '&nbsp;&nbsp;' + escHtml(title) + '</div>'
       + '<div class="section-line"></div>'
       + btns
       + '</div>';
}
/* ============================================================
   Main render -- updates only the dynamic cells; tables are server-side HTML
   ============================================================ */
function rowId(name) { return name.replace(/[^a-z0-9]/gi,'-').toLowerCase(); }

function render(data) {
  console.log('[render] called — comps:', data.components.length, '  prisma:', data.prismaClients.length);
  var comps  = data.components;
  var prisma = data.prismaClients;

  var nRun  = comps.filter(function (c) { return c.status === 'running'; }).length;
  var nStop = comps.filter(function (c) { return c.status === 'stopped'; }).length;
  var nWarn = comps.filter(function (c) { return c.status === 'warning'; }).length;
  var nPG   = prisma.filter(function (p) { return p.status === 'generated'; }).length;

  var sumEl = document.getElementById('summary');
  sumEl.style.display = 'flex';
  sumEl.innerHTML =
    '<div class="sc"><div class="num c-tot">'    + comps.length + '</div><div class="lbl">Total</div></div>'
   +'<div class="sc"><div class="num c-run">'    + nRun         + '</div><div class="lbl">Running</div></div>'
   +'<div class="sc"><div class="num c-stop">'   + nStop        + '</div><div class="lbl">Stopped</div></div>'
   +(nWarn > 0 ? '<div class="sc"><div class="num c-warn">'+nWarn+'</div><div class="lbl">Warning</div></div>' : '')
   +'<div class="sc"><div class="num c-prisma">' + nPG+'/'+prisma.length + '</div><div class="lbl">Prisma OK</div></div>';

  // Update dynamic cells by id (tables already rendered server-side)
  for (var i = 0; i < comps.length; i++) {
    var c = comps[i], cid = rowId(c.name), el;
    el = document.getElementById('pid-'+cid);    if (el) el.innerHTML = pidCell(c.pid);
    el = document.getElementById('status-'+cid); if (el) el.innerHTML = statusCell(c.status);
    el = document.getElementById('health-'+cid); if (el) el.innerHTML = healthCell(c.health);
    el = document.getElementById('actions-'+cid);if (el) el.innerHTML = actionBtns(c);
  }
  for (var j = 0; j < prisma.length; j++) {
    var p = prisma[j], pid = rowId(p.service), ok = p.status === 'generated';
    var cell = document.getElementById('prisma-'+pid);
    if (cell) { cell.className = ok ? 'pg' : 'pm'; cell.innerHTML = ok ? '&#10003; Generated' : '&#10007; Missing'; }
  }
}

/* ============================================================
   API calls
   ============================================================ */

/* Refresh status â€” NO full-page overlay; just animates the button */
async function doRefresh() {
  var btn    = document.getElementById('refresh-btn');
  var errDiv = document.getElementById('err');
  btn.disabled = true;
  btn.classList.add('loading');
  errDiv.style.display = 'none';
  // Show a subtle inline skeleton while loading
  var dash = document.getElementById('dash');
  // Keep existing tables visible during refresh (skeleton was already rendered on load)
  // Only fall back to skeleton if somehow dash is empty
  // tables are server-side -- dash is never empty
  try {
    var res = await fetch('/api/status');
    if (!res.ok) { throw new Error('HTTP ' + res.status); }
    var data = await res.json();
    console.log('[doRefresh] got data, calling render()');
    render(data);
    console.log('[doRefresh] render() complete');
    var d = new Date(data.timestamp);
    document.getElementById('last-updated').textContent =
      'Refreshed: ' + d.toLocaleTimeString();
  } catch (err) {
    errDiv.textContent = '⚠ Failed to load status: ' + err.message;
    errDiv.style.display = 'block';
    log('Refresh failed: ' + err.message, 'err');
    // Do NOT clear dash on error -- keep showing last known state
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

/* Per-row start / stop */
async function doAction(action, name, btnEl) {
  btnEl.disabled = true;
  var overlay = document.getElementById('overlay');
  document.getElementById('overlay-msg').textContent =
    (action === 'start' ? 'Starting ' : 'Stopping ') + name + '…';
  overlay.classList.add('on');
  log((action === 'start' ? 'Starting' : 'Stopping') + ' ' + name + '...', 'info');
  try {
    var res  = await fetch('/api/action', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: action, name: name }),
    });
    var data = await res.json();
    if (data.ok) {
      log(name + ': ' + data.message, 'ok');
      showToast(name, data.message, 'ok');
    } else {
      log(name + ' ERROR: ' + data.message, 'err');
      showToast(name + ' Ã¢â‚¬â€ Failed', data.message, 'err');
    }
    // Refresh after short delay so the process has time to come up / die
    setTimeout(doRefresh, 1800);
  } catch (err) {
    log('Action failed: ' + err.message, 'err');
    showToast('Error', err.message, 'err');
    overlay.classList.remove('on');
    btnEl.disabled = false;
  }
}

/* Run a global script (prep / boot) */
async function runScript(script) {
  var label = script === 'prep' ? 'prepsme.ps1' : 'bootsme.ps1';
  log('Launching ' + label + '...', 'info');
  var overlay = document.getElementById('overlay');
  document.getElementById('overlay-msg').textContent = 'Launching ' + label + '…';
  overlay.classList.add('on');
  try {
    var res  = await fetch('/api/run-script', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ script: script }),
    });
    var data = await res.json();
    if (data.ok) {
      log(label + ': ' + data.message, 'ok');
      showToast(label, data.message, 'ok');
    } else {
      log(label + ' ERROR: ' + data.message, 'err');
      showToast(label + ' Ã¢â‚¬â€ Failed', data.message, 'err');
    }
  } catch (err) {
    log('Script launch failed: ' + err.message, 'err');
    showToast('Error', err.message, 'err');
  } finally {
    overlay.classList.remove('on');
    // Refresh after 3 s to capture any newly started services
    setTimeout(doRefresh, 3000);
  }
}

/* Catch any uncaught JS errors and display them in #err so they're visible */
window.onerror = function (msg, src, line, col, err) {
  var errDiv = document.getElementById('err');
  if (errDiv) {
    errDiv.textContent = '⚠ JS Error: ' + msg + ' (' + (src || '') + ':' + line + ')';
    errDiv.style.display = 'block';
  }
  console.error('[monitor] uncaught error:', msg, src, line, col, err);
  return false;
};

/* Auto-refresh on load */
window.addEventListener('DOMContentLoaded', function () {
  console.log('[monitor] DOMContentLoaded - starting doRefresh()');
  doRefresh();
});

