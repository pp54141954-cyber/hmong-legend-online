// Hmong Legend V2-R83 — ข้อความแจ้งผลกระเป๋าและร้านค้าที่ผู้เล่นเห็นบนหน้าจอมือถือจำลอง
// รัน: MOBILE_BROWSER=chromium node tools/feedback-mobile-test.js   (Android Chromium, Pixel 7)
//      MOBILE_BROWSER=webkit   node tools/feedback-mobile-test.js   (iPhone WebKit, iPhone 13)
// ผลนี้เป็นการจำลองอุปกรณ์เท่านั้น ยังไม่ใช่การทดสอบบนโทรศัพท์จริง
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, webkit, devices } = require('playwright');
const { createServer } = require('../server/server.js');
const { CFG, ZONES } = require('../shared/world.js');

const safari = process.env.MOBILE_BROWSER === 'webkit';
const engine = safari ? webkit : chromium;
const deviceName = safari ? 'iPhone 13' : 'Pixel 7';
const label = safari ? 'iPhone WebKit (จำลอง)' : 'Android Chromium (จำลอง)';
const shot = safari ? 'webkit' : 'chromium';
let checks = 0;
const failures = [];
const ok = (name, cond) => {
  checks++;
  if (cond) console.log('PASS ' + name + ' — ' + label);
  else { failures.push(name); console.log('FAIL ' + name + ' — ' + label); }
};

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-feedback-ui-'));
  const server = createServer({ dbFile: path.join(tmp, 'game.db'), quiet: true, startZone: 'village2' });
  let browser, page;
  const pageErrors = [];
  try {
    const point = ZONES.village2.start;
    const reg = server.db.register('FeedbackUi', 'secret123', { zone: 'village2', x: point[0], y: point[1] });
    assert(reg.id, 'seed account');
    const seeded = server.db.character(reg.id);
    Object.assign(seeded, {
      cls: 'นักดาบ', clsset: 1, starter: 1, gold: 0,
      eq: { weapon: 'sword_wood', offhand: null, armor: 'coat_cloth', acc: null },
      bag: [{ id: 'potion_s', n: 2 }],
    });
    server.db.save(seeded);

    const port = await server.listen(0);
    browser = await engine.launch();
    page = await browser.newPage({ ...devices[deviceName] });
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto('http://127.0.0.1:' + port + '/?splash=0');
    await page.waitForSelector('#net:not([hidden])', { timeout: 10000 });
    await page.fill('#netn', 'FeedbackUi');
    await page.fill('#netp', 'secret123');
    await page.click('#netlogin');
    await page.waitForFunction(() => window.HLNET && window.HLNET.auth && window.HLNET.joined, null, { timeout: 15000 });

    const online = () => server.online.get(reg.id);
    const msg = () => page.evaluate(() => document.getElementById('msg').textContent || '');
    // รอข้อความบนหน้าจอ: คืนค่า true/false แทนการโยนข้อผิดพลาด เพื่อรายงานทุกจุดในการรันเดียว
    const waitMsg = (part, timeout = 8000) => page
      .waitForFunction(p => (document.getElementById('msg').textContent || '').includes(p), part, { timeout })
      .then(() => true, () => false);
    // ใช้แผงร้านค้าที่เปิดอยู่แล้ว ไม่กดปุ่มร้านค้าซ้ำ (แผงเปิดทับปุ่มนั้นอยู่)
    const openShop = async () => {
      const visible = await page.evaluate(() => { const s = document.getElementById('shop'); return !!s && !s.hidden; });
      if (!visible) await page.click('#shb');
      await page.waitForSelector('#shop:not([hidden])', { timeout: 8000 });
    };
    const buyPotion = () => page.click('#shop button[aria-label^="ซื้อ ยาสมุนไพรเล็ก"]');
    const artifacts = path.join(__dirname, 'test-artifacts');
    fs.mkdirSync(artifacts, { recursive: true });

    // 1) เงินไม่พอ — ปุ่มซื้อในร้านค้า
    await openShop();
    await buyPotion();
    ok('ร้านค้า: เงินไม่พอแสดงข้อความบนหน้าจอ', await waitMsg('เงินไม่พอ'));
    ok('ร้านค้า: เงินไม่พอแจ้งว่าซื้อสินค้านี้ไม่ได้', (await msg()).includes('ซื้อสินค้านี้ไม่ได้'));
    ok('ร้านค้า: เงินไม่พอไม่หักเงินหรือเพิ่มของ', online().c.gold === 0 && online().c.bag[0].n === 2);

    // 2) HP เต็ม — ใช้ยาจากกระเป๋า
    await page.click('#bagb');
    await page.waitForSelector('#bag:not([hidden])', { timeout: 8000 });
    await page.click('#bag button[aria-label^="ใช้ ยาสมุนไพรเล็ก"]');
    ok('กระเป๋า: HP เต็มแสดงข้อความบนหน้าจอ', await waitMsg('HP เต็มแล้ว'));
    ok('กระเป๋า: HP เต็มบอกว่ายังไม่ต้องใช้ยา', (await msg()).includes('ยังไม่ต้องใช้ยา'));
    ok('กระเป๋า: ยาไม่ถูกใช้เมื่อ HP เต็ม', online().c.bag[0].n === 2);
    await page.click('#bagb'); // ปิดกระเป๋าเพื่อให้ปุ่มร้านค้าไม่ถูกบัง

    // 2b) คูลดาวน์ยา — ใช้ยาสองครั้งติดกันหลังบาดเจ็บ ข้อความบนหน้าจอต้องบอกเวลาที่เหลือ
    online().hp = online().maxHp - 60;
    await page.click('#bagb');
    await page.waitForSelector('#bag:not([hidden])', { timeout: 8000 });
    await page.click('#bag button[aria-label^="ใช้ ยาสมุนไพรเล็ก"]');
    for (let i = 0; i < 60 && online().c.bag[0].n !== 1; i++) await new Promise(r => setTimeout(r, 50));
    await page.click('#bag button[aria-label^="ใช้ ยาสมุนไพรเล็ก"]');
    ok('กระเป๋า: คูลดาวน์ยาแสดงเวลาที่เหลือบนหน้าจอ', await waitMsg('ใช้ได้อีกใน'));
    ok('กระเป๋า: คูลดาวน์ยาไม่ตัดยาเพิ่ม', online().c.bag[0].n === 1);
    await page.click('#bagb');

    // 3) กระเป๋าเต็ม — ซื้อสินค้า (มีเงินพอ)
    online().c.gold = 1000;
    online().c.bag = Array.from({ length: CFG.bag.slots }, () => ({ id: 'hide', n: 99 }));
    await openShop();
    await buyPotion();
    ok('ร้านค้า: กระเป๋าเต็มแสดงข้อความบนหน้าจอ', await waitMsg('กระเป๋าไม่มีช่องว่าง'));
    ok('ร้านค้า: กระเป๋าเต็มบอกให้จัดกระเป๋าก่อน', (await msg()).includes('จัดกระเป๋าก่อนซื้อ'));
    ok('ร้านค้า: กระเป๋าเต็มไม่หักเงิน', online().c.gold === 1000);

    // 4) บันทึกฐานข้อมูลไม่สำเร็จ — ต้องไม่แสดงว่าซื้อสำเร็จ และสถานะเดิมต้องคงอยู่
    online().c.bag = [{ id: 'hide', n: 1 }];
    const goldBefore = online().c.gold, bagBefore = JSON.stringify(online().c.bag);
    const save = server.db.save;
    server.db.save = () => { throw new Error('injected save failure'); };
    try {
      await buyPotion();
      ok('ร้านค้า: บันทึกไม่สำเร็จแสดงข้อความบนหน้าจอ', await waitMsg('บันทึกไม่สำเร็จ'));
    } finally { server.db.save = save; }
    const saveText = await msg();
    ok('ร้านค้า: บันทึกไม่สำเร็จแจ้งว่ายังไม่ได้ซื้อ/ใช้/สวม', saveText.includes('ยังไม่ได้ซื้อ/ใช้/สวม'));
    ok('ร้านค้า: บันทึกไม่สำเร็จไม่แสดงว่าสำเร็จ', !/สำเร็จแล้ว|ซื้อแล้ว/.test(saveText));
    ok('ร้านค้า: บันทึกไม่สำเร็จคืนเงินและกระเป๋าเดิม', online().c.gold === goldBefore && JSON.stringify(online().c.bag) === bagBefore);
    await page.screenshot({ path: path.join(artifacts, 'feedback-' + shot + '-save-error.png') });

    // 5) ขาดการเชื่อมต่อ — คำสั่งไม่ถูกส่ง ต้องบอกผู้เล่น
    await page.evaluate(() => { window.__prevState = HLNET.state; HLNET.state = 'offline'; });
    await buyPotion();
    ok('การเชื่อมต่อขาด: แสดงข้อความบนหน้าจอ', await waitMsg('ขาดการเชื่อมต่อ'));
    ok('การเชื่อมต่อขาด: แจ้งว่ายังไม่ได้ทำรายการ', (await msg()).includes('ยังไม่ได้ทำรายการ'));
    await page.evaluate(() => { HLNET.state = window.__prevState || 'online'; });

    // 6) การเชื่อมต่อหลุดจริง — สถานะต้องชัดเจนและเชื่อมต่อใหม่เอง
    await page.evaluate(() => HLNET.ws.close());
    const badgeShowsDrop = await page.waitForFunction(() => /หลุดการเชื่อมต่อ|กำลังเชื่อมต่อ/.test(document.getElementById('netst').textContent || ''), null, { timeout: 4000 }).then(() => true, () => false);
    ok('การเชื่อมต่อหลุด: ป้ายสถานะแสดงว่าหลุดหรือกำลังเชื่อมต่อใหม่', badgeShowsDrop);
    const reconnected = await page.waitForFunction(() => window.HLNET.state === 'online', null, { timeout: 20000 }).then(() => true, () => false);
    ok('การเชื่อมต่อหลุด: เชื่อมต่อใหม่ได้เองและยังอยู่ในเกม', reconnected && await page.evaluate(() => HLNET.joined === true));
    await page.screenshot({ path: path.join(artifacts, 'feedback-' + shot + '-reconnected.png') });

    ok('ไม่มี JavaScript error ตลอดการทดสอบ', pageErrors.length === 0);
  } finally {
    if (browser) await browser.close();
    await server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('RESULT: ' + (checks - failures.length) + '/' + checks + ' PASS (' + label + ')');
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error('FAIL feedback mobile (' + label + '):', e.message); process.exitCode = 1; });
