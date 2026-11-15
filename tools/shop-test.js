// ทดสอบร้านค้า NPC และเงิน (V2-R73)
// ส่วนที่ 1: ตรรกะเซิร์ฟเวอร์ (ระยะ เงิน กระเป๋า เงินจากการล่า อาวุธระดับ) ไม่ใช้เบราว์เซอร์
// ส่วนที่ 2: ซื้อจริงผ่านปุ่มในเกม → เซิร์ฟเวอร์ตัดเงิน → บันทึกลงฐานข้อมูล
// รัน: node tools/shop-test.js
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
  const C = W.CFG, npc = C.npcs[0], T = W.T;
  const sim = createSim({ rand: () => .5 });
  const mk = (x, y, gold) => ({ id: 1, personal: [], c: { zone: npc.zone, x, y, dir: 'S', lv: 1, exp: 0, job: 1, jexp: 0, bag: [], eq: {}, gold, starter: 1 } });
  const NX = npc.tx * T, NY = npc.ty * T;
  const p = mk(NX, NY, 100);
  rec('ซื้อได้เมื่ออยู่ใกล้ NPC และเงินพอ', sim.buy(p, npc.id, 'potion_s', 2) === 'ok' && p.c.gold === 100 - 2 * 10 && p.c.bag.some(s => s.id === 'potion_s' && s.n === 2), 'เงินเหลือ ' + p.c.gold);
  rec('เงินไม่พอ → ปฏิเสธ และไม่หักเงิน/ไม่เพิ่มของ', sim.buy(p, npc.id, 'sword_iron', 1) === 'no-gold' && p.c.gold === 80 && !p.c.bag.some(s => s.id === 'sword_iron'));
  const far = mk(752, 464, 500);
  rec('อยู่ไกลจาก NPC → ปฏิเสธ (far)', sim.buy(far, npc.id, 'potion_s', 1) === 'far' && far.c.gold === 500);
  const other = mk(NX, NY, 500); other.c.zone = 'field';
  rec('คนละโซนกับ NPC → ปฏิเสธ (far)', sim.buy(other, npc.id, 'potion_s', 1) === 'far' && other.c.gold === 500);
  rec('ของที่ร้านไม่ขาย → invalid', sim.buy(mk(NX, NY, 500), npc.id, 'coat_cloth', 1) === 'invalid');
  rec('จำนวนไม่ถูกต้อง (0 / ไม่ใช่ตัวเลข) → invalid', sim.buy(mk(NX, NY, 500), npc.id, 'potion_s', 0) === 'invalid' && sim.buy(mk(NX, NY, 500), npc.id, 'potion_s', 'x') === 'invalid');
  const full = mk(NX, NY, 500);
  for (let i = 0; i < W.CFG.bag.slots; i++) full.c.bag.push({ id: 'coat_cloth', n: 1 });
  rec('กระเป๋าเต็ม → bag-full และไม่หักเงิน', sim.buy(full, npc.id, 'potion_s', 1) === 'bag-full' && full.c.gold === 500);
  const kill = mk(0, 0, 0);
  sim.giveGold(kill, { c: { exp: 26, boss: false } });
  rec('เงินจากมอนสเตอร์ทั่วไปตามค่าประสบการณ์', kill.c.gold === Math.floor(26 * C.economy.goldPerExp), 'ได้ ' + kill.c.gold);
  sim.giveGold(kill, { c: { exp: 8000, boss: true } });
  rec('เงินจากบอสเป็นค่าคงที่', kill.c.gold === Math.floor(26 * C.economy.goldPerExp) + C.economy.bossGold, 'รวม ' + kill.c.gold);
  const eq = mk(NX, NY, 0); eq.c.bag.push({ id: 'sword_silver', n: 1 });
  rec('ใส่ดาบเงินประดับได้ (ระดับอาวุธ 3)', sim.inv(eq, 'equip', 0) === 'ok' && eq.c.eq.weapon === 'sword_silver' && W.CFG.items.sword_silver.atk === 16);
}

// ---- ส่วนที่ 2: ซื้อจริงผ่านปุ่มในเกม ----
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-shop-'));
  const srv = createServer({ dbFile: path.join(dir, 'shop.db'), quiet: true, saveEverySec: 2, startZone: 'village' });
  const port = await srv.listen(0);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForSelector('#net:not([hidden])', { timeout: 10000 });
  await page.fill('#netn', 'Shop_Tester'); await page.fill('#netp', 'secret123');
  await page.click('#netreg');
  // ตัวละครใหม่: ตั้งชื่อ → เลือกอาชีพและเพศ → แผนที่โลก → เข้าเกม (ตามลำดับหน้าล็อบบี้)
  await page.waitForSelector('#cstart #nmin', { timeout: 15000 });
  await page.fill('#cstart #nmin', 'ShopTester'); await page.click('#cstart #nmgo');
  await page.waitForSelector('#cstart button[aria-label="อาชีพ นักดาบ"]', { timeout: 8000 });
  await page.click('#cstart button[aria-label="อาชีพ นักดาบ"]');
  await page.click('#cstart [data-g="m"]');
  await page.click('#csgo');
  await page.waitForSelector('#atgo', { timeout: 8000 }); await page.click('#atgo');
  await page.waitForFunction(() => { const c = document.getElementById('cstart'); return !c || c.hidden || getComputedStyle(c).display === 'none'; }, null, { timeout: 20000 });
  const nearNpc = await page.waitForFunction(() => { const b = document.getElementById('shb'); return b && !b.hidden; }, null, { timeout: 20000 }).then(() => true).catch(() => false);
  rec('ปุ่มร้านค้าแสดงเมื่อยืนใกล้ป้าขายของ', nearNpc);
  await page.click('#shb');
  const shopText = () => page.evaluate(() => { const s = document.getElementById('shop'); return s.hidden ? '' : s.innerText; });
  rec('เปิดร้านแล้วเห็นเงินเริ่มต้น 100', (await shopText()).includes('เงินของคุณ 100'), (await shopText()).split('\n').slice(0, 2).join(' | '));
  await page.click('#shop button[data-shop="potion_s"]');
  const bought = await page.waitForFunction(() => { const s = document.getElementById('shop'); return !s.hidden && s.innerText.includes('เงินของคุณ 90'); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  rec('ซื้อยาเล็กแล้วเงินลดเหลือ 90 (ตัดที่เซิร์ฟเวอร์)', bought);
  await page.click('#shop button[data-shop="sword_iron"]');
  await sleep(800);
  rec('ซื้อดาบเหล็ก (150) เมื่อมีเงิน 90 → เงินไม่เปลี่ยน', (await shopText()).includes('เงินของคุณ 90'));
  await sleep(2500);
  const acc = srv.db.login('Shop_Tester', 'secret123');
  const saved = acc && acc.id ? srv.db.character(acc.id) : null;
  rec('เงินถูกบันทึกลงฐานข้อมูล', saved && saved.gold === 90, 'gold=' + (saved && saved.gold));
  rec('ไม่มี JavaScript error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ไม่มี');
  await browser.close();
  await srv.close();
  const passed = results.filter(Boolean).length;
  console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
