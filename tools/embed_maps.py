#!/usr/bin/env python3
"""ฝังผังช่อง (assets/maps/<zone>.mask.txt) ลงใน game/index.html และเขียนภาพพื้นแผนที่เป็น game/maps/<zone>.webp
ภาพ: MAP_SRC ด้านล่าง (ตอนนี้ใช้ภาพแบบที่มีป้าย/เส้น — เปลี่ยนเป็นภาพสะอาดเมื่อเจ้าของส่งมา)
รัน: python3 tools/embed_maps.py && node tools/extract-shared.js
"""
import base64, io, json, os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_SRC = {'village2': 'assets/design_refs/09_village_walkpath_model.jpg', 'field2': 'assets/design_refs/11_field_walkpath_model.png'}
game = os.path.join(ROOT, 'game/index.html')
s = open(game, encoding='utf-8').read()
masks, art = {}, {}
for zid, src in MAP_SRC.items():
    masks[zid] = open(os.path.join(ROOT, 'assets/maps', zid + '.mask.txt')).read().split()
    assert len(masks[zid]) == 32 and all(len(r) == 48 for r in masks[zid]), zid
    # ภาพแผนที่แยกเป็นไฟล์ game/maps/<zone>.webp (โหลดเมื่อเข้าโซน) — ไม่ฝังในไฟล์เกมแล้ว (V2-R14)
    os.makedirs(os.path.join(ROOT, 'game/maps'), exist_ok=True)
    Image.open(os.path.join(ROOT, src)).convert('RGB').save(os.path.join(ROOT, 'game/maps', zid + '.webp'), 'WEBP', quality=80, method=6)
    art[zid] = 'maps/' + zid + '.webp'
for name, val in (('MAP_MASKS', masks), ('MAP_ART', art)):
    s, n = re.subn(r'const %s=\{.*?\};/\*%s\*/' % (name, name), lambda m: 'const %s=%s;/*%s*/' % (name, json.dumps(val, separators=(',', ':')), name), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('ไม่พบจุดฝัง ' + name)
open(game, 'w', encoding='utf-8').write(s)
print('ฝังผังช่อง', list(masks), 'ภาพแยกไฟล์', sum(os.path.getsize(os.path.join(ROOT, 'game', v)) for v in art.values()) // 1024, 'KB', 'ไฟล์เกม', len(s.encode()) // 1024, 'KB')
