// ทดสอบพื้นฐานของเกม: โหลด เดิน ต่อสู้ รับ EXP และสกิลนักดาบ
// รัน: node tools/smoke-test.js [path-to-html]   (ค่าเริ่มต้น game/index.html)
const { chromium, devices } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const file = path.resolve(process.argv[2] || 'game/index.html');
const results = [];
const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

(async () => {
  // เสิร์ฟผ่าน HTTP ให้เหมือนการเปิดจากลิงก์จริง
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); fs.createReadStream(file).pipe(r); }).listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const hasHL = await page.evaluate(() => typeof window.HL === 'object');
  rec('โหลดเกมและสร้าง window.HL', hasHL, url);
  if (!hasHL) { console.log(errors.join('\n')); process.exit(1); }

  const imgs = await page.evaluate(() => [...document.images].length + ' <img>, canvas ' + document.getElementById('c').width + 'x' + document.getElementById('c').height);
  const sprOk = await page.evaluate(() => new Promise(res => {
    // ตรวจว่ารูปตัวละครที่ฝังไว้ decode ได้ (HL ไม่ส่ง SPR ออกมา ใช้ ATL/PORTRAIT แทนถ้ามี)
    const list = [window.HL.ATL, window.HL.PORTRAIT].filter(x => x && x.complete !== undefined);
    res(list.length === 0 ? 'n/a' : list.every(i => i.complete && i.naturalWidth > 0) ? 'ok' : 'broken');
  }));
  rec('รูปที่ฝังในไฟล์ decode ได้', sprOk !== 'broken', 'ATL/PORTRAIT=' + sprOk + '; ' + imgs);

  // เดิน 4 ทิศผ่านคีย์บอร์ด (เส้นทาง input ปกติ)
  const pos = () => page.evaluate(() => ({ x: HL.player.x, y: HL.player.y, dir: HL.player.dir, zone: HL.Z.id }));
  const start = await pos();
  rec('เริ่มในหมู่บ้าน', start.zone === 'village', JSON.stringify(start));
  const moves = {};
  for (const [key, dir] of [['ArrowRight', 'E'], ['ArrowDown', 'S'], ['ArrowLeft', 'W'], ['ArrowUp', 'N']]) {
    const a = await pos();
    await page.keyboard.down(key); await page.waitForTimeout(500); await page.keyboard.up(key);
    const b = await pos();
    moves[dir] = { moved: Math.round(Math.hypot(b.x - a.x, b.y - a.y)), faced: b.dir };
  }
  const walkOk = Object.entries(moves).every(([d, m]) => m.faced === d && m.moved > 5);
  rec('เดินและหันได้ 4 ทิศด้วยคีย์บอร์ด', walkOk, JSON.stringify(moves));

  // จอยแบบสัมผัสบนแคนวาส
  const a = await pos();
  const box = await page.locator('#c').boundingBox();
  const cx = box.x + box.width * 0.3, cy = box.y + box.height * 0.5;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 60, cy, { steps: 5 });
  await page.waitForTimeout(500); await page.mouse.up();
  const b = await pos();
  rec('จอยลากบนจอเดินได้', Math.hypot(b.x - a.x, b.y - a.y) > 5, 'ระยะ ' + Math.round(Math.hypot(b.x - a.x, b.y - a.y)));

  // ต่อสู้: วางผู้เล่นข้างมอนสเตอร์ในหมู่บ้าน กดปุ่มโจมตีจริงจนมอนสเตอร์ตาย
  const before = await page.evaluate(() => ({ lv: HL.PS.lv, exp: HL.PS.exp, job: HL.PS.job, jexp: HL.PS.jexp, kills: HL.PS.kills }));
  const target = await page.evaluate(() => {
    const m = HL.mons.find(m => m.state !== 'dead' && m.type === 'ไก่ฟ้า') || HL.mons.find(m => m.state !== 'dead');
    if (!m) return null;
    HL.player.x = m.x - 20; HL.player.y = m.y; HL.player.dir = 'E'; m.state = 'idle'; m.wx = m.x; m.wy = m.y;
    window.__t = m; return { type: m.type, hp: m.hp };
  });
  rec('มีมอนสเตอร์ในโซนเริ่มต้น', !!target, JSON.stringify(target));
  let killed = false;
  for (let i = 0; i < 60 && !killed; i++) {
    await page.evaluate(() => { const m = window.__t; if (m.state !== 'dead') { HL.player.x = m.x - 20; HL.player.y = m.y; HL.player.dir = 'E'; } });
    await page.locator('#atk').dispatchEvent('pointerdown');
    await page.waitForTimeout(80);
    await page.locator('#atk').dispatchEvent('pointerup');
    await page.waitForTimeout(450);
    killed = await page.evaluate(() => window.__t.state === 'dead');
  }
  const after = await page.evaluate(() => ({ lv: HL.PS.lv, exp: HL.PS.exp, job: HL.PS.job, jexp: HL.PS.jexp, kills: HL.PS.kills }));
  rec('ปุ่มโจมตีฆ่ามอนสเตอร์ได้', killed, target && target.type);
  rec('ได้ EXP และ Job EXP เมื่อฆ่า', after.kills > before.kills && (after.exp > before.exp || after.lv > before.lv) && (after.jexp > before.jexp || after.job > before.job), JSON.stringify({ before, after }));

  // รูปหน้าเป้าหมาย (V2-R9): รูปครบ 14 ตัว และช่องเป้าหมายวาดรูปจริง
  const arts = await page.evaluate(() => Promise.all(Object.keys(HL.CFG.monsters).map(ty => new Promise(res => { const im = HL.monArt(ty); if (!im) return res([ty, 0]); if (im.complete) return res([ty, im.naturalWidth]); im.onload = () => res([ty, im.naturalWidth]); im.onerror = () => res([ty, -1]); }))));
  rec('รูปหน้าเป้าหมายมอนสเตอร์ครบ 14 ตัว', arts.length === 14 && arts.every(a => a[1] === 112), arts.filter(a => a[1] !== 112).map(a => a[0]).join(',') || '14/14');
  const live = await page.evaluate(() => { const m = HL.mons.find(m => m.state !== 'dead' && m.type === 'หมูป่า') || HL.mons.find(m => m.state !== 'dead'); m.hp = 9999; m.state = 'idle'; HL.player.x = m.x - 20; HL.player.y = m.y; HL.player.dir = 'E'; window.__p = m; return m.type; });
  await page.locator('#atk').dispatchEvent('pointerdown'); await page.waitForTimeout(80); await page.locator('#atk').dispatchEvent('pointerup');
  await page.waitForTimeout(500);
  const tgtPix = await page.evaluate(ty => {
    const c = document.getElementById('tgtc'), a = c.getContext('2d').getImageData(0, 0, 112, 112).data;
    const t = document.createElement('canvas'); t.width = t.height = 112; const k = t.getContext('2d'); k.drawImage(HL.monArt(ty), 0, 0, 112, 112); const b = k.getImageData(0, 0, 112, 112).data;
    let diff = 0; for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return { shown: getComputedStyle(document.getElementById('tgt')).display, name: document.getElementById('tgtn').textContent, avgDiff: +(diff / (112 * 112 * 3)).toFixed(2) };
  }, live);
  rec('ช่องเป้าหมายแสดงรูปใหม่ของมอนสเตอร์ที่กำลังตี', tgtPix.shown === 'flex' && tgtPix.name === live && tgtPix.avgDiff < 2, JSON.stringify(tgtPix));
  await page.screenshot({ path: 'tools/last-target.png' });
  await page.evaluate(() => { const m = window.__p; m.hp = m.c.hp; m.state = 'return'; const s = HL.ZONES.village.start; HL.player.x = s[0]; HL.player.y = s[1]; HL.PS.hp = HL.PS.maxHp; });

  // มอนสเตอร์เกิดใหม่
  const resp = await page.evaluate(() => window.__t.c.respawn);
  await page.waitForTimeout(resp * 1000 + 800);
  rec('มอนสเตอร์เกิดใหม่ตามเวลา', await page.evaluate(() => window.__t.state !== 'dead'), resp + ' วินาที');

  // สกิล: ล็อกก่อน แล้วตั้ง Job 30 ผ่านปุ่มทดสอบ และใช้สกิลทั้ง 11 ท่าที่ตั้งไว้
  await page.evaluate(() => { HL.PS.job = 1; for (const k in HL.PS.cd) HL.PS.cd[k] = 0; });
  const locked = await page.evaluate(() => HL.useSkill(11));
  rec('สกิลขั้นสูงล็อกเมื่อ Job ต่ำ', locked === 'locked', 'useSkill(11)=' + locked);
  await page.click('#gear'); await page.click('#tm'); await page.click('#gear').catch(() => {});
  const job = await page.evaluate(() => HL.PS.job);
  rec('ปุ่มทดสอบตั้ง Job 30', job >= 30, 'job=' + job);
  const n = await page.evaluate(() => HL.CFG.skills.length);
  const skillRes = [];
  for (let i = 1; i <= n; i++) {
    const r = await page.evaluate(i => {
      const m = HL.mons.find(m => m.state !== 'dead') || HL.mons[0];
      if (m && m.state === 'dead') { m.state = 'idle'; m.x = m.hx; m.y = m.hy; }
      const sk = HL.CFG.skills[i - 1], gap = sk.shape === 'pillar' ? sk.dist : 30; // วางเป้าตามระยะออกแบบของท่า
      if (m) { HL.player.x = m.x - gap; HL.player.y = m.y + 14; HL.player.dir = 'E'; m.hp = m.c.hp; window.__t = m; }
      for (const k in HL.PS.cd) HL.PS.cd[k] = 0; HL.PS.cast = null; HL.PS.dead = false; HL.PS.hp = HL.PS.maxHp;
      return { r: HL.useSkill(i), name: HL.CFG.skills[i - 1].name, shape: HL.CFG.skills[i - 1].shape, hp0: m ? m.hp : null };
    }, i);
    await page.waitForTimeout(900);
    const hp1 = await page.evaluate(() => window.__t ? (window.__t.state === 'dead' ? 0 : window.__t.hp) : null);
    const cd = await page.evaluate(i => HL.PS.cd[i], i);
    const noDmg = ['move', 'guard', 'buff'].includes(r.shape);
    skillRes.push({ i, name: r.name, r: r.r, dmg: r.hp0 != null ? r.hp0 - hp1 : null, cd: Math.round(cd * 10) / 10, ok: r.r === 'ok' && cd > 0 && (noDmg || r.hp0 - hp1 > 0) });
  }
  skillRes.forEach(s => rec('สกิล ' + s.i + ' ' + s.name, s.ok, 'ผล=' + s.r + ' ดาเมจ=' + s.dmg + ' คูลดาวน์เหลือ=' + s.cd));

  // ย้ายโซนผ่านปุ่มทดสอบ
  await page.click('#gear'); await page.click('#wp');
  await page.waitForTimeout(500);
  rec('ไปทุ่งมอนสเตอร์ได้', (await pos()).zone === 'field');

  await page.screenshot({ path: process.env.SHOT || 'tools/last-run.png' });
  rec('ไม่มี JavaScript error ระหว่างทดสอบ', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close(); srv.close();
  const fail = results.filter(r => !r.pass).length;
  console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน');
  fs.writeFileSync(process.env.OUT || 'tools/last-run.json', JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
