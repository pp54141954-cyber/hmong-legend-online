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
  // ผู้เล่นใหม่บนเซิร์ฟเวอร์ปกติเริ่มที่หมู่บ้านใหม่
  { const s0 = createServer({ dbFile: dbFile + '.home', quiet: true }), p0 = await s0.listen(0);
    const r = await fetch('http://127.0.0.1:' + p0 + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Home_Test', pass: 'secret123' }) });
    const tok = (await r.json()).token, acc = s0.db.session(tok).account_id, ch = s0.db.character(acc);
    rec('สมัครใหม่บนเซิร์ฟเวอร์ปกติ → เริ่มที่หมู่บ้านแผนที่ใหม่', ch.zone === 'village2', ch.zone); await s0.close(); }
  // ภาพแผนที่แยกไฟล์ (V2-R14)
  { const s1 = createServer({ dbFile: dbFile + '.maps', quiet: true }), p1 = await s1.listen(0), B = 'http://127.0.0.1:' + p1;
    const sp = await fetch(B + '/sprites/boar_walk.webp'), ok = await fetch(B + '/maps/village2.webp'), bad = await fetch(B + '/maps/..%2fserver.webp'), miss = await fetch(B + '/maps/nozone.webp');
    rec('เซิร์ฟเวอร์ส่งภาพแผนที่ /maps/*.webp และภาพมอนสเตอร์ /sprites/*.webp และปฏิเสธชื่อแปลก/ไม่มีไฟล์', sp.status === 200 && ok.status === 200 && ok.headers.get('content-type') === 'image/webp' && (await ok.arrayBuffer()).byteLength > 100000 && bad.status === 404 && miss.status === 404, ok.status + '/' + bad.status + '/' + miss.status);
    await s1.close(); }
  // ทดสอบที่เหลือเริ่มที่หมู่บ้านเดิม (มีบ้าน/มอนสเตอร์ที่ฉากทดสอบใช้)
  let srv = createServer({ dbFile, quiet: true, saveEverySec: 2, startZone: 'village', admins: [' tester_a\u200b'] }); // ตั้งแบบตัวเล็ก + อักขระมองไม่เห็น: ต้องยังตรงกับ Tester_A // V2-R27: A = แอดมิน (ADMIN_USERS)
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
  // V2-R29: บัญชีใหม่ต้องเลือกอาชีพก่อนเริ่ม
  { const shown = await until(async () => await A.page.isVisible('#cstart') && await B.page.isVisible('#cstart'));
    const n = await A.page.evaluate(() => document.querySelectorAll('#cstart .csc').length);
    rec('บัญชีใหม่: ขึ้นหน้าเลือกอาชีพตอนเริ่มเกม (8 อาชีพ)', shown && n === 8, n + ' อาชีพ');
    await A.page.click('#cstart button[aria-label="อาชีพ นักธนู"]');
    rec('แตะการ์ดอาชีพ → ปุ่มเริ่มบอกชื่ออาชีพที่เลือก', (await A.page.textContent('#csgo')) === 'เริ่มผจญภัยเป็น นักธนู');
    await A.page.click('#cstart button[aria-label="อาชีพ นักดาบ"]'); // นักดาบ: อาชีพที่ยังเลือกสีผม/ชุดได้
    await A.page.click('#cstart [data-g="f"]'); await A.page.click('#cstart [data-h="3"]'); await A.page.click('#cstart [data-o="3"]');
    await A.page.click('#cstart button[aria-label="อาชีพ นักดาบ"]'); await A.page.click('#csgo'); await B.page.click('#csgo');
    const SAx = () => [...srv.online.values()].find(p => p.c.name === 'Tester_A');
    const ok = await until(async () => !(await A.page.isVisible('#cstart')) && !(await B.page.isVisible('#cstart')) && SAx().c.clsset === 1);
    rec('กดเริ่ม → เซิร์ฟเวอร์บันทึกอาชีพ หน้าเลือกปิด เริ่มเล่นได้', ok, SAx().c.cls);
    rec('หน้าตาที่เลือกตอนสร้างถูกบันทึกที่เซิร์ฟเวอร์ (หญิง ผมขาวเงิน ชุดม่วง-ทอง)', JSON.stringify(SAx().c.look) === '{"g":"f","hair":3,"outfit":3,"hs":0,"of":0}', JSON.stringify(SAx().c.look));
    const seeA = await until(async () => { const v = await B.page.evaluate(id => (HLNET.plooks || {})[id], SAx().id); return v && v.g === 'f' && v.hair === 3; });
    rec('เครื่องอื่น (B) เห็นหน้าตาของ A ตามที่เลือก', seeA);
    rec('หน้าตาที่ส่งให้เครื่องอื่นมีอาชีพแนบ (ใช้วาดชุดอาชีพ)', ((await B.page.evaluate(id => (HLNET.plooks || {})[id], SAx().id)) || {}).cls === SAx().c.cls);
    await A.page.evaluate(() => HLNET.send({ t: 'look', look: { g: 'm', hair: 1, outfit: 4 } }));
    const upd = await until(async () => SAx().c.look.hair === 1 && (await B.page.evaluate(id => (HLNET.plooks || {})[id], SAx().id)).hair === 1 && (await A.page.evaluate(() => HL.PS.look.hair)) === 1);
    rec('A แต่งตัวใหม่ → เซิร์ฟเวอร์ + A + B เห็นหน้าตาใหม่', upd, JSON.stringify(SAx().c.look));
    const dl = SAx().denied || 0; await A.page.evaluate(() => HLNET.send({ t: 'look', look: { g: 'x', hair: 99, outfit: 0 } }));
    rec('ส่งหน้าตาผิดรูปแบบ → เซิร์ฟเวอร์ปฏิเสธ', await until(() => (SAx().denied || 0) > dl) && SAx().c.look.hair === 1);
    const d0 = SAx().denied || 0; await A.page.evaluate(() => HLNET.send({ t: 'cls', cls: 'นักฆ่า', first: 1 }));
    rec('ส่ง "เลือกครั้งแรก" ซ้ำ (ข้ามกฎหมู่บ้าน) → เซิร์ฟเวอร์ปฏิเสธ', await until(() => (SAx().denied || 0) > d0) && SAx().c.cls === 'นักดาบ'); }

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

  // 5) กติกาเซิร์ฟเวอร์ (V2-R3)
  const SA = () => [...srv.online.values()].find(p => p.c.name === 'Tester_A');
  const W = require('../shared/world.js');
  // 5.1 ข้อมูลที่เซิร์ฟเวอร์ใช้ตรงกับเกมที่รันจริง
  for (const zid of Object.keys(W.ZONES)) {
    const cl = await A.page.evaluate(zid => { const z = HL.getZone(zid), o = []; for (let y = 0; y < HL.ROWS; y++) for (let x = 0; x < HL.COLS; x++) o.push(z.g[y][x] + (z.blocked.has(x + ',' + y) ? 'b' : '')); return o.join(','); }, zid);
    const g = W.buildGrid(zid), o = []; for (let y = 0; y < W.ROWS; y++) for (let x = 0; x < W.COLS; x++) o.push(g.g[y][x] + (g.blocked.has(x + ',' + y) ? 'b' : ''));
    rec('ผังช่องชนโซน ' + zid + ' บนเซิร์ฟเวอร์ตรงกับเกม', cl === o.join(','), W.COLS * W.ROWS + ' ช่อง');
  }
  const cfgSame = await A.page.evaluate(() => JSON.stringify({ s: HL.CFG.skills, m: HL.CFG.monsters, b: HL.CFG.basic, p: HL.CFG.player })) === JSON.stringify({ s: W.CFG.skills, m: W.CFG.monsters, b: W.CFG.basic, p: W.CFG.player });
  rec('ค่า CFG (สกิล มอนสเตอร์ ผู้เล่น) บนเซิร์ฟเวอร์ตรงกับเกม', cfgSame);
  // 5.2 สองเครื่องเห็นมอนสเตอร์ชุดเดียวกัน
  await sleep(400);
  const ma = await A.page.evaluate(() => HL.mons.map(m => [m.id, m.tx, m.ty])), mb = await B.page.evaluate(() => HL.mons.map(m => [m.id, m.tx, m.ty]));
  // V2-R20: แต่ละเครื่องได้เฉพาะมอนสเตอร์ในระยะมองเห็น — มอนสเตอร์ที่เห็นร่วมกันต้องเป็นตัวเดียวกันและอยู่ตำแหน่งเดียวกัน
  const both = ma.filter(([id]) => mb.some(q => q[0] === id));
  const sameMons = both.length >= 3 && both.every(([id, x, y]) => { const o = mb.find(q => q[0] === id); return Math.hypot(o[1] - x, o[2] - y) < 30; });
  rec('A และ B เห็นมอนสเตอร์ชุดเดียวกัน (ตัวที่อยู่ในระยะของทั้งคู่)', sameMons, 'ร่วม ' + both.length + ' ตัว · A ' + ma.length + ' · B ' + mb.length);
  // 5.3 ฆ่ามอนสเตอร์ด้วยปุ่ม ⚔ → เซิร์ฟเวอร์ให้ EXP (ฉาก: วางไก่ฟ้าของเซิร์ฟเวอร์ไว้หน้าตัวละคร)
  const zv = srv.sim.zones.village, chick = zv.mons.find(m => m.type === 'ไก่ฟ้า' && m.state !== 'dead');
  const pa = SA(); Object.assign(chick, { x: pa.c.x + 20, y: pa.c.y, hx: pa.c.x + 20, hy: pa.c.y, wx: pa.c.x + 20, wy: pa.c.y, t: 99, hp: 1, state: 'idle' });
  await A.page.evaluate(() => { HL.player.dir = 'E'; });
  const exp0 = pa.c.exp;
  srv.sim.setRand(() => 0); // ฉาก: ให้ทุกแถวในตารางดรอปผ่าน
  await sleep(250);
  await A.page.locator('#atk').dispatchEvent('pointerdown'); await sleep(100); await A.page.locator('#atk').dispatchEvent('pointerup');
  await until(() => chick.state === 'dead', 2000); srv.sim.setRand(Math.random);
  const gotExp = await until(async () => SA().c.exp > exp0 && (await st(A.page)).exp === SA().c.exp);
  rec('ปุ่ม ⚔ ฆ่ามอนสเตอร์ของเซิร์ฟเวอร์ ได้ EXP จากเซิร์ฟเวอร์', gotExp && chick.state === 'dead', 'server exp ' + exp0 + '→' + SA().c.exp + ', Job EXP ' + SA().c.jexp);
  rec('B เห็นมอนสเตอร์ตัวนั้นตาย', await until(async () => !(await B.page.evaluate(id => HL.mons.some(m => m.id === id && m.state !== 'dead'), chick.id))));
  rec('เครื่อง A ได้เลขดาเมจจากเซิร์ฟเวอร์', (await st(A.page)).stats.dmgEv > 0);
  // 5.4 แก้ EXP ในเครื่อง → เซิร์ฟเวอร์ไม่เชื่อ
  const expS = SA().c.exp;
  await A.page.evaluate(() => { HL.PS.exp = 99999; HL.PS.lv = 50; });
  await sleep(500);
  const c54 = await st(A.page);
  rec('แก้ EXP/Lv ในเครื่องแล้วเซิร์ฟเวอร์ไม่เปลี่ยน และเครื่องถูกแก้กลับ', SA().c.exp === expS && SA().c.lv === 1 && c54.exp === expS && c54.lv === 1, 'server exp=' + SA().c.exp + ' client exp=' + c54.exp);
  // 5.4b กระเป๋า (V2-R4)
  rec('ของดรอปจากไก่ฟ้าเข้ากระเป๋าบนเซิร์ฟเวอร์', SA().c.bag.some(s => s.id === 'feather') && SA().c.bag.some(s => s.id === 'potion_s'), JSON.stringify(SA().c.bag));
  rec('เครื่อง A เห็นตัวเลขของดรอป', await until(async () => (await A.page.evaluate(() => HLNET.stats.loot || 0)) >= 2));
  await A.page.click('#bagb');
  rec('ปุ่ม 🎒 เปิดกระเป๋า เห็นของที่ได้', await until(async () => { const t = await A.page.textContent('#bag'); return t.includes('ขนไก่ฟ้า') && t.includes('ยาสมุนไพรเล็ก'); }));
  const icons = await A.page.evaluate(() => [...document.querySelectorAll('#bag img.ic')].map(i => i.complete && i.naturalWidth > 0));
  rec('ไอคอนไอเทมในกระเป๋าแสดงครบ', icons.length >= 2 && icons.every(Boolean), icons.length + ' รูป');
  rec('ชุดเริ่มต้น (บัญชีใหม่): ดาบไม้ + เสื้อผ้าฝ้ายสวมอยู่ ยากลางอยู่ในกระเป๋า', SA().c.eq.weapon === 'sword_wood' && SA().c.eq.armor === 'coat_cloth' && (await A.page.textContent('#bag')).includes('ยาสมุนไพรกลาง'), JSON.stringify(SA().c.eq));
  { await A.page.click('#lvb'); await A.page.waitForSelector('#stp:not([hidden]) .grid');
    const st = await A.page.evaluate(() => { const g = k => [...document.querySelectorAll('#stp .cell')].find(c => c.querySelector('span').textContent === k).querySelector('b').firstChild.textContent; return { atk: +g('ATK'), def: +g('DEF'), w: document.querySelector('#stp .eqr').textContent } });
    rec('หน้าต่างสถานะออนไลน์: ATK/DEF ตรงกับเซิร์ฟเวอร์ และแสดงอุปกรณ์ที่สวม', st.atk === SA().atk && st.def === SA().def && st.w.includes('ดาบไม้ฝึกหัด'), JSON.stringify(st) + ' server ATK ' + SA().atk);
    SA().c.lv = 3; srv.sim.stats(SA()); SA().skDirty = true; // ฉาก: Lv 3 = 6 แต้ม
    await A.page.waitForFunction(() => HLNET.spts === 6, null, { timeout: 3000 });
    const atk0 = SA().atk;
    for (let i = 0; i < 2; i++) { await A.page.click('#stp button[aria-label="เพิ่ม STR"]'); await A.page.waitForTimeout(250); }
    const ok = await until(async () => SA().atk === atk0 + 2 && (await A.page.evaluate(() => [...document.querySelectorAll('#stp .cell')].find(c => c.textContent.startsWith('ATK')).querySelector('b').firstChild.textContent)) === String(atk0 + 2));
    rec('ออนไลน์: กด + STR 2 ครั้ง → เซิร์ฟเวอร์ ATK +2 และจอตรงกัน', ok && SA().c.st.str === 2, 'ATK ' + atk0 + '→' + SA().atk);
    const d0 = SA().denied || 0; A.page.evaluate(() => HLNET.send({ t: 'stat', op: 'up', k: 'str', n: 10 }));
    rec('ออนไลน์: ขอแต้มเกินที่มี → เซิร์ฟเวอร์ปฏิเสธ', await until(async () => (SA().denied || 0) > d0) && SA().c.st.str === 2);
    A.page.evaluate(() => HLNET.send({ t: 'stat', op: 'reset' }));
    rec('ออนไลน์: รีเซ็ตแต้ม → ATK กลับ', await until(async () => SA().atk === atk0 && (await A.page.evaluate(() => HLNET.spts)) === 6));
    SA().c.lv = 1; srv.sim.stats(SA()); SA().skDirty = true;
    await A.page.click('#stp .x'); await A.page.click('#bagb'); } // เปิดสถานะจะปิดกระเป๋า → เปิดกลับ
  srv.sim.addItem(SA(), 'sword_iron', 1); // ฉาก: ให้ดาบเหล็ก 1 เล่ม
  await A.page.waitForSelector('#bag button[aria-label="ใส่ ดาบเหล็กตีมือ"]', { timeout: 3000 });
  const atkBase = SA().atk, oldW = (W.CFG.items[SA().c.eq.weapon] || { atk: 0 }).atk; // V2-R24: มีดาบไม้จากชุดเริ่มต้นอยู่แล้ว
  await A.page.click('#bag button[aria-label="ใส่ ดาบเหล็กตีมือ"]');
  const equipped = await until(async () => SA().c.eq.weapon === 'sword_iron' && (await A.page.textContent('#bag')).includes('ATK ' + (atkBase + 10 - oldW)) && SA().c.bag.some(s => s.id === 'sword_wood' || !oldW));
  rec('แตะดาบในกระเป๋า → สวมใส่ ATK +10 แทนดาบเดิม, ดาบเดิมกลับเข้ากระเป๋า (เซิร์ฟเวอร์และจอตรงกัน)', equipped, 'ATK ' + atkBase + '→' + SA().atk);
  SA().hp = 20; const potN = () => SA().c.bag.filter(s => s.id === 'potion_s').reduce((a, s) => a + s.n, 0), pot0 = potN();
  await A.page.click('#bag button[aria-label="ใช้ ยาสมุนไพรเล็ก"]');
  rec('แตะยา → HP บนเซิร์ฟเวอร์ฟื้น และยาลด 1', await until(async () => SA().hp >= 55 && potN() === pot0 - 1), 'HP 20→' + Math.round(SA().hp));
  const dInv = (await st(A.page)).stats.denied;
  await A.page.evaluate(() => HLNET.send({ t: 'inv', op: 'equip', slot: 99 }));
  rec('คำสั่งกระเป๋าปลอม (ช่อง 99) ถูกปฏิเสธ', await until(async () => (await st(A.page)).stats.denied > dInv));
  await A.page.bringToFront(); // หน้าต่างที่ไม่อยู่ด้านหน้า เบราว์เซอร์อาจหยุดรอบวาด (requestAnimationFrame)
  const hudOk = await until(async () => (await A.page.textContent('#hpt')).startsWith(String(Math.ceil(SA().hp)) + ' /'), 3000);
  rec('แถบ HP บนจอตรงกับเซิร์ฟเวอร์หลังใช้ยา', hudOk, 'จอ=' + (await A.page.textContent('#hpt')) + ' เซิร์ฟเวอร์=' + Math.ceil(SA().hp));
  await A.page.screenshot({ path: 'tools/last-bag.png' });
  await A.page.click('#bag h3 button');

  // 5.4c แต้มอัปสกิล (V2-R8) — ผ่านแผง 📜 จริง
  await A.page.click('#skb');
  rec('ปุ่ม 📜 เปิดแผงสกิล เห็นแต้มคงเหลือ 1 ที่ Job 1', await until(async () => (await A.page.textContent('#skp')).includes('แต้มสกิลคงเหลือ 1')));
  rec('สกิลที่ยังไม่ถึง Job ปุ่ม + กดไม่ได้', await A.page.isDisabled('#skp button[aria-label="อัป ลงอาคมคมดาบ"]'));
  const atkSk0 = SA().atk;
  await A.page.click('#skp button[aria-label="อัป คมดาบลงยันต์"]');
  const learned = await until(async () => SA().c.sk['คมดาบลงยันต์'] === 1 && (await A.page.textContent('#skp')).includes('แต้มสกิลคงเหลือ 0'));
  rec('กด + อัป "คมดาบลงยันต์" → เซิร์ฟเวอร์บันทึกระดับ 1 แต้มเหลือ 0', learned, 'ATK ' + atkSk0 + '→' + SA().atk);
  const dSk = (await st(A.page)).stats.denied;
  await A.page.evaluate(() => HLNET.send({ t: 'skill', op: 'up', name: 'ปลุกคมอาคม' }));
  rec('ส่งคำขออัปสกิลที่ยังล็อกตรง ๆ → เซิร์ฟเวอร์ปฏิเสธ', await until(async () => (await st(A.page)).stats.denied > dSk) && !SA().c.sk['ปลุกคมอาคม']);
  await A.page.screenshot({ path: 'tools/last-skills.png' });
  await A.page.click('#skp h3 button:last-child');

  // 5.5 เดินทะลุบ้าน (เปิด "เดินได้ทุกที่" ในเครื่อง) → เซิร์ฟเวอร์ไม่ยอม
  const s55 = await st(A.page);
  await A.page.evaluate(() => { HL.player.x = 368; });
  await sleep(300);
  await A.page.click('#gear'); await A.page.click('#free'); await A.page.click('#gear');
  const fx0 = (await st(A.page)).stats.fixes;
  await A.page.keyboard.down('ArrowUp'); await sleep(1500); await A.page.keyboard.up('ArrowUp');
  await sleep(400);
  const W55 = SA().c, houseRow = 12 * 32; // บ้านหลังที่ 3 อยู่ช่อง y=10–11 ตรงหัว
  rec('เดินทะลุกำแพง/บ้านไม่ได้ (เซิร์ฟเวอร์ดึงกลับ)', (await st(A.page)).stats.fixes > fx0 && W55.y >= houseRow, 'fix ' + fx0 + '→' + (await st(A.page)).stats.fixes + ', server y=' + Math.round(W55.y));
  await A.page.click('#gear'); await A.page.click('#free'); await A.page.click('#gear');
  // 5.6 สกิลที่ยังล็อก / กดรัวเกินคูลดาวน์ → เซิร์ฟเวอร์ปฏิเสธ
  const d0 = (await st(A.page)).stats.denied;
  await A.page.evaluate(() => HLNET.act(11, 'E'));
  await until(async () => (await st(A.page)).stats.denied > d0);
  rec('ส่งคำขอสกิลที่ยังล็อก (Job 1) เซิร์ฟเวอร์ปฏิเสธ', (await st(A.page)).stats.denied > d0);
  const d1 = (await st(A.page)).stats.denied;
  await A.page.evaluate(() => { for (let i = 0; i < 6; i++) HLNET.act('b', 'E'); });
  await sleep(500);
  rec('กดโจมตีรัว 6 ครั้งเลี่ยงคูลดาวน์ไม่ได้', (await st(A.page)).stats.denied - d1 >= 4, 'ถูกปฏิเสธ ' + ((await st(A.page)).stats.denied - d1) + '/6');
  // 5.7 ปุ่มทดสอบ Job 30 ถูกปิดบนเซิร์ฟเวอร์จริง
  await A.page.click('#gear'); await A.page.click('#tm'); await A.page.click('#gear'); await sleep(400);
  rec('ปุ่ม "ตั้ง Job 30" ใช้ไม่ได้บนเซิร์ฟเวอร์ปกติ', SA().c.job === 1 && (await st(A.page)).job === 1);
  // 5.8 สกิลทั้ง 11 ท่าคิดดาเมจที่เซิร์ฟเวอร์ (ฉาก: ตั้ง Job 30 บนเซิร์ฟเวอร์ + วางเป้าตามระยะท่า)
  SA().c.job = 30;
  for (const sk of W.CFG.skills) if (!SA().c.sk[sk.name]) SA().c.sk[sk.name] = 1; // ฉาก: อัปท่ากดทั้ง 11 ท่าเป็นระดับ 1
  SA().skDirty = true;
  // ยืนนอกเขตปลอดภัย (ในเขตปลอดภัยมอนสเตอร์จะถอยกลับและฟื้น HP ทันทีตามกติกาเดิม)
  const PX = 752, PY = 464;
  Object.assign(SA().c, { x: PX, y: PY }); await A.page.evaluate(([x, y]) => { HL.player.x = x; HL.player.y = y; }, [PX, PY]);
  await sleep(300);
  const skr = [];
  for (let i = 1; i <= W.CFG.skills.length; i++) {
    const sk = W.CFG.skills[i - 1], p = SA(), gap = sk.shape === 'pillar' ? sk.dist : 30;
    // รอให้ตำแหน่งบนเซิร์ฟเวอร์ตรงกับในเครื่องก่อนวางเป้า (ข้อความ mv ของท่าก่อนอาจยังมาไม่ถึง)
    await A.page.evaluate(([x, y]) => { HL.player.x = x; HL.player.y = y; }, [PX, PY]);
    await until(async () => Math.hypot(p.c.x - PX, p.c.y - PY) < 1, 2000);
    await sleep(200);
    const m = zv.mons.find(m => m.state !== 'dead' && m !== chick) || zv.mons[0];
    Object.assign(m, { state: 'idle', x: p.c.x + gap, y: p.c.y + 14, hx: p.c.x + gap, hy: p.c.y + 14, wx: p.c.x + gap, wy: p.c.y + 14, t: 99, hp: m.c.hp, target: null });
    p.cd = {}; p.castUntil = 0;
    await A.page.evaluate(() => { for (const k in HL.PS.cd) HL.PS.cd[k] = 0; HL.PS.cast = null; HL.player.dir = 'E'; });
    await sleep(150);
    const hp0 = m.hp, buff0 = p.buffT, guard0 = p.guardT, x0 = p.c.x, den0 = (await st(A.page)).stats.denied;
    const at = { px: Math.round(p.c.x), py: Math.round(p.c.y), dir: p.c.dir, mx: Math.round(m.x), my: Math.round(m.y), mst: m.state, ty: m.type };
    await A.page.keyboard.press(String(i <= 9 ? i : 0)).catch(() => {});
    if (i > 9) await A.page.evaluate(i => HL.useSkill(i), i);
    let mn = hp0; for (let k = 0; k < 9; k++) { await sleep(100); mn = Math.min(mn, m.state === 'dead' ? 0 : m.hp); }
    const dmg = hp0 - mn; SA().hp = SA().maxHp;
    const eff = sk.shape === 'buff' ? p.buffT > 0 : sk.shape === 'guard' ? p.guardT > 0 : sk.shape === 'move' ? Math.abs(p.c.x - x0) > 20 : dmg > 0;
    skr.push(i + ':' + (eff ? 'ok' : 'NO') + (dmg ? '(' + dmg + ')' : ''));
    rec('สกิล ' + i + ' ' + sk.name + ' ทำงานที่เซิร์ฟเวอร์', eff, sk.shape + ' ดาเมจ=' + dmg + (eff ? '' : ' ตอนกด=' + JSON.stringify(at) + ' หลัง=' + JSON.stringify({ px: Math.round(p.c.x), py: Math.round(p.c.y), dir: p.c.dir, mx: Math.round(m.x), my: Math.round(m.y), mst: m.state, denied: (await st(A.page)).stats.denied - den0, cdc: Object.keys(p.cd) })));
    // กลับจุดเดิมให้ท่าถัดไป (ทั้งสองฝั่งพร้อมกัน)
    p.c.x = PX; p.c.y = PY; await A.page.evaluate(([x, y]) => { HL.player.x = x; HL.player.y = y; }, [PX, PY]);
    await sleep(200);
  }
  // 5.9 มอนสเตอร์ไล่ตีผู้เล่น → HP ลด → ตาย → เกิดใหม่ที่หมู่บ้าน (ในทุ่งมอนสเตอร์)
  SA().warpAt = 0; /* ฉาก: ข้ามคูลดาวน์วาร์ปของปุ่มทดสอบ */ await A.page.click('#gear'); await A.page.click('#wp'); await A.page.click('#gear');
  await until(async () => SA().c.zone === 'field');
  await sleep(300);
  const pf = SA(), zf = srv.sim.zones.field, wolf = zf.mons.find(m => m.type === 'หมาป่า' && m.state !== 'dead');
  Object.assign(wolf, { x: pf.c.x + 30, y: pf.c.y, hx: pf.c.x + 30, hy: pf.c.y, state: 'idle', target: null });
  const hpBefore = pf.hp;
  const hurt = await until(async () => (await A.page.evaluate(() => HL.PS.hp)) < hpBefore && SA().hp < hpBefore, 5000);
  rec('มอนสเตอร์ของเซิร์ฟเวอร์ไล่ตี HP ลดทั้งสองฝั่ง', hurt, 'HP ' + hpBefore + '→' + Math.ceil(SA().hp));
  SA().hp = 1;
  const died = await until(async () => (await A.page.evaluate(() => HL.PS.dead)) && SA().dead, 5000);
  rec('HP หมดแล้วตาย (เซิร์ฟเวอร์ตัดสิน)', died);
  const resp = await until(async () => { const s = await st(A.page); return !SA().dead && s.zone === 'village2' && SA().c.zone === 'village2'; }, 6000);
  await A.page.evaluate(() => { const s = HL.ZONES.village.start; }); // ตายแล้วไปหมู่บ้านใหม่
  rec('เกิดใหม่ที่หมู่บ้านแผนที่ใหม่หลัง ' + W.CFG.player.respawnSec + ' วินาที', resp, 'HP ' + Math.ceil(SA().hp) + '/' + SA().maxHp);
  await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A'));

  // 6) ย้ายโซน: B ไม่เห็น A แล้ว
  SA().warpAt = 0; /* ฉาก: ข้ามคูลดาวน์วาร์ปของปุ่มทดสอบ */ await A.page.click('#gear'); await A.page.click('#wp'); await A.page.click('#gear');
  const gone = await until(async () => (await st(A.page)).zone === 'field' && !(await st(B.page)).others.some(o => o.name === 'Tester_A'));
  rec('A ย้ายไปทุ่งมอนสเตอร์ B ไม่เห็น A แล้ว', gone);
  await until(() => [...srv.online.values()].find(p => p.c.name === 'Tester_A').c.zone === 'field', 3000); // A อาจเริ่มจากหมู่บ้านใหม่ (เกิดหลังตาย) ซึ่ง B มองไม่เห็นอยู่แล้ว
  const srvZone = [...srv.online.values()].find(p => p.c.name === 'Tester_A').c.zone;
  rec('เซิร์ฟเวอร์รับการย้ายโซนผ่านจุดที่อนุญาต', srvZone === 'field', 'zone=' + srvZone);
  SA().warpAt = 0; /* ฉาก: ข้ามคูลดาวน์วาร์ปของปุ่มทดสอบ */ await A.page.click('#gear'); await A.page.click('#wp'); await A.page.click('#gear');
  await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A'));

  // V2-R27: แอดมิน (เฉพาะบัญชีใน ADMIN_USERS) + อาชีพออนไลน์
  { const hz = await (await fetch(url + 'healthz')).json(); rec('/healthz บอกจำนวนบัญชีแอดมินที่ตั้งไว้ (ไม่บอกชื่อ) + เวอร์ชัน', hz.admins === 1 && hz.ver && !JSON.stringify(hz).includes('Tester_A'), JSON.stringify(hz)); }
  rec('เมนู ⚙ บอกชื่อบัญชีและสิทธิ์ (A = แอดมิน, B = ผู้เล่น)', (await A.page.textContent('#acctinfo')).includes('แอดมิน') && (await B.page.textContent('#acctinfo')).includes('ผู้เล่น') && (await A.page.textContent('#acctinfo code')) === 'Tester_A');
  { rec('บัญชีแอดมินเห็นปุ่ม 🛠, บัญชีทั่วไปไม่เห็น', await A.page.isVisible('#admb') && !(await B.page.isVisible('#admb')));
    await A.page.click('#admb'); await A.page.waitForSelector('#adp:not([hidden]) #ad-lv');
    const lv0 = SA().c.lv; await A.page.fill('#ad-lv', '25'); await A.page.click('#ad-lvb');
    rec('แอดมินตั้งเลเวลผ่านแผง → เซิร์ฟเวอร์เปลี่ยนจริง และจอตรงกัน', await until(async () => SA().c.lv === 25 && (await A.page.evaluate(() => HL.PS.lv)) === 25), lv0 + '→' + SA().c.lv);
    await A.page.click('#ad-god'); rec('แอดมินเปิดโหมดอมตะ', await until(() => SA().god === true));
    await A.page.click('#ad-god'); await until(() => !SA().god);
    await A.page.click('#adp .x');
    const SBp = () => [...srv.online.values()].find(p => p.c.name === 'Tester_B'), lvB = SBp().c.lv, d0 = SBp().denied || 0;
    await B.page.evaluate(() => HLNET.send({ t: 'adm', op: 'lv', n: 99 }));
    rec('บัญชีทั่วไปส่งคำสั่งแอดมินเอง → เซิร์ฟเวอร์ปฏิเสธ', await until(() => (SBp().denied || 0) > d0) && SBp().c.lv === lvB);
    SA().c.lv = lv0; srv.sim.stats(SA()); SA().skDirty = true;
    // อาชีพ: A อยู่ในหมู่บ้าน (เขตปลอดภัย) → เปลี่ยนเป็นนักธนูผ่านหน้าเลือกอาชีพ
    const zBack = SA().c.zone; await A.page.evaluate(() => HLNET.send({ t: 'adm', op: 'warp', zone: 'village2' })); // ฉาก: แอดมินวาร์ปไปหมู่บ้านใหม่ (เขตปลอดภัย)
    await until(async () => SA().c.zone === 'village2' && (await st(A.page)).zone === 'village2');
    await A.page.click('#skb'); await A.page.click('#skp h3 .clsb'); await A.page.waitForSelector('#clp:not([hidden]) .cc');
    await A.page.click('#clp button[aria-label="เปลี่ยนเป็น นักธนู"]');
    const ok = await until(async () => SA().c.cls === 'นักธนู' && (await A.page.evaluate(() => HL.curCls())) === 'นักธนู' && (await A.page.evaluate(() => [...document.querySelectorAll('#skills .sk')].some(b => b.getAttribute('aria-label') === 'ศรเจาะจุดอ่อน'))));
    rec('ออนไลน์: เปลี่ยนอาชีพในหมู่บ้าน → เซิร์ฟเวอร์บันทึก และปุ่มสกิลเปลี่ยนตาม', ok, SA().c.cls);
    await A.page.evaluate(() => HLNET.send({ t: 'cls', cls: 'นักดาบ' })); await until(async () => SA().c.cls === 'นักดาบ' && (await A.page.evaluate(() => HL.curCls())) === 'นักดาบ');
    await A.page.click('#clp .x');
    await A.page.evaluate(z => HLNET.send({ t: 'adm', op: 'warp', zone: z }), zBack); await until(async () => SA().c.zone === zBack && (await st(A.page)).zone === zBack); }

  // V2-R26: วาร์ปผ่านแผนที่โลก (เซิร์ฟเวอร์ตรวจ) + ปิดช่องโหว่กระโดดโซนผ่าน mv
  { const a = SA(); a.warpAt = 0; await A.page.evaluate(() => HL.clearWarpCd()); const z0 = a.c.zone, to = z0 === 'bamboo' ? 'peak' : 'bamboo';
    await A.page.click('#wmb'); await A.page.waitForSelector('#wmp:not([hidden]) .wp[data-z="' + to + '"]');
    await A.page.click('#wmp .wp[data-z="' + to + '"]');
    const ok = await until(async () => SA().c.zone === to && (await st(A.page)).zone === to && Math.hypot(SA().c.x - W.ZONES[to].start[0], SA().c.y - W.ZONES[to].start[1]) < 40);
    rec('วาร์ปผ่านแผนที่โลก → เซิร์ฟเวอร์ย้ายตัวไปจุดเริ่มโซน และจอตรงกัน', ok, z0 + ' → ' + SA().c.zone);
    const d0 = SA().denied || 0; A.page.evaluate(() => HLNET.send({ t: 'warp', zone: 'mine' }));
    rec('วาร์ปซ้ำภายใน 5 วิ → เซิร์ฟเวอร์ปฏิเสธ (cooldown)', await until(async () => (SA().denied || 0) > d0) && SA().c.zone === to);
    SA().warpAt = 0; const d1 = SA().denied || 0; A.page.evaluate(() => HLNET.send({ t: 'warp', zone: 'nowhere' }));
    rec('วาร์ปไปโซนที่ไม่มี → ปฏิเสธ', await until(async () => (SA().denied || 0) > d1) && SA().c.zone === to);
    const f0 = A.page.evaluate(() => HLNET.stats.fixes), p = W.ZONES.peak.start, fx0 = await f0;
    await A.page.evaluate(([x, y]) => HLNET.send({ t: 'mv', zone: 'peak', x, y, dir: 'S', moving: false }), [p[0], p[1]]);
    rec('ส่ง mv กระโดดไปจุดเริ่มโซนอื่นตรง ๆ (ไม่ผ่านทางออก) → เซิร์ฟเวอร์ไม่รับ', await until(async () => (await A.page.evaluate(() => HLNET.stats.fixes)) > fx0) && SA().c.zone === to, 'zone=' + SA().c.zone);
    SA().warpAt = 0; await A.page.evaluate(() => { HL.warp('village', 1) }); await until(() => SA().c.zone === 'village');
    await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A')); }

  // V2-R16: เวลาโลกจากเซิร์ฟเวอร์ + World Boss + ประกาศ
  { const C = W.CFG.time;
    srv.sim.setTimeOffset(C.worldEvery * 2 + 30 - Date.now() / 1000 - C.worldWindow - 60); // นอกช่วง World Boss
    await sleep(300);
    srv.sim.setTimeOffset(C.cycleSec * 3.67 - Date.now() / 1000 + C.worldEvery * 3); // คืนเลือด + ช่วง World Boss เริ่ม
    const got = await until(async () => { const t = await A.page.evaluate(() => HLNET.wt); return t && t.blood; }, 3000);
    const ann = await until(async () => (await A.page.evaluate(() => (HLNET.stats.ann || []).join('|'))).includes('มังกรแห่งหุบเขาหมอก'), 3000);
    const wb = srv.sim.zones.peak.mons.find(m => m.type === 'มังกรแห่งหุบเขาหมอก');
    rec('เครื่องผู้เล่นได้เวลาโลก (คืนพระจันทร์สีเลือด) จากเซิร์ฟเวอร์', got, JSON.stringify(await A.page.evaluate(() => HLNET.wt && HLNET.wt.name)));
    rec('World Boss เกิดบนเซิร์ฟเวอร์และประกาศถึงผู้เล่นทุกโซน', ann && wb.state !== 'dead', 'state=' + wb.state);
    srv.sim.setTimeOffset(C.cycleSec * 2.25 - Date.now() / 1000 + C.worldEvery * 5 + C.worldWindow); // กลับกลางวัน นอกช่วง
    await sleep(300); }

  // V2-R21: ปาร์ตี้ผ่านหน้าจอจริง + แบ่ง EXP
  await A.page.click('#ptb'); await A.page.fill('#ptname', 'tester_b'); await A.page.click('#ptinv');
  const gotInv = await until(async () => (await B.page.getAttribute('#ptb', 'class') || '').includes('inv'));
  rec('A ชวน B ทางแผง 👥 → B เห็นจุดแจ้งเตือนคำเชิญ', gotInv);
  await B.page.click('#ptb'); await B.page.click('#ptacc');
  const formed = await until(async () => (await A.page.$$('#ptp .mem')).length === 2 && (await B.page.$$('#ptp .mem')).length === 2);
  rec('B กดเข้าร่วม → ทั้งสองเครื่องเห็นสมาชิก 2 คนพร้อมแถบ HP', formed);
  const SB = () => [...srv.online.values()].find(p => p.c.name === 'Tester_B');
  { const a = SA(), b = SB(), z = srv.sim.zones[a.c.zone], m = z.mons.find(m => !m.c.boss && m.state !== 'dead');
    // ฉาก: วาง B ไว้ใกล้ A (ฝั่งเซิร์ฟเวอร์) และวางมอนสเตอร์ HP 1 หน้า A
    Object.assign(b.c, { zone: a.c.zone, x: a.c.x + 40, y: a.c.y });
    Object.assign(m, { x: a.c.x + 20, y: a.c.y, hx: a.c.x + 20, hy: a.c.y, wx: a.c.x + 20, wy: a.c.y, t: 99, hp: 1, state: 'idle' });
    a.c.exp = 0; b.c.exp = 0; // ฉาก: เริ่ม EXP 0 ไม่ให้เลเวลอัประหว่างวัด
    const ea = a.c.exp, eb = b.c.exp, la = a.c.lv, lb = b.c.lv; srv.sim.setRand(() => .5);
    await A.page.evaluate(() => { HL.player.dir = 'E'; }); await sleep(200);
    await A.page.locator('#atk').dispatchEvent('pointerdown'); await sleep(100); await A.page.locator('#atk').dispatchEvent('pointerup');
    await until(() => m.state === 'dead', 2000); srv.sim.setRand(Math.random);
    const each = Math.round(m.c.exp * srv.sim.WT.exp * 1.1 / 2);
    rec('ปาร์ตี้: A ฆ่ามอนสเตอร์ → A และ B ได้ EXP คนละ ' + each + ' (แบ่ง + โบนัส 10%)', m.state === 'dead' && a.c.lv === la && b.c.lv === lb && a.c.exp - ea === each && b.c.exp - eb === each, (a.c.exp - ea) + ' / ' + (b.c.exp - eb) + ' · ' + m.type); }
  await A.page.screenshot({ path: 'tools/last-party.png' }).catch(() => {});
  await B.page.click('#ptleave');
  rec('B ออกจากปาร์ตี้ → ปาร์ตี้ยุบ (เหลือคนเดียว)', await until(() => !SA().party && !SB().party && srv.sim.parties.size === 0));
  await A.page.click('#ptp h3 button'); await B.page.click('#ptp h3 button');

  // 7) หลุดแล้วต่อใหม่เอง
  await A.page.evaluate(() => HLNET.ws.close());
  const back = await until(async () => { const s = await st(A.page); return s.state === 'online' && s.stats.reconnects === 1; }, 6000);
  rec('เน็ตหลุดแล้วเชื่อมต่อใหม่เองได้', back);
  rec('หลังต่อใหม่ B ยังเห็น A', await until(async () => (await st(B.page)).others.some(o => o.name === 'Tester_A')));

  // 8) บันทึกแล้วรีสตาร์ตเซิร์ฟเวอร์
  await A.page.keyboard.down('ArrowDown'); await sleep(500); await A.page.keyboard.up('ArrowDown'); await sleep(400);
  const saved = await st(A.page), pA = SA();
  await A.ctx.close(); await B.ctx.close();
  // อ่านค่าที่จะถูกบันทึก หลังผู้เล่นออก (ไม่มีของดรอป/ท่าค้างมาเปลี่ยนค่าระหว่างอ่านกับปิดเซิร์ฟเวอร์)
  const savedBag = JSON.stringify(pA.c.bag), savedEq = JSON.stringify(pA.c.eq), savedSk = JSON.stringify(pA.c.sk);
  await srv.close();
  srv = createServer({ dbFile, quiet: true, startZone: 'village' }); port = await srv.listen(0); url = 'http://127.0.0.1:' + port + '/';
  const A2 = await open('Pixel 7');
  await signup(A2.page, 'Tester_A', 'secret123', 'login');
  await until(async () => (await st(A2.page)).joined); await sleep(500);
  rec('ล็อกอินครั้งต่อไป: ไม่ถามอาชีพซ้ำ', !(await A2.page.isVisible('#cstart')));
  rec('ล็อกอินครั้งต่อไป: หน้าตาเดิมยังอยู่ (บันทึกในฐานข้อมูล)', await A2.page.evaluate(() => HL.PS.look.g === 'm' && HL.PS.look.hair === 1 && HL.PS.look.outfit === 4));
  await until(async () => (await st(A2.page)).joined);
  const re = await st(A2.page);
  const posOk = re.zone === saved.zone && Math.hypot(re.x - saved.x, re.y - saved.y) < 4;
  rec('รีสตาร์ตเซิร์ฟเวอร์แล้วตำแหน่งกลับมาถูก', posOk, 'ก่อน=(' + saved.zone + ',' + Math.round(saved.x) + ',' + Math.round(saved.y) + ') หลัง=(' + re.zone + ',' + Math.round(re.x) + ',' + Math.round(re.y) + ')');
  const SA2 = [...srv.online.values()].find(p => p.c.name === 'Tester_A');
  await until(async () => (await A2.page.evaluate(() => JSON.stringify(HLNET.bag))) === savedBag, 3000); // กระเป๋ามาใน snapshot แรกหลังเข้าเกม
  rec('รีสตาร์ตแล้วกระเป๋าและอุปกรณ์กลับมาครบ', JSON.stringify(SA2.c.bag) === savedBag && JSON.stringify(SA2.c.eq) === savedEq && (await A2.page.evaluate(() => JSON.stringify(HLNET.bag))) === savedBag, savedEq + ' ' + savedBag);
  rec('รีสตาร์ตแล้วระดับสกิลกลับมาครบ', JSON.stringify(SA2.c.sk) === savedSk && (await A2.page.evaluate(() => JSON.stringify(HLNET.sk))) === savedSk, savedSk.slice(0, 120));
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
