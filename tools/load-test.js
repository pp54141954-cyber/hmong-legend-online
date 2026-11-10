// ทดสอบโหลด: บอทผู้เล่นจริงผ่าน WebSocket (สมัคร → เข้าเกม → เดินบนช่องเดินได้ 10 ครั้ง/วิ → โจมตีทุก 1 วิ)
// เซิร์ฟเวอร์รันเป็น process แยก (วัด CPU/หน่วยความจำของเซิร์ฟเวอร์จริง ไม่ปนกับบอท)
// รัน: node tools/load-test.js [จำนวนต่อโซน=50] [วินาที=30] [โซน=field2] [จำนวนโซน=1]
//   เช่น node tools/load-test.js 50 30 field2,bamboo 2   → 100 คน (โซนละ 50)
// เกณฑ์ผ่าน (ปรับได้ด้านล่าง): sim p99 < 25 ms, tick p99 < 25 ms, ความหน่วงตอบสนอง p95 < 150 ms, ไม่มีบอทหลุด/ถูกปฏิเสธการเดิน
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const WebSocket = require(path.join(__dirname, '../server/node_modules/ws'));
const W = require('../shared/world.js');

const PER = +(process.argv[2] || 50), SEC = +(process.argv[3] || 30);
const ZONES = String(process.argv[4] || 'field2').split(','), NZ = +(process.argv[5] || ZONES.length);
const LIMIT = { simP99: 25, tickP99: 25, rttP95: 150, wireKBps: 8 }; // 8 KB/s ≈ 29 MB/ชม.
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-load-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const srv = spawn(process.execPath, [path.join(__dirname, '../server/server.js')], { env: { ...process.env, PORT: port, DB_FILE: path.join(dir, 'load.db'), STATS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stderr.on('data', () => {});
  await new Promise(r => srv.stdout.on('data', d => { if (String(d).includes('http://')) r(); }));
  const B = 'http://127.0.0.1:' + port;
  const zones = ZONES.slice(0, NZ);
  console.log('เซิร์ฟเวอร์ pid ' + srv.pid + ' · บอท ' + PER * zones.length + ' ตัว (' + zones.map(z => z + '×' + PER).join(', ') + ') · ' + SEC + ' วิ');

  // ช่องเดินได้ของแต่ละโซน (ใช้ข้อมูลเดียวกับเซิร์ฟเวอร์)
  const grid = {};
  for (const z of zones) { const g = W.buildGrid(z); grid[z] = (x, y) => W.inb(x, y) && !W.BLOCKT.has(g.g[y][x]) && !g.blocked.has(x + ',' + y) && g.g[y][x] !== W.TYPES.EX; }
  const T = W.T, SPEED = 95; // ต่ำกว่า speed ของเกม (110)

  const bots = [], st = { rtt: [], fixes: 0, denied: 0, closed: 0, snaps: 0, errors: 0 };
  async function mkBot(i, zone) {
    const name = 'bot' + zone.slice(0, 3) + i;
    const r = await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, pass: 'secret123' }) });
    const { token } = await r.json();
    const ws = new WebSocket(B.replace('http', 'ws') + '/ws');
    const bot = { ws, zone, x: 0, y: 0, tx: 0, ty: 0, ready: false, pending: new Map(), seq: 0 };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token })));
    ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'welcome') {
        // ย้ายเข้าโซนทดสอบผ่านจุดเข้าโซนที่อนุญาต (จุดเริ่มของโซน)
        const s = W.ZONES[zone].start; bot.x = s[0]; bot.y = s[1]; bot.tx = Math.floor(bot.x / T); bot.ty = Math.floor(bot.y / T);
        ws.send(JSON.stringify({ t: 'mv', zone, x: bot.x, y: bot.y, dir: 'S', moving: false })); bot.ready = true;
      } else if (m.t === 'snap') {
        st.snaps++;
        // ความหน่วงตอบสนอง: เวลาที่ส่งตำแหน่ง → จนเห็นตำแหน่งนั้นใน snapshot ของตัวเอง
        if (m.me) for (const [k, t0] of bot.pending) if (Math.abs(m.me.x - k[0]) <= 1 && Math.abs(m.me.y - k[1]) <= 1) { st.rtt.push(Date.now() - t0); bot.pending.clear(); break; }
        if (m.me && m.me.dead) bot.dead = true; else if (bot.dead && m.me && !m.me.dead) { bot.dead = false; bot.respawned = true; }
      } else if (m.t === 'fix') { st.fixes++; bot.x = m.x; bot.y = m.y; bot.tx = Math.floor(m.x / T); bot.ty = Math.floor(m.y / T); if (m.zone !== bot.zone) bot.lost = true; }
      else if (m.t === 'deny') st.denied++;
    });
    ws.on('close', () => { st.closed++; bot.ready = false; });
    ws.on('error', () => st.errors++);
    bots.push(bot);
  }
  for (const z of zones) for (let i = 0; i < PER; i++) await mkBot(i, z);
  await sleep(1500);
  await fetch(B + '/api/stats?reset=1');
  const cpu0 = (await (await fetch(B + '/api/stats')).json()).cpuSec, t0 = Date.now();
  for (const b of bots) b.rd0 = b.ws._socket ? b.ws._socket.bytesRead : 0;

  // เดิน: ไปช่องข้างเคียงที่เดินได้ทีละช่อง ด้วยความเร็วคงที่
  const step = .1;
  const walk = setInterval(() => {
    for (const b of bots) {
      if (!b.ready || b.dead || b.lost) continue;
      if (b.respawned) { b.lost = true; continue; } // เกิดใหม่ที่หมู่บ้าน — เลิกเดินในโซนทดสอบ
      const cx = (b.tx + .5) * T, cy = (b.ty + .5) * T, d = Math.hypot(cx - b.x, cy - b.y);
      if (d < 2) {
        const ok = (b.zone && grid[b.zone]); const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, c]) => ok(b.tx + a, b.ty + c) && ok(b.tx + a, b.ty + c - 0));
        if (nb.length) { const [a, c] = nb[Math.floor(Math.random() * nb.length)]; b.tx += a; b.ty += c; }
      } else { const s = Math.min(d, SPEED * step); b.x += (cx - b.x) / d * s; b.y += (cy - b.y) / d * s; }
      const x = Math.round(b.x * 10) / 10, y = Math.round(b.y * 10) / 10;
      b.ws.send(JSON.stringify({ t: 'mv', zone: b.zone, x, y, dir: 'S', moving: true }));
      if (b.pending.size < 3) b.pending.set([x, y], Date.now());
    }
  }, step * 1000);
  const atk = setInterval(() => { for (const b of bots) if (b.ready && !b.dead) b.ws.send(JSON.stringify({ t: 'act', k: 'b', dir: 'E' })); }, 1000);
  for (let s = 5; s <= SEC; s += 5) { await sleep(5000); const x = await (await fetch(B + '/api/stats')).json(); console.log('  ' + s + ' วิ · ออนไลน์ ' + x.online + ' · sim p99 ' + x.simP99 + ' ms · tick p99 ' + x.tickP99 + ' ms · ' + x.kbPerSec + ' KB/s'); }
  clearInterval(walk); clearInterval(atk);

  const S = await (await fetch(B + '/api/stats')).json(), wall = (Date.now() - t0) / 1000;
  const rs = st.rtt.sort((a, b) => a - b), q = p => rs.length ? rs[Math.min(rs.length - 1, Math.floor(rs.length * p))] : -1;
  const N = bots.length, cpu = (S.cpuSec - cpu0) / wall * 100;
  const R = {
    bots: N, zones: zones.join(','), sec: +wall.toFixed(1), online: S.online,
    simP50: S.simP50, simP99: S.simP99, simMax: S.simMax, tickP50: S.tickP50, tickP99: S.tickP99, tickMax: S.tickMax,
    rttP50: q(.5), rttP95: q(.95), rttSamples: rs.length, serverCpuPct: +cpu.toFixed(1), rssMB: S.rssMB,
    kbPerSec: S.kbPerSec, kbPerSecPerPlayer: +(S.kbPerSec / N).toFixed(1),
    wireKBpsPerPlayer: +(bots.reduce((a, b) => a + (b.ws._socket ? b.ws._socket.bytesRead : 0) - (b.rd0 || 0), 0) / 1024 / wall / N).toFixed(1), fixes: st.fixes, denied: st.denied, closed: st.closed, errors: st.errors,
  };
  const pass = R.online === N && R.closed === 0 && R.errors === 0 && R.fixes === 0 && R.simP99 < LIMIT.simP99 && R.tickP99 < LIMIT.tickP99 && R.rttP95 >= 0 && R.rttP95 < LIMIT.rttP95 && R.wireKBpsPerPlayer < LIMIT.wireKBps;
  console.log(JSON.stringify(R, null, 1));
  console.log((pass ? 'PASS' : 'FAIL') + ' โหลด ' + N + ' คน · เกณฑ์ sim/tick p99 < 25 ms, ความหน่วง p95 < 150 ms, ไม่หลุด ไม่ถูกดึงกลับ · ข้อมูลผ่านเน็ตต่อคน < ' + LIMIT.wireKBps + ' KB/s');
  fs.appendFileSync(path.join(__dirname, 'last-load.jsonl'), JSON.stringify({ ...R, pass, at: new Date().toISOString() }) + '\n');
  for (const b of bots) b.ws.close();
  srv.kill('SIGTERM'); await sleep(300); fs.rmSync(dir, { recursive: true, force: true });
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
