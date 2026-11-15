// ตรวจจังหวะท่าโจมตีและเอฟเฟกต์สกิลเทียบเวลาดาเมจ (รอบ 2 ส่วนที่ 2 / V2-R82)
// รัน: node tools/attack-timing-test.js        (ไม่ใช้เบราว์เซอร์ — อ่านโค้ดจริงจาก game/index.html, server/sim.js, shared/world.js)
// ครอบคลุม: 8 อาชีพ × ท่าพื้นฐาน + สกิลช่อง 3–11 (ช่อง 1–2 เป็นเคลื่อนที่/ป้องกัน ไม่มีดาเมจ)
// เวลาหน่วยวินาที · 1 เฟรม = 1/60 วินาที · RELEASE = จุดปล่อยท่า 0.6 × poseT (ฝั่งเกมและเซิร์ฟเวอร์ต้องเท่ากัน)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
// รัน: node tools/attack-timing-test.js [path-to-html]  — ค่าเริ่มต้น game/index.html (ใส่ไฟล์เดิมเพื่อเทียบก่อนแก้ได้)
const html = fs.readFileSync(path.resolve(process.argv[2] || path.join(root, 'game/index.html')), 'utf8');
const simSrc = fs.readFileSync(path.join(root, 'server/sim.js'), 'utf8');
const W = require(path.join(root, 'shared/world.js'));
const CFG = W.CFG;

const FRAME = 1 / 60;
const RELEASE = 0.6;
const BEAT = 0.2625; // ความยาวจังหวะละ 1/4 ของตารางเดิม 1.05 วิ
const CLASSES = ['นักดาบ', 'นักสู้', 'นักฆ่า', 'นักธนู', 'ผู้รักษา', 'ผู้พิทักษ์', 'ผู้สืบวิญญาณ', 'ผู้ใช้มนตรา'];
const SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11];

const results = [];
const rec = (name, pass, detail) => {
  results.push(!!pass);
  console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
};
const info = text => console.log('INFO ' + text);

// ดึงซอร์สของฟังก์ชันจาก index.html โดยนับวงเล็บ — ใช้โค้ดจริงของเกม ไม่คัดลอกมาเทียบเอง
function fnSource(name) {
  const s = html.indexOf('function ' + name + '(');
  if (s < 0) return null;
  let depth = 0;
  for (let i = html.indexOf('{', s); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(s, i + 1);
  }
  return null;
}
// บรรทัดเดียวที่ขึ้นต้นด้วย const NAME=
function lineSource(name) {
  const m = html.match(new RegExp('^const ' + name + '=.*$', 'm'));
  return m ? m[0] : null;
}
const evalLine = name => { const s = lineSource(name); return s ? new Function(s + '\nreturn ' + name + ';')() : null; };

const ATK4 = evalLine('ATK4');
const ATK4_SEQ = evalLine('ATK4_SEQ');
const atkMode = evalLine('atkMode');
const SKILL_FX = evalLine('SKILL_FX');
const SKILL_FXUD = evalLine('SKILL_FXUD');
const relSrc = fnSource('release') || '';
const updSrc = fnSource('updCast') || '';
const drawArtSrc = fnSource('drawArt') || '';

// ---------- A. จุดปล่อยท่าเท่ากันทั้งเกมและเซิร์ฟเวอร์ ----------
const clientRelease = /c\.sk\.poseT\s*\*\s*\.6/.test(updSrc);
const serverRelease = /sk\.poseT \* \.6/.test(simSrc);
rec('A จุดปล่อยท่า = 0.6 × poseT ทั้งฝั่งเกมและเซิร์ฟเวอร์', clientRelease && serverRelease,
  'เกม=' + clientRelease + ' เซิร์ฟเวอร์=' + serverRelease);

// ---------- B. เฟรมปะทะของท่าฟัน/ยิง เทียบจุดปล่อย ----------
// ค่าตรวจ: ท่าฟัน (sword/b5/s5) จุดปล่อยต้องอยู่ในช่วงเฟรมปะทะ (hit) · ท่าธนู (bow) ไม่มีเฟรมปะทะ
// ต้องให้เฟรมปล่อยสายเริ่มไม่เกิน 1 เฟรมก่อนจุดปล่อย
const seqFails = [];
const seqLines = [];
for (const cls of CLASSES) {
  const body = ATK4 && ATK4.body[cls];
  const n = body ? (body.m || body.f).n : 4; // นักดาบใช้ชุด pc_*_atk4 (4 เฟรม) โหมด sword
  const modeOf = key => (cls === 'นักดาบ' ? 'sword' : atkMode({ n }, key === 'b', cls));
  const keys = ['b', ...SLOTS];
  for (const key of keys) {
    const sk = key === 'b' ? CFG.basicFor(cls) : CFG.skillFor(cls, key);
    const P = sk.poseT;
    const mode = modeOf(key);
    const M = ATK4_SEQ && ATK4_SEQ[mode];
    if (!M) { seqFails.push(cls + '/' + key + ' ไม่มีโหมด ' + mode); continue; }
    const len = M.seq.length;
    const k = Math.floor(RELEASE * len);
    const fi = M.seq[k];
    let runStart = k;
    while (runStart > 0 && M.seq[runStart - 1] === fi) runStart--;
    let runEnd = k;
    while (runEnd < len - 1 && M.seq[runEnd + 1] === fi) runEnd++;
    if (M.hit.length) {
      const inHit = M.hit.includes(fi);
      const margin = ((runEnd + 1) / len - RELEASE) * P; // เวลาที่ผลดาเมจยังอยู่ในเฟรมปะทะได้อีก
      if (!inHit) seqFails.push(cls + '/' + key + ' จุดปล่อยตกที่เฟรม ' + fi + ' ไม่ใช่เฟรมปะทะ');
      seqLines.push([cls, key, mode, 'เฟรม ' + fi + ' ปะทะ', 'ช่วงที่เหลือ ' + (margin * 1000).toFixed(0) + ' ms']);
    } else {
      const lag = (RELEASE - runStart / len) * P; // เฟรมปล่อยเริ่มก่อนจุดปล่อยกี่วินาที
      if (lag > FRAME + 1e-9) seqFails.push(cls + '/' + key + ' ' + mode + ' เฟรมปล่อยเริ่มช้ากว่าจุดปล่อย ' + (lag * 1000).toFixed(0) + ' ms');
      seqLines.push([cls, key, mode, 'เฟรม ' + fi + ' ปล่อย', 'เริ่มช้า ' + (lag * 1000).toFixed(0) + ' ms']);
    }
  }
}
rec('B เฟรมปะทะ/ปล่อยของท่าโจมตีตรงกับจุดปล่อยดาเมจ (8 อาชีพ × ท่าพื้นฐาน + สกิล 3–11)', seqFails.length === 0,
  seqFails.slice(0, 6).join(' · ') + (seqFails.length > 6 ? ' … (' + seqFails.length + ' รายการ)' : '') || 'ครบ');
for (const row of seqLines.filter(r => r[1] === 'b' || r[1] === 3)) info('  ' + row.join(' | '));

// ---------- C. ดีเลย์ของดาเมจที่ออกหลังปล่อย: เกมกับเซิร์ฟเวอร์ต้องตรงกัน ----------
const simSnippet = name => { const s = simSrc.indexOf("case '" + name + "'"); return s < 0 ? '' : simSrc.slice(s, s + 400); };
const cChecks = [
  ['pillar .12', /shape==='pillar'[\s\S]*?t:\.12/.test(relSrc) && /later\(z, \.12/.test(simSnippet('pillar'))],
  ['rain .08+k·.09', /shape==='rain'[\s\S]*?t:\.08\+k\*\.09/.test(relSrc) && /later\(z, \.08 \+ k \* \.09/.test(simSnippet('rain'))],
  ['trap sk.delay', /shape==='trap'[\s\S]*?t:sk\.delay/.test(relSrc) && /later\(z, sk\.delay/.test(simSnippet('trap'))],
  ['tri .15/.3', /shape==='tri'[\s\S]*?t:\.15/.test(relSrc) && /later\(z, \.15/.test(simSnippet('tri'))],
  ['spikes k·.09', /shape==='spikes'[\s\S]*?t:k\*\.09/.test(relSrc) && /later\(z, k \* \.09/.test(simSnippet('spikes'))],
  ['multi k·.1', /shape==='multi'[\s\S]*?t:k\*\.1/.test(relSrc) && /later\(z, k \* \.1/.test(simSnippet('multi'))],
];
const cBad = cChecks.filter(c => !c[1]).map(c => c[0]);
rec('C ดีเลย์ดาเมจหลังปล่อยของทุกรูปแบบตรงกันทั้งเกมและเซิร์ฟเวอร์', cBad.length === 0,
  cBad.length ? 'ไม่ตรง: ' + cBad.join(', ') : cChecks.map(c => c[0]).join(' · '));

// ---------- D. จังหวะเอฟเฟกต์ตาราง: ปล่อย (เฟรม 3) ต้องเริ่มพร้อมดาเมจแรก ----------
// ดาเมจแรกหลังเริ่มร่าย: R = 0.6 × poseT + ดีเลย์ของรูปแบบ (trap = sk.delay, pillar .12, rain .08, อื่นๆ 0)
const firstHitDelay = sk => (sk.shape === 'trap' ? (sk.delay || 0) : sk.shape === 'pillar' ? 0.12 : sk.shape === 'rain' ? 0.08 : 0);
const beatLine = lineSource('CHART_BEAT');
const timingSrc = fnSource('chartTiming');
const beatSrc = fnSource('chartBeat');
let CT = null;
if (!beatLine || !timingSrc || !beatSrc) {
  rec('D เอฟเฟกต์ตารางตรงจังหวะปล่อย: มี chartTiming / chartBeat ในเกม', false,
    'ยังไม่มี — ตารางเอฟเฟกต์เล่นยาว 1.05 วิ เฟรม 3 (ปล่อย) เริ่มที่ 0.525 วิทุกสกิล ไม่ได้ยึดเวลาดาเมจ');
} else {
  CT = new Function('CFG', beatLine + '\n' + timingSrc + '\n' + beatSrc + '\nreturn { chartTiming, chartBeat, CHART_BEAT };')(CFG);
  const dFails = [];
  let maxSkew = 0;
  for (const cls of CLASSES) {
    for (const i of SLOTS) {
      const sk = CFG.skillFor(cls, i);
      const expA = RELEASE * sk.poseT + firstHitDelay(sk);
      const tm = CT.chartTiming(cls, i);
      if (Math.abs(tm.a - expA) > 1e-9) { dFails.push(cls + '/' + i + ' จุดปล่อย ' + tm.a.toFixed(3) + ' ≠ ' + expA.toFixed(3)); continue; }
      if (Math.abs(tm.T - (tm.a + 2 * CT.CHART_BEAT)) > 1e-9) dFails.push(cls + '/' + i + ' ความยาวไม่ตรงลำดับเฟรม');
      // ไล่เวลาจริงของการเล่น: เฟรม 3 ต้องเริ่มที่ a และมีความยาว 1 จังหวะ
      const step = 1 / 600;
      let start3 = null, end3 = null;
      for (let e = 0; e <= tm.T + 1e-9; e += step) {
        const fr = CT.chartBeat({ a: tm.a, T: tm.T, t: tm.T - e });
        if (fr === 3 && start3 === null) start3 = e;
        if (fr === 4 && start3 !== null && end3 === null) end3 = e;
      }
      if (start3 === null || Math.abs(start3 - tm.a) > step * 1.5) { dFails.push(cls + '/' + i + ' เฟรม 3 เริ่มที่ ' + (start3 ?? -1).toFixed(3)); continue; }
      maxSkew = Math.max(maxSkew, Math.abs(start3 - expA));
      if (end3 !== null && Math.abs((end3 - start3) - CT.CHART_BEAT) > step * 1.5) dFails.push(cls + '/' + i + ' เฟรม 3 ยาว ' + (end3 - start3).toFixed(3));
    }
  }
  rec('D เฟรม 3 (ปล่อย) ของเอฟเฟกต์ตารางเริ่มพร้อมดาเมจแรก (8 อาชีพ × สกิล 3–11)', dFails.length === 0,
    dFails.slice(0, 5).join(' · ') + (dFails.length > 5 ? ' … (' + dFails.length + ' รายการ)' : '') || 'คลาดเคลื่อนสูงสุด ' + (maxSkew * 1000).toFixed(1) + ' ms');
}
// ตัวเลขฐานของโค้ดเดิม (ไม่ขึ้นกับโค้ดใหม่) เพื่อเทียบ
info('ฐานเดิม: เฟรมปล่อยเริ่ม 0.525 วิ · ดาเมจแรกอยู่ระหว่าง ' + Math.min(...CLASSES.flatMap(c => SLOTS.map(i => RELEASE * CFG.skillFor(c, i).poseT + firstHitDelay(CFG.skillFor(c, i))))).toFixed(3) +
  ' ถึง ' + Math.max(...CLASSES.flatMap(c => SLOTS.map(i => RELEASE * CFG.skillFor(c, i).poseT + firstHitDelay(CFG.skillFor(c, i))))).toFixed(3) + ' วิ');

// ---------- E. ความครอบคลุมของภาพ: ทุกอาชีพมีภาพ/เอฟเฟกต์ครบ ----------
const coverFails = [];
for (const cls of CLASSES) {
  const fxudName = SKILL_FXUD && SKILL_FXUD.cls[cls];
  const fxName = SKILL_FX && SKILL_FX.cls[cls];
  if (!fxName || !fs.existsSync(path.join(root, 'game/sprites/skfx_' + fxName + '.webp'))) coverFails.push(cls + ' ไม่มี skfx_');
  if (!fxudName || !fs.existsSync(path.join(root, 'game/sprites/skfxud_' + fxudName + '.webp'))) coverFails.push(cls + ' ไม่มี skfxud_');
  const body = ATK4 && ATK4.body[cls];
  if (body) for (const g of ['m', 'f']) if (!fs.existsSync(path.join(root, 'game/sprites/pca_' + body[g].id + '.webp'))) coverFails.push('pca_' + body[g].id);
  if (cls === 'นักดาบ') for (const f of ['pc_m0_b_atk4', 'pc_m0_h_atk4', 'pc_f0_b_atk4', 'pc_f0_h_atk4']) if (!fs.existsSync(path.join(root, 'game/sprites/' + f + '.webp'))) coverFails.push(f);
}
rec('E ภาพครบ: ทุกอาชีพมี skfx_/skfxud_ และภาพท่าโจมตี (pca_*, pc_*_atk4)', coverFails.length === 0, coverFails.join(' · ') || 'ครบ');
const artNames = new Set([...drawArtSrc.matchAll(/case\s*'([a-z]+)'/g)].map(m => m[1]));
const artFails = [];
for (const cls of CLASSES) for (const i of SLOTS) {
  const art = CFG.skillFor(cls, i).art;
  if (art && !artNames.has(art)) artFails.push(cls + '/' + i + ' ' + art);
}
rec('E ภาพสำรองของทุกสกิลวาดได้ (art ทุกชื่อมีตัววาดใน drawArt)', artFails.length === 0, artFails.join(' · ') || 'ครบ ' + artNames.size + ' แบบ');

// ---------- สรุป ----------
const passed = results.filter(Boolean).length;
console.log('\nสรุป: ' + passed + '/' + results.length + ' ผ่าน');
process.exit(passed === results.length ? 0 : 1);
