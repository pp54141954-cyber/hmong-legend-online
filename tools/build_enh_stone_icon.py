#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ไอคอน 'หินป้องกันการตีบวก' (enh_stone) วาดขึ้นเองในโครงการด้วย Pillow — ไม่ใช่สินทรัพย์ภายนอก จึงไม่มีเงื่อนไขไลเซนส์ให้ตรวจ

ผลลัพธ์:
  assets/items/enh_stone.png        ภาพ 34x34
  assets/items/items.json           เพิ่มคีย์ enh_stone (data URI) — สคริปต์นี้เขียนทับเฉพาะคีย์นี้
  assets/items/icon_sources.json    บันทึกที่มาของไอคอน
รัน: python3 tools/build_enh_stone_icon.py && python3 tools/embed_item_icons.py
"""
import base64, io, json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(ROOT, 'assets/items')
SIZE = 34

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# ก้อนหินมุมมน 3 โทน: ตัวหิน เงาด้านล่างขวา ไฮไลท์ด้านบนซ้าย
rock = [(7, 11), (12, 6), (21, 5), (28, 9), (30, 17), (28, 25), (21, 30), (12, 29), (6, 24), (4, 17)]
d.polygon(rock, fill=(120, 128, 138, 255), outline=(38, 42, 48, 255))
d.polygon([(19, 27), (27, 22), (29, 18), (25, 25), (20, 28)], fill=(84, 90, 100, 255))
d.polygon([(9, 12), (13, 8), (19, 7), (15, 11), (10, 14)], fill=(184, 192, 202, 255))
# เครื่องหมายป้องกันสีทองตรงกลาง (รูปข้าวหลามตัด)
d.polygon([(17, 11), (23, 17), (17, 24), (11, 17)], fill=(242, 193, 78, 255), outline=(120, 80, 20, 255))
d.point([(17, 16), (16, 17)], fill=(255, 244, 190, 255))

img.save(os.path.join(ITEMS, 'enh_stone.png'))
buf = io.BytesIO()
img.save(buf, 'PNG')
uri = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

items_path = os.path.join(ITEMS, 'items.json')
art = json.load(open(items_path, encoding='utf-8'))
art['enh_stone'] = uri
with open(items_path, 'w', encoding='utf-8') as f:
    json.dump(art, f, separators=(',', ':'), ensure_ascii=False)

src_path = os.path.join(ITEMS, 'icon_sources.json')
src = json.load(open(src_path, encoding='utf-8'))
src['enh_stone'] = 'original icon drawn for this project (tools/build_enh_stone_icon.py); not an external asset'
with open(src_path, 'w', encoding='utf-8') as f:
    json.dump(src, f, indent=1, ensure_ascii=False)
    f.write('\n')
print('สร้างไอคอน enh_stone แล้ว', SIZE, 'x', SIZE)
