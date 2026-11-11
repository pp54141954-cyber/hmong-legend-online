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
  // เสิร์ฟไฟล์เกม + ภาพแผนที่แยกไฟล์ (maps/*.webp) จากโฟลเดอร์เดียวกัน
  const srv = http.createServer((q, r) => {
    const m = /^\/(maps|sprites)\/([a-z0-9_]+\.webp)$/.exec(q.url) || /^\/(icons)\/([a-z0-9_]+\.png)$/.exec(q.url);
    if (m) { const f = path.join(path.dirname(file), m[1], m[2]); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', m[2].endsWith('.png') ? 'image/png' : 'image/webp'); return fs.createReadStream(f).pipe(r); }
    r.setHeader('content-type', 'text/html; charset=utf-8'); fs.createReadStream(file).pipe(r);
  }).listen(0);
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
  rec('เริ่มเกมที่หมู่บ้านแผนที่ใหม่ (village2)', start.zone === 'village2', JSON.stringify(start));
  // ทดสอบเดิม (เดิน ต่อสู้ สกิล) ใช้หมู่บ้านเดิมที่มีมอนสเตอร์อยู่ใกล้
  await page.evaluate(() => { const s = HL.ZONES.village.start; HL.enterZone('village', s[0], s[1]); });
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
  const arts = await page.evaluate(() => Promise.all(Object.keys(HL.CFG.monsters).filter(t => !HL.CFG.monsters[t].boss).map(ty => new Promise(res => { const im = HL.monArt(ty); if (!im) return res([ty, 0]); if (im.complete) return res([ty, im.naturalWidth]); im.onload = () => res([ty, im.naturalWidth]); im.onerror = () => res([ty, -1]); }))));
  rec('รูปหน้าเป้าหมายมอนสเตอร์ทั่วไปครบ 14 ตัว', arts.length === 14 && arts.every(a => a[1] === 112), arts.filter(a => a[1] !== 112).map(a => a[0]).join(',') || '14/14');
  const live = await page.evaluate(() => { const m = HL.mons.find(m => m.state !== 'dead' && m.type === 'หมูป่า') || HL.mons.find(m => m.state !== 'dead'); m.hp = 9999; m.state = 'idle'; HL.player.x = m.x - 20; HL.player.y = m.y; HL.player.dir = 'E'; window.__p = m; return m.type; });
  await page.locator('#atk').dispatchEvent('pointerdown'); await page.waitForTimeout(80); await page.locator('#atk').dispatchEvent('pointerup');
  await page.waitForTimeout(500);
  const tgtPix = await page.evaluate(ty => {
    const c = document.getElementById('tgtc'), a = c.getContext('2d').getImageData(0, 0, 112, 112).data;
    const t = document.createElement('canvas'); t.width = t.height = 112; const k = t.getContext('2d'); k.drawImage(HL.monArt(ty), 0, 0, 112, 112); const b = k.getImageData(0, 0, 112, 112).data;
    let diff = 0; for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return { shown: getComputedStyle(document.getElementById('tgt')).display, name: document.getElementById('tgtn').textContent, avgDiff: +(diff / (112 * 112 * 3)).toFixed(2) };
  }, live);
  rec('การ์ดเป้าหมายมุมขวาบนไม่แสดงแล้ว (เจ้าของสั่งเอาออก V2-R27)', tgtPix.shown === 'none', tgtPix.shown);
  await page.screenshot({ path: 'tools/last-target.png' });
  await page.evaluate(() => { const m = window.__p; m.hp = m.c.hp; m.state = 'return'; const s = HL.ZONES.village.start; HL.player.x = s[0]; HL.player.y = s[1]; HL.PS.hp = HL.PS.maxHp; });

  // ภาพมอนสเตอร์ในฉาก (V2-R10): ภาพเดิน/ท่าของทั้ง 14 ชนิดโหลดได้
  const spr = await page.evaluate(() => Promise.all(Object.keys(HL.CFG.monsters).filter(t => !HL.CFG.monsters[t].boss).map(ty => { const S = HL.monSpr(ty); if (!S) return [ty, 'none'];
    const w = im => !im ? Promise.resolve(-1) : im.complete ? Promise.resolve(im.naturalWidth) : new Promise(r => { im.onload = () => r(im.naturalWidth); im.onerror = () => r(0); });
    return Promise.all([w(S.walk), w(S.act)]).then(([a, b]) => [ty, a, b]); })));
  const bad = spr.filter(x => x[1] === 'none' || x[1] === 0 || x[2] === 0 || (x[1] === -1 && x[2] === -1));
  rec('ภาพมอนสเตอร์ทั่วไปในฉากโหลดได้ครบ 14 ชนิด (เดิน 13 + ท่า 13)', bad.length === 0 && spr.filter(x => x[1] > 0).length === 13 && spr.filter(x => x[2] > 0).length === 13, bad.map(x => x[0]).join(',') || 'กระทิงผีมีเฉพาะท่า');

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
      if (m) { HL.player.x = m.x - gap; HL.player.y = m.y + 14; HL.player.dir = 'E'; m.hp = m.c.hp; m.state = 'idle'; m.t = 99; m.wx = m.x; m.wy = m.y; m.c = Object.assign({}, m.c, { aggro: 0, speed: 0 }); window.__t = m; } // ฉาก: เป้านิ่ง ไม่ไล่ (V2-R21 มอนสเตอร์ HP สูงขึ้น ตัวเดิมรอดจากท่าก่อนแล้ววิ่งไล่)
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

  // ===== 6 โซนแผนที่ภาพ (V2-R15): ตรวจทุกโซนแบบเดียวกัน =====
  await page.evaluate(() => { HL.PS.dead = false; HL.PS.cast = null; HL.PS.hp = HL.PS.maxHp; });
  const PZ = await page.evaluate(() => Object.keys(HL.ZONES).filter(z => HL.ZONES[z].painted));
  rec('มีโซนแผนที่ภาพ 6 โซน', PZ.length === 6, PZ.join(','));
  for (const zid of PZ) {
    await page.evaluate(z => { const s = HL.ZONES[z].start; HL.enterZone(z, s[0], s[1]); }, zid);
    const r = await page.evaluate(() => new Promise(res => {
      const im = HL.mapImg(HL.Z.D.painted); const go = () => {
        const T = HL.T, D = HL.Z.D, sx = Math.floor(D.start[0] / T), sy = Math.floor(D.start[1] / T), seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
        while (q.length) { const [x, y] = q.shift(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + a) + ',' + (y + b); if (!seen.has(k) && !HL.tileBlocked(x + a, y + b)) { seen.add(k); q.push([x + a, y + b]); } } }
        const exits = D.exits.map(e => { let ok = false; for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (seen.has(x + ',' + y)) ok = true; return ok; });
        // จุดมาถึงในโซนปลายทางต้องเดินได้ และไม่ใช่ช่องทางออก
        const arr = D.exits.map(e => { const Z2 = HL.getZone(e.to), tx = Math.floor(e.tx), ty = Math.floor(e.ty); return !HL.TYPES || (Z2.g[ty][tx] !== HL.TYPES.EX && ![HL.TYPES.WA, HL.TYPES.CF, HL.TYPES.BD, HL.TYPES.CR].includes(Z2.g[ty][tx]) && !Z2.blocked.has(tx + ',' + ty)); });
        const monsIn = HL.mons.filter(m => seen.has(Math.floor(m.x / T) + ',' + Math.floor(m.y / T))).length;
        res({ img: im ? im.naturalWidth : 0, reach: seen.size, exits, arr, mons: HL.mons.length, monsIn });
      }; if (!im || im.complete) go(); else { im.onload = go; im.onerror = go; } }));
    rec('โซน ' + zid + ': ภาพโหลด เดินถึงทางออกครบ จุดมาถึงปลายทางเดินได้', r.img === 1536 && r.exits.every(Boolean) && r.arr.every(Boolean), 'ถึงได้ ' + r.reach + ' ช่อง ทางออก ' + JSON.stringify(r.exits) + ' จุดมาถึง ' + JSON.stringify(r.arr));
    rec('โซน ' + zid + ': มอนสเตอร์เกิดบนพื้นที่เดินถึงได้ทุกตัว', r.monsIn === r.mons, r.monsIn + '/' + r.mons);
    if (zid === 'village2') await page.screenshot({ path: 'tools/last-village2.png' });
    if (zid === 'bamboo') await page.screenshot({ path: 'tools/last-field2.png' });
  }
  // เดินข้ามโซนจริงด้วยคีย์บอร์ด: หมู่บ้าน → (ลงสะพาน) → ทุ่งน้ำตก
  await page.evaluate(() => { const s = HL.ZONES.village2.start; HL.enterZone('village2', s[0], s[1]); const e = HL.ZONES.village2.exits[0]; HL.player.x = (e.x + 1.5) * HL.T; HL.player.y = (e.y - 1.5) * HL.T; HL.freeMode = false; });
  await page.waitForTimeout(1100);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(700); await page.keyboard.up('ArrowDown');
  rec('เดินลงสะพานหมู่บ้านแล้วไปทุ่งน้ำตก', (await pos()).zone === 'field2', (await pos()).zone);

  // ===== V2-R16 กลางวัน/กลางคืน/บอส (ออฟไลน์) =====
  const setT = t => page.evaluate(t => { HL.setClock(t - Date.now() / 1000); HL.update(0.01); }, t);
  const C = await page.evaluate(() => HL.CFG.time);
  const T_DAY = C.cycleSec * 2.25, T_NIGHT = C.cycleSec * 2.75, T_BLOOD = C.cycleSec * 3.67;
  const px = () => page.evaluate(() => { const c = document.getElementById('c'), k = c.getContext('2d'), d = k.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 3), 1, 1).data; return [d[0], d[1], d[2]]; });
  await page.evaluate(() => { const s = HL.ZONES.rainforest.start; HL.enterZone('rainforest', s[0], s[1]); });
  await setT(T_DAY); await page.waitForTimeout(250); const cDay = await px();
  const bossDay = await page.evaluate(() => HL.mons.filter(m => m.c.boss && m.state !== 'dead').map(m => m.type));
  await setT(T_BLOOD); await page.waitForTimeout(250); const cBlood = await px();
  const wt = await page.evaluate(() => ({ n: HL.WT.name, st: document.getElementById('st').textContent }));
  const bossBlood = await page.evaluate(() => HL.mons.filter(m => m.c.boss && m.state !== 'dead').map(m => m.type));
  rec('กลางวัน: ป่าดิบชื้นมีบอสประจำพื้นที่ตัวเดียว', bossDay.length === 1 && bossDay[0] === 'เทพหมาป่าภูเขา', bossDay.join(','));
  rec('คืนพระจันทร์สีเลือด: บอสคืนเลือดปรากฏ + HUD แสดง 🩸', bossBlood.includes('วิญญาณหมาป่าศักดิ์สิทธิ์') && wt.st.startsWith('🩸'), wt.n + ' · ' + bossBlood.join(','));
  rec('คืนพระจันทร์สีเลือด: จอมีโทนแดงเข้มกว่ากลางวัน', cBlood[0] - cBlood[2] > cDay[0] - cDay[2] && cBlood[1] < cDay[1], JSON.stringify({ cDay, cBlood }));
  await page.screenshot({ path: 'tools/last-bloodmoon.png' });
  await page.evaluate(() => { const s = HL.ZONES.peak.start; HL.enterZone('peak', s[0], s[1]); });
  await setT(C.worldEvery * 2 + 30);
  const peak = await page.evaluate(() => { const w = HL.mons.find(m => m.type === 'มังกรแห่งหุบเขาหมอก'); HL.player.x = w.x; HL.player.y = w.y + 120; return { on: w.state !== 'dead', img: !!HL.monSpr(w.type), port: !!HL.monArt(w.type) }; });
  await page.waitForTimeout(300);
  rec('World Boss มังกรแห่งหุบเขาหมอกปรากฏที่ยอดเขาในช่วงเวลา มีภาพและรูปเป้าหมาย', peak.on && peak.img && peak.port, JSON.stringify(peak));
  await page.screenshot({ path: 'tools/last-worldboss.png' });
  const bossSpr = await page.evaluate(() => Promise.all(Object.keys(HL.CFG.monsters).filter(t => HL.CFG.monsters[t].boss).map(ty => { const S = HL.monSpr(ty); if (!S) return [ty, 0, 0];
    const w = im => !im ? Promise.resolve(0) : im.complete ? Promise.resolve(im.naturalWidth) : new Promise(r => { im.onload = () => r(im.naturalWidth); im.onerror = () => r(0); });
    return Promise.all([w(S.walk), w(S.act)]).then(([a, b]) => [ty, a, b]); })));
  rec('ภาพบอสในฉาก: เดิน 6/6 ตัว, ท่าโจมตี 6/6 ตัว', bossSpr.filter(b => b[1] > 0).length === 6 && bossSpr.filter(b => b[2] > 0).length === 6, JSON.stringify(bossSpr.map(b => b[0].slice(0, 6) + ':' + (b[1] > 0 ? 'W' : '-') + (b[2] > 0 ? 'A' : '-'))));
  await setT(T_DAY);
  await page.evaluate(() => { HL.setClock(0); HL.PS.hp = HL.PS.maxHp; HL.PS.dead = false; const s = HL.ZONES.village.start; HL.enterZone('village', s[0], s[1]); });

  // ===== V2-R23: จอย 8 ทิศ, ออโต, มอนสเตอร์เล็กลง/มากขึ้น, ช่องลัด =====
  await page.evaluate(() => { HL.AUTO.on = false; HL.PS.dead = false; HL.PS.cast = null; HL.PS.hp = HL.PS.maxHp; const s = HL.ZONES.village2.start; HL.enterZone('village2', s[0], s[1]); });
  await page.waitForTimeout(300);
  { const p0 = await pos(); await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowDown');
    const p1 = await pos(); rec('เดินทแยง (ขวา+ลง) ได้ทั้งสองแกน', p1.x - p0.x > 10 && p1.y - p0.y > 10, Math.round(p1.x - p0.x) + ',' + Math.round(p1.y - p0.y)); }
  { const box = await page.locator('#c').boundingBox(); const hx = box.x + Math.max(86, box.width * .17), hy = box.y + box.height - Math.max(130, box.height * .16);
    await page.evaluate(() => { const s = HL.ZONES.village2.start; HL.player.x = s[0]; HL.player.y = s[1]; });
    const p0 = await pos(); await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(hx + 40, hy - 40, { steps: 4 }); await page.waitForTimeout(500);
    const j = await page.evaluate(() => HL.inputDir()); await page.mouse.up(); const p1 = await pos();
    rec('จอยฐานมุมซ้ายล่าง: ลากเฉียงขึ้นขวา → เดินทแยงแบบอนาล็อก', j[0] > .5 && j[1] < -.5 && p1.x > p0.x + 5 && p1.y < p0.y - 5, 'จอย=' + j.map(v => v.toFixed(2)).join(',') + ' ระยะ ' + Math.round(p1.x - p0.x) + ',' + Math.round(p1.y - p0.y)); }
  { const n = await page.evaluate(() => { const s = HL.ZONES.field2.start; HL.enterZone('field2', s[0], s[1]); return HL.mons.filter(m => !m.c.boss).length; });
    const want = await page.evaluate(() => HL.ZONES.field2.spawns.reduce((a, s) => a + s.count, 0) * HL.CFG.spawnMul);
    rec('จำนวนมอนสเตอร์ในทุ่งน้ำตกเพิ่มเป็น ×' + 2 + ' (' + want + ' ตัว)', n === want && want >= 28, n + ' ตัว'); }
  rec('ภาพมอนสเตอร์เล็กลง (×' + (await page.evaluate(() => HL.MON_SCALE)) + ')', await page.evaluate(() => HL.MON_SCALE < 1));
  { await page.evaluate(() => { HL.PS.lv = 10; HL.recalc(); HL.PS.hp = HL.PS.maxHp; HL.PS.kills = 0; });
    const k0 = await page.evaluate(() => ({ kills: HL.PS.kills, exp: HL.PS.exp, lv: HL.PS.lv }));
    await page.click('#pg');
    const on = await page.getAttribute('#pg', 'aria-pressed');
    let k1 = k0; for (let i = 0; i < 40 && k1.kills < 2; i++) { await page.waitForTimeout(500); k1 = await page.evaluate(() => ({ kills: HL.PS.kills, exp: HL.PS.exp, lv: HL.PS.lv, dead: HL.PS.dead })); }
    rec('ปุ่ม AUTO: เดินหาและฆ่ามอนสเตอร์เองได้ ≥2 ตัวภายใน 20 วิ', on === 'true' && k1.kills >= 2, 'ฆ่า ' + k1.kills + ' ตัว ' + await page.evaluate(() => JSON.stringify({ z: HL.Z && HL.Z.id, p: [HL.player.x | 0, HL.player.y | 0], hp: HL.PS.hp | 0, dead: HL.PS.dead, free: HL.freeMode, on: HL.AUTO.on, tgt: !!HL.AUTO.tgt, cast: !!HL.PS.cast, job: HL.PS.job })));
    await page.screenshot({ path: 'tools/last-auto.png' });
    await page.click('#pg'); rec('กด AUTO อีกครั้ง = ปิด', (await page.getAttribute('#pg', 'aria-pressed')) === 'false'); }
  { const before = await page.evaluate(() => HL.SLOTS.slice());
    await page.evaluate(() => HL.setSlot(0, 8)); const slots = await page.evaluate(() => HL.SLOTS.slice());
    const btn = await page.evaluate(() => document.querySelector('#skills .sk').getAttribute('aria-label'));
    rec('ช่องลัด: จัดสกิล 8 ลงช่อง 1 → ปุ่มแรกเปลี่ยนตาม และไม่ซ้ำช่อง', slots[0] === 8 && new Set(slots).size === 6 && btn === 'ดาบทลายขุนเขา', JSON.stringify(slots));
    await page.evaluate(b => b.forEach((v, k) => HL.setSlot(k, v)), before); }
  { const r = await page.evaluate(() => { const s = HL.ZONES.village2.start; HL.enterZone('village2', s[0], s[1]);
      let open = 0, tot = 0; for (let y = 13; y <= 18; y++) for (let x = 20; x <= 28; x++) { tot++; if (!HL.tileBlocked(x, y)) open++ } return [open, tot] });
    rec('ลานหินกลางหมู่บ้านเดินได้ทั้งลาน (ช่อง 20–28 × 13–18)', r[0] === r[1], r[0] + '/' + r[1]); }
  { await page.evaluate(() => { HL.PS.job = 30; });
    await page.click('#skb'); await page.waitForSelector('#skp:not([hidden]) .skgrid');
    const g = await page.evaluate(() => ({ ph: [...document.querySelectorAll('#skp .ph b')].map(e => e.textContent), jobs: [...document.querySelectorAll('#skp .lbl.job')].map(e => +e.textContent), nodes: document.querySelectorAll('#skp .nd').length, hot: document.querySelectorAll('#skp .hs').length }));
    rec('หน้าสกิล: ตาราง 3 สาย × แถว Job + ช่องลัด 6 ช่อง', g.ph.length === 3 && g.jobs.length >= 6 && g.jobs.every((v, i) => !i || v > g.jobs[i - 1]) && g.hot === 6 && g.nodes >= 20, JSON.stringify(g));
    const before = await page.evaluate(() => HL.SLOTS.slice());
    await page.click('#skp .hs[data-slot="5"]');
    const hint = await page.textContent('#skp .hott');
    await page.click('#skp .nd.act[data-skill="ดาบทลายขุนเขา"]');
    const after = await page.evaluate(() => ({ s: HL.SLOTS.slice(), lbl: document.querySelector('#skp .hs[data-slot="5"]').getAttribute('aria-label'), btn: [...document.querySelectorAll('#skills .sk')][5].getAttribute('aria-label') }));
    rec('หน้าสกิล: แตะช่อง 6 แล้วแตะสกิล → ใส่ช่องลัดและปุ่มบนจอเปลี่ยนตาม', hint.includes('ช่อง 6') && after.s[5] === 8 && after.lbl === 'ช่องลัด 6 ดาบทลายขุนเขา' && after.btn === 'ดาบทลายขุนเขา', JSON.stringify(after));
    await page.screenshot({ path: 'tools/last-skills.png' });
    const saved = await page.evaluate(() => localStorage.getItem('hl_slots'));
    rec('ช่องลัดบันทึกในเครื่อง (localStorage)', saved === JSON.stringify(after.s), saved);
    await page.evaluate(b => b.forEach((v, k) => HL.setSlot(k, v)), before);
    await page.click('#skp h3 button:last-child'); rec('ปิดหน้าสกิลได้', await page.evaluate(() => document.getElementById('skp').hidden)); }
  // ===== V2-R24: ป้ายเลเวล, หน้าต่างสถานะ, หน้าต่างอัปเลเวล, สกิลออโต, ทางเดินบนน้ำ =====
  { const r = await page.evaluate(() => { const s = HL.ZONES.field2.start; HL.enterZone('field2', s[0], s[1]);
      const ww = [[32, 18, 42, 19], [5, 29, 29, 30], [13, 28, 18, 30]]; let bad = [];
      for (const [x0, y0, x1, y1] of ww) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (HL.tileBlocked(x, y)) bad.push(x + ',' + y);
      const onW = HL.mons.filter(m => ww.some(([x0, y0, x1, y1]) => m.hx / 32 >= x0 && m.hx / 32 < x1 + 1 && m.hy / 32 >= y0 && m.hy / 32 < y1 + 1)).length;
      const path = HL.bfsPath(Math.floor(s[0] / 32), Math.floor(s[1] / 32), 16, 29, 4000);
      return { bad, onW, path: !!path } });
    rec('ทางเดินไม้บนน้ำ (ทุ่งน้ำตก) เดินได้ทุกช่อง และเดินไปถึงจากจุดเริ่ม', r.bad.length === 0 && r.path, JSON.stringify(r));
    rec('มีมอนสเตอร์เกิดบนทางเดินไม้บนน้ำ', r.onW >= 3, r.onW + ' ตัว'); }
  { const r = await page.evaluate(() => [HL.monLvCol(0), HL.monLvCol(4), HL.monLvCol(8), HL.monLvCol(-8), HL.mons.every(m => m.c.lv > 0)]);
    rec('ป้ายเลเวลมอนสเตอร์ทุกตัว + สีตามความยาก (ขาว/เหลือง/แดง/เทา)', r[0] === '#ffffff' && r[1] === '#ffcf5a' && r[2] === '#ff6b6b' && r[3] === '#a8b0b4' && r[4], JSON.stringify(r));
    await page.screenshot({ path: 'tools/last-walkway.png' }); }
  { await page.evaluate(() => { HL.PS.lv = 5; HL.recalc(); HL.PS.hp = HL.PS.maxHp; });
    await page.click('#lvb'); await page.waitForSelector('#stp:not([hidden]) .grid');
    const t = await page.evaluate(() => ({ cells: [...document.querySelectorAll('#stp .cell span')].map(e => e.textContent), lv: document.querySelector('#stp .hd .lv').textContent, atk: [...document.querySelectorAll('#stp .cell')].find(c => c.textContent.startsWith('ATK')).querySelector('b').firstChild.textContent, want: HL.PS.atk }));
    rec('หน้าต่างสถานะ: แตะวงเลเวล → แสดง HP ATK DEF คริ ความเร็ว อุปกรณ์', t.cells.length >= 8 && t.lv === 'Lv5' && +t.atk === t.want && await page.isVisible('#stp .eqr'), JSON.stringify(t));
    await page.screenshot({ path: 'tools/last-status.png' });
    await page.click('#stp .x'); rec('ปิดหน้าต่างสถานะได้ (ไม่บังจอ)', await page.evaluate(() => document.getElementById('stp').hidden) && !(await page.isVisible('#stp'))); }
  { const r = await page.evaluate(() => { HL.lvEl.hidden = true; const l0 = HL.PS.lv; HL.gain(HL.CFG.expCurve(HL.PS.lv) + 1, 0);
      return { l0, l1: HL.PS.lv, shown: !HL.lvEl.hidden, txt: HL.lvEl.textContent } });
    rec('หน้าต่างอัปเลเวลขึ้นเมื่อเลเวลอัป (บอก HP/ATK ที่เพิ่ม)', r.l1 === r.l0 + 1 && r.shown && r.txt.includes('Lv ' + r.l1) && r.txt.includes('ATK +'), r.txt);
    await page.screenshot({ path: 'tools/last-lvup.png' });
    await page.click('#lvup'); rec('แตะหน้าต่างอัปเลเวลเพื่อปิด', await page.evaluate(() => HL.lvEl.hidden));
    const j = await page.evaluate(() => { const j0 = HL.PS.job; HL.gain(0, HL.CFG.jobCurve(HL.PS.job) + 1); return { j0, j1: HL.PS.job, txt: HL.lvEl.textContent } });
    rec('Job เลเวลอัป → หน้าต่างบอกแต้มสกิล +1', j.j1 === j.j0 + 1 && j.txt.includes('แต้มสกิล +1'), j.txt);
    await page.waitForTimeout(3000); rec('หน้าต่างอัปเลเวลปิดเองภายใน 3 วิ', await page.evaluate(() => HL.lvEl.hidden)); }
  { await page.evaluate(() => { HL.PS.job = 30; HL.PS.cd = {}; HL.PS.cast = null; const s = HL.ZONES.field2.start; HL.enterZone('field2', s[0], s[1]);
      const m = HL.mons.find(m => !m.c.boss); Object.assign(m.c, {}); m.x = HL.player.x + 30; m.y = HL.player.y + 10; m.hx = m.x; m.hy = m.y; m.state = 'idle'; });
    await page.click('#ask'); await page.waitForSelector('#aop:not([hidden]) .aks');
    rec('ปุ่ม ⚙ เปิดหน้าตั้งค่า AUTO: เป้าหมายในแมพ + สกิล 6 ช่อง + ยา + ปุ่มเริ่ม', await page.evaluate(() => document.querySelectorAll('#aop .tg').length >= 3 && document.querySelectorAll('#aop .ak').length === 6 && document.querySelectorAll('#aop .pots button').length === 5 && !!document.querySelector('#aop .go')));
    rec('สกิลออโตตอนเล่นเอง: เริ่มต้น = ปิด', (await page.getAttribute('#ao-man', 'aria-checked')) === 'false');
    await page.click('#ao-man');
    let used = []; for (let i = 0; i < 20 && !used.length; i++) { await page.waitForTimeout(150); used = await page.evaluate(() => Object.keys(HL.PS.cd).filter(k => k !== 'b' && HL.PS.cd[k] > 0)); }
    rec('สกิลออโต: มอนสเตอร์อยู่ในระยะ → ใช้สกิลในช่องลัดเอง', (await page.getAttribute('#ao-man', 'aria-checked')) === 'true' && used.length > 0, 'สกิลที่ใช้ ' + used.join(','));
    rec('สกิลออโต: จำค่าไว้ในเครื่อง', await page.evaluate(() => localStorage.getItem('hl_autosk') === '1'));
    // ปิดทุกช่องในหน้าตั้งค่า → ไม่ใช้สกิล
    await page.click('#ao-man'); await page.click('#ao-man');
    for (const k of [0, 1, 2, 3, 4, 5]) { const on = await page.evaluate(k => document.querySelector('#aop .ak[data-k="' + k + '"]').classList.contains('on'), k); const dis = await page.evaluate(k => document.querySelector('#aop .ak[data-k="' + k + '"]').disabled, k); if (on && !dis) await page.click('#aop .ak[data-k="' + k + '"]'); }
    await page.evaluate(() => { HL.PS.cd = {}; HL.PS.cast = null; });
    await page.waitForTimeout(1200);
    const none = await page.evaluate(() => Object.keys(HL.PS.cd).filter(k => k !== 'b' && HL.PS.cd[k] > 0));
    rec('ตั้งค่า: ปิดสกิลทุกช่อง → สกิลออโตไม่ใช้สกิล', none.length === 0 && await page.evaluate(() => [...document.querySelectorAll('#aop .ak:not([disabled])')].every(b => !b.classList.contains('on'))), none.join(','));
    for (const k of [0, 1, 2, 3]) await page.click('#aop .ak[data-k="' + k + '"]');
    await page.click('#ao-man'); rec('ปิดสกิลออโตได้', (await page.getAttribute('#ao-man', 'aria-checked')) === 'false');
    // เลือกเป้าหมาย: ตัดทุกชนิดยกเว้นหนึ่ง → AUTO ล่าเฉพาะชนิดนั้น
    const types = await page.evaluate(() => [...document.querySelectorAll('#aop .tg')].map(b => b.dataset.t));
    for (const t of types.slice(1)) await page.click('#aop .tg[data-t="' + t + '"]');
    rec('แตะการ์ดเป้าหมาย → ขีดฆ่า (ไม่ล่า)', await page.evaluate(n => document.querySelectorAll('#aop .tg.off').length === n, types.length - 1));
    await page.evaluate(t => { HL.PS.dead = false; HL.PS.hp = HL.PS.maxHp; HL.PS.cast = null; for (const m of HL.mons) if (m.type === t && m.state === 'dead') { m.state = 'idle'; m.hp = m.c.hp; m.x = m.hx; m.y = m.hy } }, types[0]); // ฉาก: ให้มีเป้าที่เลือกยังมีชีวิต
    await page.click('#aop .go');
    rec('ปุ่ม "เริ่ม AUTO" ในหน้าตั้งค่า → AUTO เปิด และปุ่มเปลี่ยนเป็น "หยุด AUTO"', (await page.getAttribute('#pg', 'aria-pressed')) === 'true' && (await page.textContent('#aop .go')) === 'หยุด AUTO');
    await page.screenshot({ path: 'tools/last-autocfg.png' });
    await page.click('#aop .x');
    let tg = null; for (let i = 0; i < 20 && !tg; i++) { await page.waitForTimeout(150); tg = await page.evaluate(() => HL.AUTO.tgt && HL.AUTO.tgt.type); }
    rec('AUTO เลือกเป้าเฉพาะชนิดที่เปิดไว้', tg === types[0], tg + ' (เปิดไว้: ' + types[0] + ') ' + (tg === types[0] ? '' : await page.evaluate(t => JSON.stringify({ on: HL.AUTO.on, dead: HL.PS.dead, cast: !!HL.PS.cast, joy: HL.inputDir(), z: HL.Z.id, p: [Math.floor(HL.player.x / 32), Math.floor(HL.player.y / 32)], tg: HL.AUTO.cfg.tg, rab: HL.mons.filter(m => m.type === t).map(m => [m.state, Math.floor(m.x / 32), Math.floor(m.y / 32), (m.autoSkip || 0) > HL.tNow]) }), types[0])));
    await page.click('#pg'); await page.click('#ask'); for (const t of types.slice(1)) await page.click('#aop .tg[data-t="' + t + '"]'); await page.click('#aop .x');
    rec('ตั้งค่าเป้าหมายกลับครบ', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hl_auto')).tg).length === 0)); }
  { const r = await page.evaluate(async () => { HL.AUTO.on = false; HL.PS.dead = false; HL.PS.cast = null; HL.enterZone('field2', 32.5 * 32, 31.5 * 32); HL.PS.maxHp = HL.PS.hp = 1e6; HL.AUTO.on = true; const y0 = HL.player.y;
      await new Promise(r => setTimeout(r, 2500)); const o = { zone: HL.Z.id, moved: Math.round(y0 - HL.player.y) }; HL.AUTO.on = false; HL.recalc(); HL.PS.hp = HL.PS.maxHp; return o });
    rec('AUTO เริ่มจากยืนบนช่องทางออก → เดินออกมาล่าได้ และไม่หลุดโซน', r.zone === 'field2' && r.moved > 10, JSON.stringify(r));
    await page.evaluate(() => { HL.AUTO.on = false; HL.PS.cast = null; }); }
  // ===== V2-R26: ไอคอนสกิล, คูลดาวน์, ภาพมอนสเตอร์ตายไม่ค้าง, แผนที่โลก + วาร์ป =====
  { const ic = await page.evaluate(async () => { const im = [...document.querySelectorAll('#skills .sk img')]; await Promise.all(im.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r }))); return im.map(i => i.naturalWidth) });
    rec('ปุ่มสกิลมีไอคอนครบ 6 ปุ่ม (โหลดได้)', ic.length === 6 && ic.every(w => w === 64), ic.join(','));
    await page.evaluate(() => { HL.AUTO.on = false; HL.PS.job = 30; HL.PS.cd = {}; HL.PS.cast = null; HL.PS.dead = false; HL.PS.hp = HL.PS.maxHp; const s = HL.ZONES.village2.start; HL.enterZone('village2', s[0], s[1]); }); // รอคูลดาวน์ในเขตปลอดภัย
    const i0 = await page.evaluate(() => HL.SLOTS[0]); await page.evaluate(i => HL.useSkill(i), i0); await page.waitForTimeout(300);
    const cd = await page.evaluate(() => { const b = document.querySelector('#skills .sk'); return { n: b.querySelector('.cdn').textContent, cls: b.className, sweep: b.style.getPropertyValue('--cd') } });
    rec('คูลดาวน์: ตัวเลขนับถอยหลัง + วงมืดบนปุ่ม', /^\d/.test(cd.n) && cd.cls.includes('cd') && parseFloat(cd.sweep) > 0, JSON.stringify(cd));
    await page.waitForFunction(() => !document.querySelector('#skills .sk').classList.contains('cd'), null, { timeout: 20000, polling: 30 });
    const rdy = await page.evaluate(() => document.querySelector('#skills .sk').classList.contains('ready'));
    rec('คูลดาวน์หมด → ปุ่มกะพริบพร้อมใช้ และตัวเลขหาย', rdy && (await page.evaluate(() => document.querySelector('#skills .sk .cdn').textContent)) === ''); }
  { const r = await page.evaluate(() => { const m = { state: 'idle' }, a = { st: m.state, d: m.dieT0 };
      m.state = 'dead'; delete m.dieT0; const fresh = HL.monShown(m); m.dieT0 = HL.tNow; const dying = HL.monShown(m); m.dieT0 = HL.tNow - 2; const old = HL.monShown(m);
      m.state = a.st; m.dieT0 = a.d; return { fresh, dying, old } });
    rec('มอนสเตอร์ตาย: แสดงท่าตายช่วงสั้นแล้วหาย, ตัวที่ตายอยู่แล้วไม่ค้างภาพ', !r.fresh && r.dying && !r.old, JSON.stringify(r)); }
  { await page.click('#wmb'); await page.waitForSelector('#wmp:not([hidden]) .zc');
    const w = await page.evaluate(() => ({ n: document.querySelectorAll('#wmp .zc').length, here: document.querySelector('#wmp .zc.here b').textContent, imgs: document.querySelectorAll('#wmp .zt img').length, lv: [...document.querySelectorAll('#wmp .zl')].map(e => e.textContent) }));
    rec('แผนที่โลก: 7 โซน รูปย่อ + ช่วงเลเวล + บอก "อยู่ที่นี่"', w.n === 7 && w.imgs >= 6 && w.here === await page.evaluate(() => HL.Z.D.name), JSON.stringify(w));
    await page.screenshot({ path: 'tools/last-world.png' });
    await page.click('#wmp .wp[data-z="bamboo"]');
    rec('กดวาร์ป → ไปโซนป่าไผ่ทันที (ออฟไลน์)', await page.evaluate(() => HL.Z.id === 'bamboo' && document.getElementById('wmp').hidden));
    rec('วาร์ปซ้ำเร็วเกิน → รอคูลดาวน์', await page.evaluate(() => HL.warp('peak') === 'cooldown' && HL.Z.id === 'bamboo')); }
  { await page.evaluate(() => { HL.statResetLocal(); HL.PS.lv = 4; HL.recalc(); HL.PS.hp = HL.PS.maxHp; HL.lvEl.hidden = true; });
    await page.waitForTimeout(200);
    rec('มีแต้มเหลือ → จุดแดงบนวงเลเวล', await page.evaluate(() => { document.getElementById('lvb').click(); return document.getElementById('lvb').classList.contains('dot') }));
    await page.waitForSelector('#stp:not([hidden]) .srow');
    const a0 = await page.evaluate(() => HL.PS.atk);
    for (let i = 0; i < 3; i++) await page.click('#stp button[aria-label="เพิ่ม STR"]');
    const r = await page.evaluate(() => ({ atk: HL.PS.atk, st: HL.PS.st, left: document.getElementById('sptsv').textContent, dis: [...document.querySelectorAll('#stp .sup')].every(b => b.disabled), cell: [...document.querySelectorAll('#stp .cell')].find(c => c.textContent.startsWith('ATK')).querySelector('b').firstChild.textContent }));
    rec('หน้าต่างสถานะ: กด + STR 3 ครั้ง → ATK +3 และจอแสดงตาม', r.atk === a0 + 3 && +r.cell === r.atk && r.st.str === 3, JSON.stringify(r));
    for (let i = 0; i < 6; i++) await page.click('#stp button[aria-label="เพิ่ม VIT"]');
    const r2 = await page.evaluate(() => ({ left: document.getElementById('sptsv').textContent, dis: [...document.querySelectorAll('#stp .sup')].every(b => b.disabled), dot: document.getElementById('lvb').classList.contains('dot') }));
    rec('แต้มหมด (Lv 4 = 9 แต้ม) → ปุ่ม + ปิด, จุดแดงหาย', r2.left === 'คงเหลือ 0' && r2.dis && !r2.dot, JSON.stringify(r2));
    await page.screenshot({ path: 'tools/last-statpts.png' });
    await page.click('#strst'); rec('รีเซ็ตแต้มสเตตัส → คืนครบ', await page.evaluate(() => document.getElementById('sptsv').textContent === 'คงเหลือ 9' && HL.PS.atk === HL.CFG.player.baseAtk + 3 * HL.CFG.player.atkPerLv));
    await page.click('#stp button[aria-label="เพิ่ม AGI 5"]');
    rec('ปุ่ม +5 → ลงทีละ 5 แต้ม', await page.evaluate(() => HL.PS.st.agi === 5 && document.getElementById('sptsv').textContent === 'คงเหลือ 4'));
    await page.click('#stp .tabs [data-tab="bag"]');
    rec('แท็บ "กระเป๋า" ในหน้าต่างตัวละคร → เปิดกระเป๋า', await page.evaluate(() => document.getElementById('stp').hidden && !document.getElementById('bag').hidden));
    await page.click('#bag h3 button'); await page.click('#lvb'); await page.waitForSelector('#stp:not([hidden]) .srow');
    await page.click('#stp .tabs [data-tab="sk"]');
    rec('แท็บ "สกิล" → เปิดหน้าสกิล', await page.evaluate(() => document.getElementById('stp').hidden && !document.getElementById('skp').hidden));
    await page.click('#skp h3 button:last-child'); await page.evaluate(() => HL.statResetLocal()); }
  { const r = await page.evaluate(() => { const m = HL.mons.find(m => !m.c.boss); HL.setTarget(m); return null });
    await page.waitForTimeout(300);
    const t = await page.locator('#tgt').boundingBox(), c = await page.locator('#c').boundingBox();
    const jx = c.x + Math.max(86, c.width * .17), jy = c.y + c.height - Math.max(130, c.height * .16);
    rec('การ์ดเป้าหมายไม่แสดงแม้มีเป้า', t === null, JSON.stringify(t)); }
  // ===== V2-R27: อาชีพ + แอดมิน (ออฟไลน์) =====
  { await page.evaluate(() => { HL.AUTO.on = false; HL.PS.dead = false; HL.PS.cast = null; HL.PS.job = 30; const s = HL.ZONES.field2.start; HL.enterZone('field2', s[0], s[1]); });
    await page.click('#skb'); await page.click('#skp h3 .clsb'); await page.waitForSelector('#clp:not([hidden]) .cc');
    const o = await page.evaluate(() => ({ n: document.querySelectorAll('#clp .cc').length, dis: [...document.querySelectorAll('#clp .cc button')].every(b => b.disabled), warn: !!document.querySelector('#clp .warn') }));
    rec('หน้าเลือกอาชีพ: 8 อาชีพ, นอกหมู่บ้านปุ่มเลือกถูกปิด + มีคำเตือน', o.n === 8 && o.dis && o.warn, JSON.stringify(o));
    rec('นอกหมู่บ้านเปลี่ยนอาชีพไม่ได้', await page.evaluate(() => HL.setClassLocal('นักธนู') === 'not-safe' && HL.curCls() === 'นักดาบ'));
    await page.click('#clp .x');
    await page.evaluate(() => { const s = HL.ZONES.village2.start; HL.enterZone('village2', s[0], s[1]); });
    await page.click('#skb'); await page.click('#skp h3 .clsb'); await page.waitForSelector('#clp:not([hidden]) .cc');
    await page.click('#clp button[aria-label="เปลี่ยนเป็น นักธนู"]');
    const c = await page.evaluate(() => ({ cls: HL.curCls(), bar: [...document.querySelectorAll('#skills .sk')].map(b => b.getAttribute('aria-label')), cur: document.querySelector('#clp .cur b').textContent }));
    rec('ในหมู่บ้านเลือก "นักธนู" → ปุ่มสกิลเปลี่ยนเป็นท่าของนักธนู', c.cls === 'นักธนู' && c.cur === 'นักธนู' && c.bar.includes('ศรเจาะจุดอ่อน') && !c.bar.includes('ลงอาคมคมดาบ'), JSON.stringify(c));
    await page.screenshot({ path: 'tools/last-class.png' });
    await page.click('#clp .x'); await page.click('#skb');
    const sp = await page.evaluate(() => ({ t: document.querySelector('#skp h3 span').textContent, ph: [...document.querySelectorAll('#skp .ph b')].map(e => e.textContent) }));
    rec('หน้าสกิลแสดงสายของนักธนู', sp.t.includes('นักธนู') && sp.ph.join(',') === 'แม่นธนู,พรานกับดัก,ศรมนตรา', JSON.stringify(sp));
    await page.click('#skp h3 button:last-child');
    rec('สถานะบนจอบอกอาชีพ', (await page.textContent('#st')).includes('นักธนู'));
    rec('ท่าชั่วคราวของอาชีพใหม่ใช้ได้ (กลไกเดียวกับนักดาบ)', await page.evaluate(() => { HL.PS.cd = {}; HL.PS.cast = null; return HL.useSkill(6) === 'ok' }));
    await page.evaluate(() => HL.setClassLocal('นักดาบ')); }
  { const r = await page.evaluate(() => { const o = []; o.push(HL.adminLocal({ op: 'lv', n: 40 }), HL.PS.lv); o.push(HL.adminLocal({ op: 'job', n: 20 }), HL.PS.job); o.push(HL.adminLocal({ op: 'lv', n: 0 }));
      HL.adminLocal({ op: 'warp', zone: 'mine' }); o.push(HL.Z.id); HL.adminLocal({ op: 'clear' }); o.push(HL.mons.filter(m => !m.c.boss).every(m => m.state === 'dead')); return o });
    rec('แอดมินออฟไลน์: ตั้งเลเวล/Job, ค่าผิดถูกปฏิเสธ, วาร์ป, ล้างมอนสเตอร์', r[1] === 40 && r[3] === 20 && r[4] === 'ค่าไม่ถูกต้อง' && r[5] === 'mine' && r[6], JSON.stringify(r));
    await page.evaluate(() => HL.adminLocal({ op: 'time', mode: 'blood' })); await page.waitForTimeout(1300);
    rec('แอดมินออฟไลน์: เปลี่ยนเวลาเป็นพระจันทร์เลือด', await page.evaluate(() => HL.WT.blood));
    await page.evaluate(() => HL.adminLocal({ op: 'time', mode: 'day' })); await page.waitForTimeout(1300);
    rec('ปุ่มแอดมินไม่แสดงบนเว็บ (ไม่ใช่บัญชีแอดมิน)', !(await page.isVisible('#admb'))); }
  await page.evaluate(() => { HL.AUTO.on = false; HL.PS.dead = false; HL.PS.hp = HL.PS.maxHp; const s = HL.ZONES.village.start; HL.enterZone('village', s[0], s[1]); });

  // ย้ายโซนผ่านปุ่มทดสอบ
  await page.click('#gear'); await page.click('#wp');
  await page.waitForTimeout(500);
  rec('ไปทุ่งมอนสเตอร์ได้', (await pos()).zone === 'field');

  await page.screenshot({ path: process.env.SHOT || 'tools/last-run.png' });
  // ===== V2-R28: หน้าโหลด + เพลง/เสียงประกอบ (หน้าใหม่ ?splash=1) =====
  { const sp = await ctx.newPage(); sp.on('pageerror', e => errors.push('splash pageerror: ' + e.message));
    await sp.goto(url + '?splash=1'); await sp.waitForTimeout(300);
    const s0 = await sp.evaluate(() => ({ vis: !document.getElementById('splash').hidden, title: document.querySelector('#splash h1').textContent, go: !document.getElementById('splgo').hidden, tip: document.getElementById('spltip').textContent }));
    rec('หน้าโหลด: แสดงตอนเข้าเกม มีชื่อเกม + เคล็ดลับ, ปุ่มเข้าเกมยังไม่ขึ้นระหว่างโหลด', s0.vis && s0.title === 'HMONG LEGEND' && s0.tip.startsWith('เคล็ดลับ') && (!s0.go || await sp.evaluate(() => SND.splash.done)), JSON.stringify(s0));
    await sp.waitForFunction(() => SND.splash.done, null, { timeout: 15000 });
    const s1 = await sp.evaluate(() => ({ pct: SND.splash.pct, txt: document.getElementById('splpct').textContent, aria: document.querySelector('#splash .bar').getAttribute('aria-valuenow'), go: !document.getElementById('splgo').hidden, n: HL.preloadList().length }));
    rec('หน้าโหลด: โหลดภาพแผนที่/ไอคอน/มอนสเตอร์ครบ 100% แล้วขึ้นปุ่ม "แตะเพื่อเข้าเกม"', s1.pct === 100 && s1.txt === '100%' && s1.aria === '100' && s1.go && s1.n >= 15, JSON.stringify(s1));
    await sp.click('#splsnd'); await sp.waitForTimeout(1500);
    const a = await sp.evaluate(() => ({ st: SND.ctx && SND.ctx.state, tr: SND.track, notes: SND.stats.notes }));
    rec('หน้าโหลด: แตะ "เปิดเสียง" → เพลงหน้าแรกเล่น (Web Audio ทำงาน)', a.st === 'running' && a.tr === 'title' && a.notes > 0, JSON.stringify(a));
    await sp.click('#splgo', { force: true }); await sp.waitForTimeout(1500);
    const g = await sp.evaluate(() => ({ hid: document.getElementById('splash').hidden, tr: SND.track, start: SND.stats.played.start }));
    rec('แตะเพื่อเข้าเกม → หน้าโหลดหาย เปลี่ยนเป็นเพลงหมู่บ้าน', g.hid && g.tr === 'village' && g.start === 1, JSON.stringify(g));
    await sp.evaluate(() => { HL.adminLocal({ op: 'time', mode: 'day' }); const s = HL.ZONES.field2.start; HL.enterZone('field2', s[0], s[1]); HL.PS.maxHp = HL.PS.hp = 1e6; }); // ฉาก: ไม่ให้ตายระหว่างรอเพลงเปลี่ยน
    await sp.waitForTimeout(2600);
    rec('ออกจากหมู่บ้าน (กลางวัน) → เพลงผจญภัย + เสียงวาร์ป', await sp.evaluate(() => SND.track === 'field' && SND.stats.played.warp >= 1), await sp.evaluate(() => SND.track));
    await sp.evaluate(() => HL.adminLocal({ op: 'time', mode: 'night' })); await sp.waitForTimeout(2600);
    rec('กลางคืนนอกหมู่บ้าน → เพลงกลางคืน', await sp.evaluate(() => SND.track === 'night'), await sp.evaluate(() => SND.track));
    await sp.evaluate(() => HL.adminLocal({ op: 'time', mode: 'blood' })); await sp.waitForTimeout(2600);
    rec('พระจันทร์เลือดนอกหมู่บ้าน → เพลงบอส', await sp.evaluate(() => SND.track === 'boss'), await sp.evaluate(() => SND.track));
    await sp.evaluate(() => HL.adminLocal({ op: 'time', mode: 'day' }));
    const fx = await sp.evaluate(async () => { const P = HL.PS; P.job = 30; P.cd = {}; P.cast = null; P.dead = false; const m = HL.mons.find(m => !m.c.boss && m.state !== 'dead'); m.x = HL.player.x + 20; m.y = HL.player.y + 6; m.hp = 1; HL.player.dir = 'E';
      document.getElementById('atk').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); document.getElementById('atk').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300)); HL.PS.cd = {}; HL.PS.cast = null; HL.useSkill(3); HL.gain(HL.CFG.expCurve(HL.PS.lv) + 1, 0); return Object.assign({}, SND.stats.played) });
    rec('เสียงเอฟเฟกต์: ฟันดาบ / โดนตี / มอนสเตอร์ตาย / สกิล / เลเวลอัป', fx.swing >= 1 && fx.hit >= 1 && fx.die >= 1 && fx.skill >= 1 && fx.lvup >= 1, JSON.stringify(fx));
    await sp.click('#sndb'); await sp.waitForSelector('#sndp:not([hidden]) #snd-mus');
    await sp.fill('#snd-mus', '0'); await sp.dispatchEvent('#snd-mus', 'input');
    await sp.click('#snd-mute');
    const v = await sp.evaluate(() => ({ st: JSON.parse(localStorage.getItem('hl_snd')), btn: document.getElementById('sndb').textContent }));
    rec('ปุ่ม 🔊: ปรับระดับเพลง + ปิดเสียงทั้งหมด และจำค่าไว้ในเครื่อง', v.st.mus === 0 && v.st.mute === true && v.btn === '🔇', JSON.stringify(v));
    await sp.screenshot({ path: 'tools/last-sound.png' });
    await sp.click('#snd-mute'); await sp.fill('#snd-mus', '55'); await sp.dispatchEvent('#snd-mus', 'input');
    await sp.close(); }
  { const cp = await ctx.newPage(); cp.on('pageerror', e => errors.push('pick pageerror: ' + e.message));
    await cp.goto(url + '?pick=1'); await cp.waitForSelector('#cstart:not([hidden]) .csc');
    const o = await cp.evaluate(() => ({ n: document.querySelectorAll('#cstart .csc').length, on: document.querySelector('#cstart .csc.on b').textContent, d: document.querySelector('#cstart .csc .d').textContent }));
    rec('หน้าเลือกอาชีพตอนเริ่มเกม: 8 อาชีพ มีคำอธิบาย เลือกไว้ก่อน = นักดาบ', o.n === 8 && o.on === 'นักดาบ' && o.d.length > 5, JSON.stringify(o));
    rec('หน้าสร้างตัวละคร: มีเพศ ชาย/หญิง, สีผม 6, ชุด 6 และภาพตัวอย่าง', await cp.evaluate(() => document.querySelectorAll('#cstart [data-g]').length === 2 && document.querySelectorAll('#cstart [data-h]').length === 6 && document.querySelectorAll('#cstart [data-o]').length === 6 && !!document.getElementById('lkcv')));
    await cp.click('#cstart [data-g="f"]'); await cp.click('#cstart [data-h="2"]'); await cp.click('#cstart [data-o="2"]'); await cp.waitForTimeout(300);
    rec('ภาพตัวอย่างวาดตัวละครจริง (มีพิกเซล)', await cp.evaluate(() => { const d = document.getElementById('lkcv').getContext('2d').getImageData(0, 0, 120, 156).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 1500 }));
    await cp.click('#cstart button[aria-label="อาชีพ ผู้ใช้มนตรา"]');
    await cp.screenshot({ path: 'tools/last-cstart.png' });
    await cp.click('#csgo');
    const r = await cp.evaluate(() => ({ hid: document.getElementById('cstart').hidden, cls: HL.curCls(), saved: localStorage.getItem('hl_cls_off'), bar: document.querySelector('#skills .sk').getAttribute('aria-label'), exp: HL.skName(HL.SLOTS[0]), mage: HL.CLS_ACTIVE['ผู้ใช้มนตรา'] }));
    rec('เลือก "ผู้ใช้มนตรา" → เริ่มเกมเป็นอาชีพนั้น ปุ่มสกิลเปลี่ยนตาม', r.hid && r.cls === 'ผู้ใช้มนตรา' && r.saved === 'ผู้ใช้มนตรา' && r.bar === r.exp && r.mage.includes(r.bar), JSON.stringify(r));
    const lk = await cp.evaluate(async () => { await new Promise(r => setTimeout(r, 300)); const L = HL.PS.look, c0 = document.createElement('canvas'), c1 = document.createElement('canvas'); c0.width = c1.width = 96; c0.height = c1.height = 124;
      const S = HL.sheetsFor(L); c0.getContext('2d').drawImage(HL.sheetsFor({ g: 'm', hair: 0, outfit: 0 }).SPR, 0, 0, 96, 124, 0, 0, 96, 124); c1.getContext('2d').drawImage(S.SPR, 0, 0, 96, 124, 0, 0, 96, 124);
      const a = c0.getContext('2d').getImageData(0, 0, 96, 124).data, b = c1.getContext('2d').getImageData(0, 0, 96, 124).data; let head = 0, body = 0; for (let i = 0; i < a.length; i += 4) { const y = (i >> 2) / 96 | 0; if (a[i] !== b[i] || a[i + 1] !== b[i + 1]) { if (y < 52) head++; else body++ } }
      return { L, head, body, saved: JSON.parse(localStorage.getItem('hl_look_off') || 'null') } });
    rec('หน้าตาที่เลือกถูกใช้ในเกม: สีผมเปลี่ยนเฉพาะหัว สีชุดเปลี่ยนเฉพาะตัว และจำในเครื่อง', lk.L.g === 'f' && lk.L.hair === 2 && lk.L.outfit === 2 && lk.head > 100 && lk.body > 50 && lk.saved && lk.saved.hair === 2, JSON.stringify(lk));
    await cp.waitForFunction(() => HL.femReady(), null, { timeout: 10000 });
    const draws = async () => { const a = await cp.evaluate(() => HL.femDraws); await cp.waitForTimeout(500); return (await cp.evaluate(() => HL.femDraws)) - a };
    const fem = await cp.evaluate(() => ({ fem: HL.sheetsFor(HL.PS.look).fem, w: HL.sheetsFor(HL.PS.look).SPR.width, h: HL.sheetsFor(HL.PS.look).SPR.height }));
    rec('ตัวละครหญิงใช้ภาพจริงของเจ้าของ (ขนาดแผ่นเท่าตัวชาย) ไม่ใช้ผมยาวชั่วคราวแล้ว', fem.fem === true && fem.w === 384 && fem.h === 496 && (await draws()) === 0, JSON.stringify(fem));
    const fh = await cp.evaluate(() => { const px = l => { const c = document.createElement('canvas'); c.width = 384; c.height = 496; const k = c.getContext('2d'); k.drawImage(HL.sheetsFor(l).SPR, 0, 0); return k.getImageData(0, 0, 384, 496).data };
      const a = px({ g: 'f', hair: 0, outfit: 0 }), b = px({ g: 'f', hair: 4, outfit: 0 }), c = px({ g: 'f', hair: 0, outfit: 2 }); let hairLow = 0, hairCh = 0, outCh = 0, outHead = 0;
      for (let i = 0; i < a.length; i += 4) { const y = ((i >> 2) / 384 | 0) % 124; if (a[i] !== b[i] || a[i + 2] !== b[i + 2]) { hairCh++; if (y >= 52) hairLow++ } if (a[i] !== c[i] || a[i + 1] !== c[i + 1]) { outCh++; if (y < 40) outHead++ } }
      return { hairCh, hairLow, outCh, outHead } });
    rec('หญิง: เปลี่ยนสีผมรวมผมยาวใต้ไหล่ (ไม่ใช่แค่หัว), เปลี่ยนชุดไม่กระทบผม', fh.hairCh > 3000 && fh.hairLow > 500 && fh.outCh > 1000 && fh.outHead < 50, JSON.stringify(fh));
    await cp.evaluate(() => HL.setLook({ g: 'f', hair: 2, outfit: 2 }));
    await cp.evaluate(() => { const s = HL.ZONES.village2.start; HL.enterZone('village2', s[0], s[1]) });
    await cp.click('#skb'); await cp.click('#skp h3 .clsb'); await cp.click('#lkedit'); await cp.waitForSelector('#cstart:not([hidden]) #lkcv');
    const em = await cp.evaluate(() => ({ t: document.querySelector('#cstart .cshd b').textContent, grid: document.querySelector('#cstart .csg').hidden, btn: document.getElementById('csgo').textContent }));
    rec('แต่งตัวละครภายหลัง (หน้าอาชีพ → แต่งตัวละคร): ซ่อนส่วนอาชีพ ปุ่มบันทึก', em.t === 'แต่งตัวละคร' && em.grid && em.btn === 'บันทึกหน้าตา', JSON.stringify(em));
    await cp.click('#cstart [data-g="m"]'); await cp.click('#cstart [data-h="5"]'); await cp.click('#csgo');
    rec('บันทึกหน้าตาใหม่ → ใช้ทันที', await cp.evaluate(() => HL.PS.look.g === 'm' && HL.PS.look.hair === 5 && document.getElementById('cstart').hidden));
    await cp.evaluate(() => localStorage.removeItem('hl_look_off'));
    await cp.evaluate(() => localStorage.removeItem('hl_cls_off')); await cp.close(); }
  // ===== V2-R35: ทรงผม/แบบชุด แยกชั้นหัว-ตัว =====
  { const lp = await ctx.newPage(); lp.on('pageerror', e => errors.push('layers pageerror: ' + e.message));
    await lp.goto(url + '?pick=1'); await lp.waitForSelector('#cstart:not([hidden]) #lkcv');
    const base = await lp.evaluate(() => ({ m: HL.CHAR_CAT.m.hair.length && HL.CHAR_CAT.m.outfit.length, f: HL.CHAR_CAT.f.hair.length && HL.CHAR_CAT.f.outfit.length, chipsWhenOne: document.querySelectorAll('#cstart [data-hs],#cstart [data-of]').length }));
    rec('ทะเบียนทรงผม/ชุด: มีชุดพื้นฐานทั้งชาย/หญิง, ตอนมีแบบเดียวไม่แสดงปุ่มเลือก', base.m && base.f && base.chipsWhenOne === 0, JSON.stringify(base));
    const r = await lp.evaluate(async () => { const wait = async l => { for (let i = 0; i < 120; i++) { const s = HL.sheetsFor(l); if (!s.tmp) return s; await new Promise(r => setTimeout(r, 50)) } return HL.sheetsFor(l) };
      HL.CHAR_CAT.m.hair.push({ id: 'f0', n: 'ทดสอบหัวหญิง' }); HL.CHAR_CAT.m.outfit.push({ id: 'f0', n: 'ทดสอบตัวหญิง' }); // ทดสอบประกอบข้ามชุด
      const px = async l => { const s = await wait(l), c = document.createElement('canvas'); c.width = 384; c.height = 496; const k = c.getContext('2d'); k.drawImage(s.SPR, 0, 0); return { s, d: k.getImageData(0, 0, 384, 496).data } };
      const A = await px({ g: 'm', hs: 0, of: 0, hair: 0, outfit: 0 }), B = await px({ g: 'm', hs: 1, of: 0, hair: 0, outfit: 0 }), C = await px({ g: 'm', hs: 0, of: 1, hair: 0, outfit: 0 });
      let headDiffB = 0, bodyDiffB = 0, headDiffC = 0, bodyDiffC = 0, longHair = 0;
      for (let i = 0; i < A.d.length; i += 4) { const y = ((i >> 2) / 384 | 0) % 124, dB = A.d[i] !== B.d[i] || A.d[i + 3] !== B.d[i + 3], dC = A.d[i] !== C.d[i] || A.d[i + 3] !== C.d[i + 3];
        if (y < 40) { headDiffB += dB; headDiffC += dC } else if (y > 70) { bodyDiffB += dB && B.d[i + 3] !== 254; bodyDiffC += dC } if (y > 60 && B.d[i + 3] === 254) longHair++ }
      return { layered: A.s.layered && B.s.layered && C.s.layered, headDiffB, bodyDiffB, headDiffC, bodyDiffC, longHair } });
    rec('ประกอบชั้นภาพ: เปลี่ยนทรงผม → หัวเปลี่ยน ตัวเดิม (ผมยาวลงหลังได้), เปลี่ยนชุด → ตัวเปลี่ยน หัวเดิม', r.layered && r.headDiffB > 500 && r.bodyDiffB < 200 && r.longHair > 300 && r.bodyDiffC > 1000 && r.headDiffC < 200, JSON.stringify(r));
    await lp.evaluate(() => window.__rr = 1); await lp.click('#cstart [data-g="f"]'); await lp.click('#cstart [data-g="m"]');
    const chips = await lp.evaluate(() => ({ hs: [...document.querySelectorAll('#cstart [data-hs]')].map(b => b.textContent), of: [...document.querySelectorAll('#cstart [data-of]')].map(b => b.textContent) }));
    rec('มีหลายแบบ → แสดงปุ่ม "ทรงผม" และ "แบบชุด" พร้อมชื่อ', chips.hs.length === 2 && chips.of.length === 2 && chips.hs[0] === 'สั้นผ้าคาดหัว' && chips.of[0] === 'ชุดม้งดั้งเดิม', JSON.stringify(chips));
    await lp.click('#cstart [data-hs="1"]'); await lp.click('#cstart [data-of="1"]'); await lp.click('#csgo');
    rec('เลือกทรงผม/ชุดแล้วเริ่มเกม → ใช้ในตัวละคร', await lp.evaluate(() => HL.PS.look.hs === 1 && HL.PS.look.of === 1 && HL.PS.look.g === 'm'));
    await lp.evaluate(() => localStorage.removeItem('hl_look_off')); await lp.close(); }
  // ===== V2-R36: สกิลจริงทุกอาชีพ (ออฟไลน์) =====
  { const r = await page.evaluate(async () => { const out = [], sleep = ms => new Promise(r => setTimeout(r, ms));
      const s0 = HL.ZONES.field2.start; HL.enterZone('field2', s0[0], s0[1]); HL.AUTO.on = false;
      for (const cls of HL.CLASSES) { HL.PS.cls = cls; HL.buildSkills();
        for (let i = 3; i <= 11; i++) { const sk = HL.skillFor(i); HL.PS.job = 30; HL.PS.dead = false; HL.PS.cast = null; HL.PS.cd = {}; HL.PS.buffT = 0; HL.PS.guardT = 0; HL.recalc(); HL.PS.hp = Math.round(HL.PS.maxHp * .3);
          HL.player.x = s0[0]; HL.player.y = s0[1]; HL.player.dir = 'E'; for (const m of HL.mons) { m.state = 'dead'; m.respT = 1e9 }
          const m = HL.mons.find(m => !m.c.boss), far = sk.dist || (sk.shape === 'shot' || sk.shape === 'wave' ? 110 : 26); Object.assign(m, { state: 'idle', hp: 1e6, x: s0[0] + far, y: s0[1] + (sk.dist ? 14 : 0) + m.c.size * .6 - 14, hx: s0[0] + far, hy: s0[1], respT: 0, atkT: 99 });
          const hp0 = HL.PS.hp, res = HL.useSkill(i); await sleep(900);
          const ok = res === 'ok' && (sk.shape === 'heal' ? HL.PS.hp > hp0 : sk.shape === 'buff' ? HL.PS.buffT > 0 : sk.shape === 'guard' ? HL.PS.guardT > 0 : m.hp < 1e6);
          if (!ok) out.push(cls + '#' + i + ' ' + sk.shape + ' ' + res + ' dmg=' + Math.round(1e6 - m.hp)) } }
      HL.PS.cls = 'นักดาบ'; HL.buildSkills(); for (const m of HL.mons) { m.respT = 1 } return out });
    rec('ออฟไลน์: ทุกอาชีพ ทุกสกิล (72 ท่า) ใช้ได้และมีผล (ดาเมจ/ฟื้น/บัฟ/ป้องกัน)', r.length === 0, r.slice(0, 6).join(' | '));
    const sh = await page.evaluate(async () => { HL.PS.cls = 'นักธนู'; HL.buildSkills(); HL.PS.cd = {}; HL.PS.cast = null; HL.PS.dead = false; HL.player.dir = 'E'; for (const m of HL.mons) { m.state = 'dead'; m.respT = 1e9 } const n0 = HL.shotsN; document.getElementById('atk').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); document.getElementById('atk').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); const n = HL.shotsN; HL.PS.cls = 'นักดาบ'; HL.buildSkills(); for (const m of HL.mons) m.respT = 1; return { n0, n } });
    rec('นักธนู: กดโจมตี → ยิงลูกศรออกไป (กระสุนในฉาก)', sh.n > sh.n0, JSON.stringify(sh)); }
  { const r = await page.evaluate(async () => { const s0 = [22.5 * 32, 15.5 * 32]; HL.enterZone('field2', s0[0], s0[1]); HL.PS.cls = 'นักธนู'; HL.buildSkills(); HL.PS.job = 30; HL.PS.cd = {}; HL.PS.cast = null; HL.PS.dead = false; HL.player.dir = 'E';
      for (const m of HL.mons) { m.state = 'dead'; m.respT = 1e9 } const m = HL.mons.find(m => !m.c.boss); Object.assign(m, { state: 'idle', hp: 1e6, x: s0[0] - 40, y: s0[1], hx: s0[0] - 40, hy: s0[1], respT: 0, atkT: 99 });
      HL.useSkill(11); await new Promise(r => setTimeout(r, 1500)); const d = 1e6 - m.hp; HL.PS.cls = 'นักดาบ'; HL.buildSkills(); for (const q of HL.mons) q.respT = 1; return d });
    rec('ออฟไลน์: ห่าศรตกใส่มอนสเตอร์ข้างหลังตัวได้ (ไม่ตกที่ว่างตามทิศที่หัน)', r > 0, Math.round(r)); }
  // ===== V2-R38: ท่าทางอาชีพ (นักธนูชาย) =====
  { const r = await page.evaluate(async () => { const L = { g: 'm', hair: 0, outfit: 0, hs: 0, of: 0 }; let P = null; for (let i = 0; i < 100 && !P; i++) { P = HL.poseFor('นักธนู', L); if (!P) await new Promise(r => setTimeout(r, 50)) }
      return { ok: !!P, w: P && P.img.width, h: P && P.img.height, sword: HL.poseFor('นักดาบ', L), fem: HL.poseFor('นักธนู', { g: 'f' }), recol: P && HL.poseFor('นักธนู', { g: 'm', hair: 4, outfit: 2, hs: 0, of: 0 }).img !== P.img } });
    rec('นักธนูชาย: มีภาพท่ายิงธนูจริง (960×496), สีผม/ชุดเปลี่ยนตามได้, อาชีพที่ยังไม่มีภาพใช้ท่าเดิม', r.ok && r.w === 960 && r.h === 496 && r.recol && !r.sword && !r.fem, JSON.stringify(r)); }
  { const r = await page.evaluate(async () => { const out = {}; const s0 = [22.5 * 32, 15.5 * 32]; HL.enterZone('field2', s0[0], s0[1]); HL.setLook({ g: 'f', hair: 0, outfit: 0 });
      for (const cls of HL.CLASSES) { HL.PS.cls = cls; HL.buildSkills(); HL.player.dir = 'E'; const n0 = HL.castDraw[0]; HL.PS.cast = { sk: Object.assign({}, HL.basicNow(), { poseT: 9 }), t: 1, done: true, key: 'b' };
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); out[cls] = HL.castDraw[0] > n0 ? HL.castDraw[1] : 'เดิม'; HL.PS.cast = null }
      HL.PS.cls = 'นักดาบ'; HL.buildSkills(); HL.setLook({ g: 'm', hair: 0, outfit: 0 }); return out });
    const want = { 'นักดาบ': 'เดิม', 'นักธนู': 'bow', 'นักฆ่า': 'daggers', 'นักสู้': 'fists', 'ผู้สืบวิญญาณ': 'staff', 'ผู้รักษา': 'leafstaff', 'ผู้ใช้มนตรา': 'book', 'ผู้พิทักษ์': 'shield' };
    rec('ท่าใช้สกิลครบทุกอาชีพ: แต่ละอาชีพถืออาวุธของตัวเอง (นักดาบใช้ภาพเดิม)', Object.keys(want).every(k => r[k] === want[k]), JSON.stringify(r)); }
  rec('หน้าเกมปกติ (ระบบทดสอบอัตโนมัติ) ข้ามหน้าโหลดได้', await page.evaluate(() => document.getElementById('splash').hidden && SND.splash.shown === false));
  rec('ไม่มี JavaScript error ระหว่างทดสอบ', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close(); srv.close();
  const fail = results.filter(r => !r.pass).length;
  console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน');
  fs.writeFileSync(process.env.OUT || 'tools/last-run.json', JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
