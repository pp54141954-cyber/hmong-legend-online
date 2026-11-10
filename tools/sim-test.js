// ทดสอบตรรกะเซิร์ฟเวอร์ (server/sim.js) โดยไม่ใช้เบราว์เซอร์
// รัน: node tools/sim-test.js
const { createSim } = require('../server/sim.js');
const W = require('../shared/world.js');
const results = [];
const rec = (name, pass, detail) => { results.push({ name, pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const run = (sim, sec, t0) => { for (let k = 0; k < sec / .05; k++) sim.step(.05, t0 + k * .05); };
const PX = 752, PY = 464; // ทางเดินนอกเขตปลอดภัยของหมู่บ้าน

// BUG-008: ข้อความตำแหน่งจากเครื่องผู้เล่นมาถึงก่อนเซิร์ฟเวอร์คิดท่า → ต้องไม่ขยับซ้ำ
for (const [i, name, expectDx] of [[1, 'ท่าเคลื่อนที่', 80], [10, 'ก้าวหลบสวนคม', -52], [11, 'พริบตาสามคม', 40]]) {
  for (const early of [false, true]) {
    const sim = createSim({ rand: () => .5 });
    const p = { id: 1, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 30, jexp: 0 } };
    sim.addPlayer(p);
    sim.act(p, i, 100);
    if (early) { p.c.x = PX + expectDx; } // จำลอง mv จากเครื่องผู้เล่นที่ขยับแล้ว มาถึงก่อน
    run(sim, 1, 100);
    rec(name + (early ? ' (mv มาก่อน)' : ' (mv มาทีหลัง)') + ' ขยับครั้งเดียว', Math.abs(p.c.x - (PX + expectDx)) < 0.01, 'x=' + p.c.x + ' คาด ' + (PX + expectDx));
  }
}

// รางวัลและเลเวลอัปคิดบนเซิร์ฟเวอร์
{
  const sim = createSim({ rand: () => .5 });
  const p = { id: 1, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 1, jexp: 0 } };
  sim.addPlayer(p);
  sim.gain(p, W.CFG.expCurve(1) + 5, W.CFG.jobCurve(1));
  rec('EXP ถึงเกณฑ์ → Lv 2, HP เต็มตามสูตร', p.c.lv === 2 && p.c.exp === 5 && p.maxHp === W.CFG.player.baseHP + W.CFG.player.hpPerLv && p.hp === p.maxHp, JSON.stringify({ lv: p.c.lv, exp: p.c.exp, maxHp: p.maxHp }));
  rec('Job EXP ถึงเกณฑ์ → Job 2', p.c.job === 2 && p.c.jexp === 0);
}

// มอนสเตอร์ไม่ไล่ผู้เล่นในเขตปลอดภัย
{
  const sim = createSim();
  const z = sim.zones.village, s = W.ZONES.village.start;
  const p = { id: 1, c: { zone: 'village', x: s[0], y: s[1], dir: 'S', lv: 1, exp: 0, job: 1, jexp: 0 } };
  sim.addPlayer(p);
  const boar = z.mons.find(m => m.type === 'หมูป่า');
  Object.assign(boar, { x: s[0] + 40, y: s[1], hx: s[0] + 40, hy: s[1] });
  run(sim, 2, 0);
  rec('มอนสเตอร์ไม่ทำร้ายผู้เล่นในเขตปลอดภัย', p.hp === p.maxHp && boar.state !== 'chase');
}

const fail = results.filter(r => !r.pass).length;
console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน');
process.exit(fail ? 1 : 0);
