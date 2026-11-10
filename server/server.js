// Hmong Legend — เซิร์ฟเวอร์ออนไลน์ Phase 5 รอบแรก
// หน้าที่รอบนี้: บัญชี + โทเคน, เห็นผู้เล่นคนอื่นในโซนเดียวกัน, ตรวจความเร็ว/ขอบแมพ/การย้ายโซน,
// บันทึกตัวละคร, กลับเข้าเกมหลังเน็ตหลุด
// ยังไม่ทำในรอบนี้: การต่อสู้และรางวัลบนเซิร์ฟเวอร์ (ดู docs/server-authority.md)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const DB = require('./db');

const CONF = {
  port: +(process.env.PORT || 8080),
  dbFile: process.env.DB_FILE || path.join(__dirname, 'data', 'hmong.db'),
  gameFile: process.env.GAME_FILE || path.join(__dirname, '..', 'game', 'index.html'),
  tickHz: 10,               // ส่ง snapshot 10 ครั้ง/วินาที
  saveEverySec: 30,         // บันทึกลงฐานข้อมูลทุก 30 วินาที และตอนออก
  sessionTtlMs: 24 * 3600e3,
  T: 32, W: 48 * 32, H: 32 * 32,
  speed: 110,               // ต้องตรงกับ CFG.player.speed ในเกม
  burst: 160,               // เผื่อท่าพุ่ง (ไกลสุด 120 px) + ความหน่วงเครือข่าย
  maxMsgPerSec: 40, maxMsgBytes: 1024,
  maxLv: 100, maxJob: 50,
};
const T = CONF.T;
// จุดที่วาร์ปไปได้ (เริ่มเกม ประตูโซน ปุ่มทดสอบ จุดเกิดหลังตาย) — คัดจาก ZONES ใน game/index.html
const ENTRY = {
  village: [[11.5 * T, 15.6 * T], [45.5 * T, 30.1 * T]],
  field: [[2.5 * T, 15 * T], [2.5 * T, 15.5 * T], [4.5 * T, 15 * T]],
};
const START = { zone: 'village', x: ENTRY.village[0][0], y: ENTRY.village[0][1] };
const nearEntry = (zone, x, y) => (ENTRY[zone] || []).some(([ex, ey]) => Math.hypot(ex - x, ey - y) <= 3 * T);

function createServer(opts = {}) {
  const conf = { ...CONF, ...opts };
  fs.mkdirSync(path.dirname(conf.dbFile), { recursive: true });
  const db = DB.open(conf.dbFile);
  const online = new Map(); // account_id -> player
  const log = (...a) => { if (!conf.quiet) console.log(new Date().toISOString(), ...a); };

  const readBody = req => new Promise((res, rej) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 4096) { rej(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch (e) { rej(e); } });
  });
  const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const validName = n => typeof n === 'string' && /^[\p{L}\p{N}_]{3,16}$/u.test(n);
  const validPass = p => typeof p === 'string' && p.length >= 6 && p.length <= 64;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
        return fs.createReadStream(conf.gameFile).pipe(res);
      }
      if (req.method === 'GET' && url.pathname === '/api/hello') return json(res, 200, { game: 'hmong-legend', online: online.size });
      if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
        const b = await readBody(req);
        if (!validName(b.name)) return json(res, 400, { error: 'ชื่อต้องยาว 3–16 ตัว ใช้ตัวอักษร ตัวเลข หรือ _' });
        if (!validPass(b.pass)) return json(res, 400, { error: 'รหัสผ่านต้องยาว 6–64 ตัว' });
        const r = url.pathname === '/api/register' ? db.register(b.name, b.pass, START) : db.login(b.name, b.pass);
        if (r.error) return json(res, url.pathname === '/api/register' ? 409 : 401, r);
        log('auth', url.pathname, b.name);
        return json(res, 200, { token: db.newSession(r.id, conf.sessionTtlMs), name: b.name });
      }
      json(res, 404, { error: 'not found' });
    } catch (e) { json(res, 400, { error: 'bad request' }); }
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: conf.maxMsgBytes });
  const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  const flush = p => { try { db.save(p.c); p.dirty = false; } catch (e) { log('save error', e.message); } };

  wss.on('connection', ws => {
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
        if (old) { flush(old); send(old.ws, { t: 'err', code: 'replaced', msg: 'บัญชีนี้เข้าเกมจากที่อื่น' }); old.ws.close(); }
        const c = old ? old.c : db.character(s.account_id);
        p = { ws, c, id: s.account_id, moving: false, allow: conf.burst, lastT: now, dirty: false };
        online.set(p.id, p);
        log('join', c.name, c.zone, Math.round(c.x), Math.round(c.y));
        return send(ws, { t: 'welcome', id: p.id, name: c.name, state: { zone: c.zone, x: c.x, y: c.y, dir: c.dir, lv: c.lv, exp: c.exp, job: c.job, jexp: c.jexp } });
      }
      if (m.t === 'mv') {
        const c = p.c, x = +m.x, y = +m.y, zone = String(m.zone), dir = 'NSEW'.includes(m.dir) && m.dir.length === 1 ? m.dir : c.dir;
        p.allow = Math.min(conf.burst, p.allow + (now - p.lastT) / 1000 * conf.speed * 1.3); p.lastT = now;
        const inMap = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= conf.W && y <= conf.H;
        const d = Math.hypot(x - c.x, y - c.y);
        let ok = inMap && ENTRY[zone] && (zone === c.zone ? d <= p.allow || nearEntry(zone, x, y) : nearEntry(zone, x, y));
        if (!ok) { p.rejects = (p.rejects || 0) + 1; log('reject mv', c.name, zone, Math.round(x), Math.round(y), 'd=' + Math.round(d)); return send(ws, { t: 'fix', zone: c.zone, x: c.x, y: c.y }); }
        if (zone === c.zone && !nearEntry(zone, x, y)) p.allow -= d;
        c.zone = zone; c.x = x; c.y = y; c.dir = dir; p.moving = !!m.moving; p.dirty = true;
        return;
      }
      if (m.t === 'prog') {
        // ชั่วคราว: รับค่าจากเครื่องผู้เล่นโดยตรวจเพียงขอบเขต — จะย้ายการคิดรางวัลมาที่เซิร์ฟเวอร์ในขั้นถัดไป
        const c = p.c, I = v => Math.max(0, Math.floor(+v || 0));
        c.lv = Math.min(conf.maxLv, Math.max(1, I(m.lv))); c.exp = I(m.exp); c.job = Math.min(conf.maxJob, Math.max(1, I(m.job))); c.jexp = I(m.jexp);
        p.dirty = true; return;
      }
    });
    ws.on('close', () => {
      if (p && online.get(p.id) === p) { flush(p); online.delete(p.id); log('leave', p.c.name); }
    });
  });

  const tick = setInterval(() => {
    const byZone = {};
    for (const p of online.values()) (byZone[p.c.zone] ||= []).push({ id: p.id, name: p.c.name, x: Math.round(p.c.x), y: Math.round(p.c.y), dir: p.c.dir, moving: p.moving, lv: p.c.lv });
    for (const p of online.values()) send(p.ws, { t: 'snap', players: (byZone[p.c.zone] || []).filter(o => o.id !== p.id) });
  }, 1000 / conf.tickHz);
  const saver = setInterval(() => { for (const p of online.values()) if (p.dirty) flush(p); }, conf.saveEverySec * 1000);

  return {
    server, online, db,
    listen: port => new Promise(r => server.listen(port ?? conf.port, () => r(server.address().port))),
    close: () => new Promise(r => {
      clearInterval(tick); clearInterval(saver);
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
