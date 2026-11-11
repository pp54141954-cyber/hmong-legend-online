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
    const p = { id: 1, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 30, jexp: 0, starter: 1 } };
    sim.addPlayer(p);
    sim.learn(p, W.CFG.skills[i - 1].name); // V2-R8: ท่ากดต้องอัประดับ 1 ก่อน
    rec(name + (early ? ' (mv มาก่อน)' : ' (mv มาทีหลัง)') + ' ใช้ท่าได้', sim.act(p, i, 100) === 'ok');
    if (early) { p.c.x = PX + expectDx; } // จำลอง mv จากเครื่องผู้เล่นที่ขยับแล้ว มาถึงก่อน
    run(sim, 1, 100);
    rec(name + (early ? ' (mv มาก่อน)' : ' (mv มาทีหลัง)') + ' ขยับครั้งเดียว', Math.abs(p.c.x - (PX + expectDx)) < 0.01, 'x=' + p.c.x + ' คาด ' + (PX + expectDx));
  }
}

// รางวัลและเลเวลอัปคิดบนเซิร์ฟเวอร์
{
  const sim = createSim({ rand: () => .5 });
  const p = { id: 1, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 1, jexp: 0, starter: 1 } };
  sim.addPlayer(p);
  sim.gain(p, W.CFG.expCurve(1) + 5, W.CFG.jobCurve(1));
  rec('EXP ถึงเกณฑ์ → Lv 2, HP เต็มตามสูตร', p.c.lv === 2 && p.c.exp === 5 && p.maxHp === W.CFG.player.baseHP + W.CFG.player.hpPerLv && p.hp === p.maxHp, JSON.stringify({ lv: p.c.lv, exp: p.c.exp, maxHp: p.maxHp }));
  rec('Job EXP ถึงเกณฑ์ → Job 2', p.c.job === 2 && p.c.jexp === 0);
}

// V2-R24 ชุดไอเทมเริ่มต้น: ตัวละครใหม่ได้ครั้งเดียว ใส่อุปกรณ์ให้ทันที
{
  const sim = createSim({ rand: () => .5 });
  const p = { id: 1, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 1, jexp: 0 } };
  sim.addPlayer(p);
  const S = W.CFG.starter, w = W.CFG.items[S.eq.weapon], a = W.CFG.items[S.eq.armor];
  rec('ชุดเริ่มต้น: ใส่ดาบไม้ + เสื้อผ้าฝ้ายให้ทันที (ATK/HP เพิ่มตาม)', p.c.eq.weapon === S.eq.weapon && p.c.eq.armor === S.eq.armor && p.atk === W.CFG.player.baseAtk + w.atk && p.maxHp === W.CFG.player.baseHP + a.hp && p.def === a.def, JSON.stringify({ eq: p.c.eq, atk: p.atk, hp: p.maxHp, def: p.def }));
  rec('ชุดเริ่มต้น: ยาเข้ากระเป๋าครบ + แจ้งผู้เล่น', S.bag.every(([id, n]) => p.c.bag.some(s => s.id === id && s.n === n)) && p.c.starter === 1 && p.personal.some(e => e.k === 'starter'), JSON.stringify(p.c.bag));
  const p2 = { id: 2, c: Object.assign({}, p.c, { bag: p.c.bag.map(s => Object.assign({}, s)), eq: Object.assign({}, p.c.eq) }) };
  sim.removePlayer && sim.removePlayer(p); sim.addPlayer(p2);
  rec('ชุดเริ่มต้น: เข้าเกมครั้งถัดไปไม่ได้ซ้ำ', p2.c.bag.length === p.c.bag.length && !p2.personal.some(e => e.k === 'starter'));
  const p3 = { id: 3, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 5, exp: 0, job: 1, jexp: 0, eq: { weapon: 'sword_iron' }, bag: [] } };
  sim.addPlayer(p3);
  rec('ชุดเริ่มต้น: ตัวละครเก่าที่ถือดาบอยู่แล้ว → ไม่ถอดของเดิม ดาบไม้เข้ากระเป๋าแทน', p3.c.eq.weapon === 'sword_iron' && p3.c.bag.some(s => s.id === 'sword_wood'));
}

// V2-R25 แต้มสเตตัส: เซิร์ฟเวอร์ตรวจแต้ม คำนวณค่าเอง
{
  const sim = createSim({ rand: () => .5 }), P = W.CFG.player;
  const p = { id: 1, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 5, exp: 0, job: 1, jexp: 0, starter: 1 } };
  sim.addPlayer(p);
  rec('Lv 5 มีแต้มสเตตัส 12 (3 ต่อเลเวล)', sim.statFree(p) === 12, sim.statFree(p));
  const a0 = p.atk, h0 = p.maxHp, sp0 = p.bon.spd, cr0 = p.bon.crit;
  rec('เพิ่ม STR 4 → ATK +4', sim.statOp(p, 'up', 'str', 4) === 'ok' && p.atk === a0 + 4, p.atk);
  rec('เพิ่ม VIT 4 → HP สูงสุด +16, DEF +1', sim.statOp(p, 'up', 'vit', 4) === 'ok' && p.maxHp === h0 + 16 && p.def === 1, p.maxHp + ' DEF ' + p.def);
  sim.statOp(p, 'up', 'agi', 2); sim.statOp(p, 'up', 'luk', 2);
  rec('AGI 2 / LUK 2 → ความเร็ว +0.8% คริ +0.5% (รวมในโบนัสที่เซิร์ฟเวอร์ใช้)', Math.abs(p.bon.spd - sp0 - .008) < 1e-9 && Math.abs(p.bon.crit - cr0 - .005) < 1e-9);
  rec('แต้มหมด → ปฏิเสธ', sim.statFree(p) === 0 && sim.statOp(p, 'up', 'str', 1) === 'no-points' && p.c.st.str === 4);
  rec('ค่าสเตตัสปลอม (ไม่มีในรายการ) → ปฏิเสธ', sim.statOp(p, 'up', 'hack', 1) === 'invalid' && sim.statOp(p, 'up', '__proto__', 1) === 'invalid');
  rec('รีเซ็ต → แต้มคืนครบ ค่ากลับเท่าเดิม', sim.statOp(p, 'reset') === 'ok' && sim.statFree(p) === 12 && p.atk === a0 && p.maxHp === h0);
  sim.gain(p, W.CFG.expCurve(5), 0);
  rec('เลเวลอัป → แต้ม +3', p.c.lv === 6 && sim.statFree(p) === 15, sim.statFree(p));
  const q = { id: 2, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 2, exp: 0, job: 1, jexp: 0, starter: 1, st: { str: 50, vit: -3 } } };
  sim.addPlayer(q);
  const h = { id: 3, c: { zone: 'village', x: PX, y: PY, dir: 'E', lv: 100, exp: 0, job: 1, jexp: 0, starter: 1 } }; sim.addPlayer(h);
  for (let i = 0; i < 10; i++) sim.statOp(h, 'up', 'str', 10);
  rec('เพดาน 99 ต่อค่า: ลง 10×10 ได้แค่ 90 (ครั้งที่ 10 เกิน 99 ถูกปฏิเสธ)', h.c.st.str === 90, h.c.st.str);
  sim.statOp(h, 'up', 'str', 9); rec('ลงครบ 99 แล้วกดอีก → max', h.c.st.str === 99 && sim.statOp(h, 'up', 'str', 1) === 'max', h.c.st.str);
  rec('ข้อมูลแต้มเกินที่มี (แก้ฐานข้อมูล) → รีเซ็ตเป็น 0', q.c.st.str === 0 && sim.statFree(q) === 3, JSON.stringify(q.c.st));
}

// V2-R27 อาชีพ + แอดมิน
{
  const sim = createSim({ rand: () => .5 }), V = W.ZONES.village2, F = W.ZONES.field2;
  const p = { id: 1, c: { zone: 'village2', x: V.start[0], y: V.start[1], dir: 'S', lv: 30, exp: 0, job: 30, jexp: 0, starter: 1 } };
  sim.addPlayer(p);
  rec('อาชีพ: มี 8 อาชีพ ตัวละครเดิม = นักดาบ', sim.CLASSES.length === 8 && sim.clsOf(p) === 'นักดาบ', sim.CLASSES.join(','));
  rec('อาชีพ: ชื่อปลอม → ปฏิเสธ', sim.setClass(p, 'hacker') === 'invalid');
  { const n = { id: 9, c: { zone: 'field2', x: F.start[0], y: F.start[1], dir: 'S', lv: 1, exp: 0, job: 1, jexp: 0, starter: 1 } }; sim.addPlayer(n);
    rec('เลือกอาชีพครั้งแรก: ตัวละครใหม่เลือกได้แม้อยู่นอกหมู่บ้าน', sim.setClass(n, 'ผู้รักษา', true) === 'ok' && n.c.cls === 'ผู้รักษา' && n.c.clsset === 1 && n.personal.some(e => e.k === 'cls' && e.first));
    rec('เลือกอาชีพครั้งแรกซ้ำ → ปฏิเสธ (ใช้ข้ามกฎหมู่บ้านไม่ได้)', sim.setClass(n, 'นักฆ่า', true) === 'already' && n.c.cls === 'ผู้รักษา');
    rec('หลังเลือกแล้ว เปลี่ยนนอกหมู่บ้านไม่ได้', sim.setClass(n, 'นักฆ่า') === 'not-safe');
    rec('หน้าตาเริ่มต้น = ชาย ผมดำ ชุดดำ-แดง', JSON.stringify(n.c.look) === '{"g":"m","hair":0,"outfit":0}');
    rec('ตั้งหน้าตา: หญิง ผมขาวเงิน ชุดม่วง-ทอง', sim.setLook(n, { g: 'f', hair: 3, outfit: 3 }) === 'ok' && n.c.look.g === 'f' && n.c.look.hair === 3 && n.personal.some(e => e.k === 'look'));
    rec('ทรงผม/แบบชุด: เลือกได้ (hs/of) และค่าเกินช่วงถูกปฏิเสธ', sim.setLook(n, { g: 'f', hair: 3, outfit: 3, hs: 2, of: 1 }) === 'ok' && n.c.look.hs === 2 && n.c.look.of === 1 && sim.setLook(n, { g: 'f', hair: 0, outfit: 0, hs: 99, of: 0 }) === 'invalid' && sim.setLook(n, { g: 'f', hair: 0, outfit: 0, hs: 0, of: -2 }) === 'invalid' && n.c.look.hs === 2);
    rec('หน้าตาแบบเก่า (ไม่มี hs/of) ยังรับได้ → ทรงผม/ชุดพื้นฐาน', sim.setLook(n, { g: 'f', hair: 3, outfit: 3 }) === 'ok' && n.c.look.hs === 0 && n.c.look.of === 0);
    rec('ค่าหน้าตาผิด (เพศ/สีเกินช่วง/ไม่ใช่ตัวเลข) → ปฏิเสธ', ['x', null, { g: 'x', hair: 0, outfit: 0 }, { g: 'm', hair: 99, outfit: 0 }, { g: 'm', hair: 1.5, outfit: 0 }, { g: 'f', hair: 0, outfit: -1 }].every(l => sim.setLook(n, l) === 'invalid') && n.c.look.hair === 3); }
  const q = { id: 2, c: { zone: 'field2', x: F.start[0], y: F.start[1], dir: 'S', lv: 30, exp: 0, job: 30, jexp: 0, starter: 1 } }; sim.addPlayer(q);
  rec('อาชีพ: นอกเขตปลอดภัย → เปลี่ยนไม่ได้', sim.setClass(q, 'นักธนู') === 'not-safe' && sim.clsOf(q) === 'นักดาบ');
  sim.learn(p, 'ลงอาคมคมดาบ'); const swordPts = sim.freePoints(p);
  rec('อาชีพ: ในหมู่บ้าน → เปลี่ยนเป็นนักธนูได้ + แจ้งผู้เล่น', sim.setClass(p, 'นักธนู') === 'ok' && p.c.cls === 'นักธนู' && p.personal.some(e => e.k === 'cls'));
  rec('อาชีพ: แต้มสกิลของอาชีพใหม่เต็ม (ระดับสกิลแยกตามอาชีพ)', sim.freePoints(p) === swordPts + 1, sim.freePoints(p) + ' vs ' + swordPts);
  rec('อาชีพ: ท่ากดช่อง 3 ของนักธนู (ศรเจาะจุดอ่อน) ยังไม่อัป → ล็อก', sim.act(p, 3, 100) === 'locked');
  rec('อาชีพ: อัปสกิลนักดาบตอนเป็นนักธนู → ไม่ได้', sim.learn(p, 'ฟันแยกศิลา') === 'invalid');
  rec('อาชีพ: อัปศรเจาะจุดอ่อน → ใช้ท่าช่อง 3 ได้ (กลไกชั่วคราว)', sim.learn(p, 'ศรเจาะจุดอ่อน') === 'ok' && sim.act(p, 3, 200) === 'ok');
  const a0 = p.atk; sim.learn(p, 'สายตาพราน'); // สกิลติดตัวของนักธนู (ถ้ามี)
  sim.setClass(p, 'นักดาบ');
  rec('อาชีพ: กลับเป็นนักดาบ → ระดับสกิลเดิมยังอยู่', sim.clsOf(p) === 'นักดาบ' && sim.skLv(p, 'ลงอาคมคมดาบ') === 1 && sim.skLv(p, 'ศรเจาะจุดอ่อน') === 1);
  // แอดมิน
  rec('แอดมิน: ตั้งเลเวล 50 → แต้มสเตตัสคำนวณใหม่, HP เต็ม', sim.admin(p, 'lv', { n: 50 }) === 'ok' && p.c.lv === 50 && p.hp === p.maxHp && sim.statFree(p) === 147);
  rec('แอดมิน: ค่าเลเวลเกิน → ปฏิเสธ', sim.admin(p, 'lv', { n: 999 }) === 'invalid' && p.c.lv === 50);
  rec('แอดมิน: ให้ไอเทม', sim.admin(p, 'item', { id: 'sword_iron', n: 2 }) === 'ok' && p.c.bag.filter(s => s.id === 'sword_iron').length === 2);
  rec('แอดมิน: ไอเทมปลอม → ปฏิเสธ', sim.admin(p, 'item', { id: 'gold_bar', n: 1 }) === 'invalid');
  sim.admin(q, 'god', {}); const h = q.hp, z = sim.zones.field2, m = z.mons.find(m => !m.c.boss);
  Object.assign(m, { x: q.c.x + 20, y: q.c.y, hx: q.c.x + 20, hy: q.c.y, state: 'idle', atkT: 0 }); run(sim, 3, 300);
  rec('แอดมิน: โหมดอมตะ → ไม่เสีย HP', q.god && q.hp === h, q.hp + '/' + h);
  rec('แอดมิน: ล้างมอนสเตอร์ในโซน', sim.admin(q, 'clear', {}) === 'ok' && z.mons.filter(m => !m.c.boss).every(m => m.state === 'dead'));
  rec('แอดมิน: เปลี่ยนเวลาเป็นพระจันทร์เลือด', sim.admin(q, 'time', { mode: 'blood' }) === 'ok' && sim.WT.blood);
  rec('แอดมิน: เปลี่ยนเวลาเป็นกลางวัน', sim.admin(q, 'time', { mode: 'day' }) === 'ok' && !sim.WT.night);
  const pk = { id: 3, c: { zone: 'peak', x: 0, y: 0, dir: 'S', lv: 50, exp: 0, job: 30, jexp: 0, starter: 1 } }; sim.addPlayer(pk);
  rec('แอดมิน: เรียกบอสในโซน (นอกเวลา) → บอสอยู่จนตาย', sim.admin(pk, 'boss', {}) === 'ok' && sim.zones.peak.mons.filter(m => m.c.boss).every(m => m.state === 'idle' && !m.away), sim.zones.peak.mons.filter(m => m.c.boss).map(m => m.type + ':' + m.state).join(','));
  run(sim, 1, 400);
  rec('แอดมิน: บอสที่เรียกไม่ถูกซ่อนตามเวลา', sim.zones.peak.mons.filter(m => m.c.boss).every(m => m.state !== 'dead'));
}

// V2-R36 สกิลจริงทุกอาชีพ: ทุกช่อง 3–11 ใช้ได้ และทำดาเมจ/ฟื้น HP/บัฟ/ป้องกัน ตามแบบท่า
{
  const ROWS = W.SKILL_TABLE, CL = [...new Set(ROWS.map(r => r[0]))], bad = [];
  for (const cls of CL) {
    const names = ROWS.filter(r => r[0] === cls && r[3] === 'a' && r[2] !== 'ท่าพื้นฐาน').map(r => r[2]);
    for (let i = 3; i <= 11; i++) {
      const sim = createSim({ rand: () => .5 }), z = sim.zones.field2, s0 = W.ZONES.field2.start;
      const p = { id: 1, c: { zone: 'field2', x: s0[0], y: s0[1], dir: 'E', lv: 40, exp: 0, job: 30, jexp: 0, starter: 1, cls, clsset: 1 } };
      sim.addPlayer(p); p.c.sk[names[i - 1]] = 1; sim.stats(p); p.hp = Math.round(p.maxHp * .3);
      for (const m of z.mons) { m.state = 'dead'; m.respT = 1e9; }
      const sk = W.CFG.skillFor(cls, i), far = sk.dist ? sk.dist : sk.shape === 'shot' || sk.shape === 'wave' ? 120 : 30;
      const m = z.mons.find(m => !m.c.boss); Object.assign(m, { state: 'idle', hp: 1e6, x: p.c.x + far, y: p.c.y + (sk.dist ? 14 : 0) + m.c.size * .6 - 14 + 14, hx: p.c.x + far, hy: p.c.y, respT: 0, target: null, atkT: 99 });
      m.y = p.c.y + (sk.dist ? 14 : 0); const hp0 = p.hp, r = sim.act(p, i, 100); run(sim, 2, 100);
      const dmg = 1e6 - m.hp, ok = r === 'ok' && (sk.shape === 'heal' ? p.hp > hp0 : sk.shape === 'buff' ? p.buffT > 0 : sk.shape === 'guard' ? p.guardT > 0 : dmg > 0);
      if (!ok) bad.push(cls + '#' + i + ' ' + names[i - 1] + ' (' + sk.shape + ') r=' + r + ' dmg=' + Math.round(dmg) + ' hp ' + hp0 + '→' + Math.round(p.hp));
    }
  }
  rec('ทุกอาชีพ ทุกสกิล (8×9 = 72 ท่า) ใช้ได้และมีผลจริงบนเซิร์ฟเวอร์', bad.length === 0, bad.slice(0, 6).join(' | '));
  const sim = createSim({ rand: () => .5 }), s0 = W.ZONES.field2.start;
  const h = { id: 1, c: { name: 'H', zone: 'field2', x: s0[0], y: s0[1], dir: 'E', lv: 30, exp: 0, job: 30, jexp: 0, starter: 1, cls: 'ผู้รักษา', clsset: 1 } };
  const f = { id: 2, c: { name: 'F', zone: 'field2', x: s0[0] + 60, y: s0[1], dir: 'E', lv: 30, exp: 0, job: 30, jexp: 0, starter: 1, clsset: 1 } };
  const far = { id: 3, c: { name: 'X', zone: 'field2', x: s0[0] + 900, y: s0[1], dir: 'E', lv: 30, exp: 0, job: 30, jexp: 0, starter: 1, clsset: 1 } };
  for (const q of [h, f, far]) sim.addPlayer(q);
  sim.party(h, 'invite', 'F', 0); sim.party(f, 'accept', null, 0); sim.party(h, 'invite', 'X', 0); sim.party(far, 'accept', null, 0);
  h.c.sk['ประคองชีวิต'] = 1; for (const q of [h, f, far]) q.hp = 10; sim.act(h, 3, 100); run(sim, 1, 100);
  rec('ผู้รักษา: ฮีลตัวเอง + เพื่อนปาร์ตี้ในรัศมี (คนที่อยู่ไกลไม่ได้)', h.hp > 10 && f.hp > 10 && far.hp === 10, [h.hp, f.hp, far.hp].join('/'));
  const a = { id: 9, c: { zone: 'field2', x: s0[0], y: s0[1], dir: 'E', lv: 30, exp: 0, job: 30, jexp: 0, starter: 1, cls: 'นักธนู', clsset: 1 } }; sim.addPlayer(a);
  rec('นักธนู: ท่าพื้นฐานเป็นยิงธนูระยะไกล (ไม่ใช่ฟันดาบ)', W.CFG.basicFor('นักธนู').shape === 'shot' && W.CFG.basicFor('นักธนู').range >= 200 && W.CFG.basicFor('นักดาบ').shape !== 'shot');
}

// มอนสเตอร์ไม่ไล่ผู้เล่นในเขตปลอดภัย
{
  const sim = createSim();
  const z = sim.zones.village, s = W.ZONES.village.start;
  const p = { id: 1, c: { zone: 'village', x: s[0], y: s[1], dir: 'S', lv: 1, exp: 0, job: 1, jexp: 0, starter: 1 } };
  sim.addPlayer(p);
  const boar = z.mons.find(m => m.type === 'หมูป่า');
  Object.assign(boar, { x: s[0] + 40, y: s[1], hx: s[0] + 40, hy: s[1] });
  run(sim, 2, 0);
  rec('มอนสเตอร์ไม่ทำร้ายผู้เล่นในเขตปลอดภัย', p.hp === p.maxHp && boar.state !== 'chase');
}

// ---------- V2-R4 กระเป๋า ของดรอป อุปกรณ์ ----------
const mkP = (sim, extra) => { const p = { id: 1, c: Object.assign({ zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 1, jexp: 0, starter: 1 }, extra) }; sim.addPlayer(p); return p; };
const killFirst = (sim, p, type) => {
  const z = sim.zones.village, m = z.mons.find(m => m.type === type && m.state !== 'dead');
  Object.assign(m, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, wx: PX + 20, wy: PY, t: 99, hp: 1, state: 'idle' });
  sim.act(p, 'b', 500); run(sim, .5, 500); return m;
};
{
  const sim = createSim({ rand: () => 0 }), p = mkP(sim);
  const m = killFirst(sim, p, 'กระต่ายมีเขา');
  const want = W.CFG.drops['กระต่ายมีเขา'].map(r => r[0]).sort().join(',');
  rec('โอกาสดรอปผ่านทุกแถว → ได้ของครบตามตาราง', m.state === 'dead' && p.c.bag.map(s => s.id).sort().join(',') === want, p.c.bag.map(s => s.id).join(','));
  rec('มีเหตุการณ์ loot ส่งให้เครื่องผู้เล่น', p.personal.filter(e => e.k === 'loot').length === W.CFG.drops['กระต่ายมีเขา'].length);
}
{
  const sim = createSim({ rand: () => .999 }), p = mkP(sim);
  killFirst(sim, p, 'กระต่ายมีเขา');
  rec('โอกาสดรอปไม่ผ่าน → ไม่ได้ของ', p.c.bag.length === 0);
}
{
  const sim = createSim(), p = mkP(sim);
  sim.addItem(p, 'hide', 150);
  rec('วัตถุดิบซ้อนได้ช่องละ 99', p.c.bag.length === 2 && p.c.bag[0].n === 99 && p.c.bag[1].n === 51, JSON.stringify(p.c.bag));
  for (let i = 0; i < 40; i++) sim.addItem(p, 'sword_wood', 1);
  const got = sim.addItem(p, 'sword_iron', 1);
  rec('กระเป๋าเต็ม 30 ช่อง → ใส่ไม่ได้ และแจ้ง bagfull', p.c.bag.length === 30 && got === 0 && p.personal.some(e => e.k === 'bagfull'));
}
{
  const sim = createSim(), p = mkP(sim), atk0 = p.atk, hp0 = p.maxHp;
  sim.addItem(p, 'sword_iron', 1); sim.addItem(p, 'coat_cloth', 1);
  const r1 = sim.inv(p, 'equip', 0, 0);
  rec('ใส่ดาบเหล็ก → ATK +10 และออกจากกระเป๋า', r1 === 'ok' && p.atk === atk0 + 10 && p.c.eq.weapon === 'sword_iron' && p.c.bag.length === 1);
  sim.addItem(p, 'sword_wood', 1);
  sim.inv(p, 'equip', 1, 0);
  rec('ใส่ดาบไม้แทน → สลับดาบเหล็กกลับเข้ากระเป๋า ATK +4', p.c.eq.weapon === 'sword_wood' && p.atk === atk0 + 4 && p.c.bag.some(s => s.id === 'sword_iron'));
  sim.inv(p, 'equip', p.c.bag.findIndex(s => s.id === 'coat_cloth'), 0);
  rec('ใส่เสื้อผ้าฝ้าย → HP สูงสุด +20 DEF 2', p.maxHp === hp0 + 20 && p.def === 2);
  rec('ถอดเสื้อ → HP สูงสุดกลับ และ HP ไม่เกินสูงสุด', sim.inv(p, 'unequip', 'armor', 0) === 'ok' && p.maxHp === hp0 && p.hp <= p.maxHp && p.c.bag.some(s => s.id === 'coat_cloth'));
  rec('สั่งใส่วัตถุดิบ / ช่องว่าง / ช่องอุปกรณ์ปลอม → ปฏิเสธ', (sim.addItem(p, 'hide', 1), sim.inv(p, 'equip', p.c.bag.findIndex(s => s.id === 'hide'), 0)) === 'not-equip' && sim.inv(p, 'equip', 99, 0) === 'empty' && sim.inv(p, 'unequip', '__proto__', 0) === 'empty');
}
{
  const sim = createSim(), p = mkP(sim);
  sim.addItem(p, 'potion_s', 2);
  rec('HP เต็มใช้ยาไม่ได้', sim.inv(p, 'use', 0, 10) === 'hp-full' && p.c.bag[0].n === 2);
  p.hp = 10;
  const r = sim.inv(p, 'use', 0, 10);
  rec('ใช้ยา → ฟื้น 40 และยาลด 1', r === 'ok' && p.hp === 50 && p.c.bag[0].n === 1);
  rec('ใช้ยาซ้ำภายใน 1 วินาที → ติดคูลดาวน์', sim.inv(p, 'use', 0, 10.5) === 'cooldown');
  rec('ใช้ยาขวดสุดท้าย → ช่องหายจากกระเป๋า', sim.inv(p, 'use', 0, 11.2) === 'ok' && p.c.bag.length === 0);
  p.dead = true;
  sim.addItem(p, 'potion_s', 1);
  rec('ตายอยู่ใช้ของไม่ได้', sim.inv(p, 'use', 0, 20) === 'dead');
}
{
  // เกราะลดดาเมจ: หมาป่า ATK 11 (rand=.5 → ดาเมจฐาน 11) ใส่เสื้อหนัง DEF 5 → 6
  const hitBy = def => {
    const sim = createSim({ rand: () => .5 }), p = mkP(sim, { eq: def ? { armor: 'coat_leather' } : {} });
    const z = sim.zones.village, wolf = z.mons.find(m => m.type === 'กระต่ายมีเขา');
    wolf.c = W.CFG.monsters['หมาป่า'];
    Object.assign(wolf, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, state: 'chase', target: p, atkT: 0 });
    const h0 = p.hp; run(sim, .1, 0); return h0 - p.hp;
  };
  const a = hitBy(false), b = hitBy(true);
  const WA = W.CFG.monsters['หมาป่า'].atk; // V2-R21: ค่าจากสูตรสมดุล
  rec('เกราะ DEF 5 ลดดาเมจหมาป่าลง 5 (' + WA + ' → ' + (WA - 5) + ')', a === WA && b === WA - 5, 'ไม่ใส่=' + a + ' ใส่=' + b);
}

// ---------- V2-R8 แต้มอัปสกิลจากตาราง CSV ----------
{
  const sim = createSim(), p = mkP(sim);
  rec('Job 1: แต้มสกิล 1 แต้ม, สกิลเริ่มต้น 3 ท่าได้ระดับ 1 ฟรี', sim.freePoints(p) === 1 && sim.skLv(p, 'ท่าพื้นฐาน') === 1 && sim.skLv(p, 'ท่าเคลื่อนที่') === 1 && sim.skLv(p, 'ท่าป้องกัน') === 1);
  rec('อัปสกิลที่ยังไม่ถึง Job → ปฏิเสธ', sim.learn(p, 'ลงอาคมคมดาบ') === 'locked');
  rec('ชื่อสกิลที่ไม่มีในตาราง → ปฏิเสธ', sim.learn(p, 'ท่าปลอม') === 'invalid');
  rec('อัปสกิลติดตัว Job 1 ได้ แต้มเหลือ 0', sim.learn(p, 'คมดาบลงยันต์') === 'ok' && sim.freePoints(p) === 0);
  rec('แต้มหมด → ปฏิเสธ', sim.learn(p, 'กำลังขุนเขา') === 'no-points');
  p.c.job = 50;
  rec('Job 50: แต้มรวมสูงสุด 50 (ใช้ไป 1 เหลือ 49)', sim.freePoints(p) === 49);
  for (let i = 0; i < 9; i++) sim.learn(p, 'คมดาบลงยันต์');
  rec('อัปเกินระดับสูงสุด (10) → ปฏิเสธ', sim.skLv(p, 'คมดาบลงยันต์') === 10 && sim.learn(p, 'คมดาบลงยันต์') === 'max');
}
{
  const sim = createSim({ rand: () => .5 }), p = mkP(sim, { lv: 30, job: 30 });
  sim.stats(p); const atk0 = p.atk, hp0 = p.maxHp;
  for (let i = 0; i < 10; i++) { sim.learn(p, 'คมดาบลงยันต์'); }
  for (let i = 0; i < 10; i++) { sim.learn(p, 'กำลังขุนเขา'); }
  rec('โบนัสชื่อเดียวกันบวกข้ามสาย: พลังโจมตีกายภาพ 2%×20 = +40%', p.atk === Math.round(atk0 * 1.4), atk0 + '→' + p.atk);
  for (let i = 0; i < 5; i++) sim.learn(p, 'ร่างแกร่งดั่งผา');
  rec('พลังชีวิตสูงสุด +2%×5', p.maxHp === Math.round(hp0 * 1.1), hp0 + '→' + p.maxHp);
}
{
  // ท่ากดต้องอัปก่อนใช้; ความเสียหายสกิล % มีผลกับสกิลแต่ไม่มีผลกับท่าพื้นฐาน
  const hit = (learnDmg, key) => {
    const sim = createSim({ rand: () => .5 }), p = mkP(sim, { job: 30 });
    if (key !== 'b') sim.learn(p, W.CFG.skills[key - 1].name);
    if (learnDmg) { for (let i = 0; i < 3; i++) sim.learn(p, 'แก่นดาบวิญญาณ'); }
    const z = sim.zones.village, m = z.mons.find(m => m.type === 'หมูป่า');
    Object.assign(m, { x: PX + 30, y: PY + 14, hx: PX + 30, hy: PY + 14, wx: PX + 30, wy: PY + 14, t: 99, hp: 999, state: 'idle' });
    const r = sim.act(p, key, 100); run(sim, 1, 100); return { r, dmg: 999 - m.hp };
  };
  const sim0 = createSim(), p0 = mkP(sim0, { job: 30 });
  rec('ท่ากดที่ยังไม่อัป (ระดับ 0) ใช้ไม่ได้ แม้ Job ถึง', sim0.act(p0, 8, 1) === 'locked');
  const a = hit(false, 8), b = hit(true, 8), c = hit(false, 'b'), d = hit(true, 'b');
  rec('ความเสียหายสกิล +6% เพิ่มดาเมจท่า "ดาบทลายขุนเขา"', a.r === 'ok' && b.dmg > a.dmg, a.dmg + '→' + b.dmg);
  rec('ความเสียหายสกิลไม่มีผลกับท่าพื้นฐาน', c.dmg === d.dmg && c.dmg > 0, c.dmg + ' = ' + d.dmg);
}
{
  const sim = createSim(), p = mkP(sim, { job: 30 });
  sim.learn(p, 'ลงอาคมคมดาบ');
  for (let i = 0; i < 5; i++) sim.learn(p, 'จังหวะไร้ช่องว่าง');
  for (let i = 0; i < 5; i++) sim.learn(p, 'อาคมต่อเนื่อง');
  sim.act(p, 3, 100); run(sim, .5, 100);
  const sk = W.CFG.skills[2];
  rec('ความเร็วฟื้นคูลดาวน์ 1%×5 → คูลดาวน์สั้นลง 5%', Math.abs((p.cd[3] - 100) - sk.cd * .95) < 1e-9, (p.cd[3] - 100).toFixed(2) + ' วิ (เดิม ' + sk.cd + ')');
  rec('ระยะเวลาบัฟ 2%×5 → บัฟนานขึ้น 10%', Math.abs(p.buffT - (sk.dur * 1.1 - (0.5 - sk.poseT * .6))) < .06, p.buffT.toFixed(2) + ' วิ');
}
{
  // โอกาสคริติคอล: rand=0.15 ปกติไม่คริ (ต้อง <0.10); +1%×10 → เกณฑ์ 0.20 → คริ
  const one = learnCrit => {
    const sim = createSim({ rand: () => .15 }), p = mkP(sim, { job: 30 });
    if (learnCrit) for (let i = 0; i < 5; i++) { sim.learn(p, 'จิตประสานคม'); sim.learn(p, 'คมดาบแม่นยำ'); }
    const z = sim.zones.village, m = z.mons.find(m => m.type === 'หมูป่า');
    Object.assign(m, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, wx: PX + 20, wy: PY, t: 99, hp: 999, state: 'idle' });
    sim.act(p, 'b', 100); run(sim, .5, 100);
    return sim.zones.village.events.find(e => e.k === 'dmg');
  };
  const n = one(false), c = one(true);
  rec('โอกาสคริติคอล +10% (2 สกิลบวกกัน) ทำให้คริได้', n && !n.crit && c && c.crit);
}

// ---------- V2-R16 กลางวัน/กลางคืน/คืนพระจันทร์สีเลือด/บอส ----------
{
  const C = W.CFG.time, wc = W.CFG.worldClock;
  const day = wc(C.cycleSec * 1 + 10), night = wc(C.cycleSec * 1 + C.cycleSec * C.dayFrac + 10), blood = wc(C.cycleSec * 3 + C.cycleSec * C.dayFrac + 10);
  rec('นาฬิกา: กลางวัน / กลางคืน / ทุกคืนที่ 3 = พระจันทร์สีเลือด', !day.night && night.night && !night.blood && blood.blood, [day.name, night.name, blood.name].join(' · '));
  rec('World Boss เปิด ' + C.worldWindow + ' วิ ทุก ' + C.worldEvery + ' วิ', wc(10).world && !wc(C.worldWindow + 10).world && wc(C.worldEvery + 5).world);
  // เวลาที่ใช้ทดสอบ (ไม่ใช่ช่วง World Boss): กลางวัน / กลางคืนธรรมดา / คืนเลือด
  const T_DAY = C.cycleSec * 2.25, T_NIGHT = C.cycleSec * 2.75, T_BLOOD = C.cycleSec * 3.67; // รอบที่ 2 = คืนธรรมดา, รอบที่ 3 = คืนเลือด; T_DAY/T_NIGHT อยู่นอกช่วง World Boss
  const bossState = (t, zone, type) => { const sim = createSim(); sim.step(.05, t); return sim.zones[zone].mons.find(m => m.type === type); };
  rec('บอสประจำพื้นที่ (ราชาปีศาจภูเขา) อยู่ตลอด', bossState(T_DAY, 'peak', 'ราชาปีศาจภูเขา').state === 'idle' && bossState(T_NIGHT, 'peak', 'ราชาปีศาจภูเขา').state === 'idle');
  const bd = bossState(T_DAY, 'rainforest', 'วิญญาณหมาป่าศักดิ์สิทธิ์'), bb = bossState(T_BLOOD, 'rainforest', 'วิญญาณหมาป่าศักดิ์สิทธิ์');
  rec('บอสคืนเลือดซ่อนตอนกลางวัน และปรากฏคืนพระจันทร์สีเลือด', bd.away && bd.state === 'dead' && !bb.away && bb.state === 'idle');
  const wOff = bossState(C.worldWindow + 30, 'peak', 'มังกรแห่งหุบเขาหมอก'), wOn = bossState(C.worldEvery + 30, 'peak', 'มังกรแห่งหุบเขาหมอก');
  rec('World Boss ซ่อนนอกช่วง และปรากฏในช่วง', wOff.away && !wOn.away && wOn.state === 'idle');
  // ประกาศ: ผู้เล่นออนไลน์ได้ข้อความเมื่อ World Boss ปรากฏ
  { const sim = createSim(), p = mkP(sim); sim.step(.05, C.worldWindow + 30); p.personal = []; sim.step(.05, C.worldEvery + 30);
    rec('ประกาศ World Boss ถึงผู้เล่นทุกคน', p.personal.some(e => e.k === 'announce' && e.msg.includes('มังกรแห่งหุบเขาหมอก'))); }
  // กลางคืน: มอนสเตอร์ตีแรงขึ้น ×1.2, คืนเลือด ×1.5; รางวัล EXP ×1.25 / ×2
  const hit = t => { const sim = createSim({ rand: () => .5 }), p = mkP(sim); sim.step(.01, t);
    const z = sim.zones.village, m = z.mons.find(m => m.type === 'กระต่ายมีเขา'); m.c = W.CFG.monsters['หมาป่า'];
    Object.assign(m, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, state: 'chase', target: p, atkT: 0 }); const h0 = p.hp; sim.step(.05, t); return h0 - p.hp; };
  const dD = hit(T_DAY), dN = hit(T_NIGHT), dB = hit(T_BLOOD);
  const wa = W.CFG.monsters['หมาป่า'].atk, eD = Math.round(wa), eN = Math.round(wa * C.night.atk), eB = Math.round(wa * C.blood.atk);
  rec('ดาเมจหมาป่า กลางวัน/กลางคืน/คืนเลือด = ' + [eD, eN, eB].join(' / '), dD === eD && dN === eN && dB === eB, dD + ' / ' + dN + ' / ' + dB);
  const ex = t => { const sim = createSim({ rand: () => .5 }), p = mkP(sim, { job: 30 }); sim.step(.01, t);
    const z = sim.zones.village, m = z.mons.find(m => m.type === 'ไก่ฟ้า'); Object.assign(m, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, wx: PX + 20, wy: PY, t: 99, hp: 1, state: 'idle' });
    sim.act(p, 'b', t); for (let k = 0; k < 10; k++) sim.step(.05, t + k * .05); return p.c.exp; };
  const ce = W.CFG.monsters['ไก่ฟ้า'].exp, xD = Math.round(ce), xN = Math.round(ce * C.night.exp), xB = Math.round(ce * C.blood.exp);
  rec('EXP ไก่ฟ้า กลางวัน/กลางคืน/คืนเลือด = ' + [xD, xN, xB].join(' / '), ex(T_DAY) === xD && ex(T_NIGHT) === xN && ex(T_BLOOD) === xB, ex(T_DAY) + ' / ' + ex(T_NIGHT) + ' / ' + ex(T_BLOOD));
  // ปราบบอส → รางวัลบอส + ประกาศ
  { const sim = createSim({ rand: () => .5 }), p = mkP(sim, { zone: 'peak', job: 30 }); sim.step(.01, T_DAY);
    const z = sim.zones.peak, b = z.mons.find(m => m.type === 'ราชาปีศาจภูเขา'); Object.assign(p.c, { x: b.x - 20, y: b.y, dir: 'E' }); b.hp = 1; b.t = 99; p.hp = p.maxHp = 1e6; // ฉาก: ผู้เล่นทนพอให้ท่าออก
    sim.act(p, 'b', T_DAY); for (let k = 0; k < 10; k++) sim.step(.05, T_DAY + k * .05);
    rec('ปราบบอสได้ EXP บอส (8000) และมีประกาศ', b.state === 'dead' && p.c.lv > 1 && p.personal.some(e => e.k === 'announce' && e.msg.includes('ราชาปีศาจภูเขา')), 'Lv ' + p.c.lv); }
}

// ---------- V2-R21 สมดุลค่าพลัง ----------
{
  const B = W.CFG.balance, M = W.CFG.monsters, P = W.CFG.player;
  const normal = Object.entries(M).filter(([, m]) => !m.boss);
  // ผู้เล่นเลเวลเท่ามอนสเตอร์ ตีท่าพื้นฐาน (ATK×1) กี่ครั้งตาย / มอนสเตอร์ตีผู้เล่นกี่ครั้งตาย
  const rows = normal.map(([t, m]) => ({ t, lv: m.lv, hits: Math.ceil(m.hp / B.pAtk(m.lv)), survive: Math.ceil(B.pHp(m.lv) / m.atk), kills: +(W.CFG.expCurve(m.lv) / m.exp).toFixed(1) }));
  rec('มอนสเตอร์ทั่วไปทุกตัวมีเลเวล', normal.every(([, m]) => m.lv > 0));
  rec('เลเวลเท่ากัน: ตีท่าพื้นฐาน 5 ครั้งตาย (ทุกชนิด)', rows.every(r => r.hits === 5), rows.map(r => r.t + ':' + r.hits).join(' '));
  rec('เลเวลเท่ากัน: มอนสเตอร์ตีผู้เล่น 11–13 ครั้งจึงตาย', rows.every(r => r.survive >= 11 && r.survive <= 13), rows.map(r => r.survive).join(','));
  rec('ล่า 13–31 ตัวต่อ 1 เลเวล (เพิ่มตามเลเวล)', rows.every(r => r.kills >= 13 && r.kills <= 31), rows.map(r => r.lv + ':' + r.kills).join(' '));
  const byLv = [...rows].sort((a, b) => a.lv - b.lv);
  rec('HP / ATK / EXP เพิ่มตามเลเวลไม่สลับลำดับ', byLv.every((r, i) => !i || (M[r.t].hp >= M[byLv[i - 1].t].hp && M[r.t].atk >= M[byLv[i - 1].t].atk && M[r.t].exp >= M[byLv[i - 1].t].exp)));
  // มอนสเตอร์ในแต่ละโซนอยู่ในช่วงเลเวลของโซน
  const band = { field2: [1, 12], bamboo: [7, 22], rainforest: [15, 32], mine: [27, 42], peak: [37, 47] };
  const badZ = Object.entries(band).filter(([z, [lo, hi]]) => !W.ZONES[z].spawns.every(s => M[s.type].lv >= lo && M[s.type].lv <= hi));
  rec('มอนสเตอร์ในแต่ละโซนอยู่ในช่วงเลเวลของโซน', badZ.length === 0, Object.entries(band).map(([z]) => z + ':' + W.ZONES[z].spawns.map(s => M[s.type].lv).join('/')).join(' '));
  rec('บอสเลเวลสูงกว่ามอนสเตอร์ในโซนเดียวกัน', Object.entries(W.CFG.bosses).every(([z, bs]) => bs.every(b => W.ZONES[z].spawns.every(s => M[b.type].lv >= M[s.type].lv))));
}
// ---------- V2-R21 ปาร์ตี้ ----------
{
  const mk = (sim, id, name, extra) => { const p = { id, c: Object.assign({ name, zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 1, jexp: 0, starter: 1 }, extra) }; sim.addPlayer(p); return p; };
  const sim = createSim({ rand: () => .5 });
  const a = mk(sim, 1, 'Aa'), b = mk(sim, 2, 'Bb'), c = mk(sim, 3, 'Cc'), far = mk(sim, 4, 'Far', { x: PX + 2000 });
  rec('ชวนชื่อที่ไม่มี → ปฏิเสธ', sim.party(a, 'invite', 'nobody', 0) === 'no-player');
  rec('ชวน → เกิดปาร์ตี้ และ B ได้คำเชิญ', sim.party(a, 'invite', 'bb', 0) === 'ok' && b.personal.some(e => e.k === 'pinvite' && e.from === 'Aa'));
  rec('B ตอบรับ → ปาร์ตี้ 2 คน', sim.party(b, 'accept', null, 1) === 'ok' && sim.partyView(a).m.length === 2);
  rec('สมาชิกที่ไม่ใช่หัวหน้าชวนคนอื่นไม่ได้', sim.party(b, 'invite', 'Cc', 1) === 'not-leader');
  rec('คำเชิญหมดอายุ 30 วิ', (sim.party(a, 'invite', 'Cc', 2), sim.party(c, 'accept', null, 40)) === 'no-invite');
  sim.party(a, 'invite', 'Far', 41); sim.party(far, 'accept', null, 42);
  // ฆ่าไก่ฟ้า: A และ B อยู่ใกล้ แบ่ง EXP + โบนัส 10%, Far อยู่ไกลเกินระยะไม่ได้
  const z = sim.zones.village, m = z.mons.find(m => m.type === 'ไก่ฟ้า');
  Object.assign(m, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, wx: PX + 20, wy: PY, t: 99, hp: 1, state: 'idle' });
  a.c.exp = b.c.exp = far.c.exp = 0; const T0 = W.CFG.time.cycleSec * 2.25;
  sim.step(.01, T0); sim.act(a, 'b', T0); for (let k = 0; k < 10; k++) sim.step(.05, T0 + k * .05);
  const E = W.CFG.monsters['ไก่ฟ้า'].exp, each = Math.round(E * 1.1 / 2);
  rec('ปาร์ตี้: สมาชิกในระยะได้ EXP คนละ ' + each + ' (รวมโบนัส), คนไกลไม่ได้', m.state === 'dead' && a.c.exp === each && b.c.exp === each && far.c.exp === 0, [a.c.exp, b.c.exp, far.c.exp].join('/'));
  rec('ออกจากปาร์ตี้ → เหลือ 2 คน; ออกอีกคน → ยุบ', (sim.party(far, 'leave', null, 50), sim.partyView(a).m.length === 2) && (sim.party(b, 'leave', null, 51), !a.party && sim.parties.size === 0));
  rec('ผู้เล่นออกจากเกม → ออกจากปาร์ตี้อัตโนมัติ', (sim.party(a, 'invite', 'Bb', 60), sim.party(b, 'accept', null, 61), sim.removePlayer(b), !a.party));
}
// ---------- V2-R21 แบ่งรางวัลบอสตามดาเมจ ----------
{
  const sim = createSim({ rand: () => .5 }), T0 = W.CFG.time.cycleSec * 2.25;
  const mk = (id, name) => { const p = { id, c: { name, zone: 'peak', x: 0, y: 0, dir: 'E', lv: 50, exp: 0, job: 30, jexp: 0, starter: 1 } }; sim.addPlayer(p); p.hp = p.maxHp = 1e9; return p; };
  const a = mk(1, 'A'), b = mk(2, 'B'), c = mk(3, 'C'); sim.step(.01, T0);
  const boss = sim.zones.peak.mons.find(m => m.type === 'ราชาปีศาจภูเขา');
  boss.dmgBy = new Map([[a, boss.c.hp * .6], [b, boss.c.hp * .4 - 1], [c, boss.c.hp * .001]]); boss.hp = 1; boss.t = 99;
  Object.assign(b.c, { x: boss.x - 20, y: boss.y }); for (const p of [a, b, c]) p.c.exp = 0, p.c.lv = 50;
  sim.act(b, 'b', T0); for (let k = 0; k < 10; k++) sim.step(.05, T0 + k * .05);
  const E = W.CFG.monsters['ราชาปีศาจภูเขา'].exp, got = p => p.personal.filter(e => e.k === 'reward').reduce((s, e) => s + e.exp, 0);
  const ea = Math.round(E * (.3 + .7 * .6)), eb = got(b);
  rec('บอส: A ทำดาเมจ 60% ได้ ' + ea + ' EXP (30% + 70%×สัดส่วน)', Math.abs(got(a) - ea) <= E * .005, 'A=' + got(a) + ' B=' + eb + ' C=' + got(c));
  rec('บอส: B (ตีปิด, 40%) ได้น้อยกว่า A; C ทำไม่ถึง 1% ไม่ได้', eb > 0 && eb < got(a) && got(c) === 0);
}

const fail = results.filter(r => !r.pass).length;
console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน');
process.exit(fail ? 1 : 0);
