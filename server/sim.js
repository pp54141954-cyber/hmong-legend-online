// การจำลองโลกเกมบนเซิร์ฟเวอร์: มอนสเตอร์ การต่อสู้ รางวัล HP การตาย
// ตรรกะแปลงมาจาก game/index.html (updMon, release, damageMon, gain, hitPlayer) — ส่วนภาพ/เอฟเฟกต์อยู่ในเครื่องผู้เล่น
'use strict';
const W = require('../shared/world.js');
const { T, CFG, Combat, BLOCKT, ZONES } = W;
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
  const zones = {};
  for (const id of Object.keys(ZONES)) zones[id] = makeZone(id);
  const players = new Set();

  // ---------- ผู้เล่น ----------
  function stats(p) { const P = CFG.player; p.maxHp = P.baseHP + (p.c.lv - 1) * P.hpPerLv; p.atk = P.baseAtk + (p.c.lv - 1) * P.atkPerLv; }
  function addPlayer(p) {
    Object.assign(p, { hp: 0, dead: false, deadT: 0, cd: {}, castUntil: 0, buffT: 0, buffBonus: 0, guardT: 0, guardRed: 0, personal: [] });
    stats(p); p.hp = p.maxHp; players.add(p);
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
    if (c.job < P.maxJob) { c.jexp += j; while (c.job < P.maxJob && c.jexp >= CFG.jobCurve(c.job)) { c.jexp -= CFG.jobCurve(c.job); c.job++; p.personal.push({ k: 'job', job: c.job }); } }
    p.dirty = true;
  }

  function damageMon(p, z, m, mult) {
    mult *= (p.buffT > 0 ? 1 + p.buffBonus : 1) * (m.markT > 0 ? 1 + m.markBonus : 1);
    const r = Combat.damage(p.atk, mult, rand(), rand());
    m.hp -= r.dmg; z.events.push({ k: 'dmg', id: m.id, dmg: r.dmg, crit: r.crit, by: p.id });
    if (m.state === 'idle' || m.state === 'return') { m.state = 'chase'; m.target = p; }
    if (m.hp <= 0) {
      m.state = 'dead'; m.respT = m.c.respawn; m.target = null; p.kills = (p.kills || 0) + 1;
      gain(p, m.c.exp, m.c.job);
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
    if (key !== 'b' && p.c.job < sk.job) return 'locked';
    if ((p.cd[key] || 0) > now + LAG) return 'cooldown';
    if (p.castUntil > now + LAG) return 'busy';
    p.cd[key] = now + sk.cd; p.castUntil = now + sk.poseT;
    const from = { zone: p.c.zone, x: p.c.x, y: p.c.y, dir: p.c.dir };
    later(zoneOf(p), sk.poseT * .6, () => release(p, sk, from));
    return 'ok';
  }

  function hitPlayer(p, m) {
    const r = Combat.damage(m.c.atk, 1, rand(), 1);
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
      if (p.dead) { p.deadT -= dt; if (p.deadT <= 0) { const s = ZONES.village.start; p.dead = false; p.hp = p.maxHp; p.c.zone = 'village'; p.c.x = s[0]; p.c.y = s[1]; p.c.dir = 'S'; p.personal.push({ k: 'respawn', zone: 'village', x: s[0], y: s[1] }); p.dirty = true; } }
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

  return { zones, players, addPlayer, removePlayer, act, step, pathClear, stats, gain };
}
module.exports = { createSim };
