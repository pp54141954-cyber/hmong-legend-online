#!/usr/bin/env python3
"""ฝังผังช่อง (assets/maps/<zone>.mask.txt) และภาพพื้นแผนที่ลงใน game/index.html
ภาพ: MAP_SRC ด้านล่าง (ตอนนี้ใช้ภาพแบบที่มีป้าย/เส้น — เปลี่ยนเป็นภาพสะอาดเมื่อเจ้าของส่งมา)
รัน: python3 tools/embed_maps.py && node tools/extract-shared.js
"""
import base64, io, json, os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_SRC = {'village2': 'assets/design_refs/09_village_walkpath_model.jpg'}
game = os.path.join(ROOT, 'game/index.html')
s = open(game, encoding='utf-8').read()
masks, art = {}, {}
for zid, src in MAP_SRC.items():
    masks[zid] = open(os.path.join(ROOT, 'assets/maps', zid + '.mask.txt')).read().split()
    assert len(masks[zid]) == 32 and all(len(r) == 48 for r in masks[zid]), zid
    b = io.BytesIO(); Image.open(os.path.join(ROOT, src)).convert('RGB').save(b, 'WEBP', quality=80, method=6)
    art[zid] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
for name, val in (('MAP_MASKS', masks), ('MAP_ART', art)):
    s, n = re.subn(r'const %s=\{.*?\};/\*%s\*/' % (name, name), lambda m: 'const %s=%s;/*%s*/' % (name, json.dumps(val, separators=(',', ':')), name), s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('ไม่พบจุดฝัง ' + name)
open(game, 'w', encoding='utf-8').write(s)
print('ฝังแผนที่', list(masks), 'ภาพ', sum(len(v) for v in art.values()) // 1024, 'KB', 'ไฟล์เกม', len(s.encode()) // 1024, 'KB')
