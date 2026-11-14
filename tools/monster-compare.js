// ภาพเปรียบเทียบตัวเลือกมอนสเตอร์ (V2-R7) — วาดในเกมจริงบนพื้นหญ้า ข้างตัวละครหลัก
// รัน: python3 tools/build_monster_candidates.py && node tools/monster-compare.js
// ผล: docs/evidence/monsters_r7/NN_<ชนิด>.png และ docs/evidence/monsters_r7_overview.png
// แต่ละภาพ: [ตัวละครหลัก] [มอนสเตอร์ปัจจุบัน (drawMon)] [A] [B] [C] [D]
// ตัวเลือกวาดด้วยโค้ดทดสอบนี้เท่านั้น (ทับบนแคนวาสของเกม ใช้มุมกล้อง/ซูมเดียวกับเกม) — ไม่ได้แก้ game/index.html
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const GAME = path.join(ROOT, 'game/index.html');
const CAND = path.join(ROOT, 'assets/monster_candidates');
const OUTD = path.join(ROOT, 'docs/evidence/monsters_r7');
const man = JSON.parse(fs.readFileSync(path.join(CAND, 'candidates.json'), 'utf8'));
const uri = id => 'data:image/png;base64,' + fs.readFileSync(path.join(CAND, id + '.png')).toString('base64');

(async () => {
  fs.mkdirSync(OUTD, { recursive: true });
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); fs.createReadStream(GAME).pipe(r); }).listen(0);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 460 }, deviceScaleFactor: 2 });
  // ต่อท้ายทุกเฟรมของเกมด้วยการวาดตัวเลือก (ใช้ transform ชุดเดียวกับ draw())
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(t => { cb(t); try { window.__ov && window.__ov(); } catch (e) { window.__ovErr = String(e); } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + srv.address().port + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ซ่อน HUD (DOM) ให้เห็นเฉพาะแคนวาส; หาแถวหญ้าโล่งในหมู่บ้าน
  const spot = await page.evaluate(() => {
    const cv = document.getElementById('c');
    for (const el of document.body.querySelectorAll('*')) if (el !== cv && !el.contains(cv)) el.style.visibility = 'hidden';
    const { Z, T, COLS, ROWS, TYPES } = HL;
    const free = (x, y) => Z.g[y][x] === TYPES.GR && !HL.tileBlocked(x, y);
    const objAt = (x, y) => Z.objs.some(o => Math.abs(o.x - x) < 2.5 && o.base / T > y - .5 && o.base / T < y + 3);
    let best = null;
    for (let y = 4; y < ROWS - 2 && !best; y++) for (let x = 1; x < COLS - 18 && !best; x++) {
      let ok = true;
      for (let k = 0; k < 17 && ok; k++) for (let dy = -1; dy <= 0 && ok; dy++) ok = free(x + k, y + dy) && !objAt(x + k, y + dy);
      if (ok) best = { x: x * T + 20, y: y * T + 26 };
    }
    return best;
  });
  if (!spot) throw new Error('no free grass row');

  const files = [];
  let n = 0;
  for (const [type, list] of Object.entries(man)) {
    n++;
    const res = await page.evaluate(async ({ type, list, spot, imgs }) => {
      const { player, CFG, T, COLS, ROWS } = HL;
      const GAP = 74, LEFT = spot.x;
      player.x = LEFT; player.y = spot.y; player.dir = 'E';
      const c = Object.assign({}, CFG.monsters[type], { aggro: 0, speed: 0 });
      const mx = LEFT + GAP, my = spot.y;
      HL.setMons([{ type, c, x: mx, y: my, hx: mx, hy: my, hp: c.hp, state: 'idle', t: 0, atkT: 0, dir: 'E', wx: mx, wy: my, respT: 0, hurt: 0 }]);
      const loaded = await Promise.all(imgs.map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; })));
      // วัดขนาดมอนสเตอร์ปัจจุบันจากภาพที่เกมวาดจริง: เทียบเฟรมที่มี/ไม่มีมอนสเตอร์ (หน่วยพิกเซลโลก)
      const s = c.size;
      window.__ov = null;
      const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const cvm = document.getElementById('c'), Km = cvm.getContext('2d');
      const dprm = window.devicePixelRatio || 1, zm = Math.max(.15, Math.min(4, Math.min(cvm.clientWidth, cvm.clientHeight) / 520));
      const Wm = COLS * T, Hm = ROWS * T, vwm = cvm.clientWidth / zm, vhm = cvm.clientHeight / zm;
      const cxm = Wm > vwm ? Math.min(Wm - vwm, Math.max(0, player.x - vwm / 2)) : (Wm - vwm) / 2;
      const cym = Hm > vhm ? Math.min(Hm - vhm, Math.max(0, player.y - vhm / 2)) : (Hm - vhm) / 2;
      const sc = dprm * zm, rx = Math.round((mx - GAP / 2 - cxm) * sc), ry = Math.round((my - 80 - cym) * sc), rw = Math.round(GAP * sc), rh = Math.round(92 * sc);
      await frame(); const withM = Km.getImageData(rx, ry, rw, rh).data;
      const keep = HL.mons; HL.setMons([]); await frame(); const noM = Km.getImageData(rx, ry, rw, rh).data; HL.setMons(keep);
      let x0 = rw, x1 = -1, y0 = rh, y1 = -1;
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) { const i = (yy * rw + xx) * 4;
        if (Math.abs(withM[i] - noM[i]) + Math.abs(withM[i + 1] - noM[i + 1]) + Math.abs(withM[i + 2] - noM[i + 2]) > 40) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); } }
      const curW = x1 >= 0 ? (x1 - x0 + 1) / sc : s * 2, curH = y1 >= 0 ? (y1 - y0 + 1) / sc : s * 2;
      const cv = document.getElementById('c'), K = cv.getContext('2d');
      window.__ov = () => {
        const dpr = window.devicePixelRatio || 1, cw = cv.clientWidth, ch = cv.clientHeight, W = COLS * T, H = ROWS * T;
        const zoom = Math.max(.15, Math.min(4, Math.min(cw, ch) / 520)), vw = cw / zoom, vh = ch / zoom;
        const cx = W > vw ? Math.min(W - vw, Math.max(0, player.x - vw / 2)) : (W - vw) / 2;
        const cy = H > vh ? Math.min(H - vh, Math.max(0, player.y - vh / 2)) : (H - vh) / 2;
        K.save(); K.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cx * dpr * zoom, -cy * dpr * zoom); K.imageSmoothingEnabled = false;
        const label = (t, x, y, col) => { K.font = 'bold 9px sans-serif'; K.textAlign = 'center'; K.lineWidth = 3; K.strokeStyle = 'rgba(0,0,0,.8)'; K.strokeText(t, x, y); K.fillStyle = col || '#fff'; K.fillText(t, x, y); };
        loaded.forEach((im, i) => {
          const x = mx + GAP * (i + 1), k = Math.min(2.2, Math.max(.6, Math.sqrt(curW * curH / (im.width * im.height)))), w = im.width * k, h = im.height * k;
          K.fillStyle = 'rgba(0,0,0,.3)'; K.beginPath(); K.ellipse(x, my + 1, Math.min(w * .45, s * 1.3), s * .35, 0, 0, 7); K.fill();
          K.drawImage(im, x - w / 2, my - h + 2, w, h);
          label(String.fromCharCode(65 + i), x, my + 14, '#ffe27a');
          label(list[i].source.split('/').pop().replace('.png', '') + (list[i].extra !== '-' ? ' *' : ''), x, my + 25);
        });
        label('ตัวละครหลัก', LEFT, my + 14); label('ปัจจุบัน', mx, my + 14, '#9fe0ff');
        K.font = 'bold 13px sans-serif'; K.textAlign = 'left'; K.lineWidth = 4; K.strokeStyle = 'rgba(0,0,0,.85)';
        K.strokeText(type, LEFT - 18, my - 70); K.fillStyle = '#fff'; K.fillText(type, LEFT - 18, my - 70);
        K.font = '9px sans-serif'; K.strokeText('* = ปรับสี/เติมรายละเอียดแล้ว (ดู docs/ASSETS.md)', LEFT + 90, my - 72); K.fillStyle = '#ffe27a'; K.fillText('* = ปรับสี/เติมรายละเอียดแล้ว (ดู docs/ASSETS.md)', LEFT + 90, my - 72);
        K.restore();
        window.__clip = { x0: (LEFT - 30 - cx) * zoom, x1: (mx + GAP * (loaded.length + .7) - cx) * zoom, y0: (my - 86 - cy) * zoom, y1: (my + 32 - cy) * zoom };
      };
      await new Promise(r => setTimeout(r, 400));
      return { cur: [Math.round(curW), Math.round(curH)], clip: window.__clip, err: window.__ovErr || null, mons: HL.mons.length };
    }, { type, list, spot, imgs: list.map(c => uri(c.id)) });
    if (res.err) throw new Error(res.err);
    const c = res.clip;
    const file = path.join(OUTD, String(n).padStart(2, '0') + '_' + list[0].id.split('_')[0] + '.png');
    await page.screenshot({ path: file, clip: { x: Math.max(0, c.x0), y: Math.max(0, c.y0), width: c.x1 - Math.max(0, c.x0), height: c.y1 - Math.max(0, c.y0) } });
    files.push(file);
    console.log('saved', path.relative(ROOT, file), type, list.length + ' ตัวเลือก', 'ขนาดปัจจุบัน', res.cur.join('x'));
  }

  // ภาพรวม: ต่อทุกแถวเป็นภาพเดียว
  const ov = await page.evaluate(async srcs => {
    const ims = await Promise.all(srcs.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; })));
    const W = Math.max(...ims.map(i => i.width)), H = ims.reduce((a, i) => a + i.height, 0);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const k = c.getContext('2d');
    k.fillStyle = '#1b2a1f'; k.fillRect(0, 0, W, H); let y = 0; for (const i of ims) { k.drawImage(i, 0, y); y += i.height; }
    return c.toDataURL('image/png');
  }, files.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')));
  fs.writeFileSync(path.join(ROOT, 'docs/evidence/monsters_r7_overview.png'), Buffer.from(ov.split(',')[1], 'base64'));
  console.log('saved docs/evidence/monsters_r7_overview.png', errors.length ? 'pageerrors: ' + errors.join('; ') : 'no page errors');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
