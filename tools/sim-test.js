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

// ---------- V2-R4 กระเป๋า ของดรอป อุปกรณ์ ----------
const mkP = (sim, extra) => { const p = { id: 1, c: Object.assign({ zone: 'village', x: PX, y: PY, dir: 'E', lv: 1, exp: 0, job: 1, jexp: 0 }, extra) }; sim.addPlayer(p); return p; };
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
  rec('เกราะ DEF 5 ลดดาเมจหมาป่าจาก 11 เป็น 6', a === 11 && b === 6, 'ไม่ใส่=' + a + ' ใส่=' + b);
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
  rec('ดาเมจหมาป่า กลางวัน/กลางคืน/คืนเลือด = 11 / 13 / 17', dD === 11 && dN === 13 && dB === 17, dD + ' / ' + dN + ' / ' + dB);
  const ex = t => { const sim = createSim({ rand: () => .5 }), p = mkP(sim, { job: 30 }); sim.step(.01, t);
    const z = sim.zones.village, m = z.mons.find(m => m.type === 'ไก่ฟ้า'); Object.assign(m, { x: PX + 20, y: PY, hx: PX + 20, hy: PY, wx: PX + 20, wy: PY, t: 99, hp: 1, state: 'idle' });
    sim.act(p, 'b', t); for (let k = 0; k < 10; k++) sim.step(.05, t + k * .05); return p.c.exp; };
  rec('EXP ไก่ฟ้า กลางวัน/กลางคืน/คืนเลือด = 6 / 8 / 12', ex(T_DAY) === 6 && ex(T_NIGHT) === 8 && ex(T_BLOOD) === 12, ex(T_DAY) + ' / ' + ex(T_NIGHT) + ' / ' + ex(T_BLOOD));
  // ปราบบอส → รางวัลบอส + ประกาศ
  { const sim = createSim({ rand: () => .5 }), p = mkP(sim, { zone: 'peak', job: 30 }); sim.step(.01, T_DAY);
    const z = sim.zones.peak, b = z.mons.find(m => m.type === 'ราชาปีศาจภูเขา'); Object.assign(p.c, { x: b.x - 20, y: b.y, dir: 'E' }); b.hp = 1; b.t = 99; p.hp = p.maxHp = 1e6; // ฉาก: ผู้เล่นทนพอให้ท่าออก
    sim.act(p, 'b', T_DAY); for (let k = 0; k < 10; k++) sim.step(.05, T_DAY + k * .05);
    rec('ปราบบอสได้ EXP บอส (8000) และมีประกาศ', b.state === 'dead' && p.c.lv > 1 && p.personal.some(e => e.k === 'announce' && e.msg.includes('ราชาปีศาจภูเขา')), 'Lv ' + p.c.lv); }
}

const fail = results.filter(r => !r.pass).length;
console.log('\nสรุป: ' + (results.length - fail) + '/' + results.length + ' ผ่าน');
process.exit(fail ? 1 : 0);
