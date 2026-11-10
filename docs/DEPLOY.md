# คู่มือเปิดใช้งานจริง (V2-R22)

ชุดติดตั้ง: `Dockerfile` + `deploy/docker-compose.yml` (เกม + Caddy ขอใบรับรอง HTTPS ให้อัตโนมัติ)
ทดสอบแล้วในเครื่องทดสอบ: `node tools/deploy-test.js hmong-legend:test https://localhost/` ผ่าน 12/12

## สิ่งที่เจ้าของต้องเตรียม

| อย่าง | รายละเอียด | ค่าใช้จ่ายโดยประมาณ |
| --- | --- | --- |
| VPS 1 เครื่อง | Ubuntu 22.04/24.04, 2 vCPU, RAM 2 GB, ดิสก์ 20 GB — ผลทดสอบโหลด 50 คนใช้ CPU 10% ของ 4 vCPU และ RAM ~150 MB (`docs/LOAD_TEST.md`) | ~5–12 USD/เดือน (เช่น DigitalOcean, Vultr, Linode, Hetzner; เลือกศูนย์ข้อมูลสิงคโปร์ให้ใกล้ผู้เล่นไทย/ลาว) |
| ชื่อโดเมน | เช่น `hmonglegend.com` แล้วตั้ง DNS ระเบียน **A** ของ `game.<โดเมน>` ชี้ไปที่ IP ของ VPS | ~10–15 USD/ปี |
| อีเมล | สำหรับ Let's Encrypt แจ้งเตือนใบรับรอง | ฟรี |

ไม่ต้องใช้ API key หรือรหัสผ่านของบริการภายนอก

## ขั้นตอนบน VPS (ครั้งแรก ~15 นาที)

```sh
# 1) ติดตั้ง Docker
curl -fsSL https://get.docker.com | sh

# 2) เอาโค้ดลงเครื่อง
git clone -b claude/elephant-goldfish-setup-mvw06c https://github.com/pp54141954-cyber/hmong-legend-online.git
cd hmong-legend-online

# 3) ตั้งค่า
cp deploy/.env.example deploy/.env
nano deploy/.env        # แก้ DOMAIN=game.โดเมนของคุณ และ ACME_EMAIL

# 4) เปิดพอร์ต 80/443 แล้วรัน
sudo ufw allow 80,443/tcp   # ถ้าใช้ ufw
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# 5) ตรวจ
curl https://game.โดเมนของคุณ/healthz     # {"ok":true,...}
```

เปิด `https://game.โดเมนของคุณ` บนมือถือ → หน้าเข้าสู่ระบบ → สมัคร → เล่น

## อัปเดตเวอร์ชัน
```sh
cd hmong-legend-online && git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```
ข้อมูลผู้เล่นอยู่ใน volume `gamedata` ไม่หายเมื่ออัปเดต/รีสตาร์ต (ทดสอบแล้ว)

## สำรองข้อมูล (แนะนำทุกวัน)
```sh
# สำรองขณะเกมทำงาน (ปลอดภัย) เก็บ 14 ชุดล่าสุดใน volume
docker compose -f deploy/docker-compose.yml exec game node --no-warnings tools/backup-db.js /data/hmong.db /data/backups 14
# ตั้งเวลาอัตโนมัติ 04:10 ทุกวัน
( crontab -l; echo "10 4 * * * cd $PWD && docker compose -f deploy/docker-compose.yml exec -T game node --no-warnings tools/backup-db.js /data/hmong.db /data/backups 14" ) | crontab -
# คัดลอกออกนอกเครื่องเป็นครั้งคราว
docker compose -f deploy/docker-compose.yml cp game:/data/backups ./backups
```

## ความปลอดภัยที่เปิดไว้แล้ว
- HTTPS บังคับ (Caddy) + HSTS
- หัวข้อความ: CSP (สคริปต์/การเชื่อมต่อเฉพาะเซิร์ฟเวอร์ตัวเอง), nosniff, ห้ามฝังในเว็บอื่น
- WebSocket รับเฉพาะต้นทาง `https://<DOMAIN>`, สูงสุด 8 การเชื่อมต่อต่อ IP
- สมัคร/ล็อกอิน สูงสุด 20 ครั้งต่อ IP ต่อนาที (กันเดารหัส)
- รหัสผ่านเก็บแบบ scrypt, โทเคน 24 ชม.
- `/api/stats` ปิด (เปิดเฉพาะ `STATS=1` ตอนทดสอบโหลด), ปุ่มทดสอบ Job 30 ปิด
- container รันด้วยผู้ใช้ไม่ใช่ root

## ทดสอบก่อนประกาศให้ผู้เล่นเข้า
1. วัดกำลังเครื่อง VPS จริง (สคริปต์เริ่มเซิร์ฟเวอร์ทดสอบของตัวเอง ไม่แตะข้อมูลจริง):
   ```sh
   docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim sh -c "cd server && npm ci --omit=dev && cd .. && node tools/load-test.js 50 30 field2"
   ```
   ผลต้องขึ้น `PASS โหลด 50 คน`
2. ทดสอบมือถือจริงตาม `docs/DEVICE_TEST.md`
