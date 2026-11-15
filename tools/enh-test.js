// ทดสอบตีบวกอาวุธ (V2-R78 · ข้อกำหนด V1.2 ฉบับยืนยัน)
// ส่วนที่ 1: ค่าตั้งตามข้อกำหนดที่ยืนยันแล้ว และตรรกะเซิร์ฟเวอร์ (จำลอง ไม่ใช้เบราว์เซอร์)
// ส่วนที่ 2: ฐานข้อมูล — ค่าตีบวกคงอยู่หลังบันทึก และประวัติการตีบวกถูกบันทึกทุกครั้ง
// ส่วนที่ 3: เกมจริงในเบราว์เซอร์ — เปิดหน้าช่างตีเหล็ก ตีบวก ดูกระเป๋า และให้เซิร์ฟเวอร์ปฏิเสธคำขอที่ไม่ถูกต้อง
//            (Pixel 7 และขนาดจอ iPhone 13 บน Chromium — ไม่มี WebKit ในเครื่องนี้)
// รัน: node tools/enh-test.js   (ใช้ฐานข้อมูลชั่วคราว ไม่แตะ server/data)
const path = require('path'), fs = require('fs'), os = require('os');
const { DatabaseSync } = require('node:sqlite');
const { chromium, devices } = require('playwright');
const { createSim } = require('../server/sim.js');
const { createServer } = require('../server/server.js');
const dbmod = require('../server/db.js');
const W = require('../shared/world.js');

const results = [];
const rec = (name, pass, detail) => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const C = W.CFG, EH = C.enhance, T = W.T;
const smiths = C.npcs.filter(n => n.role === 'smith');
const evDir = path.join(__dirname, '..', 'docs', 'evidence');
let ridN = 0; const rid = () => 'rid-' + (++ridN);
const countStone = c => c.bag.reduce((n, s) => n + (s.id === EH.stone ? s.n : 0), 0);

// ---- ส่วนที่ 1: ค่าตั้งและตรรกะเซิร์ฟเวอร์ ----
{
  const V12 = [[.35, 40000], [.15, 60000], [.10, 90000], [.10, 140000], [.05, 200000]];
  rec('ระดับตีบวกสูงสุด +15', EH.cap === 15);
  rec('เพดาน 55,000 ตั้งแต่ระดับ +11 ถึง +14 (ระดับ 11 ถึง 15 เท่ากัน คำสั่งเจ้าของ V2-R81)', EH.goldCap === 55000 && EH.goldCapFrom === 11);
  rec('ตารางที่ยืนยันแล้ว +10→+11 ถึง +14→+15 (โอกาส · เงิน · หินป้องกัน 1)', V12.every(([r, g], k) => { const s = EH.steps[10 + k]; return s.rate === r && s.gold === g && s.stone === 1 && !s.prov; }));
  rec('ค่าต่ำกว่า +10 ติดธง prov (ค่าชั่วคราว รอตรวจ)', EH.steps.slice(0, 10).every(s => s.prov === 1));
  rec('หินป้องกันเป็นวัตถุดิบ (mat)', !!C.items[EH.stone] && C.items[EH.stone].type === 'mat');
  rec('ช่างตีเหล็กหนึ่งคนในแต่ละหมู่บ้านเริ่มต้น และขายหินป้องกัน', smiths.length === 2 && ['village', 'village2'].every(z => smiths.some(n => n.zone === z)) && smiths.every(n => n.shop.some(r => r[0] === EH.stone)));
  const shopOf = z => C.npcs.find(n => n.zone === z && n.role !== 'smith');
  rec('ช่างกับร้านค้าห่างกันเกิน 2 เท่าของระยะซื้อ (ไม่มีปุ่มซ้อนกัน)', smiths.every(s => { const sh = shopOf(s.zone); return Math.hypot(s.tx - sh.tx, s.ty - sh.ty) > 2 * C.economy.shopRange; }));

  const mk = (o = {}) => {
    const s = smiths[0];
    return { id: 1, personal: [], dead: false, c: Object.assign({ name: 'ทดสอบ', zone: s.zone, x: s.tx * T, y: (s.ty + 1) * T, dir: 'S', lv: 10, exp: 0, job: 1, jexp: 0, cls: 'นักดาบ', clsset: 1, st: C.stats.clean({}), sk: {}, look: {}, bag: [], eq: { weapon: 'sword_wood', armor: null, acc: null }, enh: {}, gold: 1000000, starter: 1 }, o) };
  };
  const sim = createSim({ rand: () => 0 });       // ทุกการสุ่มสำเร็จ
  const simLow = createSim({ rand: () => 0.99 }); // ทุกการสุ่มล้มเหลว (โอกาสทุกระดับต่ำกว่านี้)

  const pFar = mk(); pFar.c.x = 0; pFar.c.y = 0;
  rec('อยู่ไกลจากช่างตีเหล็ก → far', sim.enhance(pFar, { src: 'eq', rid: rid() }, 100) === 'far');
  const pZone = mk(); pZone.c.zone = 'field2';
  rec('คนละโซนกับช่างตีเหล็ก → far', sim.enhance(pZone, { src: 'eq', rid: rid() }, 100) === 'far');
  const pNoW = mk(); pNoW.c.eq.weapon = null;
  rec('ไม่มีอาวุธที่ใส่ → empty', sim.enhance(pNoW, { src: 'eq', rid: rid() }, 100) === 'empty');
  const pArm = mk(); pArm.c.bag.push({ id: 'coat_cloth', n: 1 });
  rec('ของในกระเป๋าที่ไม่ใช่อาวุธ → not-weapon', sim.enhance(pArm, { src: 'bag', i: 0, rid: rid() }, 100) === 'not-weapon');
  rec('ไม่มีรหัสคำขอ → invalid', sim.enhance(mk(), { src: 'eq' }, 100) === 'invalid');
  const pGold = mk({ gold: 100 }); pGold.c.bag.push({ id: 'enh_stone', n: 5 });
  rec('เงินไม่พอ → no-gold และไม่หักหิน', sim.enhance(pGold, { src: 'eq', rid: rid() }, 100) === 'no-gold' && pGold.c.gold === 100 && countStone(pGold.c) === 5);
  const pStone = mk();
  rec('หินป้องกันไม่พอ → no-stone และไม่หักเงิน', sim.enhance(pStone, { src: 'eq', rid: rid() }, 100) === 'no-stone' && pStone.c.gold === 1000000);

  // สำเร็จที่ +0 (โอกาส 100%): +1 · หักเงิน 2,000 · หักหิน 1
  const p7 = mk(); p7.c.bag.push({ id: 'enh_stone', n: 3 });
  const r7 = sim.enhance(p7, { src: 'eq', rid: rid() }, 200);
  rec('ตีบวกสำเร็จ +0 → +1 หักเงิน 2,000 และหิน 1', r7.ok && r7.to === 1 && p7.c.enh.weapon === 1 && p7.c.gold === 1000000 - 2000 && countStone(p7.c) === 2, JSON.stringify({ to: r7.to, gold: p7.c.gold, stone: countStone(p7.c) }));
  rec('ขอซ้ำในช่วงคูลดาวน์ 0.8 วิ → cooldown', sim.enhance(p7, { src: 'eq', rid: rid() }, 200.3) === 'cooldown');

  // คำขอ rid เดิมซ้ำ → ไม่ประมวลผลซ้ำ ไม่หักซ้ำ
  const p8 = mk(); p8.c.bag.push({ id: 'enh_stone', n: 3 });
  sim.enhance(p8, { src: 'eq', rid: 'dup-1' }, 300);
  rec('คำขอ rid เดิมซ้ำ → dup และไม่หักซ้ำ', sim.enhance(p8, { src: 'eq', rid: 'dup-1' }, 400) === 'dup' && countStone(p8.c) === 2 && p8.c.gold === 1000000 - 2000);

  // ล้มเหลวที่ +10 (โอกาส 35%): คงระดับเดิม ไม่ลด ไม่แตก ไม่หาย และหักเงิน/หินเต็มจำนวน
  const p9 = mk({ enh: { weapon: 10 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); p9.c.bag.push({ id: 'enh_stone', n: 2 });
  const r9 = simLow.enhance(p9, { src: 'eq', rid: rid() }, 500);
  rec('ล้มเหลวที่ +10 → คงที่ +10 ไม่ลด ไม่หาย', !r9.ok && r9.to === 10 && p9.c.enh.weapon === 10 && p9.c.eq.weapon === 'sword_hmong' && p9.c.gold === 1000000 - 40000 && countStone(p9.c) === 1, JSON.stringify({ ok: r9.ok, enh: p9.c.enh.weapon, gold: p9.c.gold, stone: countStone(p9.c) }));
  const p10 = mk({ enh: { weapon: 15 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); p10.c.bag.push({ id: 'enh_stone', n: 2 });
  rec('ถึง +15 แล้ว → max (ตีบวกต่อไม่ได้)', simLow.enhance(p10, { src: 'eq', rid: rid() }, 600) === 'max');
  // ระดับ 11 ถึง 14 จ่ายเท่ากันที่ 55,000 (คำสั่งเจ้าของ V2-R81) · ระดับ 1–10 คงค่าเดิม (+10 → +11 = 40,000)
  const pC = mk({ gold: 55000, enh: { weapon: 11 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); pC.c.bag.push({ id: 'enh_stone', n: 1 });
  const rC = sim.enhance(pC, { src: 'eq', rid: rid() }, 800);
  rec('ตีบวกจาก +11 จ่าย 55,000 (เท่ากับ +12 ถึง +14) และหักครบ', rC.ok && rC.to === 12 && rC.gold === 55000 && pC.c.gold === 0, JSON.stringify({ gold: rC.gold, left: pC.c.gold, to: rC.to }));
  const pC11 = mk({ gold: 54999, enh: { weapon: 11 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); pC11.c.bag.push({ id: 'enh_stone', n: 1 });
  rec('ที่ +11 เงิน 54,999 ไม่พอ → no-gold และไม่หัก', sim.enhance(pC11, { src: 'eq', rid: rid() }, 800) === 'no-gold' && pC11.c.gold === 54999);
  const pC12 = mk({ gold: 55000, enh: { weapon: 12 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); pC12.c.bag.push({ id: 'enh_stone', n: 1 });
  const rC12 = sim.enhance(pC12, { src: 'eq', rid: rid() }, 800);
  rec('ตีบวกจาก +12 จ่ายเพียง 55,000 (ไม่ใช่ 90,000) และหักครบ', rC12.ok && rC12.to === 13 && rC12.gold === 55000 && pC12.c.gold === 0, JSON.stringify({ gold: rC12.gold, left: pC12.c.gold, to: rC12.to }));
  const pC2 = mk({ gold: 54999, enh: { weapon: 14 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); pC2.c.bag.push({ id: 'enh_stone', n: 1 });
  rec('เงิน 54,999 ไม่พอสำหรับ +14 (เพดาน 55,000) → no-gold และไม่หัก', sim.enhance(pC2, { src: 'eq', rid: rid() }, 800) === 'no-gold' && pC2.c.gold === 54999);
  const pT = mk({ gold: 40000, enh: { weapon: 10 }, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); pT.c.bag.push({ id: 'enh_stone', n: 1 });
  const rT = sim.enhance(pT, { src: 'eq', rid: rid() }, 800);
  rec('ขั้น +10 ยังจ่าย 40,000 (ต่ำกว่าเพดาน)', rT.gold === 40000 && pT.c.gold === 0, JSON.stringify({ gold: rT.gold, left: pT.c.gold }));

  // อาวุธในกระเป๋าตีบวกได้โดยไม่ต้องใส่
  const p11 = mk({ eq: { weapon: null, armor: null, acc: null } }); p11.c.bag.push({ id: 'sword_iron', n: 1 }, { id: 'enh_stone', n: 2 });
  const r11 = sim.enhance(p11, { src: 'bag', i: 0, rid: rid() }, 700);
  rec('ตีบวกอาวุธในกระเป๋าได้ (ไม่ต้องใส่)', r11.ok && p11.c.bag[0].enh === 1, JSON.stringify(p11.c.bag[0]));

  // ใส่/ถอด: ค่าตีบวกติดไปกับอาวุธ
  const p12 = mk({ eq: { weapon: null, armor: null, acc: null } }); p12.c.bag.push({ id: 'sword_hmong', n: 1, enh: 7 });
  rec('ใส่อาวุธที่ตีบวกแล้ว → ค่าตีบวกติดไปที่ช่องอาวุธ', sim.inv(p12, 'equip', 0) === 'ok' && p12.c.eq.weapon === 'sword_hmong' && p12.c.enh.weapon === 7);
  rec('ถอดอาวุธ → ค่าตีบวกติดไปกับอาวุธในกระเป๋า', sim.inv(p12, 'unequip', 'weapon') === 'ok' && p12.c.bag.some(s => s.id === 'sword_hmong' && s.enh === 7) && !p12.c.enh.weapon);

  // เปลี่ยนอาชีพ: อาวุธเดิมเก็บเข้ากระเป๋าพร้อมค่าตีบวก
  const p13 = mk({ eq: { weapon: 'sword_hmong', armor: null, acc: null }, enh: { weapon: 9 } });
  rec('เปลี่ยนอาชีพ: อาวุธเดิมเก็บเข้ากระเป๋าพร้อมค่าตีบวก และได้อาวุธของอาชีพใหม่ +0', sim.setClass(p13, 'นักธนู') === 'ok' && p13.c.bag.some(s => s.id === 'sword_hmong' && s.enh === 9) && p13.c.eq.weapon === 'bow_wood' && !p13.c.enh.weapon, JSON.stringify({ r: sim.setClass, bag: p13.c.bag, eq: p13.c.eq.weapon }));

  // ค่าโจมตีเพิ่มตามระดับตีบวก: ดาบด้ามแดง (ATK 24) ที่ +10 → ATK รวมเพิ่ม 14 (39 + 24×1.6 ปัด − 39 + 24 ปัด)
  const pA = mk({ eq: { weapon: 'sword_hmong', armor: null, acc: null }, enh: { weapon: 0 } });
  sim.stats(pA); const a0 = pA.atk;
  pA.c.enh.weapon = 10; sim.stats(pA); const a1 = pA.atk;
  rec('ค่าโจมตีอาวุธเพิ่มตามระดับตีบวก (ดาบด้ามแดง +10 ≈ ×1.6)', a1 - a0 === 14, 'ก่อน ' + a0 + ' → หลัง ' + a1);

  // สถิติ: ที่ +10 (โอกาส 35%) จาก 20,000 ครั้ง ต้องใกล้ 35% และล้มเหลวไม่ลดระดับ
  const simR = createSim({ rand: Math.random });
  const pS = mk({ gold: 1e12, eq: { weapon: 'sword_hmong', armor: null, acc: null } }); pS.c.bag.push({ id: 'enh_stone', n: 1e6 });
  let okN = 0, badDrop = 0; const N = 20000;
  for (let i = 0; i < N; i++) {
    pS.c.enh.weapon = 10;
    const r = simR.enhance(pS, { src: 'eq', rid: rid() }, 1000 + i);
    if (r.ok) okN++; else if (r.to !== 10) badDrop++;
  }
  const rate = okN / N;
  rec('อัตราสำเร็จ +10 จาก 20,000 ครั้ง ≈ 35% (±1%) และไม่มีการลดระดับเมื่อล้มเหลว', Math.abs(rate - 0.35) < 0.01 && badDrop === 0, 'ได้ ' + (rate * 100).toFixed(2) + '% · ลดระดับ ' + badDrop + ' ครั้ง');
}

(async () => {
  // ---- ส่วนที่ 2: ฐานข้อมูล ----
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-enh-db-'));
    const file = path.join(dir, 'enh.db');
    const db = dbmod.open(file);
    const acc = db.register('Enh_Db', 'secret123', { zone: 'village', x: 100, y: 100 });
    const c = db.character(acc.id);
    c.eq.weapon = 'sword_hmong'; c.enh = { weapon: 12 }; c.bag.push({ id: 'sword_iron', n: 1, enh: 3 }); c.gold = 4321;
    db.save(c);
    const back = db.character(acc.id);
    rec('ค่าตีบวกคงอยู่หลังบันทึกและโหลดใหม่ (ที่ใส่อยู่ + ในกระเป๋า + เงิน)', back.enh.weapon === 12 && back.bag.some(s => s.id === 'sword_iron' && s.enh === 3) && back.gold === 4321);
    db.logEnh(acc.id, 'Enh_Db', 'village', { item: 'sword_hmong', from: 12, to: 13, ok: true, gold: 90000, stone: 1 });
    db.logEnh(acc.id, 'Enh_Db', 'village', { item: 'sword_hmong', from: 12, to: 12, ok: false, gold: 90000, stone: 1 });
    db.close();
    const rd = new DatabaseSync(file);
    const row = rd.prepare('SELECT COUNT(*) AS n, SUM(ok) AS okn FROM enh_log WHERE account_id = ?').get(acc.id);
    rd.close();
    rec('ประวัติการตีบวกบันทึกทุกครั้ง (สำเร็จและล้มเหลว)', Number(row.n) === 2 && Number(row.okn) === 1, JSON.stringify({ n: Number(row.n), ok: Number(row.okn) }));
  }

  // ---- ส่วนที่ 3: เกมจริงในเบราว์เซอร์ ----
  const runUi = async (label, device, shot) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-enh-ui-'));
    const srv = createServer({ dbFile: path.join(dir, 'ui.db'), quiet: true, saveEverySec: 2, startZone: 'village' });
    const port = await srv.listen(0);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices[device] });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const user = 'Enh_' + label;
    await page.goto('http://127.0.0.1:' + port + '/');
    await page.waitForSelector('#net:not([hidden])', { timeout: 10000 });
    await page.fill('#netn', user); await page.fill('#netp', 'secret123');
    await page.click('#netreg');
    await page.waitForSelector('#cstart #nmin', { timeout: 15000 });
    await page.fill('#cstart #nmin', 'Enh' + label.slice(0, 6)); await page.click('#cstart #nmgo');
    await page.waitForSelector('#cstart button[aria-label="อาชีพ นักดาบ"]', { timeout: 8000 });
    await page.click('#cstart button[aria-label="อาชีพ นักดาบ"]');
    await page.click('#cstart [data-g="m"]');
    await page.click('#csgo');
    await page.waitForSelector('#atgo', { timeout: 8000 }); await page.click('#atgo');
    await page.waitForFunction(() => { const c = document.getElementById('cstart'); return !c || c.hidden || getComputedStyle(c).display === 'none'; }, null, { timeout: 20000 });

    const acc = srv.db.login(user, 'secret123');
    const p = srv.online.get(acc.id);
    const s = smiths[0];
    const sx = s.tx * T, sy = (s.ty + 1) * T;
    p.c.gold = 100000; p.c.bag.push({ id: 'enh_stone', n: 5 }); p.bagDirty = true; p.dirty = true;
    p.c.x = sx; p.c.y = sy;
    await page.evaluate(([x, y]) => { HL.player.x = x; HL.player.y = y; }, [sx, sy]);

    const near = await page.waitForFunction(() => { const b = document.getElementById('shb'); return b && !b.hidden && b.innerText.includes('ช่างตีเหล็ก'); }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    rec(label + ': ปุ่มช่างตีเหล็กขึ้นเมื่อยืนใกล้ช่าง', near);
    await page.click('#shb');
    await page.waitForSelector('#enh:not([hidden])', { timeout: 5000 });
    const panel = () => page.evaluate(() => document.getElementById('enh').innerText);
    const t0 = await panel();
    rec(label + ': หน้าช่างแสดงเงินและหินป้องกันจากเซิร์ฟเวอร์', t0.includes('เงินของคุณ 100,000') && t0.includes('หินป้องกัน 5 ก้อน'), t0.split('\n').slice(0, 2).join(' | '));
    rec(label + ': หน้าช่างแสดงอัตรา +0 → +1 ค่า ATK ทศนิยม 2 ตำแหน่ง และติดธงค่าชั่วคราว', t0.includes('+0 → +1') && t0.includes('ATK 4 → 4.24') && t0.includes('ค่าชั่วคราว'));

    await page.click('#enh .enhgo');
    const ok1 = await page.waitForFunction(() => (document.getElementById('msg').textContent || '').includes('ตีบวกสำเร็จ'), null, { timeout: 8000 }).then(() => true).catch(() => false);
    rec(label + ': ตีบวก +0 → +1 สำเร็จ (ผลจากเซิร์ฟเวอร์)', ok1);
    await sleep(1500);
    rec(label + ': เซิร์ฟเวอร์หักเงิน 2,000 และหิน 1 และตั้งค่า +1', p.c.enh.weapon === 1 && p.c.gold === 98000 && countStone(p.c) === 4, JSON.stringify({ enh: p.c.enh, gold: p.c.gold, stone: countStone(p.c) }));
    rec(label + ': หน้าช่างอัปเดตเป็นตีบวกเป็น +2', (await panel()).includes('ตีบวกเป็น +2'));

    await page.click('#bagb');
    await page.waitForSelector('#bag:not([hidden])', { timeout: 5000 });
    const bagTxt = await page.evaluate(() => document.getElementById('bag').innerText);
    rec(label + ': กระเป๋าแสดงอาวุธ +1 และหินป้องกันเป็นวัตถุดิบ ×4', bagTxt.includes('+1') && bagTxt.includes('หินป้องกันการตีบวก ×4'), bagTxt.split('\n').filter(l => l.includes('หิน') || l.includes('+1')).join(' | '));
    await page.click('#bag h3 button');

    p.c.bag = p.c.bag.filter(x => x.id !== 'enh_stone'); p.bagDirty = true; p.dirty = true;
    await sleep(1200);
    await page.click('#enh .enhgo'); // ปุ่มตีบวกจริงของหน้าช่าง (ไม่มีหินแล้ว)
    const denyNo = await page.waitForFunction(() => (document.getElementById('msg').textContent || '').includes('หินป้องกันไม่พอ'), null, { timeout: 6000 }).then(() => true).catch(() => false);
    rec(label + ': ไม่มีหินป้องกัน → เซิร์ฟเวอร์ปฏิเสธ และค่าไม่เปลี่ยน', denyNo && p.c.enh.weapon === 1);

    // เดินออกจากช่าง: เซิร์ฟเวอร์ส่งตำแหน่งจริงกลับ เครื่องผู้เล่นจึงปิดหน้าช่างเอง (การปฏิเสธระยะทดสอบใน sim แล้ว)
    p.c.x = 0; p.c.y = 0; p.dirty = true;
    const closed = await page.waitForFunction(() => document.getElementById('enh').hidden, null, { timeout: 6000 }).then(() => true).catch(() => false);
    rec(label + ': เดินออกจากช่างตีเหล็ก → หน้าช่างปิดเอง', closed);

    // กลับไปยืนใกล้ช่างแล้วเปิดหน้าช่างใหม่เพื่อถ่ายภาพหน้าจอ
    p.c.x = sx; p.c.y = sy; p.dirty = true;
    await page.evaluate(([x, y]) => { HL.player.x = x; HL.player.y = y; }, [sx, sy]);
    await page.waitForFunction(() => { const b = document.getElementById('shb'); return b && !b.hidden && b.innerText.includes('ช่างตีเหล็ก'); }, null, { timeout: 8000 });
    await page.click('#shb');
    await page.waitForSelector('#enh:not([hidden])', { timeout: 5000 });
    await sleep(400);
    // ระดับ 11 ถึง 14 เท่ากันที่ 55,000 (คำสั่งเจ้าของ V2-R81) — ที่ +11 และ +12 ต้องแสดง 55,000 (ถ่ายภาพที่ +12) แล้วคืนค่าเดิมสำหรับการตรวจฐานข้อมูลด้านล่าง
    p.c.enh.weapon = 11; p.c.bag.push({ id: 'enh_stone', n: 1 }); p.bagDirty = true; p.dirty = true;
    await page.waitForFunction(() => (document.getElementById('enh').innerText || '').includes('+11 → +12'), null, { timeout: 6000 });
    const t11 = await panel();
    rec(label + ': หน้าช่างที่ +11 แสดงเงิน 55,000 (เท่ากับ +12 ถึง +14)', t11.includes('เงิน 55,000') && !t11.includes('เงิน 60,000'), t11.split('\n').filter(l => l.includes('+11 → +12')).join(' | ').slice(0, 140));
    p.c.enh.weapon = 12; p.bagDirty = true; p.dirty = true;
    await page.waitForFunction(() => (document.getElementById('enh').innerText || '').includes('+12 → +13'), null, { timeout: 6000 });
    const t12 = await panel();
    rec(label + ': หน้าช่างที่ +12 แสดงเงิน 55,000 (เท่ากับระดับ 11 ถึง 14)', t12.includes('เงิน 55,000') && !t12.includes('เงิน 90,000'), t12.split('\n').filter(l => l.includes('+12 → +13')).join(' | ').slice(0, 140));
    await page.screenshot({ path: path.join(evDir, shot) });
    p.c.enh.weapon = 1; p.c.bag = p.c.bag.filter(x => x.id !== 'enh_stone'); p.bagDirty = true; p.dirty = true;
    rec(label + ': ไม่มี JavaScript error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ไม่มี');

    await browser.close();
    await srv.close();
    const rd = new DatabaseSync(path.join(dir, 'ui.db'));
    const row = rd.prepare('SELECT COUNT(*) AS n, SUM(ok) AS okn FROM enh_log WHERE account_id = ?').get(acc.id);
    const crow = rd.prepare('SELECT enh, gold FROM characters WHERE account_id = ?').get(acc.id);
    rd.close();
    rec(label + ': ประวัติในฐานข้อมูลตรงกับการตีบวกที่สำเร็จ (1 ครั้ง, สำเร็จ 1)', Number(row.n) === 1 && Number(row.okn) === 1, JSON.stringify({ n: Number(row.n), ok: Number(row.okn) }));
    rec(label + ': ตารางตัวละครเก็บค่าตีบวก +1 และเงินที่หักแล้ว (98,000)', JSON.parse(crow.enh).weapon === 1 && Number(crow.gold) === 98000, JSON.stringify({ enh: crow.enh, gold: Number(crow.gold) }));
  };

  try {
    await runUi('pixel7', 'Pixel 7', 'enh_r78_panel_pixel7.png');
    await runUi('iphone13', 'iPhone 13', 'enh_r78_panel_iphone13.png');
  } catch (e) { rec('ส่วนที่ 3 ทำงานจบ', false, e.message); }

  const passed = results.filter(Boolean).length;
  console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
