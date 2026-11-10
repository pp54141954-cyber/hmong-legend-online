// ฐานข้อมูล: SQLite ที่มากับ Node.js (node:sqlite) — เปลี่ยนเป็น PostgreSQL ได้โดยแทนที่ไฟล์นี้ไฟล์เดียว
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');

function open(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS characters (
      account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
      name TEXT NOT NULL,
      zone TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, dir TEXT NOT NULL,
      lv INTEGER NOT NULL, exp INTEGER NOT NULL, job INTEGER NOT NULL, jexp INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      expire_at INTEGER NOT NULL
    );`);

  const hash = pass => {
    const salt = crypto.randomBytes(16);
    return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pass, salt, 32).toString('hex');
  };
  const verify = (pass, stored) => {
    const [, s, h] = stored.split('$');
    const got = crypto.scryptSync(pass, Buffer.from(s, 'hex'), 32);
    return crypto.timingSafeEqual(got, Buffer.from(h, 'hex'));
  };
  const q = {
    insAcc: db.prepare('INSERT INTO accounts (username, password_hash, created_at) VALUES (?, ?, ?)'),
    getAcc: db.prepare('SELECT * FROM accounts WHERE username = ?'),
    insChar: db.prepare('INSERT INTO characters VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    getChar: db.prepare('SELECT * FROM characters WHERE account_id = ?'),
    saveChar: db.prepare('UPDATE characters SET zone=?, x=?, y=?, dir=?, lv=?, exp=?, job=?, jexp=?, updated_at=? WHERE account_id=?'),
    insSess: db.prepare('INSERT INTO sessions VALUES (?, ?, ?)'),
    getSess: db.prepare('SELECT * FROM sessions WHERE token = ? AND expire_at > ?'),
    delOld: db.prepare('DELETE FROM sessions WHERE expire_at <= ?'),
  };

  return {
    register(username, pass, start) {
      if (q.getAcc.get(username)) return { error: 'ชื่อนี้มีผู้ใช้แล้ว' };
      const r = q.insAcc.run(username, hash(pass), Date.now());
      const id = Number(r.lastInsertRowid);
      q.insChar.run(id, username, start.zone, start.x, start.y, 'S', 1, 0, 1, 0, Date.now());
      return { id };
    },
    login(username, pass) {
      const a = q.getAcc.get(username);
      if (!a || !verify(pass, a.password_hash)) return { error: 'ชื่อหรือรหัสผ่านไม่ถูกต้อง' };
      return { id: a.id };
    },
    newSession(accountId, ttlMs) {
      q.delOld.run(Date.now());
      const token = crypto.randomBytes(32).toString('hex');
      q.insSess.run(token, accountId, Date.now() + ttlMs);
      return token;
    },
    session(token) { return typeof token === 'string' ? q.getSess.get(token, Date.now()) : undefined; },
    character(accountId) { return q.getChar.get(accountId); },
    save(c) { q.saveChar.run(c.zone, c.x, c.y, c.dir, c.lv, c.exp, c.job, c.jexp, Date.now(), c.account_id); },
    close() { db.close(); },
  };
}
module.exports = { open };
