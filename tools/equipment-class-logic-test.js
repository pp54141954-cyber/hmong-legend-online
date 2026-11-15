// Server-side class weapon regression only. Legacy browser shop tests remain in class-weapon-test.js.
'use strict';
const assert = require('node:assert/strict');
const { createSim } = require('../server/sim.js');
const W = require('../shared/world.js');
const results = [];
const rec = (name, pass, detail) => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- ส่วนที่ 1: ตรรกะเซิร์ฟเวอร์ ----
{
  const C = W.CFG, T = W.T, T2 = C.npcs.find(n => n.zone === 'village2');
  const mk = (cls, gold, x, y, zone) => ({ id: 1, personal: [], c: { zone: zone || 'village', x, y, dir: 'S', lv: 1, exp: 0, job: 1, jexp: 0, bag: [], eq: {}, gold, cls, clsset: 1, starter: 1 } });
  const VX = 11.5 * T, VY = 15.6 * T; // จุดเกิดหมู่บ้านเริ่มต้น (ปลอดภัย)
  const sim = createSim({ rand: () => .5 });

  const a = mk('นักธนู', 0, VX, VY);
  a.c.bag.push({ id: 'sword_iron', n: 1 });
  rec('สวมดาบให้นักธนูไม่ได้ (wrong-class) และของยังอยู่ในกระเป๋า', sim.inv(a, 'equip', 0) === 'wrong-class' && a.c.eq.weapon === undefined && a.c.bag.some(s => s.id === 'sword_iron'));
  a.c.bag.push({ id: 'bow_iron', n: 1 });
  rec('สวมธนูเหล็กให้นักธนูได้', sim.inv(a, 'equip', 1) === 'ok' && a.c.eq.weapon === 'bow_iron', 'ATK ' + C.items.bow_iron.atk);

  const shopper = mk('นักดาบ', 500, T2.tx * T, T2.ty * T, 'village2');
  rec('ร้านหมู่บ้านกางเขาซื้อดาบไม้ได้ (นักดาบ)', sim.buy(shopper, T2.id, 'sword_wood', 1) === 'ok' && shopper.c.gold === 450);
  rec('ซื้อธนูของอาชีพอื่นไม่ได้ (wrong-class) และไม่หักเงิน', sim.buy(shopper, T2.id, 'bow_wood', 1) === 'wrong-class' && shopper.c.gold === 450);

  const sw = mk('นักดาบ', 0, VX, VY); sw.c.eq.weapon = 'sword_wood'; delete sw.c.clsset; // ยังไม่เคยเลือกอาชีพ
  rec('เลือกอาชีพครั้งแรกเป็นนักธนู: ดาบไม้เดิมไปกระเป๋า ใส่ธนูไม้', sim.setClass(sw, 'นักธนู', true) === 'ok' && sw.c.eq.weapon === 'bow_wood' && sw.c.bag.some(s => s.id === 'sword_wood'));
  rec('เปลี่ยนเป็นนักฆ่าในหมู่บ้าน: ธนูไม้ไปกระเป๋า ใส่มีดสั้นไม้', sim.setClass(sw, 'นักฆ่า') === 'ok' && sw.c.eq.weapon === 'daggers_wood' && sw.c.bag.some(s => s.id === 'bow_wood'));

  const drop = mk('นักธนู', 0, VX, VY); drop.c.eq.weapon = 'bow_iron';
  const dsim = createSim({ rand: () => 0 }); // ทอยทุกครั้งให้ติด → ทดสอบว่าของดรอปตามอาชีพ
  dsim.rollDrops(drop, { type: 'โกเลมหิน', id: 1 });
  rec('ดรอประดับ 3 ของโกเลมหินเป็นอาวุธของอาชีพผู้เล่น (นักธนู → ธนูเงิน)', drop.c.bag.some(s => s.id === 'bow_silver'), 'กระเป๋า: ' + drop.c.bag.map(s => s.id).join(', '));
}


const passed = results.filter(Boolean).length;
console.log('Class weapon logic: ' + passed + '/' + results.length + ' pass');
assert.equal(passed, results.length, 'existing class weapon logic regression failed');
