// Isolated integration regression: WebSocket attack damage + SQLite rejoin persistence.
// No Render calls, no production accounts, no game-code changes, no physical-device claim.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocket } = require('../server/node_modules/ws');
const { createServer } = require('../server/server.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
function check(name, condition, detail = '') {
  assert.ok(condition, name + (detail ? ' — ' + detail : ''));
  passed++;
  console.log('PASS ' + name + (detail ? ' — ' + detail : ''));
}
async function until(name, fn, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (fn()) return;
    await sleep(25);
  }
  throw new Error('Timed out: ' + name);
}
function dial(port, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    const messages = [];
    let resolved = false;
    const tm = setTimeout(() => { ws.terminate(); reject(new Error('Welcome timeout')); }, 8000);
    ws.on('message', raw => {
      let obj;
      try { obj = JSON.parse(String(raw)); } catch (e) { return; }
      messages.push(obj);
      if (obj.t === 'welcome' && !resolved) {
        resolved = true; clearTimeout(tm); resolve({ ws, messages, welcome: obj });
      }
    });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token })));
    ws.on('error', e => { if (!resolved) { clearTimeout(tm); reject(e); } });
    ws.on('close', () => { if (!resolved) { clearTimeout(tm); reject(new Error('Closed before welcome')); } });
  });
}
async function login(port) {
  const response = await fetch('http://127.0.0.1:' + port + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'CombatSaveIT', pass: 'testpass123' })
  });
  assert.equal(response.status, 200, 'HTTP login should succeed');
  const obj = await response.json();
  assert.ok(obj.token, 'HTTP login should issue a token');
  return obj.token;
}
async function disconnect(ws) {
  if (ws.readyState === WebSocket.CLOSED) return;
  await new Promise(resolve => {
    ws.once('close', resolve);
    ws.close();
  });
}
async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-combat-persistence-'));
  const dbFile = path.join(directory, 'game.db');
  let s1, s2, a, b;
  try {
    s1 = createServer({ dbFile, quiet: true, startZone: 'field', saveEverySec: 1 });
    const zone = s1.sim.zones.field;
    assert.ok(zone && zone.mons.length > 0, 'field should contain monsters');
    let chosen;
    for (const m of zone.mons) {
      if (m.c.boss || m.state !== 'idle' || zone.inSafe(m.x, m.y)) continue;
      for (const [dx, dy, dir] of [[-18, 0, 'E'], [18, 0, 'W'], [0, -18, 'S'], [0, 18, 'N']]) {
        const x = m.x + dx, y = m.y + dy;
        if (!zone.boxBlocked(x, y) && !zone.inSafe(x, y)) {
          chosen = { m, x, y, dir }; break;
        }
      }
      if (chosen) break;
    }
    assert.ok(chosen, 'need an unblocked combat position near a regular monster');
    const { m, x, y, dir } = chosen;
    m.t = 9999; m.wx = m.x; m.wy = m.y; // Stable fixture; not a change to game rules.
    const r = s1.db.register('CombatSaveIT', 'testpass123', { zone: 'field', x, y });
    assert.ok(r.id, 'temporary test account should register');
    const c = s1.db.character(r.id);
    c.cls = 'นักดาบ'; c.clsset = 1; c.starter = 1; c.lv = 20;
    c.dir = dir; c.eq = { weapon: 'sword_iron', offhand: null, armor: 'coat_cloth', acc: 'charm_silver' };
    c.enh = { weapon: 9 };
    c.bag = [{ id: 'sword_hmong', n: 1, enh: 12 }, { id: 'potion_s', n: 3 }];
    c.gold = 43210;
    s1.db.save(c);

    const port = await s1.listen(0);
    a = await dial(port, await login(port));
    check('real HTTP login and WebSocket welcome', a.welcome.auth && a.welcome.state.zone === 'field');
    const p = s1.online.get(r.id);
    check('server created an online player', !!p && p.c.eq.weapon === 'sword_iron');
    const beforeHp = m.hp;
    a.ws.send(JSON.stringify({ t: 'act', k: 'b', dir }));
    await until('attack reduces monster HP', () => m.hp < beforeHp || m.state === 'dead', 5000);
    check('WebSocket basic attack causes actual monster damage', m.hp < beforeHp, beforeHp + ' -> ' + m.hp);
    check('server records damage or kill outcome', m.hp < beforeHp && (m.state === 'dead' || m.state === 'chase' || m.hp > 0));
    const goldBeforeKill = p.c.gold, expBeforeKill = p.c.exp, jobBeforeKill = p.c.jexp;
    // The first basic attack may not defeat this monster: continue until it is dead.
    for (let k = 0; k < 6 && m.state !== 'dead'; k++) {
      await sleep(550); // basic cooldown is 0.45 seconds
      a.ws.send(JSON.stringify({ t: 'act', k: 'b', dir }));
      await sleep(220); // let server-side cast resolve
    }
    await until('monster is defeated', () => m.state === 'dead', 5000);
    check('monster defeated after real WebSocket attacks', m.state === 'dead');
    check('monster defeat rewards EXP or Job EXP',
      p.c.exp > expBeforeKill || p.c.jexp > jobBeforeKill || p.c.lv > 20 || p.c.job > 1);
    check('monster defeat credits in-game gold', p.c.gold > goldBeforeKill);

    const steps = [[8, 0, 'E'], [-8, 0, 'W'], [0, 8, 'S'], [0, -8, 'N']];
    const step = steps.find(([dx, dy]) => s1.sim.pathClear(p.c.zone, p.c.x, p.c.y, p.c.x + dx, p.c.y + dy));
    assert.ok(step, 'need an accessible 8px movement for persistence test');
    const nextX = p.c.x + step[0], nextY = p.c.y + step[1];
    a.ws.send(JSON.stringify({ t: 'mv', zone: p.c.zone, x: nextX, y: nextY, dir: step[2], moving: true }));
    await until('server accepts movement', () => p.c.x === nextX && p.c.y === nextY);
    check('real WebSocket movement updates server coordinates', p.c.x === nextX && p.c.y === nextY);
    a.ws.send(JSON.stringify({ t: 'inv', op: 'equip', slot: 0 }));
    await until('equipment swapped on server', () => p.c.eq.weapon === 'sword_hmong');
    check('equipping +12 weapon preserves enhancement level', p.c.enh.weapon === 12);
    check('previous +9 sword returns to bag intact', p.c.bag.some(it => it.id === 'sword_iron' && it.enh === 9));

    const expected = {
      x: p.c.x, y: p.c.y, zone: p.c.zone, dir: p.c.dir,
      weapon: p.c.eq.weapon, weaponEnh: p.c.enh.weapon,
      gold: p.c.gold, bag: JSON.stringify(p.c.bag),
      lv: p.c.lv, exp: p.c.exp, job: p.c.job, jexp: p.c.jexp
    };
    await disconnect(a.ws);
    await until('first session removed from online map', () => !s1.online.has(r.id));
    const saved = s1.db.character(r.id);
    check('disconnect flushed position and direction to SQLite',
      saved.zone === expected.zone && saved.x === expected.x && saved.y === expected.y && saved.dir === expected.dir);
    check('disconnect flushed equipment, +12 and old +9 item',
      saved.eq.weapon === expected.weapon && saved.enh.weapon === expected.weaponEnh &&
      JSON.stringify(saved.bag) === expected.bag);
    check('disconnect flushed gold and XP',
      saved.gold === expected.gold && saved.lv === expected.lv &&
      saved.exp === expected.exp && saved.job === expected.job && saved.jexp === expected.jexp);

    await s1.close(); s1 = null;
    s2 = createServer({ dbFile, quiet: true, startZone: 'field', saveEverySec: 1 });
    const port2 = await s2.listen(0);
    b = await dial(port2, await login(port2));
    check('can log back in after isolated server restart', b.welcome.auth && b.welcome.state.zone === expected.zone);
    check('position survives server restart and new login',
      b.welcome.state.x === expected.x && b.welcome.state.y === expected.y && b.welcome.state.dir === expected.dir);
    await until('full equipment snapshot after rejoin',
      () => b.messages.some(t => t.t === 'snap' && t.me && t.me.eq && t.me.bag));
    const state = b.messages.find(t => t.t === 'snap' && t.me && t.me.eq && t.me.bag).me;
    check('rejoin snapshot restores equipped weapon and enhancement',
      state.eq.weapon === expected.weapon && state.enh.weapon === expected.weaponEnh);
    check('rejoin snapshot restores complete bag and gold',
      JSON.stringify(state.bag) === expected.bag && state.gold === expected.gold);
    console.log('RESULT: ' + passed + '/' + passed + ' PASS (isolated WS + SQLite integration; not live Render / devices)');
  } finally {
    try { if (a && a.ws.readyState === WebSocket.OPEN) await disconnect(a.ws); } catch {}
    try { if (b && b.ws.readyState === WebSocket.OPEN) await disconnect(b.ws); } catch {}
    if (s1) await s1.close();
    if (s2) await s2.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(err => { console.error('FAIL isolated combat + persistence:', err); process.exitCode = 1; });
