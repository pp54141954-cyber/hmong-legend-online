#!/usr/bin/env python3
"""สร้างผังช่องเดินได้ (mask 48x32 ช่อง ช่องละ 32 px) จากภาพแผนที่แบบภาพทั้งแผ่น

ขั้นตอน:
  1. แยกอัตโนมัติจากสีทางเดิน (ดิน/หิน/สะพานไม้) — ช่องที่สีทางเดินเกินเกณฑ์ = เดินได้
  2. แก้ด้วยมือตาม FIX (ระบุช่องที่ต้องเปิด/ปิด) ให้ตรงกับภาพ Walk Path Model ของเจ้าของ
อักษรใน mask: '.' เดินได้  '#' กีดขวาง  '~' น้ำ  'E' ทางออก (เดินได้ ใช้ย้ายโซน)
ผลลัพธ์: assets/maps/<zone>.mask.txt และภาพตรวจ docs/evidence/map_<zone>_mask.png
รัน: python3 tools/build_map_mask.py village2 && python3 tools/embed_maps.py
"""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T, COLS, ROWS = 32, 48, 32
ZONES = {
    'village2': dict(src='assets/design_refs/09_village_walkpath_model.jpg', thr=.3),
    # ทุ่งใหม่: พื้นเดินได้คือหญ้าเขียวสว่าง (+ บันได/สะพาน/ทางดิน)
    'field2': dict(src='assets/design_refs/11_field_walkpath_model.png', thr=.3, kind='grass'),
}

def is_path(p):
    r, g, b = p
    return r > 140 and g > 95 and b < 150 and r - b > 40 and r > g > b - 10 and r - g < 75

def is_grass(p):
    r, g, b = p
    return g > 140 and r < 150 and b < 110 and g - r > 50 and g - b > 70

def is_water(p):
    r, g, b = p
    return b > 150 and b > r + 40 and g > 110

def auto(im):
    px = im.load(); rows = []
    for ty in range(ROWS):
        row = ''
        for tx in range(COLS):
            n = pa = wa = 0
            for y in range(ty * T + 2, ty * T + T - 2, 3):
                for x in range(tx * T + 2, tx * T + T - 2, 3):
                    p = px[x, y][:3]; n += 1
                    pa += (is_grass(p) if ZONES_CUR.get('kind') == 'grass' else is_path(p)); wa += is_water(p)
            row += '.' if pa / n >= ZONES_CUR['thr'] else ('~' if wa / n > .5 else '#')
        rows.append(row)
    return rows

def apply_fix(rows, fixes):
    g = [list(r) for r in rows]
    for ch, x0, y0, x1, y1 in fixes:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < COLS and 0 <= y < ROWS:
                    g[y][x] = ch
    return [''.join(r) for r in g]

def smooth(rows):
    """เติมช่องโหว่ในทางเดิน (ช่องที่มีเพื่อนบ้านเดินได้ >= 3 ด้าน) แล้วเก็บเฉพาะก้อนทางเดินที่ใหญ่สุด"""
    g = [list(r) for r in rows]
    W = lambda x, y: 0 <= x < COLS and 0 <= y < ROWS and g[y][x] in '.E'
    for _ in range(2):
        add = [(x, y) for y in range(ROWS) for x in range(COLS) if g[y][x] == '#' and sum(W(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 3]
        for x, y in add:
            g[y][x] = '.'
    seen = set(); comps = []
    for y in range(ROWS):
        for x in range(COLS):
            if W(x, y) and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    cx, cy = st.pop(); c.append((cx, cy))
                    for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        n = (cx + a, cy + b)
                        if W(*n) and n not in seen:
                            seen.add(n); st.append(n)
                comps.append(c)
    big = set(max(comps, key=len)) if comps else set()
    for c in comps:
        if len(c) < len(big):
            for x, y in c:
                g[y][x] = '#'
    return [''.join(r) for r in g]

# เปิดทางเชื่อมก่อนปรับเรียบ (เส้นทางที่สีขาดช่วงตรงบันได/ระเบียง) — อ่านจากภาพตรวจ
LINK = {'village2': [
    ('.', 14, 7, 29, 7),                     # ระเบียงหน้าบ้านผู้ใหญ่บ้าน
    ('.', 23, 8, 24, 10),                    # บันไดลงลานกลาง
    ('.', 33, 1, 35, 4), ('.', 35, 4, 37, 9),  # ทางไปป่า → บันไดขวาบน → ตลาด
    ('.', 2, 22, 4, 23), ('.', 5, 21, 7, 22), ('.', 8, 20, 11, 21),  # ทางเลียบลำธารซ้ายล่าง
    ('.', 37, 16, 40, 18),                   # ทางไปบ้านหลังที่ 4
]}

LINK['field2'] = [
    ('.', 13, 9, 14, 11),    # บันไดถ้ำ → ทุ่งบนซ้าย
    ('.', 9, 20, 10, 22),    # บันไดซ้าย → ทุ่งล่าง
    ('.', 21, 14, 28, 15),   # สะพานเชือก
    ('.', 40, 11, 42, 14),   # บันไดขวาบน → ประตูหิน
    ('.', 40, 18, 42, 21),   # บันไดขวากลาง
    ('.', 16, 27, 18, 31),   # บันไดล่างซ้าย (ทางออกใต้)
    ('.', 33, 26, 35, 29),   # บันไดล่างขวา
    ('.', 9, 5, 11, 7), ('.', 42, 6, 44, 7),  # หน้าปากถ้ำ / หน้าประตูหิน
]

# แก้ด้วยมือ: (อักษร, x0, y0, x1, y1) รวมปลายทาง — อ่านจากภาพตรวจ docs/evidence/map_<zone>_mask.png
FIX = {'field2': [
    ('#', 0, 13, 6, 18),     # บ้านบ่อน้ำและแปลงผัก
    ('E', 9, 4, 11, 4),     # ปากถ้ำ → โซนถัดไป
    ('E', 43, 5, 44, 5),    # ประตูหิน → โซนถัดไป
    ('#', 0, 7, 3, 10),     # ต้นไม้มุมซ้ายบน
    ('#', 0, 19, 2, 24),    # ต้นไม้ขอบซ้ายล่าง
    ('.', 0, 11, 2, 12), ('E', 0, 11, 0, 12),  # ทางเข้าจากหมู่บ้าน (ขอบซ้าย)
], 'village2': [
    # หลังคามุงจากสีใกล้ทางดิน → กีดขวาง
    ('#', 9, 7, 11, 9),     # โรงตีเหล็ก
    ('#', 8, 13, 9, 14),    # บ้านหลังที่ 1
    ('#', 12, 19, 13, 20),  # บ้านหลังที่ 2
    ('#', 38, 12, 40, 14),  # บ้านหลังที่ 3
    ('#', 41, 19, 43, 21),  # บ้านหลังที่ 4
    # ลานหินกลางหมู่บ้าน (เว้นเสาคริสตัล)
    ('.', 22, 13, 26, 14), ('.', 21, 15, 27, 18), ('#', 23, 13, 24, 15), ('#', 22, 14, 25, 15),  # เสาคริสตัล + อ่างน้ำพุ
    # บันได
    ('.', 23, 9, 24, 10), ('.', 23, 22, 24, 24), ('.', 35, 5, 36, 7), ('.', 34, 28, 36, 31),
    # ทางออก: บน = ทางไปป่า, ล่าง = บันไดใต้
    ('.', 33, 1, 35, 4), ('.', 35, 4, 37, 9), ('.', 36, 8, 37, 11), ('.', 34, 11, 37, 12),  # ทางไปป่า → บันไดขวาบน → ถนนวงขวา (ซ้ำหลังปรับเรียบ)
    ('E', 33, 0, 35, 0), ('E', 34, 31, 36, 31),
]}

def overlay(im, rows, out):
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    col = {'.': (40, 255, 80, 90), '#': (255, 30, 30, 70), '~': (40, 120, 255, 90), 'E': (255, 230, 0, 150)}
    for ty, r in enumerate(rows):
        for tx, ch in enumerate(r):
            d.rectangle((tx * T, ty * T, tx * T + T - 1, ty * T + T - 1), fill=col[ch], outline=(0, 0, 0, 60))
    for tx in range(0, COLS, 4):
        d.text((tx * T + 2, 2), str(tx), fill=(255, 255, 255, 255))
    for ty in range(0, ROWS, 2):
        d.text((2, ty * T + 2), str(ty), fill=(255, 255, 255, 255))
    out_im = im.convert('RGBA'); out_im.alpha_composite(ov); out_im.convert('RGB').save(out)

if __name__ == '__main__':
    zid = sys.argv[1]
    ZONES_CUR = ZONES[zid]
    im = Image.open(os.path.join(ROOT, ZONES_CUR['src'])).convert('RGB')
    assert im.size == (COLS * T, ROWS * T), im.size
    rows = apply_fix(smooth(apply_fix(auto(im), LINK.get(zid, []))), FIX.get(zid, []))
    os.makedirs(os.path.join(ROOT, 'assets/maps'), exist_ok=True)
    open(os.path.join(ROOT, 'assets/maps', zid + '.mask.txt'), 'w').write('\n'.join(rows) + '\n')
    overlay(im, rows, os.path.join(ROOT, 'docs/evidence', 'map_' + zid + '_mask.png'))
    print('\n'.join(rows))
    print('walkable', sum(r.count('.') + r.count('E') for r in rows))
