// ดึงข้อมูลกติกาเกม (ผังโซน การชน CFG สูตรต่อสู้) จาก game/index.html ไปเป็น shared/world.js ให้เซิร์ฟเวอร์ใช้
// ไฟล์เกมเป็นต้นฉบับชุดเดียว — แก้เกมแล้วรันสคริปต์นี้ใหม่: node tools/extract-shared.js
// tools/online-test.js ตรวจว่าผลที่ดึงได้ตรงกับเกมที่รันจริง (ช่องชนทุกช่อง + CFG)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'game/index.html'), 'utf8');

const grab = (startRe, endRe, label) => {
  const s = src.search(startRe); if (s < 0) throw new Error('ไม่พบจุดเริ่ม: ' + label);
  const rest = src.slice(s), e = rest.search(endRe); if (e < 0) throw new Error('ไม่พบจุดจบ: ' + label);
  return rest.slice(0, e);
};
const consts = grab(/const T=32,COLS=/, /\nconst mk=/, 'consts');
const zones = grab(/const ZONES=\{/, /\n\/\* =+ สร้างโซน/, 'ZONES');
const build = grab(/function buildZone\(id\)\{/, /\n \/\* วาดพื้น \*\//, 'buildZone');
const cfg = grab(/const CFG=\{/, /\nconst Combat=\{/, 'CFG');
const combat = grab(/const Combat=\{/, /\nconst PS=\{/, 'Combat');

const out = `// ไฟล์นี้สร้างอัตโนมัติจาก game/index.html โดย tools/extract-shared.js — ห้ามแก้ด้วยมือ
'use strict';
${consts}
${zones}
${build.replace('function buildZone(id){', 'function buildGrid(id){')}
 return {id,D,g,hgt,blocked};
}
const BLOCKT=new Set([WA,CF,BD,CR]);
${cfg}
${combat}
module.exports={T,COLS,ROWS,W,H,inb,TYPES:{GR,PA,WA,BR,ST,CR,BD,CV,CF,EX},BLOCKT,ZONES,buildGrid,CFG,Combat};
`;
fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
fs.writeFileSync(path.join(root, 'shared/world.js'), out);
const W = require(path.join(root, 'shared/world.js'));
console.log('shared/world.js: zones=' + Object.keys(W.ZONES).join(',') + ' skills=' + W.CFG.skills.length + ' monsters=' + Object.keys(W.CFG.monsters).length);
