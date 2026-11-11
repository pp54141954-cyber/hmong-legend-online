// Hmong Legend — เซิร์ฟเวอร์ออนไลน์ Phase 5 รอบแรก
// หน้าที่รอบนี้: บัญชี + โทเคน, เห็นผู้เล่นคนอื่นในโซนเดียวกัน, ตรวจความเร็ว/ขอบแมพ/การย้ายโซน,
// บันทึกตัวละคร, กลับเข้าเกมหลังเน็ตหลุด
// V2-R3: มอนสเตอร์ การต่อสู้ ดาเมจ รางวัล HP การตาย ตัดสินบนเซิร์ฟเวอร์ (server/sim.js)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const DB = require('./db');
const { createSim } = require('./sim');

const CONF = {
  port: +(process.env.PORT || 8080),
  dbFile: process.env.DB_FILE || path.join(__dirname, 'data', 'hmong.db'),
  gameFile: process.env.GAME_FILE || path.join(__dirname, '..', 'game', 'index.html'),
  tickHz: 10,               // ส่ง snapshot 10 ครั้ง/วินาที
  simHz: 20,                // จำลองโลก 20 ครั้ง/วินาที
  admins: (process.env.ADMIN_USERS || '').split(',').map(s => s.trim()).filter(Boolean), // ชื่อบัญชีผู้ดูแล (ตั้งใน Render → Environment) — ไม่ฝังในโค้ด
  allowDebug: process.env.ALLOW_DEBUG === '1', // ปุ่มทดสอบ (ตั้ง Job 30) ใช้ได้เฉพาะเซิร์ฟเวอร์ทดสอบ
  saveEverySec: 30,         // บันทึกลงฐานข้อมูลทุก 30 วินาที และตอนออก
  sessionTtlMs: 24 * 3600e3,
  T: 32, W: 48 * 32, H: 32 * 32,
  speed: 110,               // ต้องตรงกับ CFG.player.speed ในเกม
  burst: 160,               // เผื่อท่าพุ่ง (ไกลสุด 120 px) + ความหน่วงเครือข่าย
  maxMsgPerSec: 40, maxMsgBytes: 1024,
  maxLv: 100, maxJob: 50,
  // ความปลอดภัยสำหรับเปิดใช้งานจริง (V2-R22) — ตั้งผ่าน env ได้
  authPerMin: +(process.env.AUTH_PER_MIN ?? 20),      // สมัคร/ล็อกอินต่อ IP ต่อนาที (0 = ไม่จำกัด)
  wsPerIp: +(process.env.WS_PER_IP ?? 8),            // การเชื่อมต่อพร้อมกันต่อ IP (0 = ไม่จำกัด)
  trustProxy: process.env.TRUST_PROXY === '1',        // อยู่หลัง Caddy/nginx: อ่าน IP จาก X-Forwarded-For
  allowedOrigin: process.env.ALLOWED_ORIGIN || '',    // เช่น https://game.example.com (ว่าง = ไม่ตรวจ)
};
const T = CONF.T;
// จุดที่วาร์ปไปได้ (เริ่มเกม ประตูโซน ปุ่มทดสอบ จุดเกิดหลังตาย) — คัดจาก ZONES ใน game/index.html
// จุดที่วาร์ปเข้าโซนได้: จุดเริ่มของทุกโซน, ปลายทางของทุกประตู, ปุ่มทดสอบไปทุ่ง (+2 ช่อง) — คำนวณจาก ZONES ใน game/index.html
const WORLD = require('../shared/world.js');
const ENTRY = {};
for (const [id, D] of Object.entries(WORLD.ZONES)) (ENTRY[id] ||= []).push([D.start[0], D.start[1]]);
for (const D of Object.values(WORLD.ZONES)) for (const e of D.exits || []) (ENTRY[e.to] ||= []).push([(e.tx + .5) * T, (e.ty + .5) * T]);
ENTRY.field.push([WORLD.ZONES.field.start[0] + 2 * T, WORLD.ZONES.field.start[1]]);
const HOME = WORLD.CFG.player.home;
// ย้ายโซนผ่าน mv ได้เฉพาะเมื่อยืนอยู่ใกล้ทางออกที่ไปโซนนั้น (เดิมกระโดดไปจุดเข้าโซนไหนก็ได้) — ย้ายไกลใช้วาร์ป
const nearExitTo = (from, to, x, y) => (WORLD.ZONES[from].exits || []).some(e => e.to === to && x >= (e.x - 3) * T && x <= (e.x + e.w + 3) * T && y >= (e.y - 3) * T && y <= (e.y + e.h + 3) * T);
const START = { zone: HOME, x: WORLD.ZONES[HOME].start[0], y: WORLD.ZONES[HOME].start[1] };
const nearEntry = (zone, x, y) => (ENTRY[zone] || []).some(([ex, ey]) => Math.hypot(ex - x, ey - y) <= 3 * T);

function createServer(opts = {}) {
  const conf = { ...CONF, ...opts };
  fs.mkdirSync(path.dirname(conf.dbFile), { recursive: true });
  const db = DB.open(conf.dbFile);
  const online = new Map(); // account_id -> player
  const sim = createSim();
  const log = (...a) => { if (!conf.quiet) console.log(new Date().toISOString(), ...a); };

  const readBody = req => new Promise((res, rej) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 4096) { rej(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch (e) { rej(e); } });
  });
  const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const validName = n => typeof n === 'string' && /^[\p{L}\p{N}_]{3,16}$/u.test(n);
  const validPass = p => typeof p === 'string' && p.length >= 6 && p.length <= 64;

  const ipOf = req => (conf.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const authHits = new Map(); // ip -> [เวลา]
  const authLimited = ip => { if (!conf.authPerMin) return false; const now = Date.now(), a = (authHits.get(ip) || []).filter(t => now - t < 60000); a.push(now); authHits.set(ip, a); return a.length > conf.authPerMin; };
  setInterval(() => { const now = Date.now(); for (const [ip, a] of authHits) if (!a.some(t => now - t < 60000)) authHits.delete(ip); }, 60000).unref();
  // หัวข้อความปลอดภัยทุกคำตอบ: เกมใช้สคริปต์/สไตล์ในไฟล์เดียว รูป data: และเชื่อมต่อเฉพาะเซิร์ฟเวอร์นี้
  const SEC_HEADERS = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-frame-options': 'SAMEORIGIN',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'" };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    for (const [k, v] of Object.entries(SEC_HEADERS)) res.setHeader(k, v);
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, online: online.size, uptime: Math.round(process.uptime()) });
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
        return fs.createReadStream(conf.gameFile).pipe(res);
      }
      // ภาพแผนที่แยกไฟล์ (V2-R14): /maps/<ชื่อ>.webp เท่านั้น
      const mm = /^\/(maps|sprites)\/([a-z0-9_]+)\.(webp)$/.exec(url.pathname) || /^\/(icons)\/([a-z0-9_]+)\.(png)$/.exec(url.pathname); // ภาพแผนที่/มอนสเตอร์/ไอคอนสกิล (รับเฉพาะชื่อ a-z0-9_)
      if (req.method === 'GET' && mm) {
        const f = path.join(path.dirname(conf.gameFile), mm[1], mm[2] + '.' + mm[3]);
        if (!fs.existsSync(f)) return json(res, 404, { error: 'not found' });
        res.writeHead(200, { 'content-type': 'image/' + mm[3], 'cache-control': 'public, max-age=86400' });
        return fs.createReadStream(f).pipe(res);
      }
      if (req.method === 'GET' && url.pathname === '/api/stats' && (conf.stats || process.env.STATS === '1')) {
        const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(b.length * p))].toFixed(2) : 0; };
        const sec = (Date.now() - ST.since) / 1000, r = { online: online.size, sec: +sec.toFixed(1), simP50: q(ST.simMs, .5), simP99: q(ST.simMs, .99), simMax: q(ST.simMs, 1),
          tickP50: q(ST.tickMs, .5), tickP99: q(ST.tickMs, .99), tickMax: q(ST.tickMs, 1), kbPerSec: +(ST.bytes / 1024 / sec).toFixed(1), msgPerSec: +(ST.msgs / sec).toFixed(0),
          rssMB: +(process.memoryUsage().rss / 1048576).toFixed(0), cpuSec: +((process.cpuUsage().user + process.cpuUsage().system) / 1e6).toFixed(2) };
        if (url.searchParams.get('reset')) { ST.simMs = []; ST.tickMs = []; ST.bytes = 0; ST.msgs = 0; ST.since = Date.now(); }
        return json(res, 200, r);
      }
      if (req.method === 'GET' && url.pathname === '/api/hello') return json(res, 200, { game: 'hmong-legend', online: online.size });
      if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
        if (authLimited(ipOf(req))) return json(res, 429, { error: 'ลองบ่อยเกินไป กรุณารอ 1 นาที' });
        const b = await readBody(req);
        if (!validName(b.name)) return json(res, 400, { error: 'ชื่อต้องยาว 3–16 ตัว ใช้ตัวอักษร ตัวเลข หรือ _' });
        if (!validPass(b.pass)) return json(res, 400, { error: 'รหัสผ่านต้องยาว 6–64 ตัว' });
        const r = url.pathname === '/api/register' ? db.register(b.name, b.pass, conf.startZone ? { zone: conf.startZone, x: WORLD.ZONES[conf.startZone].start[0], y: WORLD.ZONES[conf.startZone].start[1] } : START) : db.login(b.name, b.pass);
        if (r.error) return json(res, url.pathname === '/api/register' ? 409 : 401, r);
        log('auth', url.pathname, b.name);
        return json(res, 200, { token: db.newSession(r.id, conf.sessionTtlMs), name: b.name });
      }
      json(res, 404, { error: 'not found' });
    } catch (e) { json(res, 400, { error: 'bad request' }); }
  });

  // บีบอัดข้อความ (permessage-deflate) ลดข้อมูลผ่านเน็ตมือถือ — เบราว์เซอร์ทุกตัวรองรับ; ปิดได้ด้วย WS_DEFLATE=0 (V2-R20)
  const deflate = process.env.WS_DEFLATE === '0' ? false : { threshold: 256, zlibDeflateOptions: { level: 3, memLevel: 7 }, serverNoContextTakeover: false, clientNoContextTakeover: true, serverMaxWindowBits: 12 };
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: conf.maxMsgBytes, perMessageDeflate: deflate });
  const send = (ws, o) => { if (ws.readyState === 1) { const s = JSON.stringify(o); ST.bytes += s.length; ST.msgs++; ws.send(s); } };
  const flush = p => { try { db.save(p.c); p.dirty = false; } catch (e) { log('save error', e.message); } };

  const wsByIp = new Map();
  wss.on('connection', (ws, req) => {
    // ต้นทางที่อนุญาต + จำนวนการเชื่อมต่อต่อ IP (V2-R22)
    if (conf.allowedOrigin && req.headers.origin !== conf.allowedOrigin) return ws.close(1008, 'origin');
    const ip = ipOf(req), nIp = (wsByIp.get(ip) || 0) + 1;
    if (conf.wsPerIp && nIp > conf.wsPerIp) return ws.close(1008, 'too many');
    wsByIp.set(ip, nIp); ws.on('close', () => { const n = (wsByIp.get(ip) || 1) - 1; if (n) wsByIp.set(ip, n); else wsByIp.delete(ip); });
    let p = null, msgs = 0, win = Date.now();
    ws.on('message', raw => {
      const now = Date.now();
      if (now - win > 1000) { win = now; msgs = 0; }
      if (++msgs > conf.maxMsgPerSec) return; // จำกัดอัตราข้อความ
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (!p) {
        if (m.t !== 'hello') return;
        const s = db.session(m.token);
        if (!s) { send(ws, { t: 'err', code: 'auth', msg: 'กรุณาเข้าสู่ระบบใหม่' }); return ws.close(); }
        const old = online.get(s.account_id);
        if (old) { flush(old); send(old.ws, { t: 'err', code: 'replaced', msg: 'บัญชีนี้เข้าเกมจากที่อื่น' }); old.ws.close(); p = old; p.ws = ws; p.allow = conf.burst; p.lastT = now; }
        else { p = { ws, c: db.character(s.account_id), id: s.account_id, moving: false, allow: conf.burst, lastT: now, dirty: false }; sim.addPlayer(p); online.set(p.id, p); }
        p.bagDirty = true; p.skDirty = true; p.netZone = null; // เข้าเกม/ต่อใหม่: ส่ง snapshot เต็ม // ส่งกระเป๋าและสกิลเต็มชุดใน snapshot แรกหลังเข้าเกม/ต่อใหม่
        const c = p.c;
        log('join', c.name, c.zone, Math.round(c.x), Math.round(c.y));
        p.admin = conf.admins.includes(c.name); if (p.admin) log('admin join', c.name);
        return send(ws, { t: 'welcome', id: p.id, name: c.name, auth: true, admin: p.admin, cls: sim.clsOf(p), pickCls: !c.clsset, state: { zone: c.zone, x: c.x, y: c.y, dir: c.dir, lv: c.lv, exp: c.exp, job: c.job, jexp: c.jexp, hp: p.hp, maxHp: p.maxHp } });
      }
      if (m.t === 'mv') {
        if (p.dead) return;
        const c = p.c, x = +m.x, y = +m.y, zone = String(m.zone), dir = 'NSEW'.includes(m.dir) && m.dir.length === 1 ? m.dir : c.dir;
        p.allow = Math.min(conf.burst, p.allow + (now - p.lastT) / 1000 * conf.speed * (1 + (p.bon ? p.bon.spd : 0)) * 1.3); p.lastT = now;
        const inMap = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= conf.W && y <= conf.H;
        const d = Math.hypot(x - c.x, y - c.y);
        let ok = inMap && ENTRY[zone] && (zone === c.zone ? (d <= p.allow && sim.pathClear(zone, c.x, c.y, x, y)) : nearEntry(zone, x, y) && nearExitTo(c.zone, zone, c.x, c.y));
        if (!ok) { p.rejects = (p.rejects || 0) + 1; log('reject mv', c.name, zone, Math.round(x), Math.round(y), 'd=' + Math.round(d)); return send(ws, { t: 'fix', zone: c.zone, x: c.x, y: c.y }); }
        if (zone === c.zone && !nearEntry(zone, x, y)) p.allow -= d;
        c.zone = zone; c.x = x; c.y = y; c.dir = dir; p.moving = !!m.moving; p.dirty = true;
        return;
      }
      if (m.t === 'act') {
        // คำขอโจมตี (k='b') หรือสกิล (k=1..11) — เซิร์ฟเวอร์ตรวจคูลดาวน์ Job การตาย แล้วคิดผลเอง
        if ('NSEW'.includes(m.dir) && String(m.dir).length === 1) p.c.dir = m.dir;
        const key = m.k === 'b' ? 'b' : Math.floor(+m.k);
        const r = sim.act(p, key, now / 1000);
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; send(ws, { t: 'deny', k: m.k, r }); }
        return;
      }
      if (m.t === 'inv') {
        const r = sim.inv(p, String(m.op), m.op === 'unequip' ? String(m.slot) : m.slot, now / 1000);
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; send(ws, { t: 'deny', k: 'inv', op: m.op, r }); }
        return;
      }
      if (m.t === 'skill') {
        const r = m.op === 'up' ? sim.learn(p, m.name) : 'invalid';
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; send(ws, { t: 'deny', k: 'skill', name: m.name, r }); }
        return;
      }
      if (m.t === 'warp') { // วาร์ป: เซิร์ฟเวอร์ตรวจโซน/สถานะ/คูลดาวน์ แล้วย้ายเอง
        const zone = String(m.zone), D = WORLD.ZONES[zone];
        const r = !D || zone === p.c.zone || !ENTRY[zone] ? 'invalid' : p.dead ? 'dead' : now - (p.warpAt || 0) < 5000 && !(m.dbg && conf.allowDebug) ? 'cooldown' : 'ok'; // ปุ่มทดสอบข้ามคูลดาวน์ได้เฉพาะเซิร์ฟเวอร์ทดสอบ
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; return send(ws, { t: 'deny', k: 'warp', zone, r }); }
        p.warpAt = now; Object.assign(p.c, { zone, x: D.start[0], y: D.start[1] }); p.dirty = true; p.allow = 0;
        log('warp', p.c.name, zone);
        return send(ws, { t: 'warp', zone, x: D.start[0], y: D.start[1] });
      }
      if (m.t === 'cls') {
        const r = sim.setClass(p, m.cls, !!m.first);
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; send(ws, { t: 'deny', k: 'cls', r }); }
        return;
      }
      if (m.t === 'adm') { // คำสั่งแอดมิน: เฉพาะบัญชีใน ADMIN_USERS
        if (!p.admin) { p.denied = (p.denied || 0) + 1; log('deny adm', p.c.name, m.op); return send(ws, { t: 'deny', k: 'adm', r: 'not-admin' }); }
        if (m.op === 'warp') { const D = WORLD.ZONES[String(m.zone)]; if (!D) return send(ws, { t: 'adm', op: m.op, r: 'invalid' }); Object.assign(p.c, { zone: String(m.zone), x: D.start[0], y: D.start[1] }); p.dirty = true; p.allow = 0; log('adm', p.c.name, 'warp', m.zone); send(ws, { t: 'warp', zone: p.c.zone, x: p.c.x, y: p.c.y }); return send(ws, { t: 'adm', op: m.op, r: 'ok' }); }
        const r = sim.admin(p, String(m.op), m);
        log('adm', p.c.name, m.op, m.n ?? m.id ?? m.mode ?? '', r);
        return send(ws, { t: 'adm', op: m.op, r, god: !!p.god });
      }
      if (m.t === 'stat') {
        const r = sim.statOp(p, String(m.op), String(m.k), m.n);
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; send(ws, { t: 'deny', k: 'stat', op: m.op, r }); }
        return;
      }
      if (m.t === 'party') {
        const r = sim.party(p, String(m.op), m.name, now / 1000);
        if (r !== 'ok') { p.denied = (p.denied || 0) + 1; send(ws, { t: 'deny', k: 'party', op: m.op, r }); }
        return;
      }
      if (m.t === 'dbg') {
        if (!conf.allowDebug) return send(ws, { t: 'deny', k: 'dbg', r: 'debug-off' });
        p.c.job = Math.max(p.c.job, 30); p.c.jexp = 0; p.dirty = true; p.skDirty = true; return;
      }
    });
    ws.on('close', () => {
      if (p && online.get(p.id) === p && p.ws === ws) { flush(p); online.delete(p.id); sim.removePlayer(p); log('leave', p.c.name); }
    });
  });

  let lastSim = Date.now();
  // ตัววัดประสิทธิภาพ (V2-R20): เวลาคิดโลก/ส่ง snapshot ต่อรอบ และปริมาณข้อมูลที่ส่ง — ดูได้ที่ /api/stats เมื่อ STATS=1
  const ST = { simMs: [], tickMs: [], bytes: 0, msgs: 0, since: Date.now() };
  const keep = (a, v) => { a.push(v); if (a.length > 2000) a.shift(); };
  const simT = setInterval(() => { const n = Date.now(), t0 = performance.now(); sim.step(Math.min(.1, (n - lastSim) / 1000), n / 1000); keep(ST.simMs, performance.now() - t0); lastSim = n; }, 1000 / conf.simHz);
  const R = v => Math.round(v);
  // snapshot แบบย่อ (V2-R20): แถวตัวเลขแทน object, ส่งเฉพาะสิ่งที่อยู่ในระยะมองเห็น (AOI), มอนสเตอร์ส่งเฉพาะที่เปลี่ยน
  const TI = Object.fromEntries(Object.keys(WORLD.CFG.monsters).map((k, i) => [k, i]));
  const STI = { idle: 0, chase: 1, return: 2, dead: 3 }, DI = { N: 0, S: 1, E: 2, W: 3 };
  const AOI = conf.aoi || 820; let tickN = 0;
  const tick = setInterval(() => { const t0 = performance.now(); tickN++;
    const pz = {}, mz = {}, ez = {};
    for (const p of online.values()) (pz[p.c.zone] ||= []).push([p.id, R(p.c.x), R(p.c.y), DI[p.c.dir] ?? 1, p.moving ? 1 : 0, p.c.lv, p.dead ? 1 : 0]);
    for (const [id, z] of Object.entries(sim.zones)) {
      mz[id] = z.mons.map(m => ({ m, row: [m.id, TI[m.type], R(m.x), R(m.y), Math.max(0, R(m.hp)), STI[m.state] ?? 0, DI[m.dir] ?? 1, m.markT > 0 ? 1 : 0] }));
      ez[id] = z.events; z.events = [];
    }
    const W = sim.WT, tm = { night: W.night, blood: W.blood, world: W.world, atk: W.atk, exp: W.exp, name: W.name, left: W.left, worldLeft: W.worldLeft };
    for (const p of online.values()) {
      const c = p.c, near = (x, y) => Math.abs(x - c.x) < AOI && Math.abs(y - c.y) < AOI;
      if (p.netZone !== c.zone) { p.netZone = c.zone; p.seenM = new Map(); p.seenP = new Set(); p.full = true; }
      const out = { t: 'snap' };
      if (p.full) out.mf = 1;
      if (p.full || tickN % 10 === 0) out.tm = tm;
      // ผู้เล่นอื่นในระยะ + ชื่อเฉพาะคนที่เครื่องนี้ยังไม่รู้จัก
      const ps = (pz[c.zone] || []).filter(r => r[0] !== p.id && near(r[1], r[2]));
      const pn = {}; for (const r of ps) if (!p.seenP.has(r[0])) { p.seenP.add(r[0]); pn[r[0]] = online.get(r[0]) ? online.get(r[0]).c.name : '?'; }
      out.ps = ps; if (Object.keys(pn).length) out.pn = pn;
      // มอนสเตอร์ในระยะ (หรือกำลังไล่เรา): ส่งเฉพาะแถวที่เปลี่ยน, ส่งรายการที่ออกนอกระยะ
      const md = [], cur = new Set();
      for (const { m, row } of mz[c.zone] || []) {
        if (!near(m.x, m.y) && m.target !== p) continue;
        cur.add(row[0]); const k = row.join(',');
        if (p.seenM.get(row[0]) !== k) { p.seenM.set(row[0], k); md.push(row); }
      }
      const mr = []; for (const id of p.seenM.keys()) if (!cur.has(id)) { mr.push(id); p.seenM.delete(id); }
      if (md.length) out.md = md; if (mr.length) out.mr = mr;
      const ev = (ez[c.zone] || []).filter(e => cur.has(e.id) || e.by === p.id); if (ev.length) out.ev = ev;
      out.me = { zone: c.zone, x: R(c.x), y: R(c.y), hp: Math.ceil(p.hp), maxHp: p.maxHp, atk: p.atk, def: p.def, lv: c.lv, exp: c.exp, job: c.job, jexp: c.jexp, dead: p.dead,
        buffT: +p.buffT.toFixed(1), guardT: +p.guardT.toFixed(1), ...(p.personal.length ? { ev: p.personal } : {}),
        ...(p.bagDirty ? { bag: c.bag, eq: c.eq } : {}),
        ...(p.skDirty ? { sk: c.sk, pts: sim.freePoints(p), bon: p.bon, st: c.st, spts: sim.statFree(p), cls: sim.clsOf(p) } : {}),
        ...(p.partyDirty || (p.party && tickN % 10 === 0) ? { party: sim.partyView(p) } : {}) };
      send(p.ws, out);
      p.personal = []; p.bagDirty = false; p.skDirty = false; p.partyDirty = false; p.full = false;
    }
  keep(ST.tickMs, performance.now() - t0); }, 1000 / conf.tickHz);
  const saver = setInterval(() => { for (const p of online.values()) if (p.dirty) flush(p); }, conf.saveEverySec * 1000);

  return {
    server, online, db, sim,
    listen: port => new Promise(r => server.listen(port ?? conf.port, () => r(server.address().port))),
    close: () => new Promise(r => {
      clearInterval(tick); clearInterval(saver); clearInterval(simT);
      for (const p of online.values()) flush(p);
      for (const c of wss.clients) c.terminate();
      wss.close(); server.close(() => { db.close(); r(); });
    }),
  };
}

if (require.main === module) {
  const s = createServer();
  s.listen().then(port => console.log('Hmong Legend server: http://localhost:' + port));
  const stop = () => s.close().then(() => process.exit(0));
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
module.exports = { createServer, CONF, ENTRY };
