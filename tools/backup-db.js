// สำรองฐานข้อมูลแบบปลอดภัยขณะเซิร์ฟเวอร์ทำงาน (SQLite VACUUM INTO) และเก็บไว้ N ชุดล่าสุด
// ใช้: node tools/backup-db.js [ไฟล์ฐานข้อมูล] [โฟลเดอร์สำรอง] [เก็บกี่ชุด=14]
const { DatabaseSync } = require('node:sqlite'); const fs = require('fs'), path = require('path');
const src = process.argv[2] || process.env.DB_FILE || path.join(__dirname, '../server/data/hmong.db');
const dir = process.argv[3] || path.join(path.dirname(src), 'backups'), keep = +(process.argv[4] || 14);
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, 'hmong-' + new Date().toISOString().replace(/[:.]/g, '-') + '.db');
const db = new DatabaseSync(src); db.exec("VACUUM INTO '" + out.replace(/'/g, "''") + "'"); db.close();
const chk = new DatabaseSync(out, { readOnly: true }); const n = chk.prepare('SELECT COUNT(*) n FROM accounts').get().n; const ok = chk.prepare('PRAGMA integrity_check').get(); chk.close();
const old = fs.readdirSync(dir).filter(f => /^hmong-.*\.db$/.test(f)).sort(); for (const f of old.slice(0, Math.max(0, old.length - keep))) fs.unlinkSync(path.join(dir, f));
console.log('สำรองแล้ว ' + out + ' · บัญชี ' + n + ' · integrity ' + Object.values(ok)[0]);
