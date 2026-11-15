// ทดสอบท่ายืน 4 ทิศและลมหายใจตอนยืนนิ่ง (รอบ 2 / V2-R72)
// รัน: node tools/idle-test.js [path-to-html]   (ค่าเริ่มต้น game/index.html)
// ภาพหน้าจอ: docs/evidence/idle_r72_ingame_{E,S,W,N}.png
const { chromium, devices } = require('playwright');
const path = require('path');

const file = path.resolve(process.argv[2] || 'game/index.html');
const outDir = path.resolve('docs/evidence');
const results = [];
const rec = (name, pass, detail) => {
  results.push(!!pass);
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const hasExports = await page.evaluate(() => typeof HL === 'object' && typeof HL.idleFrame === 'function' && typeof HL.idleBob === 'function');
  rec('โหลดเกมและมี HL.idleFrame / HL.idleBob', hasExports);

  // ทุกอาชีพ × ชาย/หญิง × 4 ทิศ ต้องได้เฟรมยืนเป็นจำนวนเต็ม 0–3
  const classes = ['นักดาบ', 'นักสู้', 'นักฆ่า', 'นักธนู', 'ผู้พิทักษ์', 'ผู้รักษา', 'ผู้ใช้มนตรา', 'ผู้สืบวิญญาณ'];
  const bad = await page.evaluate((cls) => {
    const out = [];
    for (const c of cls) for (const g of ['m', 'f']) for (const d of ['S', 'N', 'W', 'E']) {
      const v = HL.idleFrame(c, { g, cls: c }, d);
      if (!Number.isInteger(v) || v < 0 || v > 3) out.push(c + '/' + g + '/' + d + '=' + v);
    }
    return out;
  }, classes);
  rec('8 อาชีพ × ชาย/หญิง × 4 ทิศ ได้เฟรมยืน 0–3 (64 ค่า)', bad.length === 0, bad.join(' ') || 'ครบ');

  // ลมหายใจ: ตอนยืนนิ่งค่าต้องสลับ, ตอนเดินต้องเป็น 0
  const samples = [];
  for (let i = 0; i < 12; i++) { samples.push(await page.evaluate(() => HL.idleBob(false))); await page.waitForTimeout(200); }
  const distinct = [...new Set(samples)];
  rec('ยืนนิ่ง: ค่าลมหายใจสลับระหว่างสองค่า', distinct.length >= 2, 'ค่าที่พบ=' + JSON.stringify(distinct));
  rec('เดิน: ไม่ขยับลมหายใจ', (await page.evaluate(() => HL.idleBob(true))) === 0);

  // เข้าโซนหมู่บ้าน เดินทีละทิศ แล้วปล่อยปุ่มให้ยืนนิ่ง จับภาพแต่ละทิศ
  // เริ่มห่างจุดเกิดไป 3 ช่อง เพื่อไม่ให้แผงร้านค้าบังตัวละครตอนเดินลง/ขึ้น
  await page.evaluate(() => { const s = HL.ZONES.village.start; HL.enterZone('village', s[0] - 96, s[1]); });
  await page.waitForTimeout(600);
  const dirs = [['ArrowRight', 'E'], ['ArrowDown', 'S'], ['ArrowLeft', 'W'], ['ArrowUp', 'N']];
  const faced = {};
  for (const [key, dir] of dirs) {
    await page.keyboard.down(key);
    await page.waitForTimeout(400);
    await page.keyboard.up(key);
    await page.waitForTimeout(900);
    faced[dir] = await page.evaluate(() => ({ dir: HL.player.dir, moving: HL.moving }));
    // ตัดภาพรอบตัวละครที่กลางแคนวาส (ตัวละครอยู่กลางจอ) เพื่อให้ไฟล์เล็ก
    const box = await page.locator('#c').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.screenshot({ path: path.join(outDir, 'idle_r72_ingame_' + dir + '.png'), clip: { x: cx - 60, y: cy - 80, width: 120, height: 160 } });
  }
  rec('เดินและหันได้ 4 ทิศ แล้วหยุดนิ่งเมื่อปล่อยปุ่ม',
    dirs.every(([, d]) => faced[d].dir === d && faced[d].moving === false), JSON.stringify(faced));
  rec('ไม่มี JavaScript error ตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ไม่มี');

  const passed = results.filter(Boolean).length;
  console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
