// ทดสอบออนไลน์ 2 เครื่อง: สมัคร เห็นกัน กันความเร็ว ย้ายโซน หลุดแล้วต่อใหม่ บันทึก/รีสตาร์ต รหัสผิด เข้าซ้อน
// รัน: node tools/online-test.js   (ใช้ฐานข้อมูลชั่วคราว ไม่แตะ server/data)
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium, devices } = require('playwright');
const { createServer } = require('../server/server.js');

const results = [];
const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-'));
  const dbFile = path.join(dir, 'test.db');
  let srv = createServer({ dbFile, quiet: true, saveEverySec: 2 });
  let port = await srv.listen(0);
  let url = 'http://127.0.0.1:' + port + '/';
  const browser = await chromium.launch();
  const errors = [];
  const open = async (dev) => {
    const ctx = await browser.newContext({ ...devices[dev] });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(dev + ': ' + e.message));
    await page.goto(url); return { ctx, page };
  };
  const st = pg => pg.evaluate(() => ({ state: HLNET.state, joined: HLNET.joined, zone: HL.Z.id, x: HL.player.x, y: HL.player.y, others: HLNET.others.map(o => ({ name: o.name, x: o.tx, y: o.ty })), stats: HLNET.stats, lv: HL.PS.lv, exp: HL.PS.exp, job: HL.PS.job, jexp: HL.PS.jexp }));
  const signup = async (pg, name, pass, kind) => {
    await pg.waitForSelector('#net:not([hidden])', { timeout: 5000 });
    await pg.fill('#netn', name); await pg.fill('#netp', pass);
    await pg.click(kind === 'register' ? '#netreg' : '#netlogin');
  };

  // 1) สองเครื่องสมัครและเข้าเกม
  const A = await open('Pixel 7'), B = await open('iPhone 13');
  rec('หน้าเข้าสู่ระบบแสดงเมื่อเปิดจากเซิร์ฟเวอร์', await A.page.isVisible('#net'));
  await signup(A.page, 'Tester_A', 'secret123', 'register');
  await signup(B.page, 'Tester_B', 'secret456', 'register');
  const joined = await until(async () => (await st(A.page)).joined && (await st(B.page)).joined);
  rec('สองเครื่องสมัครและเข้าเกมได้', joined);

  // 2) เห็นกันและกัน
  const see = await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A') && (await st(A.page)).others.some(o => o.name === 'Tester_B'));
  rec('ทั้งสองเครื่องเห็นอีกฝ่ายในหมู่บ้าน', see);

  // 3) A เดินด้วยคีย์บอร์ด B เห็นตำแหน่งตรง
  await A.page.keyboard.down('ArrowRight'); await sleep(800); await A.page.keyboard.up('ArrowRight');
  await sleep(400);
  const a3 = await st(A.page), b3 = await st(B.page), seenA = b3.others.find(o => o.name === 'Tester_A');
  const err3 = seenA ? Math.hypot(seenA.x - a3.x, seenA.y - a3.y) : 1e9;
  await B.page.screenshot({ path: process.env.SHOT || 'tools/last-online.png' });
  rec('B เห็น A เดินไปตำแหน่งเดียวกัน', err3 < 4, 'A=(' + Math.round(a3.x) + ',' + Math.round(a3.y) + ') B เห็น=(' + (seenA && seenA.x) + ',' + (seenA && seenA.y) + ') คลาด ' + Math.round(err3) + ' px');

  // 4) กันวาร์ป/เร่งความเร็ว: แก้ตำแหน่งตรงในเครื่อง A ไป 400 px
  const before4 = await st(A.page);
  await A.page.evaluate(() => { HL.player.x += 400; });
  const pulled = await until(async () => { const s = await st(A.page); return s.stats.fixes > before4.stats.fixes && Math.abs(s.x - before4.x) < 5; });
  const b4 = (await st(B.page)).others.find(o => o.name === 'Tester_A');
  rec('เซิร์ฟเวอร์ดึงตัวที่วาร์ปเกินความเร็วกลับ', pulled && b4 && Math.abs(b4.x - before4.x) < 5, 'B เห็น A ที่ x=' + (b4 && b4.x));

  // 5) ได้ EXP จากการฆ่ามอนสเตอร์จริง แล้วค่าไปถึงเซิร์ฟเวอร์
  // ย้ายมอนสเตอร์ (สถานะในเครื่อง) มาหน้าตัวละคร แทนการวาร์ปตัวละคร ซึ่งเซิร์ฟเวอร์จะดึงกลับ
  await A.page.evaluate(() => { const m = HL.mons.find(m => m.state !== 'dead'); m.state = 'idle'; m.t = 99; m.hp = 1; m.x = m.hx = m.wx = HL.player.x + 20; m.y = m.hy = m.wy = HL.player.y; HL.player.dir = 'E'; window.__t = m; });
  await A.page.locator('#atk').dispatchEvent('pointerdown'); await sleep(100); await A.page.locator('#atk').dispatchEvent('pointerup');
  const gotExp = await until(async () => (await st(A.page)).exp > 0);
  await sleep(300);
  const srvA = [...srv.online.values()].find(p => p.c.name === 'Tester_A');
  { const cl = await st(A.page); const tm = await A.page.evaluate(() => ({ st: window.__t.state, hp: window.__t.hp, dx: window.__t.x - HL.player.x, dy: window.__t.y - HL.player.y, safe: HL.inSafe(HL.player.x, HL.player.y), fixes: HLNET.stats.fixes })); rec('EXP จากการฆ่าไปถึงเซิร์ฟเวอร์', gotExp && srvA && srvA.c.exp === cl.exp, 'server exp=' + (srvA && srvA.c.exp) + ' client exp=' + cl.exp + ' mon=' + JSON.stringify(tm)); }

  // 6) ย้ายโซน: B ไม่เห็น A แล้ว
  await A.page.click('#gear'); await A.page.click('#wp'); await A.page.click('#gear');
  const gone = await until(async () => (await st(A.page)).zone === 'field' && !(await st(B.page)).others.some(o => o.name === 'Tester_A'));
  rec('A ย้ายไปทุ่งมอนสเตอร์ B ไม่เห็น A แล้ว', gone);
  const srvZone = [...srv.online.values()].find(p => p.c.name === 'Tester_A').c.zone;
  rec('เซิร์ฟเวอร์รับการย้ายโซนผ่านจุดที่อนุญาต', srvZone === 'field', 'zone=' + srvZone);
  await A.page.click('#gear'); await A.page.click('#wp'); await A.page.click('#gear');
  await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A'));

  // 7) หลุดแล้วต่อใหม่เอง
  await A.page.evaluate(() => HLNET.ws.close());
  const back = await until(async () => { const s = await st(A.page); return s.state === 'online' && s.stats.reconnects === 1; }, 6000);
  rec('เน็ตหลุดแล้วเชื่อมต่อใหม่เองได้', back);
  rec('หลังต่อใหม่ B ยังเห็น A', await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A')));

  // 8) บันทึกแล้วรีสตาร์ตเซิร์ฟเวอร์
  await A.page.keyboard.down('ArrowDown'); await sleep(500); await A.page.keyboard.up('ArrowDown'); await sleep(400);
  const saved = await st(A.page);
  await A.ctx.close(); await B.ctx.close();
  await srv.close();
  srv = createServer({ dbFile, quiet: true }); port = await srv.listen(0); url = 'http://127.0.0.1:' + port + '/';
  const A2 = await open('Pixel 7');
  await signup(A2.page, 'Tester_A', 'secret123', 'login');
  await until(async () => (await st(A2.page)).joined);
  const re = await st(A2.page);
  const posOk = re.zone === saved.zone && Math.hypot(re.x - saved.x, re.y - saved.y) < 4;
  rec('รีสตาร์ตเซิร์ฟเวอร์แล้วตำแหน่งกลับมาถูก', posOk, 'ก่อน=(' + saved.zone + ',' + Math.round(saved.x) + ',' + Math.round(saved.y) + ') หลัง=(' + re.zone + ',' + Math.round(re.x) + ',' + Math.round(re.y) + ')');
  rec('รีสตาร์ตแล้ว Lv/EXP/Job กลับมาถูก', re.lv === saved.lv && re.exp === saved.exp && re.job === saved.job && re.jexp === saved.jexp, JSON.stringify({ lv: re.lv, exp: re.exp, job: re.job, jexp: re.jexp }));

  // 9) เปิดเกมซ้ำ (โทเคนในเครื่อง) เข้าเกมเองไม่ต้องล็อกอินใหม่
  await A2.page.reload(); await until(async () => (await st(A2.page)).joined);
  rec('รีเฟรชหน้าแล้วเข้าเกมเองด้วยโทเคนเดิม', (await st(A2.page)).joined && !(await A2.page.isVisible('#net')));

  // 10) รหัสผิด / ชื่อซ้ำ
  const C = await open('Pixel 7');
  await signup(C.page, 'Tester_A', 'wrongpass', 'login');
  await sleep(600);
  rec('รหัสผ่านผิดถูกปฏิเสธ', (await C.page.textContent('#neterr')).includes('ไม่ถูกต้อง') && !(await st(C.page)).joined);
  await signup(C.page, 'Tester_A', 'another12', 'register');
  await sleep(600);
  rec('สมัครชื่อซ้ำถูกปฏิเสธ', (await C.page.textContent('#neterr')).includes('มีผู้ใช้แล้ว'));

  // 11) เข้าบัญชีเดียวกันจากเครื่องที่สอง เครื่องแรกถูกตัด
  await signup(C.page, 'Tester_A', 'secret123', 'login');
  await until(async () => (await st(C.page)).joined);
  const kicked = await until(async () => (await A2.page.textContent('#netst')).includes('จากที่อื่น'));
  rec('เข้าบัญชีซ้อนแล้วเครื่องเดิมถูกตัด', kicked && srv.online.size === 1);

  rec('ไม่มี JavaScript error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); await srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  const fail = results.filter(r => !r.pass).length;
  console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน');
  fs.writeFileSync(process.env.OUT || 'tools/last-online.json', JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
