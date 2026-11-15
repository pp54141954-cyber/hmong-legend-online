// Hmong Legend V2-R83 — ทุกเหตุผลที่เซิร์ฟเวอร์ส่งกลับสำหรับกระเป๋าและร้านค้า มีข้อความแจ้งผลในเกม (ไม่ใช้เบราว์เซอร์)
// รัน: node tools/feedback-contract-test.js
// อ่านซอร์สจริงของ server/sim.js, server/server.js และ game/index.html — ไม่คัดลอกรายการมาเทียบเอง
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sim = fs.readFileSync(path.join(root, 'server/sim.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/server.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'game/index.html'), 'utf8');
let checks = 0;
const failures = [];
function check(name, ok) {
  checks++;
  if (ok) console.log('PASS ' + name);
  else { failures.push(name); console.log('FAIL ' + name); }
}

// เหตุผลที่ฟังก์ชันส่งคืน (ไม่รวม ok) — ตัดขอบเขตที่ฟังก์ชันถัดไปของ sim
function reasonsIn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('ไม่พบฟังก์ชัน ' + name);
  const next = src.indexOf('\n  function ', start + 10);
  const body = src.slice(start, next > 0 ? next : src.length);
  return [...new Set([...body.matchAll(/return '([a-z-]+)'/g)].map(m => m[1]))].filter(r => r !== 'ok').sort();
}

const invReasons = reasonsIn(sim, 'inv');
const buyReasons = reasonsIn(sim, 'buy');
const saveReasons = [...server.matchAll(/return '(save-error)'/g)].map(m => m[1]);

// ตารางข้อความในเกม: ดึงเฉพาะวัตถุ FB จากซอร์ส แล้วประเมินเป็นค่า
const fbStart = html.indexOf('const FB={');
const fbEnd = html.indexOf('const fbText=');
// ถ้ายังไม่มีตาราง ให้ถือว่าว่างทั้งหมด เพื่อรายงานทุกข้อความที่ขาดในครั้งเดียว
const FB = fbStart > 0 && fbEnd > fbStart
  ? new Function('return ' + html.slice(fbStart, fbEnd).replace(/^const FB=/, '').trim().replace(/;$/, ''))()
  : { shop: {}, use: {}, equip: {}, unequip: {} };
const FB_SAVE = (html.match(/const FB_SAVE='([^']+)'/) || [])[1] || '';
const FB_OFFLINE = (html.match(/const FB_OFFLINE='([^']+)'/) || [])[1] || '';
const thai = /[฀-๿]/;

check('เซิร์ฟเวอร์มีเหตุผล save-error สำหรับกระเป๋าและร้านค้า', saveReasons.length === 1);
check('ข้อความ save-error บอกว่ายังไม่ได้ทำรายการ และไม่บอกว่าสำเร็จ',
  FB_SAVE.includes('ยังไม่ได้') && !/สำเร็จแล้ว|ซื้อแล้ว|ใช้แล้ว|สวมแล้ว/.test(FB_SAVE));
check('ข้อความขาดการเชื่อมต่อบอกว่ายังไม่ได้ทำรายการ', FB_OFFLINE.includes('ยังไม่ได้ทำรายการ'));

const missingShop = buyReasons.filter(r => !(r in FB.shop));
check('ร้านค้า: ทุกเหตุผลที่ buy() ส่งกลับมีข้อความ (' + buyReasons.join(', ') + ')', missingShop.length === 0);

// ข้อความกระเป๋า: แต่ละคำสั่งต้องมีเหตุผลที่เกี่ยวข้อง (ตามเงื่อนไขในซอร์ส)
const expectedInv = {
  use: ['cooldown', 'dead', 'empty', 'hp-full', 'invalid', 'not-usable'],
  equip: ['dead', 'empty', 'invalid', 'not-equip', 'wrong-class'],
  unequip: ['bag-full', 'dead', 'empty', 'invalid'],
};
for (const op of Object.keys(expectedInv)) {
  const missing = expectedInv[op].filter(r => !(r in FB[op]));
  check('กระเป๋า ' + op + ': มีข้อความครบ ' + expectedInv[op].length + ' เหตุผล', missing.length === 0);
}
const unknownInv = invReasons.filter(r => !Object.values(expectedInv).flat().includes(r));
check('กระเป๋า: ทุกเหตุผลที่ inv() ส่งกลับอยู่ในรายการที่ตรวจ (' + invReasons.join(', ') + ')', unknownInv.length === 0);

// ทุกข้อความต้องเป็นภาษาไทยและไม่ว่าง
const texts = [...Object.values(FB.shop), ...Object.values(FB.use), ...Object.values(FB.equip), ...Object.values(FB.unequip), FB_SAVE, FB_OFFLINE];
check('ทุกข้อความไม่ว่างและเป็นภาษาไทย (' + texts.length + ' ข้อความ)', texts.every(t => t && thai.test(t)));
check('ไม่มีข้อความยาวเกิน 80 ตัวอักษร', texts.every(t => t.length <= 80));

// ทางส่งข้อความ: คำสั่งกระเป๋า/ร้านค้าต้องแจ้งเมื่อส่งไม่ได้ และผลตอบกลับต้องใช้ fbText
const sendStart = html.indexOf('function send(o){');
const sendBody = sendStart > 0 ? html.slice(sendStart, sendStart + 320) : '';
check('send() แจ้งผู้เล่นเมื่อคำสั่งกระเป๋า/ร้านค้าส่งไม่ได้ และคืนค่าสำเร็จหรือไม่', /FB_OFFLINE/.test(sendBody) && /return true/.test(sendBody) && /return false/.test(sendBody));
check('ผลปฏิเสธร้านค้าใช้ fbText (ไม่ใช้ตารางเดิม)', html.includes("HL.say(fbText('shop',m.r),4)"));
check('ผลปฏิเสธกระเป๋าใช้ fbText พร้อม op และเวลาที่เหลือ (wait) ที่เซิร์ฟเวอร์ส่งมา', html.includes("HL.say(fbText('inv',m.r,m.op,m.wait),4)"));
check('คูลดาวน์ยาแสดงเวลาที่เหลือในข้อความ', html.includes("'ยานี้ยังอยู่ในช่วงรอ · ใช้ได้อีกใน '+w+' วินาที'"));
check('เซิร์ฟเวอร์แนบ wait เฉพาะผลคูลดาวน์ยา และ sim คำนวณจากเวลาที่เหลือ', /wait: p\.potionWait/.test(server) && /p\.potionWait = Math\.max\(0\.1/.test(sim));
check('ไม่เหลือการอ้างอิงตารางเดิม SHOP_MSG / DENY', !html.includes('SHOP_MSG') && !html.includes('DENY['));
check('say() รับระยะเวลาแสดงข้อความ (ข้อผิดพลาดแสดงนานกว่า 2.4 วินาที)', html.includes('msgT=sec||2.4'));
check('เซิร์ฟเวอร์ส่ง op ของคำสั่งกระเป๋ากลับมาในการปฏิเสธ', /k: 'inv', op: m\.op, r/.test(server));

console.log('RESULT: ' + (checks - failures.length) + '/' + checks + ' PASS (feedback contract, ไม่ใช้เบราว์เซอร์)');
process.exitCode = failures.length ? 1 : 0;
