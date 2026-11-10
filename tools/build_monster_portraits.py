#!/usr/bin/env python3
"""ตัดรูปหน้าเป้าหมายมอนสเตอร์ 14 ตัว + บอส 6 ตัว จากภาพออกแบบของเจ้าของ
ต้นฉบับ: assets/design_refs/08_monsters14_bosses6_animset.png (1536x1024)
ผลลัพธ์: assets/portraits/<ชื่อ>.png และ assets/portraits/portraits.json (data URI ของมอนสเตอร์ 14 ตัว สำหรับฝังในเกม)
รัน: python3 tools/build_monster_portraits.py && python3 tools/embed_monster_portraits.py
"""
import base64, io, json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/design_refs/08_monsters14_bosses6_animset.png')
OUT = os.path.join(ROOT, 'assets/portraits')
SIZE = 112  # เท่าช่องรูปเป้าหมายใน HUD

# ลำดับตามภาพ (ชื่อตรงกับ CFG.monsters)
MONS = ['หมูป่า', 'กระต่ายมีเขา', 'หมาป่า', 'ลิงป่า', 'ไก่ฟ้า',
        'กวางภูเขา', 'กระทิงผี', 'เสือ', 'ก็อบลิน', 'นักรบเผ่าป่า',
        'หมีเขา', 'ปีศาจ', 'โกเลมหิน', 'วิญญาณไม้']
BOSSES = ['วิญญาณแห่งป่า', 'เทพหมาป่าภูเขา', 'มังกรภูเขาดำ', 'ราชาปีศาจภูเขา', 'วิญญาณหมาป่าศักดิ์สิทธิ์', 'มังกรแห่งหุบเขาหมอก']
ROWS = [(150, [12, 322, 629, 936, 1242]), (317, [12, 322, 629, 936, 1242]), (485, [12, 322, 629, 939])]
BOX = 119  # กรอบภาพใหญ่ในแผงมอนสเตอร์ (สี่เหลี่ยมจัตุรัส)

def boxes():
    out = []
    for y, xs in ROWS:
        out += [(x, y, x + BOX, y + BOX) for x in xs]
    return out

def boss_boxes():
    # แผงบอสกว้าง 235 สูง 128 → ตัดจัตุรัส 128 ตรงกลาง
    return [(x + (235 - 128) // 2, 701, x + (235 - 128) // 2 + 128, 829) for x in [8, 282, 528, 775, 1025, 1278]]

def main():
    im = Image.open(SRC).convert('RGB')
    os.makedirs(OUT, exist_ok=True)
    uris = {}
    for name, b in zip(MONS, boxes()):
        p = im.crop(b).resize((SIZE, SIZE), Image.LANCZOS)
        p.save(os.path.join(OUT, name + '.png'), optimize=True)
        buf = io.BytesIO(); p.save(buf, 'JPEG', quality=88)
        uris[name] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    for name, b in zip(BOSSES, boss_boxes()):
        im.crop(b).resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, 'boss_' + name + '.png'), optimize=True)
    json.dump(uris, open(os.path.join(OUT, 'portraits.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('มอนสเตอร์', len(uris), 'บอส', len(BOSSES), 'bytes', sum(len(v) for v in uris.values()))

if __name__ == '__main__':
    main()
