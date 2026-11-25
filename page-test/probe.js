// Page test: a throwaway probe for how an iPhone home-screen app treats two pages in one folder.
// Everything is local to the phone. Nothing is sent anywhere. Results are shown on screen and
// can be copied to the clipboard by the person holding the phone.
// Page A is the folder address itself (index.html); page B is b.html. Every hop to A goes to './'.
(function () {
  'use strict';
  var PAGE = document.body.getAttribute('data-page') === 'B' ? 'B' : 'A';
  var OTHER = PAGE === 'A' ? 'B' : 'A';
  var OTHER_ADDR = PAGE === 'A' ? 'b.html' : './';
  var OTHER_FILE = PAGE === 'A' ? 'b.html' : '(folder)';
  var KINDS = ['link', 'assign', 'replace'];
  var KEYS = ['probeVal', 'probeLog', 'probeHop', 'probeEv', 'probeRes', 'probeQ', 'probeCamLast', 'probeArm', 'probeStart'];
  var LOADS = ['navigate', 'reload', 'back_forward'];
  var START = Date.now();
  var DOC = rid();          // one id per page load: two camera uses with the same id were the same load
  var cleared = false;      // after "Clear all test data" nothing is written again

  // ---- storage, every touch guarded ---------------------------------------------------------
  function store(kind) {
    try { return kind === 's' ? window.sessionStorage : window.localStorage; } catch (e) { return null; }
  }
  function get(kind, key) {
    try { var st = store(kind); if (!st) return null; var v = st.getItem(key); return v == null ? null : JSON.parse(v); } catch (e) { return null; }
  }
  function put(kind, key, val) {
    if (cleared) return false;
    try { var st = store(kind); if (!st) return false; st.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function putBoth(key, val) { var a = put('s', key, val); var b = put('l', key, val); return a || b; }
  function wipe() {
    cleared = true;
    ['s', 'l'].forEach(function (k) {
      KEYS.forEach(function (key) {
        try { var st = store(k); if (st) st.removeItem(key); } catch (e) { /* ignore */ }
      });
    });
  }

  // ---- small helpers ------------------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function day(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function ago(ms) {
    if (ms < 0) ms = 0;
    var s = Math.round(ms / 1000);
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    return h + ' h ' + pad(m % 60) + ' min';
  }
  function rid() { return Math.random().toString(36).slice(2, 10); }
  function mode() {
    if (window.navigator.standalone === true) return 'APP';
    try { if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'APP'; } catch (e) { /* ignore */ }
    return 'TAB';
  }
  function where() { return mode() === 'APP' ? 'app' : 'tab'; }
  function navEntry() {
    try { return performance.getEntriesByType('navigation')[0] || null; } catch (x) { return null; }
  }
  function navType() {
    var e = navEntry();
    if (e && e.type) return e.type;
    try { return ['navigate', 'reload', 'back_forward'][performance.navigation.type] || 'unknown'; } catch (x) { return 'unknown'; }
  }
  // Did this load touch the network, or come from the phone's own copy? '?' when the phone does not say.
  function dlKind() {
    var e = navEntry();
    try {
      if (e && typeof e.transferSize === 'number') {
        if (e.transferSize > 0) return 'network';
        if (e.decodedBodySize > 0) return 'copy';
      }
    } catch (x) { /* ignore */ }
    return '?';
  }
  function dlWord(d) { return d === 'network' ? 'downloaded' : d === 'copy' ? 'phone copy' : 'source unknown'; }
  function osLine() {
    var m = /OS (\d+[_\d]*) like Mac OS X/.exec(navigator.userAgent || '');
    return m ? 'iOS ' + m[1].replace(/_/g, '.') : 'not an iPhone';
  }
  function fileName() {
    var last = String(location.pathname || '').split('/').pop();
    return last || '(folder)';
  }
  function fileWord(f) { return f === '(folder)' ? 'the folder address (page A)' : f; }
  function parseHash() {
    var h = String(location.hash || '').replace(/^#/, '');
    if (!h) return null;
    var o = {};
    h.split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
    return o.hop ? o : null;
  }
  function find(list, tok) { for (var i = 0; i < list.length; i++) if (list[i].tok === tok) return list[i]; return null; }
  function capped(list, n) { return list.length > n ? list.slice(list.length - n) : list; }

  // ---- results (kept in both stores; local wins; every change re-reads first) ----------------
  var R = null;
  function norm(r) {
    r = r && r.v === 2 ? r : { v: 2 };
    r.tries = r.tries || []; r.arr = r.arr || []; r.p3switch = r.p3switch || null; r.p7 = r.p7 || [];
    r.p8 = r.p8 || {}; r.net = r.net || 'not set'; r.tags = r.tags || {};
    return r;
  }
  function loadRes() { return norm(get('l', 'probeRes') || get('s', 'probeRes') || R); }
  function change(fn) { R = loadRes(); fn(R); putBoth('probeRes', R); return R; }
  R = loadRes();
  // Questions waiting for an answer, shown on whichever page opens next.
  var Q = null;
  function loadQ() { return get('l', 'probeQ') || get('s', 'probeQ') || Q || []; }
  function ask(q) { q.id = rid(); Q = loadQ().concat([q]); putBoth('probeQ', Q); }
  function takeQ(id) {
    var hit = null;
    Q = loadQ().filter(function (x) { if (x.id === id) { hit = x; return false; } return true; });
    putBoth('probeQ', Q);
    return hit;
  }

  // ---- event log: pageshow / pagehide / visibilitychange ------------------------------------
  function events() { return get('l', 'probeEv') || []; }
  function logEvent(e, extra) {
    if (cleared) return;
    var item = { t: Date.now(), pg: PAGE, e: e };
    for (var k in extra) item[k] = extra[k];
    put('l', 'probeEv', capped(events().concat([item]), 120));
  }

  // ---- open log: one entry per load, restore, or return to a page left in the background -----
  function logs() { return { l: get('l', 'probeLog') || [], s: get('s', 'probeLog') || [] }; }
  function logOf() { var g = logs(); return g.l.length >= g.s.length ? g.l : g.s; }
  function addEntry(e) {
    var g = logs();
    var a = g.l[g.l.length - 1], b = g.s[g.s.length - 1];
    var prev = !a ? b : !b ? a : (a.n >= b.n ? a : b);
    e.n = (prev ? prev.n : 0) + 1;
    e.gap = prev ? e.t - prev.t : -1;
    e.sLogLen = g.s.length; e.lLogLen = g.l.length;
    put('l', 'probeLog', capped(g.l.concat([e]), 200));
    put('s', 'probeLog', capped(g.s.concat([e]), 200));
  }
  function patchEntry(n, fields) {
    ['l', 's'].forEach(function (k) {
      var lg = get(k, 'probeLog') || [];
      lg.forEach(function (e) { if (e.n === n) for (var f in fields) e[f] = fields[f]; });
      put(k, 'probeLog', lg);
    });
  }

  function valueState(kind, now) {
    var v = get(kind, 'probeVal');
    if (v && typeof v.w === 'number') return { here: true, w: v.w };
    put(kind, 'probeVal', { w: now, id: rid() });
    return { here: false, w: now };
  }
  var visit = null;       // the open-log entry for what is on screen now
  var lastCheck = 0;      // when the values were last read again without a new entry (Copy)
  function recordOpen(how, extra) {
    var now = Date.now();
    var s = valueState('s', now), l = valueState('l', now);
    var e = {
      t: now, pg: PAGE, file: fileName(), mode: mode(), nav: how, dl: LOADS.indexOf(how) >= 0 ? dlKind() : '',
      doc: DOC, hop: '', hl: history.length, on: navigator.onLine ? 1 : 0,
      s: s.here ? now - s.w : -1, l: l.here ? now - l.w : -1, away: -1, tag: ''
    };
    for (var k in extra) e[k] = extra[k];
    addEntry(e);
    visit = e; lastCheck = now;
    return e;
  }
  function valuesGone() {
    var s = get('s', 'probeVal'), l = get('l', 'probeVal');
    return !(s && typeof s.w === 'number') || !(l && typeof l.w === 'number');
  }
  // Copy reads the values again; a loss while the page sat on screen gets its own entry.
  function recheck() { if (valuesGone()) recordOpen('copy'); else lastCheck = Date.now(); }
  function visitWords(e) {
    var w = e.nav === 'navigate' ? 'page loaded' : e.nav === 'reload' ? 'page reloaded' : e.nav === 'back_forward' ? 'page reloaded by a back move' :
      e.nav === 'restored' ? 'page restored from memory' : e.nav === 'resume' ? 'page resumed after ' + (e.away >= 0 ? ago(e.away) : 'an unknown time') + ' away' :
      e.nav === 'copy' ? 'checked at Copy' : 'opened (' + e.nav + ')';
    return w + (e.gap >= 0 ? ', ' + ago(e.gap) + ' after the open before' : ', first open');
  }
  // The "what happened just before" question belongs to this visit only, never to an older one.
  function promptable() {
    if (!visit || visit.doc !== DOC || visit.tag || visit.hop) return false;
    if (visit.nav === 'navigate' || visit.nav === 'reload' || visit.nav === 'unknown') return true;
    return visit.nav === 'resume' && (visit.away < 0 || visit.away >= 60000);
  }

  // ---- hops ---------------------------------------------------------------------------------
  var arrived = null;   // the hop that brought us here, if any
  function isFirstLoad(now) {
    return !logOf().some(function (e) { return e.file === fileName() && LOADS.indexOf(e.nav) >= 0 && e.t >= now - 600000; });
  }
  function scoreHop(h) {
    if (find(loadRes().arr, h.tok)) { arrived = { kind: h.hop, repeat: true }; return; }
    var sh = get('s', 'probeHop'), lh = get('l', 'probeHop');
    var now = Date.now(), tap = Number(h.t) || 0;
    var a = {
      tok: h.tok, kind: h.hop, from: h.from, to: PAGE, tap: tap, at: now, delay: tap ? now - tap : -1,
      s: sh && sh.tok === h.tok ? 'KEPT' : 'LOST', l: lh && lh.tok === h.tok ? 'KEPT' : 'LOST',
      fromMode: h.m, toMode: mode(), onTap: h.on === '1', onArr: navigator.onLine ? true : false,
      hl: history.length, file: fileName(), dl: dlKind(), first: isFirstLoad(now), p2: '', p3: '', back: ''
    };
    change(function (r) { a.net = r.net; r.arr = capped(r.arr.concat([a]), 80); });
    arrived = a;
    ask({ q: 'p2', tok: a.tok, kind: a.kind, from: a.from, to: PAGE });
    ask({ q: 'p3', tok: a.tok, kind: a.kind, from: a.from, to: PAGE });
  }
  // A back move while a swipe question waits, whichever page it lands on.
  function noteBack(how) {
    var waiting = loadQ().filter(function (q) { return q.q === 'p3'; });
    if (!waiting.length) return;
    var said = 'back move landed on page ' + PAGE + ' (' + how + ' ' + clock(Date.now()) + ', history ' + history.length + ')';
    change(function (r) { waiting.forEach(function (q) { var a = find(r.arr, q.tok); if (a && !a.back) a.back = said; }); });
  }
  // How old the target's copy on this phone is, from this storage's own open log.
  function targetAge(t) {
    var loads = logOf().filter(function (e) { return e.file === OTHER_FILE && LOADS.indexOf(e.nav) >= 0; });
    var dl = loads.filter(function (e) { return e.dl === 'network'; }).pop();
    var onl = loads.filter(function (e) { return e.on === 1; }).pop();
    var known = loads.some(function (e) { return e.dl === 'network' || e.dl === 'copy'; });
    return { dl: dl ? t - dl.t : -1, onl: onl ? t - onl.t : -1, known: known };
  }
  function ageWords(a, file) {
    if (!a) return '';
    var name = 'target ' + fileWord(file);
    if (a.dl >= 0) return name + ' last downloaded ' + ago(a.dl) + ' before the tap';
    if (a.onl >= 0) return name + ' last loaded with a connection ' + ago(a.onl) + ' before the tap' + (a.known ? ', never downloaded as far as the page saw' : ' (the phone does not say whether it was downloaded)');
    return name + ' never loaded in this ' + where();
  }
  function hopTo(kind) {
    var tok = rid(), t = Date.now(), on = navigator.onLine ? '1' : '0';
    putBoth('probeHop', { kind: kind, tok: tok, t: t, from: PAGE, on: on, m: mode() });
    put('l', 'probeArm', null); window.__armed = null;
    var age = targetAge(t);
    change(function (r) { r.tries = capped(r.tries.concat([{ tok: tok, kind: kind, from: PAGE, to: OTHER, t: t, on: on, m: mode(), file: OTHER_FILE, age: age }]), 80); });
    if (on === '0') ask({ q: 'p8', tok: tok, kind: kind, from: PAGE, to: OTHER, t: t });
    return OTHER_ADDR + '#hop=' + kind + '&tok=' + tok + '&t=' + t + '&from=' + PAGE + '&on=' + on + '&m=' + mode();
  }

  // P9: tap to first paint. Prefer the browser's own first-contentful-paint mark.
  function measurePaint() {
    if (!arrived || arrived.repeat || !arrived.tap) return;
    var tok = arrived.tok;
    var skip = function (why) { change(function (r) { var a = find(r.arr, tok); if (a) a.paintSkip = why; }); };
    if (!arrived.onTap) { skip('tapped with no connection'); return; }
    if (!arrived.onArr) { skip('no connection on arrival'); return; }
    var rafAt = null;
    var finish = function () {
      var fcp = null;
      try {
        var p = performance.getEntriesByType('paint').filter(function (e) { return e.name === 'first-contentful-paint'; })[0];
        if (p && performance.timeOrigin) fcp = performance.timeOrigin + p.startTime;
      } catch (e) { /* ignore */ }
      var at = fcp || rafAt || Date.now();
      var ms = Math.round(at - arrived.tap);
      if (ms < 0 || ms > 30000) skip('arrived ' + ago(ms) + ' after the tap');
      else change(function (r) { var a = find(r.arr, tok); if (a) a.paint = { ms: ms, how: fcp ? 'paint mark' : 'frame' }; });
      render();
    };
    try {
      requestAnimationFrame(function () { rafAt = Date.now(); setTimeout(finish, 600); });
    } catch (e) { setTimeout(finish, 600); }
  }

  // ---- camera (P7) --------------------------------------------------------------------------
  var camBusy = false;
  var cam = null;   // the live stream; stopCam() is the only way it ends
  function camEntry(c, out) {
    return { n: c.n, pg: PAGE, open: c.open, ms: c.ms, out: out, since: c.since, same: c.same, at: Date.now() };
  }
  function stopCam(why) {
    var c = cam;
    if (!c) return;
    cam = null;
    try { c.stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) { /* ignore */ }
    var video = document.getElementById('cam');
    if (video) { try { video.srcObject = null; } catch (e) { /* ignore */ } video.style.display = 'none'; }
    put('l', 'probeCamLast', { t: Date.now(), pg: PAGE, doc: DOC });
    change(function (r) { r.p7.push(camEntry(c, why ? 'CAMERA WORKED (stopped early: ' + why + ')' : 'CAMERA WORKED')); });
    ask({ q: 'p7', n: c.n });
    camBusy = false;
    render();
  }
  function camera() {
    if (camBusy) return;
    var status = document.getElementById('camstatus');
    var md = navigator.mediaDevices;
    var last = get('l', 'probeCamLast');
    var c = { n: loadRes().p7.length + 1, open: visit ? visit.n : 0, ms: 0, since: last ? Date.now() - last.t : -1, same: !!(last && last.doc === DOC) };
    if (!md || !md.getUserMedia) {
      change(function (r) { r.p7.push(camEntry(c, 'NO CAMERA ON THIS PAGE')); }); render(); return;
    }
    camBusy = true;
    if (status) status.textContent = 'Asking for the camera…';
    var t0 = Date.now();
    md.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(function (stream) {
      c.ms = Date.now() - t0; c.stream = stream;
      cam = c;
      if (document.visibilityState === 'hidden') { stopCam('page left before the camera started'); return; }
      setTimeout(function () { if (cam === c) stopCam(''); }, 3000);
      try {
        var video = document.getElementById('cam');
        if (status) status.textContent = 'Camera on. It stops by itself in 3 seconds.';
        if (video) { video.srcObject = stream; video.style.display = 'block'; video.scrollIntoView(); video.play(); }
      } catch (e) { /* the stop above is already scheduled */ }
    }, function (err) {
      c.ms = Date.now() - t0;
      change(function (r) { r.p7.push(camEntry(c, 'REFUSED (' + (err && err.name || 'error') + ')')); });
      ask({ q: 'p7', n: c.n }); camBusy = false; render();
    });
  }

  // ---- P3 app-switch test -------------------------------------------------------------------
  function armSwitch() {
    var arm = { t: Date.now(), pg: PAGE };
    put('l', 'probeArm', arm);
    window.__armed = arm;
    render();
  }
  function checkSwitch() {
    var arm = window.__armed;
    if (!arm) return;
    var ev = events().filter(function (e) { return e.t >= arm.t && e.pg === PAGE; });
    var hidden = ev.some(function (e) { return e.e === 'vis' && e.v === 'hidden'; });
    if (!hidden) return;   // not switched away yet
    var hide = ev.some(function (e) { return e.e === 'pagehide'; });
    var show = ev.some(function (e) { return e.e === 'pageshow'; });
    change(function (r) { r.p3switch = { hide: hide ? 'FIRED' : 'NOT FIRED', vis: 'FIRED', show: show ? 'FIRED' : 'NOT FIRED', reloaded: 'NO', at: Date.now(), pg: PAGE }; });
    window.__armed = null; put('l', 'probeArm', null);
  }

  // ---- result lines -------------------------------------------------------------------------
  function hopWhere(x) { return x.from + ' to ' + x.to + ' ' + clock(x.at || x.t); }
  function lines() {
    var r = loadRes();
    var out = [];
    var now = Date.now();
    out.push('Page test results, page ' + PAGE + ' (' + fileName() + '), ' + day(now) + ' ' + clock(now) + ', ' + mode() + ', ' + osLine());
    var never = function (k) {
      return r.tries.filter(function (t) { return t.kind === k && t.on === '1' && !find(r.arr, t.tok); });
    };
    KINDS.forEach(function (k) {
      var arr = r.arr.filter(function (a) { return a.kind === k; }), lost = never(k);
      if (!arr.length && !lost.length) { out.push('P1 ' + k + ': not tried'); return; }
      var part = function (key, label) {
        var bad = arr.filter(function (a) { return a[key] === 'LOST'; });
        return label + ' KEPT ' + (arr.length - bad.length) + ' of ' + arr.length + (bad.length ? ', LOST ' + bad.length + ' (' + bad.slice(0, 3).map(hopWhere).join(', ') + ')' : '');
      };
      out.push('P1 ' + k + ': ' + (arr.length ? part('s', 'session') + '; ' + part('l', 'local') : 'no arrival') +
        (lost.length ? '; TRIED ' + lost.length + ' more that never arrived in this ' + where() + ' (' + lost.slice(-3).map(hopWhere).join(', ') + ')' : ''));
    });
    var dm = '?';
    try { dm = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'; } catch (e) { /* ignore */ }
    out.push('P2 page sees: standalone=' + (navigator.standalone === true ? 'yes' : navigator.standalone === false ? 'no' : 'unknown') + ', display-mode=' + dm + ', so ' + mode());
    KINDS.forEach(function (k) {
      var arr = r.arr.filter(function (a) { return a.kind === k; }), lost = never(k);
      if (!arr.length && !lost.length) { out.push('P2 ' + k + ': not tried'); return; }
      var stayed = arr.filter(function (a) { return a.p2 === 'no'; }).length;
      var bar = arr.filter(function (a) { return a.p2 === 'yes'; });
      var left = arr.filter(function (a) { return a.fromMode === 'APP' && a.toMode !== 'APP'; });
      out.push('P2 ' + k + ': STAYED IN APP ' + stayed + ', BAR OR SHEET ' + bar.length + (bar.length ? ' (' + bar.slice(0, 3).map(hopWhere).join(', ') + ')' : '') +
        ', not answered ' + (arr.length - stayed - bar.length) +
        (left.length ? ', LEFT THE APP (seen by page) ' + left.length + ' (' + left.slice(0, 3).map(hopWhere).join(', ') + ')' : '') +
        (lost.length ? ', TRIED ' + lost.length + ' that never arrived in this ' + where() + ', it may have opened outside it (' + lost.slice(-3).map(hopWhere).join(', ') + ')' : ''));
    });
    var ev = events();
    var count = function (pg, e, pred) { return ev.filter(function (x) { return x.pg === pg && x.e === e && (!pred || pred(x)); }).length; };
    ['A', 'B'].forEach(function (pg) {
      var lastHid = ev.filter(function (x) { return x.pg === pg && x.e === 'vis' && x.v === 'hidden'; }).pop();
      var lastVis = ev.filter(function (x) { return x.pg === pg && x.e === 'vis' && x.v === 'visible'; }).pop();
      out.push('P3 page ' + pg + ': pageshow ' + count(pg, 'pageshow') + ' (restored ' + count(pg, 'pageshow', function (x) { return x.p; }) + '), pagehide ' + count(pg, 'pagehide') +
        ', visibility ' + count(pg, 'vis') + (lastHid ? ' (last hidden ' + clock(lastHid.t) + ')' : '') + (lastVis ? ' (last visible ' + clock(lastVis.t) + ')' : ''));
    });
    out.push('P3 history.length here now: ' + history.length);
    KINDS.forEach(function (k) {
      var arr = r.arr.filter(function (a) { return a.kind === k; });
      out.push('P3 swipe after ' + k + ': ' + (arr.length ? arr.map(function (a, i) {
        var said = a.p3 === 'yes' ? 'WENT BACK' : a.p3 === 'no' ? 'DID NOT GO BACK' : a.p3 === 'skip' ? 'swipe not tried' : 'not answered';
        return '#' + (i + 1) + ' ' + hopWhere(a) + ', history.length on arrival ' + a.hl + ', ' + said + (a.back ? ' (page saw: ' + a.back + ')' : '');
      }).join('; ') : 'not tried'));
    });
    var sw = r.p3switch;
    out.push('P3 app switch: ' + (sw ? (sw.reloaded === 'YES' ? 'PAGE WAS RELOADED on return' : 'pagehide ' + sw.hide + ', visibilitychange ' + sw.vis + ', pageshow ' + sw.show) + ' (page ' + sw.pg + ', ' + clock(sw.at) + ')' : 'not tried'));

    var code = mode() === 'TAB' ? 'P6' : 'P4';
    if (visit) {
      var tail = ' (open #' + visit.n + ', ' + visitWords(visit) + ')' + (lastCheck > visit.t ? ', read again at ' + clock(lastCheck) + ': still here' : '');
      out.push(code + ' session value: ' + (visit.s >= 0 ? 'KEPT, ' + ago(visit.s) + ' old' : 'GONE, a new one was written') + ' at ' + clock(visit.t) + tail);
      out.push(code + ' local value: ' + (visit.l >= 0 ? 'KEPT, ' + ago(visit.l) + ' old' : 'GONE, a new one was written') + ' at ' + clock(visit.t) + tail);
    }
    var g = logs(), lg = logOf();
    var mine = lg.filter(function (e) { return e.mode === mode(); });
    var longest = mine.reduce(function (m, e) { return e.s > m ? e.s : m; }, -1);
    var gone = mine.filter(function (e, i) { return e.s < 0 && i > 0; });
    out.push(code + ' longest the session value lasted: ' + (longest >= 0 ? ago(longest) : 'never seen kept') + '; found gone at ' + (gone.length ? gone.slice(-4).map(function (e) {
      return 'open #' + e.n + ' ' + clock(e.t) + ' (' + e.nav + ', ' + ago(e.gap) + ' after the open before' + (e.tag ? ', you said ' + e.tag : '') + ')';
    }).join(', ') : 'no later open'));
    out.push(code + ' opens recorded: local log ' + g.l.length + ', session log ' + g.s.length + (g.s.length ? ' (session log starts at open #' + g.s[0].n + ', ' + day(g.s[0].t) + ' ' + clock(g.s[0].t) + ')' : ''));
    ['swipe', 'restart', 'overnight'].forEach(function (tag) {
      var e = r.tags[tag];
      var label = tag === 'swipe' ? 'P5 after swipe-away' : tag === 'restart' ? 'P5 after restart' : code + ' after overnight';
      out.push(label + ': ' + (e ? 'session ' + (e.s >= 0 ? 'KEPT (' + ago(e.s) + ' old)' : 'GONE') + ', local ' + (e.l >= 0 ? 'KEPT (' + ago(e.l) + ' old)' : 'GONE') +
        ' (' + e.mode + ', open #' + e.n + ', ' + visitWords(e) + ', ' + day(e.t) + ' ' + clock(e.t) + ')' : 'not tagged yet'));
    });
    if (!r.p7.length) out.push('P7 camera: not tried');
    r.p7.forEach(function (c) {
      var rel = c.since < 0 ? 'first camera use' : (c.same ? 'same page load as the last camera use' : 'NEW page load since the last camera use') + ', ' + ago(c.since) + ' after it';
      out.push('P7 camera ' + c.n + ' on ' + c.pg + ' (open #' + c.open + ', ' + rel + '): ' + (c.said === 'yes' ? 'ASKED' : c.said === 'no' ? 'NOT ASKED' : 'not answered') + ', ' + c.out + ', call took ' + c.ms + ' ms');
    });
    out.push('P8 online now: ' + (navigator.onLine ? 'yes' : 'no'));
    var off = r.tries.filter(function (t) { return t.on === '0'; });
    if (!off.length) out.push('P8 offline hop: not tried');
    off.forEach(function (t) {
      var a = find(r.arr, t.tok), said = r.p8[t.tok];
      var got = !a ? 'page did not record an arrival' : a.onArr ? 'ARRIVED, but online by then (' + ago(a.delay) + ' after the tap)' : 'ARRIVED with no connection (' + ago(a.delay) + ' after the tap)';
      out.push('P8 offline ' + t.kind + ' (' + t.from + ' to ' + t.to + ', tapped ' + clock(t.t) + '): ' + got + ', ' + ageWords(t.age, t.file) + ', ' + (said ? 'you said: ' + said : 'not answered'));
    });
    out.push('P9 network you set: ' + r.net);
    KINDS.forEach(function (k) {
      var arr = r.arr.filter(function (a) { return a.kind === k; });
      var timed = arr.filter(function (a) { return a.paint; }), skipped = arr.filter(function (a) { return a.paintSkip; });
      if (!timed.length && !skipped.length) { out.push('P9 ' + k + ': not timed'); return; }
      var firsts = timed.filter(function (a) { return a.first; });
      var top = firsts.reduce(function (m, a) { return !m || a.paint.ms > m.paint.ms ? a : m; }, null);
      out.push('P9 ' + k + ': ' + (top ? 'slowest first load ' + top.paint.ms + ' ms (' + top.net + ', ' + dlWord(top.dl) + ')' : 'no first-load sample') +
        (timed.length ? '; all: ' + timed.map(function (a) { return a.paint.ms + ' ms ' + a.net + ' ' + (a.first ? 'first' : 'repeat') + ' ' + dlWord(a.dl) + ' ' + a.paint.how; }).join(', ') : '') +
        (skipped.length ? '; not timed: ' + skipped.map(function (a) { return a.paintSkip; }).join(', ') : ''));
    });
    out.push('P9 note: first = no load of that file in the 10 minutes before. These are times for a small test page; the real app also loads its fonts and checks the sign-in first, so it is slower.');
    out.push('Log (last 15 opens, newest last):');
    lg.slice(-15).forEach(function (e) {
      out.push('Log #' + e.n + ' ' + day(e.t).slice(5) + ' ' + clock(e.t) + ' ' + e.pg + ' ' + e.mode + ' ' + e.nav + (e.nav === 'resume' ? ' after ' + (e.away >= 0 ? ago(e.away) : '?') : '') +
        (e.dl ? ' ' + dlWord(e.dl) : '') + ', session ' + (e.s >= 0 ? ago(e.s) + ' old' : 'GONE') + ', local ' + (e.l >= 0 ? ago(e.l) + ' old' : 'GONE') +
        ', history ' + e.hl + (e.hop ? ', hop ' + e.hop : '') + (e.on ? '' : ', offline') + (e.tag ? ', you said ' + e.tag : ''));
    });
    return out;
  }

  // ---- questions ----------------------------------------------------------------------------
  function questionHtml(q) {
    var b = function (v, label) { return '<button data-act="ans" data-id="' + q.id + '" data-v="' + esc(v) + '">' + esc(label) + '</button>'; };
    var yn = function (yes, no) { return '<div class="row">' + b('yes', yes) + b('no', no) + '</div>'; };
    if (q.q === 'p2') return '<p><b>P2 (' + esc(q.kind) + ' hop, ' + esc(q.from) + ' to ' + esc(q.to) + '):</b> Did a browser bar or a sheet appear?</p>' + yn('Yes, a bar or sheet', 'No, stayed the same');
    if (q.q === 'p3') {
      return '<p><b>P3 (' + esc(q.kind) + ' hop):</b> On page ' + esc(q.to) + ', swipe in from the left edge of the screen. Did it go back to page ' + esc(q.from) + '?</p>' +
        '<div class="row">' + b('yes', 'Yes, went back') + b('no', 'No, nothing happened') + b('skip', 'I did not swipe') + '</div>';
    }
    if (q.q === 'p7') return '<p><b>P7 (camera ' + esc(q.n) + '):</b> Did the phone ask for camera access?</p>' + yn('Yes, it asked', 'No, it did not ask');
    if (q.q === 'p8') {
      return '<p><b>P8 (' + esc(q.kind) + ' hop with no connection, ' + clock(q.t) + '):</b> What happened?</p>' +
        '<div class="row">' + b('Page opened', 'Page opened') + b('Error, but I got back', 'Error, but I got back') + b('Error, I was stuck', 'Error, I was stuck') + '</div>';
    }
    return '';
  }
  function answer(id, v) {
    var q = takeQ(id);
    if (!q) return;
    change(function (r) {
      if (q.q === 'p2' || q.q === 'p3') { var a = find(r.arr, q.tok); if (a) a[q.q] = v; }
      if (q.q === 'p7') r.p7.forEach(function (c) { if (c.n === q.n) c.said = v; });
      if (q.q === 'p8') r.p8[q.tok] = v;
    });
  }

  // ---- screen -------------------------------------------------------------------------------
  function render() {
    var app = document.getElementById('app');
    if (!app) return;
    if (cleared) {
      app.innerHTML = '<h1>Cleared</h1><p class="big">Every result from this test is gone from this phone. Close this page now. Opening it again starts a new test.</p>';
      return;
    }
    var text = lines().join('\n');
    var qs = loadQ();
    var h = '';
    h += '<h1>Page test ' + PAGE + '</h1>';
    h += '<p class="big">You are on page <b>' + PAGE + '</b>. ' + (mode() === 'APP' ? 'Opened as a home-screen app.' : 'Opened in a browser tab.') + '</p>';
    if (arrived && !arrived.repeat) h += '<p class="ok">Arrived from page ' + esc(arrived.from) + ' by ' + esc(arrived.kind) + '.</p>';
    if (qs.length) {
      h += '<section class="q"><h2>Please answer</h2>';
      qs.forEach(function (q) { h += questionHtml(q); });
      h += '</section>';
    }
    if (promptable()) {
      h += '<section><h2>What happened just before this page opened?</h2><div class="row">' +
        '<button data-act="tag" data-v="swipe">I swiped the app away</button>' +
        '<button data-act="tag" data-v="restart">I restarted the phone</button>' +
        '<button data-act="tag" data-v="overnight">I left it overnight</button>' +
        '<button data-act="tag" data-v="none">Nothing special</button></div></section>';
    }
    h += '<section><h2>1. Go to page ' + OTHER + '</h2><p>After each, answer the questions on the page you land on.</p>';
    h += '<a class="btn" data-act="hop" data-kind="link" href="' + OTHER_ADDR + '">Go to ' + OTHER + ' by link</a>';
    h += '<button data-act="hop" data-kind="assign">Go to ' + OTHER + ' by assign</button>';
    h += '<button data-act="hop" data-kind="replace">Go to ' + OTHER + ' by replace</button>';
    if (PAGE === 'B') h += '<button class="ghost2" data-act="start">Start again on page A (not part of the test, asks nothing)</button>';
    h += '</section>';
    h += '<section><h2>2. Camera</h2><p>Tap, let it show the camera, it stops after 3 seconds.</p>' +
      '<button data-act="cam">Camera</button><p id="camstatus"></p></section>';
    h += '<section><h2>3. Leave and come back</h2>' +
      '<p>App switch: tap the button, go to the home screen for 5 seconds, then come back to this app.</p>' +
      '<button data-act="arm">Start app-switch test</button>' + (window.__armed ? '<p class="ok">Waiting: switch away now and come back.</p>' : '') +
      '<p>Each time you come back after a while, tap what you did in the box at the top.</p></section>';
    h += '<section><h2>4. No connection</h2><p>Turn on Airplane Mode, tap a "Go to" button, answer what happened, then turn Airplane Mode off.</p></section>';
    h += '<section><h2>5. Network now (for timing)</h2><div class="row"><button data-act="net" data-v="wifi">Wi-Fi</button><button data-act="net" data-v="cellular">Cellular</button></div><p>Set now: ' + esc(loadRes().net) + '</p></section>';
    h += '<section><h2>Results</h2><button class="copy" data-act="copy">Copy results</button><p id="copied"></p><pre id="results">' + esc(text) + '</pre></section>';
    h += '<section><button class="ghost" data-act="wipe">Clear all test data</button></section>';
    app.innerHTML = h;
  }

  function copy() {
    recheck();
    render();
    var text = lines().join('\n');
    var said = function (m) { var c = document.getElementById('copied'); if (c) c.textContent = m; };
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var ok = document.execCommand('copy'); document.body.removeChild(ta);
        said(ok ? 'Copied. Paste it into a message.' : 'Could not copy. Press and hold the results to select them.');
      } catch (e) { said('Could not copy. Press and hold the results to select them.'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { said('Copied. Paste it into a message.'); }, fallback);
    } else fallback();
  }

  function onClick(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el || cleared) return;
    var act = el.getAttribute('data-act');
    if (act === 'hop') {
      var kind = el.getAttribute('data-kind');
      var addr = hopTo(kind);
      if (kind === 'link') { el.setAttribute('href', addr); return; }   // the browser follows the link itself
      ev.preventDefault();
      if (kind === 'assign') location.assign(addr); else location.replace(addr);
      return;
    }
    if (act === 'start') { put('l', 'probeStart', { t: Date.now() }); location.replace('./'); return; }
    if (act === 'ans') { answer(el.getAttribute('data-id'), el.getAttribute('data-v')); render(); return; }
    if (act === 'tag') {
      if (!promptable()) { render(); return; }
      var v = el.getAttribute('data-v');
      visit.tag = v; patchEntry(visit.n, { tag: v });
      if (v !== 'none') { var snap = JSON.parse(JSON.stringify(visit)); change(function (r) { r.tags[v] = snap; }); }
      render(); return;
    }
    if (act === 'cam') { camera(); return; }
    if (act === 'arm') { armSwitch(); return; }
    if (act === 'net') { var nv = el.getAttribute('data-v'); change(function (r) { r.net = nv; }); render(); return; }
    if (act === 'copy') { copy(); return; }
    if (act === 'wipe') {
      if (window.confirm('Clear every result on this phone for this test?')) {
        if (cam) { try { cam.stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) { /* ignore */ } cam = null; }
        wipe(); render();
      }
    }
  }

  // ---- start --------------------------------------------------------------------------------
  var h = parseHash();
  if (h && KINDS.indexOf(h.hop) >= 0 && h.tok) scoreHop(h);
  // A back move after a hop (the P3 swipe) that reloads a page shows up as a back_forward open.
  if (navType() === 'back_forward') noteBack('reloaded');
  // An app-switch test armed before this page was reloaded.
  var armLeft = get('l', 'probeArm');
  if (armLeft && armLeft.pg === PAGE) { change(function (r) { r.p3switch = { reloaded: 'YES', at: Date.now(), pg: PAGE }; }); put('l', 'probeArm', null); }
  var started = get('l', 'probeStart');
  if (started) put('l', 'probeStart', null);
  var isStart = !!(started && PAGE === 'A' && !arrived && Date.now() - started.t < 30000);
  recordOpen(navType(), { hop: arrived && !arrived.repeat ? arrived.kind : isStart ? 'start' : '' });

  var hiddenAt = null;
  window.addEventListener('pageshow', function (e) {
    if (cleared) return;
    logEvent('pageshow', { p: !!e.persisted });
    if (e.persisted) {
      noteBack('restored');
      Q = null; R = loadRes();
      arrived = null; recordOpen('restored');
    }
    render();
  });
  window.addEventListener('pagehide', function (e) { stopCam('page left'); logEvent('pagehide', { p: !!e.persisted }); });
  document.addEventListener('visibilitychange', function () {
    if (cleared) return;
    logEvent('vis', { v: document.visibilityState });
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); stopCam('page hidden'); return; }
    var away = hiddenAt ? Date.now() - hiddenAt : -1;
    hiddenAt = null;
    checkSwitch();
    // Read both values again on every return: a page that was never reloaded must not repeat an old answer.
    if (!(visit && visit.doc === DOC && Date.now() - visit.t < 2000)) {
      if (away < 0 || away >= 10000 || valuesGone()) recordOpen('resume', { away: away }); else lastCheck = Date.now();
    }
    render();
  });
  document.addEventListener('click', onClick);
  render();
  measurePaint();
  window.__probe = { lines: lines, page: PAGE, render: render, start: START };
})();
