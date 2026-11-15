// ตรวจการทำงานจริงในเบราว์เซอร์: ท่าที่วาดจริง จุดปล่อย ดีเลย์ดาเมจ และเอฟเฟกต์ตาราง (รอบ 2 ส่วนที่ 2 / V2-R82)
// รัน: node tools/attack-sync-browser-test.js [path-to-html] [ชื่อผลทดสอบ]
//   ค่าเริ่มต้น game/index.html · ผลรายท่าเก็บที่ docs/evidence/attack_sync_r82_<ชื่อ>.json
// วิธี: คัดลอก index.html ไปโฟลเดอร์ชั่วคราว (ลิงก์ทรัพยากรเข้ามา) แล้วแทรกจุดบันทึกในสำเนา
//   ไฟล์เกมจริงไม่ถูกแก้ · เรียก attack() / useSkill() จริงทุกอาชีพ × ท่าพื้นฐาน + สกิลช่อง 3–11
const { chromium, devices } = require('playwright');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { CFG } = require('../shared/world.js');

const file = path.resolve(process.argv[2] || 'game/index.html');
const tag = process.argv[3] || 'run';
const gameDir = path.dirname(file);
const outDir = path.resolve('docs/evidence');
const RELEASE = 0.6;
const BEAT = 0.2625;
const FRAME = 1 / 60;
const CLASSES = ['นักดาบ', 'นักสู้', 'นักฆ่า', 'นักธนู', 'ผู้รักษา', 'ผู้พิทักษ์', 'ผู้สืบวิญญาณ', 'ผู้ใช้มนตรา'];
const KEYS = ['b', 3, 4, 5, 6, 7, 8, 9, 10, 11];
const srcSeq = fs.readFileSync(file, 'utf8').match(/^const ATK4_SEQ=.*$/m)[0];
const SEQ = new Function(srcSeq + '\nreturn ATK4_SEQ;')(); // ตารางเฟรมจริงของเกม

const results = [];
const rec = (name, pass, detail) => {
  results.push(!!pass);
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const frameAt = (mode, p) => { const M = SEQ[mode]; return M.seq[Math.min(M.seq.length - 1, Math.floor(p * M.seq.length))]; };
const sameList = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

// ค่าดีเลย์ดาเมจหลังปล่อยที่ควรได้ ตามรูปแบบของสกิลนั้น
function expectedDelays(sk) {
  switch (sk.shape) {
    case 'trap': return [sk.delay || 0];
    case 'pillar': return [0.12];
    case 'rain': return Array.from({ length: sk.n }, (_, k) => 0.08 + k * 0.09);
    case 'tri': return [0.15, 0.3];
    case 'spikes': return Array.from({ length: sk.n }, (_, k) => k * 0.09);
    case 'multi': return Array.from({ length: sk.hits }, (_, k) => k * 0.1);
    default: return [];
  }
}
const firstHitDelay = sk => (sk.shape === 'trap' ? (sk.delay || 0) : sk.shape === 'pillar' ? 0.12 : sk.shape === 'rain' ? 0.08 : 0);

// แทรกจุดบันทึกในสำเนาไฟล์เกม — ทุกจุดต้องพบตรง 1 ครั้ง มิฉะนั้นหยุดทันที
function instrument(html) {
  const insertAfter = (src, re, code) => {
    const hits = src.match(new RegExp(re.source, 'g')) || [];
    if (hits.length !== 1) throw new Error('จุดแทรกไม่ตรง 1 จุด: ' + re);
    return src.replace(re, m => m + code);
  };
  let s = html;
  s = s.replace('<script>', () => '<script>window.__TRL=[];window.__TR=function(e){window.__TRL.push(e)};</script><script>');
  s = insertAfter(s, /function startCast\(sk,key\)\{/, "__TR({k:'start',key:key,t:tNow});");
  s = insertAfter(s, /function release\(sk\)\{/, "__TR({k:'release',t:tNow});");
  s = insertAfter(s, /function drawAtk4\(K,img,x,y,dir,p,S,mode\)\{/, "__TR({k:'atk4',mode:mode||'sword',p:p,t:tNow});");
  s = insertAfter(s, /function poseFor\(cls,look\)\{/, "__TR({k:'poseFor',t:tNow});");
  s = insertAfter(s, /function atk4For\(l\)\{/, "__TR({k:'atk4For',t:tNow});");
  s = insertAfter(s, /function drawClassCast\([^)]*\)\{/, "__TR({k:'drawClassCast',t:tNow});");
  s = insertAfter(s, /function drawBodyCast\([^)]*\)\{/, "__TR({k:'drawBodyCast',t:tNow});");
  s = insertAfter(s, /function drawVertCast\([^)]*\)\{/, "__TR({k:'drawVertCast',t:tNow});");
  const hook = '{const __p=pending.push.bind(pending);pending.push=o=>{__TR({k:\'pend\',d:o.t,t:tNow});return __p(o)};'
    + 'const __f=fx.push.bind(fx);fx.push=o=>{__TR({k:\'fx\',fk:o.k,T:o.T,a:o.a,t:tNow});return __f(o)};}'
    + 'window.__DRV={attack:()=>attack(),useSkill:i=>useSkill(i),PS:PS,player:player,get tNow(){return tNow},pending:pending,fx:fx,CFG:CFG,'
    + 'chartReady:c=>({ud:!!skfxudImg(c),e:!!skfxImg(c)}),step:dt=>{update(dt);draw()}};';
  const at = s.split('window.HL={').length - 1;
  if (at !== 1) throw new Error('จุดแทรก window.HL ไม่ตรง 1 จุด');
  // หยุดลูปเกมได้ตอนเก็บภาพทีละเฟรม (ค่าเริ่มต้นไม่หยุด)
  const loopNeedle = 'last=n;update(dt);draw();';
  if (s.split(loopNeedle).length - 1 !== 1) throw new Error('จุดหยุดลูปไม่ตรง 1 จุด');
  s = s.replace(loopNeedle, () => 'last=n;if(window.__PAUSE){requestAnimationFrame(loop);return}update(dt);draw();');
  s = s.replace('window.HL={', () => hook + 'window.HL={');
  return s;
}

// ภาพต่อเนื่องทีละ 1/30 วินาที (หยุดลูปเกม แล้วเดินทีละเฟรมจริง) ของท่าที่เป็นตัวอย่าง รวมเป็นแผ่นเดียวให้ตาตรวจ
// เฟรมแรกที่เวลาถึงจุดปล่อยมีกรอบแดง · เฟรมแรกของดาเมจ (ถ้ามีดีเลย์) มีกรอบเหลือง
async function captureSheets(page, ctx, tag) {
  const casts = [{ cls: 'นักดาบ', key: 'b' }, { cls: 'นักธนู', key: 3 }, { cls: 'นักธนู', key: 6 }];
  const N = 24, STEP = 2; // ทีละ 2 ขั้นของ 1/60 วิ = 1/30 วิ ต่อภาพ
  const box = await page.locator('#c').boundingBox();
  // กล้องตามตัวละครเมื่ออยู่กลางแผนที่ (ย้ายไปหมู่บ้านเหมือน idle-test) ตัดกรอบให้เห็นเอฟเฟกต์ที่ยื่นไปทางขวาด้วย
  const clip = { x: box.x + box.width / 2 - 90, y: box.y + box.height / 2 - 100, width: 220, height: 170 };
  const rows = [];
  await page.evaluate(() => { const s = HL.ZONES.village.start; HL.enterZone('village', s[0] - 96, s[1]); });
  await page.waitForTimeout(600);
  for (const c of casts) {
    const sk = c.key === 'b' ? CFG.basicFor(c.cls) : CFG.skillFor(c.cls, c.key);
    const R = RELEASE * sk.poseT;
    const d = c.key === 'b' ? 0 : firstHitDelay(sk);
    await page.evaluate(({ cls, key }) => {
      const D = window.__DRV;
      window.__PAUSE = true;
      D.PS.cls = cls; D.PS.job = 50; D.PS.dead = false; D.PS.hp = D.PS.maxHp; D.PS.cast = null; D.PS.cd = {};
      D.PS.look = Object.assign({}, D.PS.look, { g: 'm' });
      D.player.dir = 'E';
      window.__t0 = D.tNow;
      if (key === 'b') D.attack(); else D.useSkill(key);
    }, { cls: c.cls, key: c.key });
    const frames = [];
    for (let f = 0; f < N; f++) {
      if (f > 0) await page.evaluate(s => { for (let k = 0; k < s; k++) window.__DRV.step(1 / 60); }, STEP);
      const t = await page.evaluate(() => window.__DRV.tNow - window.__t0);
      const png = await page.screenshot({ clip, type: 'png' });
      frames.push({ t, src: 'data:image/png;base64,' + png.toString('base64') });
    }
    await page.evaluate(() => { window.__PAUSE = false; });
    rows.push({ label: c.cls + ' · ' + (c.key === 'b' ? 'ท่าพื้นฐาน' : 'สกิล ' + c.key) + ' · ทิศขวา', R, d, frames });
  }
  const relIdx = rows.map(r => r.frames.findIndex(f => f.t >= r.R - 1e-6));
  let html = '<html><body style="margin:0;background:#15151c;color:#e6e6ea;font:13px sans-serif;padding:14px;width:1200px">'
    + '<div style="font-size:15px;margin-bottom:6px">ท่าโจมตีและเอฟเฟกต์ต่อเนื่องทีละ 1/30 วินาที · ' + tag + ' (กรอบแดง = เฟรมปล่อย · กรอบเหลือง = ดาเมจแรก)</div>';
  rows.forEach((r, ri) => {
    const hitIdx = r.d ? r.frames.findIndex(f => f.t >= r.R + r.d - 1e-6) : -1;
    html += '<div style="margin:10px 0 2px">' + r.label + ' · ปล่อยที่ ' + r.R.toFixed(3) + ' วิ' + (r.d ? ' · ดาเมจแรกที่ ' + (r.R + r.d).toFixed(3) + ' วิ' : '') + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;max-width:1140px">';
    r.frames.forEach((f, fi) => {
      const border = fi === relIdx[ri] ? '2px solid #ff4a3a' : fi === hitIdx ? '2px solid #ffd25a' : '1px solid #2a2a36';
      html += '<div style="text-align:center;width:120px"><img src="' + f.src + '" width="120" height="93" style="display:block;border:' + border + ';background:#0b0b10"><div style="font-size:11px;color:#9a9aaa">' + f.t.toFixed(3) + ' วิ</div></div>';
    });
    html += '</div>';
  });
  html += '</body></html>';
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 1310, height: 800 });
  await sheet.setContent(html);
  await sheet.waitForTimeout(200);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'attack_sync_r82_frames_' + tag + '.jpg');
  await sheet.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 80 });
  await sheet.close();
  console.log('INFO แผ่นภาพทีละเฟรม: ' + path.relative(process.cwd(), out));
}

(async () => {
  // โฟลเดอร์ชั่วคราว: index.html ที่แทรกจุดบันทึกแล้ว + ลิงก์ทรัพยากรของเกมจริง
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-attack-probe-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), instrument(fs.readFileSync(file, 'utf8')));
  for (const name of fs.readdirSync(gameDir)) {
    if (name === path.basename(file)) continue;
    fs.symlinkSync(path.join(gameDir, name), path.join(tmp, name));
  }

  // เสิร์ฟผ่าน HTTP เหมือนการใช้งานจริง: หน้าแบบ file:// ทำให้ canvas ถูกจำกัด (getImageData) และหยุดลูปการวาด
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
  const srv = http.createServer((rq, rs) => {
    const rel = decodeURIComponent(rq.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const f = path.join(tmp, rel);
    if (!f.startsWith(tmp) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'content-type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rs);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await ctx.newPage();
    const errors = [], netNoise = [], missingAssets = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    // ข้อความเครือข่ายจากการไม่มีเซิร์ฟเวอร์ออนไลน์ในการทดสอบนี้ ไม่ใช่ข้อผิดพลาดของการร่าย — แยกไว้ต่างหาก
    page.on('console', m => {
      if (m.type() !== 'error') return;
      if (/Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR_/.test(m.text())) netNoise.push(m.text());
      else errors.push('console: ' + m.text());
    });
    page.on('response', r => {
      if (r.status() >= 400 && /\/(sprites|maps|icons)\//.test(r.url())) missingAssets.push(r.url());
    });

    await page.goto('http://127.0.0.1:' + srv.address().port + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const ready = await page.evaluate(() => !!window.__DRV && Array.isArray(window.__TRL));
    rec('โหลดสำเนาที่แทรกจุดบันทึกได้ และเข้าถึงตัวควบคุมการร่าย', ready);
    if (!ready) process.exit(1);

    // ทิศ S (ลง) ใช้ตารางขึ้น/ลง และทิศ E (ขวา) ใช้ตารางด้านข้าง — ทดสอบทั้งสองทิศ
    const perCast = [];
    for (const dir of ['S', 'E']) {
      for (const cls of CLASSES) {
        for (const key of KEYS) {
          const sk = key === 'b' ? CFG.basicFor(cls) : CFG.skillFor(cls, key);
          const waitS = sk.poseT + 0.35;
          await page.evaluate(({ cls, key, dir }) => {
            const D = window.__DRV;
            D.PS.cls = cls; D.PS.job = 50; D.PS.dead = false; D.PS.hp = D.PS.maxHp;
            D.PS.cast = null; D.PS.cd = {};
            D.PS.look = Object.assign({}, D.PS.look, { g: 'm' });
            D.player.dir = dir;
            window.__TRL.length = 0;
            window.__t0 = D.tNow;
            window.__ret = key === 'b' ? D.attack() : D.useSkill(key);
          }, { cls, key, dir });
          await page.waitForFunction(w => window.__DRV.PS.cast === null && window.__DRV.tNow - window.__t0 > w, waitS, { timeout: 15000, polling: 50 });
          const got = await page.evaluate(() => ({ log: window.__TRL.slice(), ret: window.__ret }));
          perCast.push({ cls, key, dir, ret: got.ret, log: got.log });
        }
      }
    }

    // วิเคราะห์ผลรายท่า
    const detail = [];
    const failRel = [], failStrike = [], failDelay = [], failChart = [], noBody = [];
    const pathCount = {};
    for (const c of perCast) {
      const sk = c.key === 'b' ? CFG.basicFor(c.cls) : CFG.skillFor(c.cls, c.key);
      const P = sk.poseT;
      const log = c.log;
      const label = c.cls + '/' + (c.key === 'b' ? 'พื้นฐาน' : c.key) + '/' + c.dir;
      const row = { cls: c.cls, key: c.key, dir: c.dir, ret: c.ret, P, relDevMs: null, path: null, mode: null, strike: null, delays: null, chart: null };
      const start = log.find(e => e.k === 'start');
      const rel = start && log.find(e => e.k === 'release' && e.t >= start.t);
      if (!start || !rel) { failRel.push(label + ' ไม่มีการปล่อย (ret=' + c.ret + ')'); detail.push(row); continue; }
      row.relDevMs = +(((rel.t - start.t) - RELEASE * P) * 1000).toFixed(1);
      // การปล่อยเกิดที่เฟรมแรกที่เวลาถึง 0.6×poseT จึงเลยได้ไม่เกินหนึ่งเฟรมของเกม — ลูปเกมจำกัดเฟรมละไม่เกิน 50 ms (dt ≤ 0.05)
      if (!(row.relDevMs >= -1e-6 && row.relDevMs <= 50 + 1)) failRel.push(label + ' ' + row.relDevMs + ' ms');

      // ท่าที่วาดจริง = ฟังก์ชันวาดที่ถูกเรียก (poseFor/atk4For เป็นแค่ตัวเลือก จึงไม่นับเป็นการวาด)
      const after = log.filter(e => e.t >= start.t);
      const firstDraw = after.find(e => ['atk4', 'drawClassCast', 'drawBodyCast', 'drawVertCast'].includes(e.k));
      const sheetAsked = after.some(e => e.k === 'poseFor');
      row.path = firstDraw ? (firstDraw.k === 'atk4' ? 'drawAtk4' : firstDraw.k) : (sheetAsked ? 'poseFor(ไม่ทราบ)' : 'ไม่มี');
      pathCount[row.path] = (pathCount[row.path] || 0) + 1;
      if (!firstDraw) noBody.push(label);

      const atk = log.filter(e => e.k === 'atk4');
      if (atk.length) {
        const mode = atk[0].mode;
        row.mode = mode;
        const M = SEQ[mode];
        const pre = atk.filter(e => e.t < rel.t).pop();
        const post = atk.find(e => e.t >= rel.t);
        if (!post) { row.strike = 'ไม่มีเฟรมหลังปล่อย'; failStrike.push(label + ' ไม่มีเฟรมหลังปล่อย'); }
        else {
          const fiPost = frameAt(mode, post.p);
          if (M.hit.length) row.strike = { fiPost, ok: M.hit.includes(fiPost) };
          else {
            const fiPre = pre ? frameAt(mode, pre.p) : null;
            row.strike = { fiPre, fiPost, ok: fiPre !== null && fiPre !== fiPost && fiPost === 2 };
          }
          if (!row.strike.ok) failStrike.push(label + ' ' + JSON.stringify(row.strike));
        }
      }

      const pend = log.filter(e => e.k === 'pend' && e.t >= rel.t - 1e-9).map(e => e.d).sort((x, y) => x - y);
      const expD = c.key === 'b' ? [] : expectedDelays(sk).sort((x, y) => x - y);
      row.delays = { got: pend.map(d => +d.toFixed(3)), exp: expD.map(d => +d.toFixed(3)) };
      if (!sameList(pend, expD)) failDelay.push(label + ' ได้ ' + JSON.stringify(row.delays.got) + ' ควรได้ ' + JSON.stringify(row.delays.exp));

      if (c.key !== 'b') {
        const ch = log.find(e => e.k === 'fx' && /^cchart/.test(e.fk));
        row.chart = ch ? { fk: ch.fk, T: ch.T, a: ch.a } : null;
        const expA = RELEASE * P + firstHitDelay(sk);
        const chartOk = !!ch && typeof ch.a === 'number' && Math.abs(ch.a - expA) < 1e-6 && Math.abs(ch.T - (expA + 2 * BEAT)) < 1e-6;
        if (!chartOk) failChart.push(label + ' ' + JSON.stringify(row.chart) + ' ควร a=' + expA.toFixed(4));
      }
      detail.push(row);
    }

    rec('R1 ร่ายแล้วปล่อยที่ 0.6×poseT (ไม่เกิน 1 เฟรมหลังจุด) ทุกอาชีพ × ท่าพื้นฐาน + สกิล 3–11', failRel.length === 0,
      failRel.slice(0, 4).join(' · ') + (failRel.length > 4 ? ' … ' + failRel.length + ' รายการ' : '') || 'ครบ ' + perCast.length + ' ท่า');
    rec('R2 ท่าที่วาดจริงเป็นเฟรมปะทะ/ปล่อยตรงจุดปล่อยดาเมจ (โหมด sword/b5/s5/bow)', failStrike.length === 0,
      failStrike.slice(0, 4).join(' · ') + (failStrike.length > 4 ? ' … ' + failStrike.length + ' รายการ' : '') || 'ครบ');
    rec('R3 ดีเลย์ดาเมจหลังปล่อยตรงตามรูปแบบ (trap/pillar/rain/tri/spikes/multi)', failDelay.length === 0,
      failDelay.slice(0, 3).join(' · ') + (failDelay.length > 3 ? ' … ' + failDelay.length + ' รายการ' : '') || 'ครบ');
    rec('R4 เอฟเฟกต์ตารางของสกิล 3–11 เริ่มที่จุดยึดตรงดาเมจแรก (ทั้ง 8 อาชีพ)', failChart.length === 0,
      failChart.slice(0, 3).join(' · ') + (failChart.length > 3 ? ' … ' + failChart.length + ' รายการ' : '') || 'ครบ ' + detail.filter(r => r.key !== 'b').length + ' ท่า (ทิศลงและทิศข้าง)');
    rec('R5 ทุกท่ามีท่าโจมตีที่วาดจริงระหว่างร่าย', noBody.length === 0, noBody.join(' · ') || 'ครบ · ' + JSON.stringify(pathCount));
    const fallback = detail.filter(r => r.path !== 'drawAtk4');
    rec('R9 ทุกท่าวาดด้วยภาพท่าโจมตีจริง (ATK4) ตั้งแต่การโจมตีครั้งแรก ไม่ใช้ภาพสำรองของโค้ด', fallback.length === 0,
      fallback.slice(0, 4).map(r => r.cls + '/' + (r.key === 'b' ? 'พื้นฐาน' : r.key) + '/' + r.dir + ' ' + r.path).join(' · ') + (fallback.length > 4 ? ' … ' + fallback.length + ' ท่า' : '') || 'ครบ ' + detail.length + ' ท่า');

    // ภาพตารางโหลดแบบขี้เกียจ (เริ่มโหลดตอนเรียกครั้งแรก) จึงรอให้ครบทั้ง 2 ชุดของทุกอาชีพ
    let imgOk = true;
    try {
      await page.waitForFunction(list => list.every(c => { const r = window.__DRV.chartReady(c); return r.ud && r.e; }), CLASSES, { timeout: 8000, polling: 100 });
    } catch (e) { imgOk = false; }
    const imgs = await page.evaluate(list => list.map(c => ({ c, r: window.__DRV.chartReady(c) })), CLASSES);
    const missing = imgs.filter(x => !x.r.ud || !x.r.e).map(x => x.c);
    rec('R6 ภาพตารางเอฟเฟกต์ของทั้ง 8 อาชีพโหลดแล้ว (skfxud_ สำหรับทิศลง/ขึ้น และ skfx_ สำหรับทิศข้าง)', imgOk && missing.length === 0, missing.join(' · ') || 'ครบ');
    rec('R7 ไม่มี JavaScript error ตลอดการทดสอบ', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ไม่มี');
    rec('R8 ไม่มีภาพ/แผนที่/ไอคอนของเกมที่โหลดไม่ได้', missingAssets.length === 0, missingAssets.slice(0, 3).join(' | ') || 'ครบ');
    console.log('INFO ข้อความเครือข่ายจากการไม่มีเซิร์ฟเวอร์ออนไลน์: ' + netNoise.length + ' ข้อ (ไม่นับเป็นข้อผิดพลาด)');

    console.log('\nรายอาชีพ: ห่างจากจุด 0.6×poseT (ms) · โหมดหรือท่าที่วาดจริง');
    for (const cls of CLASSES) {
      const rows = detail.filter(r => r.cls === cls);
      const devs = rows.map(r => r.relDevMs).filter(v => v !== null);
      const modes = [...new Set(rows.map(r => r.mode || r.path))].join(', ');
      console.log('  ' + cls.padEnd(12) + (devs.length ? Math.min(...devs).toFixed(1) + ' … ' + Math.max(...devs).toFixed(1) : 'ไม่มีการปล่อย') + ' ms · ' + modes);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'attack_sync_r82_' + tag + '.json');
    fs.writeFileSync(outFile, JSON.stringify({ file: path.basename(file), tag, detail, errors }, null, 1));
    console.log('บันทึกผลรายท่า: ' + path.relative(process.cwd(), outFile));

    await captureSheets(page, ctx, tag);
    const passed = results.filter(Boolean).length;
    console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
    await browser.close();
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(passed === results.length ? 0 : 1);
  } catch (e) {
    await browser.close();
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
})().catch(e => { console.error(e); process.exit(1); });
