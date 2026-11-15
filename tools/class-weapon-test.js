// ทดสอบอาวุธตามอาชีพและจุดเกิดผู้เล่นใหม่ (V2-R74)
// ส่วนที่ 1: ตรรกะเซิร์ฟเวอร์ (สวมใส่ ซื้อ เปลี่ยนอาชีพ ดรอป) ไม่ใช้เบราว์เซอร์
// ส่วนที่ 2: ผู้เล่นใหม่บนเซิร์ฟเวอร์ปกติเริ่มที่หมู่บ้านกางเขา มีร้านค้าและแผนที่โลกแสดงชื่อถูกต้อง
// รัน: node tools/class-weapon-test.js
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium, devices } = require('playwright');
const { createSim } = require('../server/sim.js');
const { createServer } = require('../server/server.js');
const W = require('../shared/world.js');

const results = [];
const rec = (name, pass, detail) => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- ส่วนที่ 1: ตรรกะเซิร์ฟเวอร์ ----
{
  const C = W.CFG, T = W.T, T2 = C.npcs.find(n => n.zone === 'village2');
  const mk = (cls, gold, x, y, zone) => ({ id: 1, personal: [], c: { zone: zone || 'village', x, y, dir: 'S', lv: 1, exp: 0, job: 1, jexp: 0, bag: [], eq: {}, gold, cls, clsset: 1, starter: 1 } });
  const VX = 11.5 * T, VY = 15.6 * T; // จุดเกิดหมู่บ้านเริ่มต้น (ปลอดภัย)
  const sim = createSim({ rand: () => .5 });

  const a = mk('นักธนู', 0, VX, VY);
  a.c.bag.push({ id: 'sword_iron', n: 1 });
  rec('สวมดาบให้นักธนูไม่ได้ (wrong-class) และของยังอยู่ในกระเป๋า', sim.inv(a, 'equip', 0) === 'wrong-class' && a.c.eq.weapon === undefined && a.c.bag.some(s => s.id === 'sword_iron'));
  a.c.bag.push({ id: 'bow_iron', n: 1 });
  rec('สวมธนูเหล็กให้นักธนูได้', sim.inv(a, 'equip', 1) === 'ok' && a.c.eq.weapon === 'bow_iron', 'ATK ' + C.items.bow_iron.atk);

  const shopper = mk('นักดาบ', 500, T2.tx * T, T2.ty * T, 'village2');
  rec('ร้านหมู่บ้านกางเขาซื้อดาบไม้ได้ (นักดาบ)', sim.buy(shopper, T2.id, 'sword_wood', 1) === 'ok' && shopper.c.gold === 450);
  rec('ซื้อธนูของอาชีพอื่นไม่ได้ (wrong-class) และไม่หักเงิน', sim.buy(shopper, T2.id, 'bow_wood', 1) === 'wrong-class' && shopper.c.gold === 450);

  const sw = mk('นักดาบ', 0, VX, VY); sw.c.eq.weapon = 'sword_wood'; delete sw.c.clsset; // ยังไม่เคยเลือกอาชีพ
  rec('เลือกอาชีพครั้งแรกเป็นนักธนู: ดาบไม้เดิมไปกระเป๋า ใส่ธนูไม้', sim.setClass(sw, 'นักธนู', true) === 'ok' && sw.c.eq.weapon === 'bow_wood' && sw.c.bag.some(s => s.id === 'sword_wood'));
  rec('เปลี่ยนเป็นนักฆ่าในหมู่บ้าน: ธนูไม้ไปกระเป๋า ใส่มีดสั้นไม้', sim.setClass(sw, 'นักฆ่า') === 'ok' && sw.c.eq.weapon === 'daggers_wood' && sw.c.bag.some(s => s.id === 'bow_wood'));

  const drop = mk('นักธนู', 0, VX, VY); drop.c.eq.weapon = 'bow_iron';
  const dsim = createSim({ rand: () => 0 }); // ทอยทุกครั้งให้ติด → ทดสอบว่าของดรอปตามอาชีพ
  dsim.rollDrops(drop, { type: 'โกเลมหิน', id: 1 });
  rec('ดรอประดับ 3 ของโกเลมหินเป็นอาวุธของอาชีพผู้เล่น (นักธนู → ธนูเงิน)', drop.c.bag.some(s => s.id === 'bow_silver'), 'กระเป๋า: ' + drop.c.bag.map(s => s.id).join(', '));
}

// ---- ส่วนที่ 2: ผู้เล่นใหม่บนเซิร์ฟเวอร์ปกติ ----
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-cls-'));
  const srv = createServer({ dbFile: path.join(dir, 'cls.db'), quiet: true, saveEverySec: 2 }); // ไม่กำหนด startZone = จุดเกิดจริงของผู้เล่นใหม่
  const port = await srv.listen(0);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForSelector('#net:not([hidden])', { timeout: 10000 });
  await page.fill('#netn', 'Home_Tester'); await page.fill('#netp', 'secret123');
  await page.click('#netreg');
  await page.waitForSelector('#cstart #nmin', { timeout: 15000 });
  await page.fill('#cstart #nmin', 'HomeTester'); await page.click('#cstart #nmgo');
  await page.waitForSelector('#cstart button[aria-label="อาชีพ นักธนู"]', { timeout: 8000 });
  await page.click('#cstart button[aria-label="อาชีพ นักธนู"]');
  await page.click('#cstart [data-g="f"]');
  await page.click('#csgo');
  await page.waitForSelector('#atgo', { timeout: 8000 });
  const atlasZone = await page.textContent('#cstart .zn');
  rec('หน้าแผนที่โลกแสดงจุดเกิดจริง: หมู่บ้านกางเขา', atlasZone.includes('หมู่บ้านกางเขา'), atlasZone);
  await page.click('#atgo');
  const nearShop = await page.waitForFunction(() => { const b = document.getElementById('shb'); return b && !b.hidden; }, null, { timeout: 20000 }).then(() => true).catch(() => false);
  rec('มีปุ่มร้านค้าที่จุดเกิดหมู่บ้านกางเขา', nearShop);
  await page.click('#shb');
  const shopText = await page.evaluate(() => { const s = document.getElementById('shop'); return s.hidden ? '' : s.innerText; });
  rec('ร้านหมู่บ้านกางเขาเห็นเงินเริ่มต้น', shopText.includes('เงินของคุณ 100'), shopText.split('\n').slice(0, 2).join(' | '));
  await page.click('#shop button[data-shop="potion_s"]');
  const bought = await page.waitForFunction(() => { const s = document.getElementById('shop'); return !s.hidden && s.innerText.includes('เงินของคุณ 90'); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  rec('ซื้อยาที่หมู่บ้านกางเขาได้ (ตัดเงินที่เซิร์ฟเวอร์)', bought);
  rec('ไม่มี JavaScript error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ไม่มี');
  await browser.close();
  await srv.close();
  const passed = results.filter(Boolean).length;
  console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
