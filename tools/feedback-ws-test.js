// Hmong Legend V2-R83 — เหตุผลของกระเป๋าและร้านค้าที่เซิร์ฟเวอร์ส่งผ่าน WebSocket จริง (บัญชีทดสอบชั่วคราวเท่านั้น)
// รัน: node tools/feedback-ws-test.js
// ไม่เข้าถึง Render หรือโทรศัพท์จริง — ใช้ฐานข้อมูล SQLite ชั่วคราวในเครื่อง
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocket } = require('../server/node_modules/ws');
const { createServer } = require('../server/server.js');
const { createSim } = require('../server/sim.js');
const { CFG, T, ZONES } = require('../shared/world.js');

let checks = 0;
const failures = [];
function check(name, ok) {
  checks++;
  if (ok) console.log('PASS ' + name);
  else { failures.push(name); console.log('FAIL ' + name); }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(name, fn, timeout = 6000) {
  const t = Date.now();
  while (Date.now() - t < timeout) { if (fn()) return true; await sleep(20); }
  return false;
}

const shop = CFG.npcs.find(n => n.id === 'shop2');
const NEAR = { zone: 'village2', x: shop.tx * T, y: shop.ty * T };
const FAR = { zone: 'village2', x: 2 * T, y: 2 * T };
const FULL = () => Array.from({ length: CFG.bag.slots }, () => ({ id: 'hide', n: 99 }));
const EQ = { weapon: null, offhand: null, armor: null, acc: null };

async function login(port, name) {
  const r = await fetch('http://127.0.0.1:' + port + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, pass: 'password123' })
  });
  assert.equal(r.status, 200, 'login ' + name);
  return (await r.json()).token;
}
function connect(port, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws'), events = [];
    const timer = setTimeout(() => reject(new Error('WebSocket auth timeout')), 8000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token })));
    ws.on('message', b => {
      let m; try { m = JSON.parse(String(b)); } catch { return; }
      events.push(m);
      if (m.t === 'welcome') { clearTimeout(timer); resolve({ ws, events }); }
    });
    ws.once('error', e => { clearTimeout(timer); reject(e); });
  });
}
const denies = s => s.events.filter(m => m.t === 'deny');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-feedback-ws-'));
  const srv = createServer({ dbFile: path.join(dir, 'feedback.db'), quiet: true, startZone: 'village2', saveEverySec: 3600 });
  const sockets = [];
  let seq = 0;
  // สร้างบัญชีทดสอบใหม่ทุกกรณี เพื่อไม่ให้สถานะข้ามกัน
  async function player(opts) {
    // ปิดการเชื่อมต่อของกรณีก่อนหน้า: เซิร์ฟเวอร์จำกัดจำนวนการเชื่อมต่อต่อ IP (V2-R22)
    for (const s of sockets.splice(0)) {
      if (s.ws.readyState === WebSocket.OPEN) await new Promise(resolve => { s.ws.once('close', resolve); s.ws.close(); });
    }
    const name = 'FbWs' + (++seq);
    const r = srv.db.register(name, 'password123', { zone: opts.at.zone, x: opts.at.x, y: opts.at.y });
    const c = srv.db.character(r.id);
    Object.assign(c, { cls: opts.cls || 'นักดาบ', clsset: 1, starter: 1, gold: opts.gold ?? 0, bag: opts.bag || [], eq: opts.eq || { ...EQ } });
    srv.db.save(c);
    const session = await connect(await port(), await login(await port(), name));
    sockets.push(session);
    await waitFor('join ' + name, () => srv.online.has(r.id));
    return { id: r.id, session, pl: srv.online.get(r.id) };
  }
  let listenPort = 0;
  const port = async () => listenPort || (listenPort = await srv.listen(0));
  try {
    await port();

    // ----- ร้านค้า -----
    let a = await player({ at: NEAR, gold: 0 });
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'potion_s', n: 1 }));
    check('ร้านค้า: เงินไม่พอ ส่ง deny shop no-gold', await waitFor('no-gold', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'no-gold')));
    check('ร้านค้า: เงินไม่พอ ไม่เปลี่ยนเงินหรือกระเป๋า', a.pl.c.gold === 0 && a.pl.c.bag.length === 0);

    a = await player({ at: NEAR, gold: 1000, bag: FULL() });
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'potion_s', n: 1 }));
    check('ร้านค้า: กระเป๋าเต็ม ส่ง deny shop bag-full', await waitFor('bag-full', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'bag-full')));
    check('ร้านค้า: กระเป๋าเต็มไม่คิดเงิน', a.pl.c.gold === 1000);

    a = await player({ at: FAR, gold: 1000 });
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'potion_s', n: 1 }));
    check('ร้านค้า: อยู่ไกลจาก NPC ส่ง deny shop far', await waitFor('far', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'far')));

    a = await player({ at: NEAR, gold: 1000 });
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'no_such_item', n: 1 }));
    check('ร้านค้า: รายการไม่มีในร้าน ส่ง deny shop invalid', await waitFor('invalid', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'invalid')));

    a = await player({ at: NEAR, gold: 1000, cls: 'ผู้รักษา' });
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'sword_wood', n: 1 }));
    check('ร้านค้า: อาชีพไม่ตรงกับอาวุธ ส่ง deny shop wrong-class', await waitFor('wrong-class', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'wrong-class')));

    a = await player({ at: NEAR, gold: 100 });
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'potion_s', n: 1 }));
    check('ร้านค้า: ซื้อสำเร็จไม่มี deny และหักเงินครั้งเดียว', await waitFor('ok', () => a.pl.c.gold === 90 && a.pl.c.bag.some(s => s.id === 'potion_s' && s.n === 1)) && denies(a.session).length === 0);

    // บันทึกฐานข้อมูลล้มเหลว: ต้องได้ save-error และสถานะเดิม
    a = await player({ at: NEAR, gold: 100 });
    const beforeGold = a.pl.c.gold, beforeBag = JSON.stringify(a.pl.c.bag);
    const save = srv.db.save;
    srv.db.save = () => { throw new Error('injected save failure'); };
    try {
      a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'potion_s', n: 1 }));
      check('ร้านค้า: บันทึกไม่สำเร็จ ส่ง deny save-error', await waitFor('save-error', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'save-error')));
      check('ร้านค้า: บันทึกไม่สำเร็จ คืนเงินและกระเป๋าเดิม', a.pl.c.gold === beforeGold && JSON.stringify(a.pl.c.bag) === beforeBag);
    } finally { srv.db.save = save; }

    // ----- กระเป๋า -----
    a = await player({ at: NEAR, bag: [{ id: 'potion_s', n: 2 }] });
    a.pl.hp = a.pl.maxHp;
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'use', slot: 0 }));
    check('กระเป๋า: ใช้ยาตอน HP เต็ม ส่ง deny inv use hp-full', await waitFor('hp-full', () => denies(a.session).some(m => m.k === 'inv' && m.op === 'use' && m.r === 'hp-full')));
    check('กระเป๋า: ยาไม่ถูกใช้เมื่อ HP เต็ม', a.pl.c.bag[0].n === 2);

    a = await player({ at: NEAR, bag: [{ id: 'potion_s', n: 2 }] });
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'equip', slot: 0 }));
    check('กระเป๋า: สวมของที่ไม่ใช่อุปกรณ์ ส่ง deny inv equip not-equip', await waitFor('not-equip', () => denies(a.session).some(m => m.k === 'inv' && m.op === 'equip' && m.r === 'not-equip')));

    a = await player({ at: NEAR, cls: 'ผู้รักษา', bag: [{ id: 'sword_iron', n: 1 }] });
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'equip', slot: 0 }));
    check('กระเป๋า: อาชีพไม่ตรงกับอุปกรณ์ ส่ง deny inv equip wrong-class', await waitFor('wrong-class', () => denies(a.session).some(m => m.k === 'inv' && m.op === 'equip' && m.r === 'wrong-class')));
    check('กระเป๋า: สวมไม่สำเร็จ อุปกรณ์ยังอยู่ในกระเป๋า', a.pl.c.bag.length === 1 && a.pl.c.eq.weapon === null);

    a = await player({ at: NEAR, eq: { ...EQ, offhand: null }, bag: [] });
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'unequip', slot: 'offhand' }));
    check('กระเป๋า: ถอดช่องที่ว่าง ส่ง deny inv unequip empty', await waitFor('empty', () => denies(a.session).some(m => m.k === 'inv' && m.op === 'unequip' && m.r === 'empty')));

    a = await player({ at: NEAR, cls: 'นักดาบ', eq: { ...EQ, weapon: 'sword_wood' }, bag: FULL() });
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'unequip', slot: 'weapon' }));
    check('กระเป๋า: กระเป๋าเต็มถอดอาวุธไม่ได้ ส่ง deny inv unequip bag-full', await waitFor('bag-full-unequip', () => denies(a.session).some(m => m.k === 'inv' && m.op === 'unequip' && m.r === 'bag-full')));
    check('กระเป๋า: ถอดไม่สำเร็จ อาวุธยังสวมอยู่', a.pl.c.eq.weapon === 'sword_wood');

    a = await player({ at: NEAR, bag: [{ id: 'potion_s', n: 2 }] });
    a.pl.hp = a.pl.maxHp - 60;
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'use', slot: 0 }));
    check('กระเป๋า: ใช้ยาตอนบาดเจ็บสำเร็จ และลดจำนวนหนึ่งครั้ง', await waitFor('use-ok', () => a.pl.c.bag[0] && a.pl.c.bag[0].n === 1) && denies(a.session).length === 0);

    // คูลดาวน์ยาตรวจที่ตัวจำลองเดียวกับเซิร์ฟเวอร์ (ไม่ผ่านเครือข่าย)
    const sim = createSim({ rand: () => 0.5 });
    const p = { id: 1, c: { account_id: 1, name: 'CdTest', zone: 'village', x: 0, y: 0, dir: 'S', lv: 20, exp: 0, job: 10, jexp: 0, cls: 'นักดาบ', clsset: 1, starter: 1, gold: 0, bag: [{ id: 'potion_s', n: 2 }], eq: { ...EQ }, enh: {}, sk: {}, st: {}, look: {} }, personal: [], dirty: false, bagDirty: false };
    sim.addPlayer(p);
    p.hp = p.maxHp - 60;
    check('คูลดาวน์ยา: ใช้ครั้งแรกสำเร็จ', sim.inv(p, 'use', 0, 10) === 'ok');
    check('คูลดาวน์ยา: ใช้ซ้ำทันทีส่ง cooldown และไม่ตัดยาเพิ่ม', sim.inv(p, 'use', 0, 10.1) === 'cooldown' && p.c.bag[0].n === 1);

    // ผู้เล่นที่ตาย: ทุกคำสั่งกระเป๋าและร้านค้าต้องได้ dead
    a = await player({ at: NEAR, gold: 1000, bag: [{ id: 'potion_s', n: 2 }] });
    a.pl.dead = true;
    a.session.ws.send(JSON.stringify({ t: 'inv', op: 'use', slot: 0 }));
    a.session.ws.send(JSON.stringify({ t: 'shop', npc: 'shop2', id: 'potion_s', n: 1 }));
    check('ตายอยู่: กระเป๋าส่ง dead', await waitFor('dead-inv', () => denies(a.session).some(m => m.k === 'inv' && m.r === 'dead')));
    check('ตายอยู่: ร้านค้าส่ง dead', await waitFor('dead-shop', () => denies(a.session).some(m => m.k === 'shop' && m.r === 'dead')));
  } finally {
    for (const s of sockets) if (s.ws.readyState === WebSocket.OPEN) s.ws.close();
    await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('RESULT: ' + (checks - failures.length) + '/' + checks + ' PASS (feedback over WebSocket, บัญชีชั่วคราว)');
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error('FAIL feedback ws:', e); process.exitCode = 1; });
