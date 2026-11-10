// การจำลองโลกเกมบนเซิร์ฟเวอร์: มอนสเตอร์ การต่อสู้ รางวัล HP การตาย
// ตรรกะแปลงมาจาก game/index.html (updMon, release, damageMon, gain, hitPlayer) — ส่วนภาพ/เอฟเฟกต์อยู่ในเครื่องผู้เล่น
'use strict';
const W = require('../shared/world.js');
const { T, CFG, Combat, BLOCKT, ZONES, SKILL_TABLE } = W;

// ---------- ตารางสกิลจาก CSV (data/Hmong_Legend_All_8_Class_Skills.csv = SKILL_TABLE ในเกม) ----------
// แถว: [อาชีพ, สาย, ชื่อ, 'a'|'p', สกิลเริ่มต้น, ขั้น, Job ปลดล็อก, ระดับสูงสุด, โบนัสต่อระดับ]
const CLASS = 'นักดาบ'; // รอบนี้มีอาชีพเดียวในเกม
const SKROWS = SKILL_TABLE.filter(r => r[0] === CLASS).map(r => ({ cls: r[0], path: r[1], name: r[2], type: r[3], start: r[4], tier: r[5], job: r[6], max: r[7], bonus: String(r[8] || '').trim() }));
const SKBYNAME = new Map(SKROWS.map(r => [r.name, r]));
// โบนัสต่อระดับ เช่น "พลังโจมตีกายภาพ 2 %" → {key:'พลังโจมตีกายภาพ', per:0.02}
const parseBonus = b => { const m = /^(.*?)\s+([\d.]+)\s*(%|จุดเปอร์เซ็นต์)$/.exec(b); return m ? { key: m[1].trim(), per: +m[2] / 100 } : null; };
// โบนัสที่เกมมีระบบรองรับแล้ว → ชื่อภายใน; ที่เหลือบันทึกระดับไว้แต่ยังไม่มีผล
const BONUS_KEYS = { 'พลังโจมตีกายภาพ': 'atkPct', 'พลังชีวิตสูงสุด': 'hpPct', 'โอกาสคริติคอล': 'crit', 'ความเสียหายสกิล': 'skillDmg',
  'ระยะเวลาบัฟและสถานะที่สร้าง': 'dur', 'รัศมีสกิลพื้นที่': 'radius', 'ความเร็วเคลื่อนที่': 'spd', 'ความเร็วฟื้นคูลดาวน์': 'cdr' };
const SKILL_POINTS = job => Math.min(50, job); // 1 แต้มเริ่มต้น + 1 แต้มต่อ Job เลเวลอัป (สูงสุด 50)
const DV = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
const HW = 8, HH = 5;

function makeZone(id) {
  const G = W.buildGrid(id);
  const tileBlocked = (x, y) => !W.inb(x, y) || BLOCKT.has(G.g[y][x]) || G.blocked.has(x + ',' + y);
  const pBlocked = (x, y) => tileBlocked(Math.floor(x / T), Math.floor(y / T));
  const boxBlocked = (x, y) => pBlocked(x - HW, y - HH) || pBlocked(x + HW, y - HH) || pBlocked(x - HW, y + HH) || pBlocked(x + HW, y + HH);
  const inSafe = (x, y) => G.D.safe(Math.floor(x / T), Math.floor(y / T));
  const findFree = (tx, ty) => {
    for (let r = 0; r < 9; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const x = tx + i, y = ty + j;
      if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => !tileBlocked(x + a, y + b))) return [(x + .5) * T, (y + .5) * T];
    }
    return [tx * T, ty * T];
  };
  const mons = [];
  let nid = 1;
  (G.D.spawns || []).forEach(sp => {
    const c = CFG.monsters[sp.type];
    for (let i = 0; i < sp.count; i++) {
      const [hx, hy] = findFree(sp.tx + (i - 1) * 3, sp.ty + (i % 2 ? 2 : -1));
      mons.push({ id: nid++, type: sp.type, c, x: hx, y: hy, hx, hy, hp: c.hp, state: 'idle', t: Math.random() * 2, atkT: 0, dir: 'S', wx: hx, wy: hy, respT: 0, markT: 0, markBonus: 0, target: null });
    }
  });
  return { id, G, mons, tileBlocked, pBlocked, boxBlocked, inSafe, pending: [], shots: [], events: [] };
}

function createSim({ rand = Math.random } = {}) {
  // rand เปลี่ยนได้ (setRand) สำหรับฉากทดสอบ
  const zones = {};
  for (const id of Object.keys(ZONES)) zones[id] = makeZone(id);
  const players = new Set();

  // ---------- ผู้เล่น ----------
  // ค่าสถานะ = ฐานตามเลเวล + อุปกรณ์ที่ใส่
  function stats(p) {
    const P = CFG.player, eq = p.c.eq || {};
    let atk = 0, def = 0, hp = 0;
    for (const id of Object.values(eq)) { const it = id && CFG.items[id]; if (it) { atk += it.atk || 0; def += it.def || 0; hp += it.hp || 0; } }
    const B = p.bon = skillBonus(p);
    p.maxHp = Math.round((P.baseHP + (p.c.lv - 1) * P.hpPerLv + hp) * (1 + B.hpPct)); p.atk = Math.round((P.baseAtk + (p.c.lv - 1) * P.atkPerLv + atk) * (1 + B.atkPct)); p.def = def;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }

  // ---------- สกิล / แต้มอัปสกิล ----------
  const skLv = (p, name) => (p.c.sk && p.c.sk[name]) || 0;
  // แต้มที่ใช้ = ระดับที่เพิ่มเกินระดับฟรี (สกิลเริ่มต้นได้ระดับ 1 ฟรี)
  const spentPoints = p => SKROWS.reduce((n, r) => n + Math.max(0, skLv(p, r.name) - (r.start ? 1 : 0)), 0);
  const freePoints = p => SKILL_POINTS(p.c.job) - spentPoints(p);
  // สกิลติดตัว: โบนัสชื่อเดียวกันบวกกันข้ามสาย (ตามคำอธิบายใน CSV)
  function skillBonus(p) {
    const B = { atkPct: 0, hpPct: 0, crit: 0, skillDmg: 0, dur: 0, radius: 0, spd: 0, cdr: 0, other: {} };
    for (const r of SKROWS) {
      const lv = skLv(p, r.name); if (r.type !== 'p' || !lv) continue;
      const b = parseBonus(r.bonus); if (!b) continue;
      const k = BONUS_KEYS[b.key];
      if (k) B[k] += b.per * lv; else B.other[b.key] = (B.other[b.key] || 0) + b.per * lv;
    }
    return B;
  }
  function learn(p, name) {
    const r = SKBYNAME.get(String(name)); if (!r) return 'invalid';
    if (p.c.job < r.job) return 'locked';
    if (skLv(p, name) >= r.max) return 'max';
    if (freePoints(p) <= 0) return 'no-points';
    p.c.sk[r.name] = skLv(p, r.name) + 1;
    stats(p); p.skDirty = true; p.dirty = true;
    return 'ok';
  }
  function addPlayer(p) {
    p.c.bag = Array.isArray(p.c.bag) ? p.c.bag.filter(s => s && CFG.items[s.id] && s.n > 0) : [];
    p.c.eq = Object.assign({ weapon: null, armor: null, acc: null }, p.c.eq || {});
    p.c.sk = Object.assign({}, p.c.sk || {});
    for (const r of SKROWS) if (r.start && !p.c.sk[r.name]) p.c.sk[r.name] = 1; // สกิลเริ่มต้นได้ระดับ 1 ฟรี
    Object.assign(p, { hp: 0, dead: false, deadT: 0, cd: {}, castUntil: 0, buffT: 0, buffBonus: 0, guardT: 0, guardRed: 0, personal: [], potionAt: 0, bagDirty: true, skDirty: true });
    stats(p); p.hp = p.maxHp; players.add(p);
  }

  // ---------- กระเป๋า / อุปกรณ์ ----------
  const B = CFG.bag;
  // ใส่ของเข้ากระเป๋า: ของใช้/วัตถุดิบซ้อนได้ถึง B.stack, อุปกรณ์ช่องละชิ้น — คืนจำนวนที่ใส่ได้จริง
  function addItem(p, id, n) {
    const it = CFG.items[id]; if (!it || n <= 0) return 0;
    const bag = p.c.bag; let left = n;
    if (it.type !== 'eq') for (const s of bag) { if (s.id !== id || left <= 0) continue; const k = Math.min(left, B.stack - s.n); s.n += k; left -= k; }
    while (left > 0 && bag.length < B.slots) { const k = it.type === 'eq' ? 1 : Math.min(left, B.stack); bag.push({ id, n: k }); left -= k; }
    if (left < n) { p.bagDirty = true; p.dirty = true; }
    if (left > 0) p.personal.push({ k: 'bagfull', id, lost: left });
    return n - left;
  }
  function rollDrops(p, m) {
    for (const [id, chance, n] of CFG.drops[m.type] || []) {
      if (rand() >= chance) continue;
      const got = addItem(p, id, n);
      if (got) p.personal.push({ k: 'loot', id, n: got, from: m.id });
    }
  }
  // คำขอจากเครื่องผู้เล่น: use / equip (ช่องในกระเป๋า) หรือ unequip (ชื่อช่องอุปกรณ์)
  function inv(p, op, arg, now) {
    if (p.dead) return 'dead';
    const bag = p.c.bag;
    if (op === 'use' || op === 'equip') {
      const i = Math.floor(+arg), s = bag[i]; if (!Number.isInteger(i) || !s) return 'empty';
      const it = CFG.items[s.id];
      if (op === 'use') {
        if (it.type !== 'use') return 'not-usable';
        if (now < p.potionAt) return 'cooldown';
        if (p.hp >= p.maxHp) return 'hp-full';
        p.hp = Math.min(p.maxHp, p.hp + it.heal); p.potionAt = now + B.potionCd;
        if (--s.n <= 0) bag.splice(i, 1);
      } else {
        if (it.type !== 'eq') return 'not-equip';
        const old = p.c.eq[it.slot];
        p.c.eq[it.slot] = s.id;
        if (old) bag[i] = { id: old, n: 1 }; else bag.splice(i, 1);
        stats(p);
      }
    } else if (op === 'unequip') {
      if (!Object.prototype.hasOwnProperty.call(p.c.eq, arg) || !p.c.eq[arg]) return 'empty';
      if (bag.length >= B.slots) return 'bag-full';
      bag.push({ id: p.c.eq[arg], n: 1 }); p.c.eq[arg] = null; stats(p);
    } else return 'invalid';
    p.bagDirty = true; p.dirty = true;
    return 'ok';
  }
  function removePlayer(p) { players.delete(p); for (const z of Object.values(zones)) for (const m of z.mons) if (m.target === p) m.target = null; }
  const zoneOf = p => zones[p.c.zone];

  // ตรวจเส้นทางเดิน: ทุก 8 px ต้องไม่ชนช่องกีดขวาง
  function pathClear(zone, x0, y0, x1, y1) {
    const z = zones[zone], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
    for (let k = 1; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; if (z.boxBlocked(x, y)) return false; }
    return true;
  }
  // ระยะพุ่ง/ถอย คิดจากจุดเริ่มที่กำหนด (ไม่ใช่ตำแหน่งปัจจุบัน) เพื่อให้ผลเหมือนเดิมเสมอ
  // แม้ข้อความตำแหน่งจากเครื่องผู้เล่นจะมาถึงก่อนหรือหลังการคิดท่า
  const dashFrom = (z, x, y, dir, dist, sgn) => {
    const [ux, uy] = DV[dir];
    for (let k = 0; k < dist; k += 4) { const nx = x + ux * 4 * sgn, ny = y + uy * 4 * sgn; if (z.boxBlocked(nx, ny)) break; x = nx; y = ny; }
    return [x, y];
  };
  const place = (p, xy) => { p.c.x = xy[0]; p.c.y = xy[1]; p.dirty = true; };

  function gain(p, e, j) {
    const c = p.c, P = CFG.player;
    if (c.lv < P.maxLv) { c.exp += e; while (c.lv < P.maxLv && c.exp >= CFG.expCurve(c.lv)) { c.exp -= CFG.expCurve(c.lv); c.lv++; stats(p); p.hp = p.maxHp; p.personal.push({ k: 'lv', lv: c.lv }); } }
    if (c.job < P.maxJob) { c.jexp += j; while (c.job < P.maxJob && c.jexp >= CFG.jobCurve(c.job)) { c.jexp -= CFG.jobCurve(c.job); c.job++; p.personal.push({ k: 'job', job: c.job }); p.skDirty = true; } }
    p.dirty = true;
  }

  function damageMon(p, z, m, mult) {
    mult *= (p.buffT > 0 ? 1 + p.buffBonus : 1) * (m.markT > 0 ? 1 + m.markBonus : 1);
    const r = Combat.damage(p.atk, mult, rand(), rand() - (p.bon ? p.bon.crit : 0)); // โอกาสคริติคอล = 10% + โบนัสสกิลติดตัว
    m.hp -= r.dmg; z.events.push({ k: 'dmg', id: m.id, dmg: r.dmg, crit: r.crit, by: p.id });
    if (m.state === 'idle' || m.state === 'return') { m.state = 'chase'; m.target = p; }
    if (m.hp <= 0) {
      m.state = 'dead'; m.respT = m.c.respawn; m.target = null; p.kills = (p.kills || 0) + 1;
      gain(p, m.c.exp, m.c.job);
      rollDrops(p, m);
      z.events.push({ k: 'kill', id: m.id, by: p.id });
      p.personal.push({ k: 'reward', id: m.id, exp: m.c.exp, job: m.c.job });
    }
  }
  const alive = z => z.mons.filter(m => m.state !== 'dead');
  function doHit(p, z, sk, mult, ox, oy, dir) {
    let hits = 0;
    for (const m of alive(z)) { if (!Combat.inShape(sk, sk.range + m.c.size, ox, oy, dir, m.x, m.y - m.c.size * .6)) continue; damageMon(p, z, m, mult); hits++; }
    return hits;
  }
  const later = (z, t, f) => z.pending.push({ t, f });

  // ผลของท่า (ส่วนคำนวณของ release() ในเกม)
  function release(p, sk, from) {
    const z = zoneOf(p); if (!z || p.dead || p.c.zone !== from.zone) return;
    const sx = from.x, sy = from.y, ox = sx, oy = sy - 14, dir = from.dir, [ux, uy] = DV[dir];
    switch (sk.shape) {
      case 'move': return place(p, dashFrom(z, sx, sy, dir, sk.dist, 1));
      case 'guard': p.guardT = sk.dur; p.guardRed = sk.red; return;
      case 'buff': p.buffT = sk.dur; p.buffBonus = sk.bonus; return;
      case 'mark': for (const m of alive(z)) { if (!Combat.inShape(sk, sk.range + m.c.size, ox, oy, dir, m.x, m.y - m.c.size * .6)) continue; damageMon(p, z, m, sk.mult); m.markT = sk.markDur; m.markBonus = sk.markBonus; } return;
      case 'dash': doHit(p, z, { shape: 'line', range: sk.range, width: sk.width }, sk.mult, ox, oy, dir); return place(p, dashFrom(z, sx, sy, dir, sk.range, 1));
      case 'counter': { const e = dashFrom(z, sx, sy, dir, sk.back, -1); place(p, e); return doHit(p, z, sk, sk.mult, e[0], e[1] - 14, dir); }
      case 'tri': {
        const [ex, ey] = dashFrom(z, sx, sy, dir, 40, 1); place(p, [ex, ey]);
        doHit(p, z, { shape: 'line', range: 90, width: 26 }, sk.mult, ex - ux * 40, ey - 14 - uy * 40, dir);
        later(z, .15, () => { const cx = ex + ux * 40, cy = ey - 14 + uy * 40; for (const m of alive(z)) if (Math.hypot(m.x - cx, m.y - m.c.size * .6 - cy) <= 66 + m.c.size) damageMon(p, z, m, sk.mult); });
        later(z, .3, () => doHit(p, z, { shape: 'line', range: 190, width: 30 }, sk.mult, ex, ey - 14, dir));
        return;
      }
      case 'pillar': { const tx = ox + ux * sk.dist, ty = oy + uy * sk.dist + 14; later(z, .12, () => { for (const m of alive(z)) if (Math.hypot(m.x - tx, m.y - ty) <= sk.radius + m.c.size) damageMon(p, z, m, sk.mult); }); return; }
      case 'wave': z.shots.push({ p, x: ox, y: oy, ux, uy, sk, dist: 0, hit: new Set() }); return;
      case 'spikes':
        for (let k = 0; k < sk.n; k++) later(z, k * .09, () => { const cx = ox + ux * (40 + k * sk.step), cy = oy + uy * (40 + k * sk.step) + 8; for (const m of alive(z)) if (Math.hypot(m.x - cx, m.y - cy) <= sk.radius + m.c.size) damageMon(p, z, m, sk.mult); });
        return;
      default: doHit(p, z, sk, sk.mult, ox, oy, dir);
    }
  }

  const LAG = .15; // เผื่อความหน่วงเครือข่ายตอนตรวจคูลดาวน์
  // คำขอโจมตี/ใช้สกิลจากเครื่องผู้เล่น — ตรวจทุกเงื่อนไขก่อน
  function act(p, key, now) {
    if (p.dead) return 'dead';
    const sk = key === 'b' ? CFG.basic : CFG.skills[key - 1];
    if (!sk) return 'invalid';
    if (key !== 'b' && (p.c.job < sk.job || skLv(p, sk.name) < 1)) return 'locked'; // ต้องถึง Job และอัปสกิลแล้วอย่างน้อยระดับ 1
    if ((p.cd[key] || 0) > now + LAG) return 'cooldown';
    if (p.castUntil > now + LAG) return 'busy';
    const B = p.bon || skillBonus(p);
    p.cd[key] = now + sk.cd * Math.max(.5, 1 - B.cdr); p.castUntil = now + sk.poseT;
    // ค่าที่ใช้จริงของท่านี้ = ค่าใน CFG ปรับด้วยโบนัสสกิลติดตัว
    const eff = Object.assign({}, sk);
    if (key !== 'b' && eff.mult) eff.mult = sk.mult * (1 + B.skillDmg);
    for (const k of ['dur', 'markDur']) if (eff[k]) eff[k] = sk[k] * (1 + B.dur);
    if (eff.radius) eff.radius = sk.radius * (1 + B.radius);
    if (sk.shape === 'circle') eff.range = sk.range * (1 + B.radius);
    const from = { zone: p.c.zone, x: p.c.x, y: p.c.y, dir: p.c.dir };
    later(zoneOf(p), sk.poseT * .6, () => release(p, eff, from));
    return 'ok';
  }

  function hitPlayer(p, m) {
    const r = Combat.damage(m.c.atk, 1, rand(), 1);
    r.dmg = Math.max(1, r.dmg - (p.def || 0)); // เกราะลดดาเมจแบบหักตรง (ค่าชั่วคราว)
    if (p.guardT > 0) r.dmg = Math.max(1, Math.round(r.dmg * (1 - p.guardRed)));
    p.hp -= r.dmg; p.personal.push({ k: 'hurt', dmg: r.dmg, guard: p.guardT > 0, by: m.id });
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deadT = CFG.player.respawnSec; p.personal.push({ k: 'dead' }); for (const z of Object.values(zones)) for (const mm of z.mons) if (mm.target === p) mm.target = null; }
  }

  function monMove(z, m, tx, ty, sp, dt) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy); if (d < 2) return true;
    const s = Math.min(d, sp * dt), nx = m.x + dx / d * s, ny = m.y + dy / d * s, r = m.c.size * .6;
    const mb = (x, y) => z.pBlocked(x - r, y - 3) || z.pBlocked(x + r, y - 3) || z.pBlocked(x - r, y + 3) || z.pBlocked(x + r, y + 3);
    if (!mb(nx, m.y)) m.x = nx; if (!mb(m.x, ny)) m.y = ny;
    m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    return false;
  }
  function updMon(z, m, dt, here) {
    if (m.state === 'dead') { m.respT -= dt; if (m.respT <= 0) { m.state = 'idle'; m.hp = m.c.hp; m.x = m.hx; m.y = m.hy; m.markT = 0; } return; }
    m.atkT = Math.max(0, m.atkT - dt); m.markT = Math.max(0, m.markT - dt);
    const hd = Math.hypot(m.x - m.hx, m.y - m.hy);
    if (m.state === 'return') { if (monMove(z, m, m.hx, m.hy, m.c.speed * 1.4, dt)) { m.state = 'idle'; m.hp = m.c.hp; } return; }
    if (m.state === 'chase') {
      const p = m.target;
      if (!p || p.dead || !here.includes(p) || hd > m.c.leash || z.inSafe(p.c.x, p.c.y)) { m.state = 'return'; m.target = null; return; }
      const pd = Math.hypot(p.c.x - m.x, p.c.y - m.y);
      if (pd > m.c.atkRange) monMove(z, m, p.c.x, p.c.y, m.c.speed, dt); else if (m.atkT <= 0) { m.atkT = m.c.atkCd; hitPlayer(p, m); }
      return;
    }
    if (m.c.aggro > 0) {
      let best = null, bd = m.c.aggro;
      for (const p of here) { if (p.dead || z.inSafe(p.c.x, p.c.y)) continue; const d = Math.hypot(p.c.x - m.x, p.c.y - m.y); if (d < bd) { bd = d; best = p; } }
      if (best) { m.state = 'chase'; m.target = best; return; }
    }
    m.t -= dt; if (m.t <= 0) { m.t = 1.5 + rand() * 2.5; const a = rand() * 6.283, r = rand() * 40; m.wx = m.hx + Math.cos(a) * r; m.wy = m.hy + Math.sin(a) * r; }
    monMove(z, m, m.wx, m.wy, m.c.speed * .35, dt);
  }

  function step(dt, now) {
    for (const p of players) {
      p.buffT = Math.max(0, p.buffT - dt); p.guardT = Math.max(0, p.guardT - dt);
      if (p.dead) { p.deadT -= dt; if (p.deadT <= 0) { const h = CFG.player.home, s = ZONES[h].start; p.dead = false; p.hp = p.maxHp; p.c.zone = h; p.c.x = s[0]; p.c.y = s[1]; p.c.dir = 'S'; p.personal.push({ k: 'respawn', zone: h, x: s[0], y: s[1] }); p.dirty = true; } }
      else if (zones[p.c.zone].inSafe(p.c.x, p.c.y) && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + CFG.player.regenSafe * dt);
    }
    for (const z of Object.values(zones)) {
      const here = [...players].filter(p => p.c.zone === z.id);
      for (let i = z.pending.length - 1; i >= 0; i--) { z.pending[i].t -= dt; if (z.pending[i].t <= 0) { const f = z.pending[i].f; z.pending.splice(i, 1); f(); } }
      for (let i = z.shots.length - 1; i >= 0; i--) {
        const s = z.shots[i], d = s.sk.speed * dt; s.x += s.ux * d; s.y += s.uy * d; s.dist += d;
        for (const m of alive(z)) { if (s.hit.has(m)) continue; if (Math.hypot(m.x - s.x, (m.y - m.c.size * .6) - s.y) <= s.sk.width / 2 + m.c.size) { s.hit.add(m); damageMon(s.p, z, m, s.sk.mult); } }
        if (s.dist >= s.sk.range) z.shots.splice(i, 1);
      }
      for (const m of z.mons) updMon(z, m, dt, here);
    }
  }

  return { zones, players, addPlayer, removePlayer, act, step, pathClear, stats, gain, addItem, inv, learn, freePoints, skLv, skillBonus, SKROWS, setRand(f) { rand = f; } };
}
module.exports = { createSim };
