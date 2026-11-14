#!/usr/bin/env python3
"""ภาพมอนสเตอร์/บอส: เขียนเป็นไฟล์ game/sprites/<ชื่อ>.webp (โหลดเมื่อเข้าโซน) และฝังเฉพาะขนาด/ที่อยู่ไฟล์ใน game/index.html
(V2-R19: เดิมฝังภาพทั้งหมดในไฟล์เกม) — อ่าน assets/sprites/sprites.json จาก tools/build_monster_sprites.py"""
import base64, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
game = os.path.join(ROOT, 'game/index.html')
meta = json.load(open(os.path.join(ROOT, 'assets/sprites/meta.json'), encoding='utf-8'))
spr = json.load(open(os.path.join(ROOT, 'assets/sprites/sprites.json'), encoding='utf-8'))
out_dir = os.path.join(ROOT, 'game/sprites'); os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    if f.endswith('.webp'): os.remove(os.path.join(out_dir, f))
table, total = {}, 0
for key, d in spr.items():
    m = meta.get(key) or meta.get('boss:' + key); e = dict(d)
    for k in ('walk', 'act'):
        if k in d:
            name = m[k].rsplit('.', 1)[0] + '.webp'
            data = base64.b64decode(d[k].split(',', 1)[1])
            open(os.path.join(out_dir, name), 'wb').write(data); total += len(data)
            e[k] = 'sprites/' + name
    table[key] = e
s = open(game, encoding='utf-8').read()
new, n = re.subn(r'const MON_SPR=\{.*?\};/\*MON_SPR\*/', lambda _: 'const MON_SPR=' + json.dumps(table, ensure_ascii=False, separators=(',', ':')) + ';/*MON_SPR*/', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('ไม่พบจุดฝัง MON_SPR')
open(game, 'w', encoding='utf-8').write(new)
print('ภาพมอนสเตอร์', len(table), 'ชนิด แยกไฟล์', total // 1024, 'KB · ไฟล์เกม', len(new.encode()) // 1024, 'KB')
