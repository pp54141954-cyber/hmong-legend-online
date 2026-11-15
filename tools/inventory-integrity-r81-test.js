// Inventory R81 safety regression: isolated server-authoritative behavior, no real player data.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSim } = require('../server/sim.js');
const { open } = require('../server/db.js');
const { CFG, W, ZONES } = require('../shared/world.js');

const smith = CFG.npcs.find(n => n.role === 'smith');
assert(smith, 'a smith NPC must exist');
const stone = CFG.enhance.stone;
const cost = CFG.enhance.steps[0];
assert(cost && cost.stone > 0 && cost.rate > 0, 'enhancement must have a valid first step');
const sim = createSim({ rand: () => 0 });
const makePlayer = (name, bag, equipment = { weapon: 'sword_wood', offhand: null, armor: null, acc: null }) => {
  const p = { id: name, personal: [], c: {
    name, zone: smith.zone, x: smith.tx * W.T, y: smith.ty * W.T, dir: 'S',
    lv: 20, exp: 0, job: 10, jexp: 0, cls: 'นักดาบ', clsset: 1, starter: 1,
    bag, eq: equipment, enh: {}, sk: {}, st: CFG.stats.clean({}), look: {}, gold: 500000
  }};
  sim.addPlayer(p);
  return p;
};

// Regression: the protection stone sits BEFORE the weapon in the backpack.
// takeItem() splices that material slot, shifting all following indices.
// The enhancement must still be applied to the ORIGINAL weapon, not the next item.
const p = makePlayer('shifted-slot', [
  { id: stone, n: cost.stone },
  { id: 'sword_iron', n: 1 },
  { id: 'hide', n: 2 }
]);
const beforeGold = p.c.gold;
const result = sim.enhance(p, { src: 'bag', i: 1, rid: 'bag-weapon-after-stone' }, 1000);
assert.equal(typeof result, 'object', 'enhancement must return result');
assert.equal(result.ok, true, 'deterministic success');
assert.equal(result.from, 0);
assert.equal(result.to, 1);
assert.equal(beforeGold - p.c.gold, cost.gold, 'gold charged once');
const weapon = p.c.bag.find(s => s.id === 'sword_iron');
const hide = p.c.bag.find(s => s.id === 'hide');
assert(weapon && weapon.enh === 1, 'enhancement stays on selected sword after index shift');
assert(hide && hide.n === 2 && !hide.enh, 'material behind shifted sword must not be enhanced');
assert.equal(p.c.bag.reduce((n, s) => n + (s.id === stone ? s.n : 0), 0), 0, 'stone consumed exactly once');
assert.equal(sim.enhance(p, { src: 'bag', i: 1, rid: 'bag-weapon-after-stone' }, 1002), 'dup', 'duplicate request rejected');
assert.equal(beforeGold - p.c.gold, cost.gold, 'duplicate request never consumes resources again');

// Equip/unequip transfers the same enhanced item with no copy or lost +level.
let i = p.c.bag.findIndex(s => s.id === 'sword_iron');
assert.equal(sim.inv(p, 'equip', i, 2000), 'ok');
assert.equal(p.c.eq.weapon, 'sword_iron');
assert.equal(p.c.enh.weapon, 1);
assert.equal(p.c.bag.filter(s => s.id === 'sword_iron').length, 0);
assert.equal(sim.inv(p, 'unequip', 'weapon', 2001), 'ok');
assert.equal(p.c.eq.weapon, null);
assert.equal(p.c.bag.filter(s => s.id === 'sword_iron' && s.enh === 1).length, 1);

// Untrusted WebSocket inputs cannot be coerced into the wrong inventory slot.
const snapshot = JSON.stringify(p.c.bag);
for (const slot of [-1, 0.5, '0', null, {}, Infinity]) {
  assert.equal(sim.inv(p, 'equip', slot, 2002), 'empty', 'reject non-integer slot ' + String(slot));
  assert.equal(JSON.stringify(p.c.bag), snapshot, 'rejected command did not mutate bag');
}
assert.equal(sim.inv(p, 'unequip', '__proto__', 2002), 'empty');

// Full bag must not drop a currently equipped weapon on failed unequip.
const full = makePlayer('full-bag',
  Array.from({ length: CFG.bag.slots }, (_, j) => ({ id: 'potion_s', n: 1 })),
  { weapon: 'sword_iron', offhand: null, armor: null, acc: null });
full.c.enh.weapon = 8;
const fullSnapshot = JSON.stringify(full.c.bag);
assert.equal(sim.inv(full, 'unequip', 'weapon', 3000), 'bag-full');
assert.equal(full.c.eq.weapon, 'sword_iron');
assert.equal(full.c.enh.weapon, 8);
assert.equal(JSON.stringify(full.c.bag), fullSnapshot);

// Potion consumption is server-authoritative, respects HP and cooldown, and removes only one unit.
const heal = makePlayer('healing', [{ id: 'potion_s', n: 2 }]);
const max = heal.maxHp;
assert.equal(sim.inv(heal, 'use', 0, 10), 'hp-full');
heal.hp = Math.max(1, max - 150);
assert.equal(sim.inv(heal, 'use', 0, 10), 'ok');
assert.equal(heal.c.bag[0].n, 1);
assert(heal.hp > max - 150 && heal.hp <= max);
assert.equal(sim.inv(heal, 'use', 0, 10), 'cooldown');
assert.equal(heal.c.bag[0].n, 1);

// Round-trip through SQLite: +level, count and money survive database reopen.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-inventory-r81-'));
try {
  const file = path.join(tmp, 'game.db');
  let db = open(file);
  const reg = db.register('BagIntegrity', 'secret123', { zone: smith.zone, x: smith.tx * W.T, y: smith.ty * W.T });
  assert(reg.id);
  let c = db.character(reg.id);
  c.starter = 1;
  c.bag = p.c.bag;
  c.eq = p.c.eq;
  c.enh = p.c.enh;
  c.gold = p.c.gold;
  db.save(c);
  db.close();
  db = open(file);
  c = db.character(reg.id);
  assert.equal(c.bag.filter(s => s.id === 'sword_iron' && s.enh === 1).length, 1);
  assert.equal(c.gold, p.c.gold);
  assert.equal(c.bag.reduce((n,s) => n + (s.id === stone ? s.n : 0), 0), 0);
  db.close();
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log('PASS: inventory slot validation, shifted-stone enhancement, duplicates, equip/unequip, full bag, potion, SQLite persistence');
