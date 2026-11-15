// ทดสอบลำดับหน้า (V2-R73): หน้าโหลดเกมต้องขึ้นก่อน และหน้าเข้าสู่ระบบจะแสดงหลังหน้าโหลดจบแล้วแตะ "เริ่ม"
// รัน: node tools/splash-login-test.js
// เปิดด้วย ?splash=1 เพื่อให้หน้าโหลดทำงาน (ระบบทดสอบอัตโนมัติปกติข้ามหน้านี้)
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium, devices } = require('playwright');
const { createServer } = require('../server/server.js');

const results = [];
const rec = (name, pass, detail) => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-splash-'));
  const srv = createServer({ dbFile: path.join(dir, 'test.db'), quiet: true, saveEverySec: 2, startZone: 'village' });
  const port = await srv.listen(0);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/?splash=1');

  const visible = sel => page.evaluate(s => { const el = document.querySelector(s); return !!el && !el.hidden; }, sel);
  await sleep(600);
  rec('ขณะหน้าโหลดทำงาน หน้าโหลดแสดงอยู่', await visible('#splash'));
  rec('ขณะหน้าโหลดทำงาน หน้าเข้าสู่ระบบยังซ่อนอยู่', !(await visible('#net')));

  // รอจนหน้าโหลดเสร็จ (ปุ่มเริ่มแสดง) แต่ยังไม่แตะ
  const loaded = await page.waitForFunction(() => { const g = document.getElementById('splgo'); return g && !g.hidden; }, null, { timeout: 30000 }).then(() => true).catch(() => false);
  rec('หน้าโหลดเสร็จแล้วปุ่มเริ่มแสดง', loaded);
  await sleep(400);
  rec('หน้าโหลดเสร็จแต่ยังไม่แตะ หน้าเข้าสู่ระบบยังไม่ขึ้น', !(await visible('#net')));

  // แตะ "เริ่ม" → หน้าโหลดหาย แล้วหน้าเข้าสู่ระบบขึ้น
  // ปุ่มมีแอนิเมชันกระพริบจึงกดผ่าน DOM (เรียกตัวจัดการเดียวกับการแตะ)
  await page.evaluate(() => document.getElementById('splgo').click());
  await sleep(1200);
  rec('แตะเริ่มแล้วหน้าโหลดหาย', !(await visible('#splash')));
  rec('หน้าเข้าสู่ระบบขึ้นหลังหน้าโหลดจบ', await visible('#net'));
  rec('ไม่มี JavaScript error', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ไม่มี');

  const passed = results.filter(Boolean).length;
  console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
  await browser.close();
  await srv.close();
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
