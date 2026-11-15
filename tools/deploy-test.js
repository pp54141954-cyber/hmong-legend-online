// ทดสอบชุดติดตั้งจริง: รัน image Docker (และถ้ามี DOMAIN=localhost ก็ทดสอบผ่าน Caddy HTTPS) แล้วตรวจ
// สุขภาพ, หัวข้อความปลอดภัย, ไฟล์เกม/ภาพ, จำกัดการล็อกอิน, จำกัดต้นทาง/จำนวนการเชื่อมต่อ, ข้อมูลอยู่รอดหลังรีสตาร์ต,
// สำรองฐานข้อมูล, และเปิดเกมในเบราว์เซอร์จริง (ไม่มี error / CSP ไม่บล็อก) — สมัคร → เข้าเกม
// รัน: docker build -t hmong-legend:test .  &&  node tools/deploy-test.js [image] [https-base-url]
const { execSync } = require('child_process');
const path = require('path');
const WebSocket = require(path.join(__dirname, '../server/node_modules/ws'));
const { chromium, devices } = require('playwright');
const IMG = process.argv[2] || 'hmong-legend:test', HTTPS = process.argv[3] || '';
const sh = c => execSync(c, { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; const rec = (n, p, d) => { results.push({ n, p }); console.log((p ? 'PASS ' : 'FAIL ') + n + (d ? ' — ' + d : '')); };

(async () => {
  const name = 'hl-deploy-test', port = 18080 + Math.floor(Math.random() * 1000), ORIGIN = 'http://127.0.0.1:' + port;
  try { sh('docker rm -f ' + name + ' 2>/dev/null'); } catch {}
  try { sh('docker volume rm hl-deploy-data 2>/dev/null'); } catch {}
  const run = () => sh(`docker run -d --name ${name} -p ${port}:8080 -v hl-deploy-data:/data -e ALLOWED_ORIGIN=${ORIGIN} -e AUTH_PER_MIN=20 -e WS_PER_IP=3 -e TRUST_PROXY=0 ${IMG}`);
  run();
  const B = 'http://127.0.0.1:' + port;
  const up = async () => { for (let i = 0; i < 60; i++) { try { const r = await fetch(B + '/healthz'); if (r.ok) return true; } catch {} await sleep(250); } return false; };
  rec('container เริ่มทำงาน /healthz ตอบ', await up());
  const h = await fetch(B + '/');
  const H = k => h.headers.get(k) || '';
  rec('หน้าเกมโหลดได้ + หัวข้อความปลอดภัยครบ', h.status === 200 && H('content-security-policy').includes("connect-src 'self'") && H('x-content-type-options') === 'nosniff' && H('x-frame-options') === 'SAMEORIGIN', h.status);
  const files = await Promise.all(['/maps/village2.webp', '/sprites/boar_walk.webp', '/maps/..%2fserver.webp', '/server/server.js', '/api/stats'].map(u => fetch(B + u).then(r => r.status)));
  rec('ภาพแผนที่/มอนสเตอร์ 200 · ไฟล์อื่น/ทางลัด/สถิติ 404', files.join() === '200,200,404,404,404', files.join());
  // บัญชี + จำกัดการลองรหัส
  const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  const reg = await post('/api/register', { name: 'Deploy_A', pass: 'secret123' }); const tok = (await reg.json()).token;
  rec('สมัครบัญชีได้', reg.status === 200 && !!tok);
  let codes = []; for (let i = 0; i < 22; i++) codes.push((await post('/api/login', { name: 'Deploy_A', pass: 'wrongpass' })).status);
  rec('ลองรหัสผิดเกิน 20 ครั้ง/นาที → 429', codes.slice(0, 19).every(c => c === 401) && codes.slice(-2).every(c => c === 429), codes.slice(-4).join(','));
  // WebSocket: ต้นทาง + จำนวนต่อ IP
  const wsTry = origin => new Promise(r => { const ws = new WebSocket(B.replace('http', 'ws') + '/ws', { headers: { origin } }); let got = false;
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token: tok }))); ws.on('message', m => { if (JSON.parse(m).t === 'welcome') { got = true; r({ ok: true, ws }); } });
    ws.on('close', (c) => { if (!got) r({ ok: false, code: c }); }); ws.on('error', () => {}); setTimeout(() => !got && r({ ok: false, code: 'timeout' }), 4000); });
  const bad = await wsTry('https://evil.example');
  rec('WebSocket จากต้นทางอื่นถูกปฏิเสธ', !bad.ok, String(bad.code));
  const c1 = await wsTry(ORIGIN);
  rec('ต้นทางถูกต้องเข้าเกมได้', c1.ok);
  // การเชื่อมต่อเปล่า (ยังไม่ล็อกอิน) — บัญชีเดียวกันซ้อนจะเตะอันเก่าออก จึงทดสอบจำนวนต่อ IP ด้วยการเชื่อมต่อเปล่า
  const raw = () => new Promise(r => { const ws = new WebSocket(B.replace('http', 'ws') + '/ws', { headers: { origin: ORIGIN } }); let st = 'open?';
    ws.on('open', () => { st = 'open'; setTimeout(() => r({ ws, st }), 600); }); ws.on('close', c => { st = 'closed:' + c; }); ws.on('error', () => {}); });
  const extra = [await raw(), await raw()], c4 = await raw();
  rec('เกิน 3 การเชื่อมต่อ/IP ถูกปฏิเสธ (1008)', extra.every(x => x.st === 'open') && c4.st === 'closed:1008', extra.map(x => x.st).join(',') + ' → ' + c4.st);
  for (const c of [c1, ...extra, c4]) if (c.ws) c.ws.close();
  // ข้อมูลอยู่รอดหลังรีสตาร์ต + สำรอง
  await sleep(500);
  sh('docker restart ' + name); await up();
  const re = await post('/api/login', { name: 'Deploy_A', pass: 'secret123' });
  rec('รีสตาร์ต container แล้วบัญชียังอยู่ (volume /data)', re.status === 200 || re.status === 429, String(re.status));
  const bk = sh(`docker exec ${name} node --no-warnings tools/backup-db.js /data/hmong.db /data/backups 14`);
  rec('สำรองฐานข้อมูลขณะทำงาน + integrity ok', /บัญชี 1/.test(bk) && /integrity ok/.test(bk), bk.split('/').pop());
  // เบราว์เซอร์จริง: ไม่มี error, CSP ไม่บล็อก, สมัคร → เข้าเกม
  const urls = [B + '/'].concat(HTTPS ? [HTTPS] : []);
  const browser = await chromium.launch();
  for (const u of urls) {
    const ctx = await browser.newContext({ ...devices['Pixel 7'], ignoreHTTPSErrors: true }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(u); await p.waitForSelector('#net:not([hidden])', { timeout: 8000 }).catch(() => {});
    await p.fill('#netn', 'Deploy_' + (u.startsWith('https') ? 'S' : 'B')); await p.fill('#netp', 'secret123'); await p.click('#netreg');
    let joined = false; for (let i = 0; i < 40 && !joined; i++) { await sleep(150); joined = await p.evaluate(() => !!(window.HLNET && HLNET.joined && HLNET.auth)); }
    await sleep(1500);
    const st = await p.evaluate(() => ({ zone: HL.Z.id, mapW: HL.mapImg(HL.Z.D.painted) ? HL.mapImg(HL.Z.D.painted).naturalWidth : 0, snaps: HLNET.stats.snaps }));
    rec((u.startsWith('https') ? 'HTTPS (Caddy)' : 'HTTP ตรง') + ': เปิดเกม สมัคร เข้าเกม ภาพแผนที่โหลด ไม่มี error/CSP', joined && st.mapW === 1536 && st.snaps > 5 && errs.length === 0, JSON.stringify(st) + (errs.length ? ' ' + errs[0].slice(0, 120) : ''));
    await ctx.close();
  }
  await browser.close();
  sh('docker rm -f ' + name); try { sh('docker volume rm hl-deploy-data'); } catch {}
  const fail = results.filter(r => !r.p).length; console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); try { execSync('docker rm -f hl-deploy-test'); } catch {} process.exit(2); });
