#!/usr/bin/env python3
"""ผังช่องเดินได้ (48x32) จากภาพแผนที่สะอาด assets/maps_src/<zone>.png

1. ทางดิน/ลานหินสี sand → เดินได้ (สัดส่วนพิกเซลในช่อง >= thr)
2. LINK: เปิดบันได/สะพาน/ลานหิน ที่สีไม่ใช่ทางดิน (ใส่ด้วยมือ อ่านจากภาพตรวจ)
3. ปรับเรียบ (เติมช่องโหว่) เก็บก้อนใหญ่สุด แล้ว FIX ด้วยมือ
4. ทางออก = ช่องเดินได้ที่ติดขอบภาพ (กำหนดใน EXITS)
ผลลัพธ์: assets/maps/<zone>.mask.txt, docs/evidence/map_<zone>_mask.png
รัน: python3 tools/build_clean_masks.py [zone ...] && python3 tools/embed_maps.py && node tools/extract-shared.js
"""
import os, sys
from collections import deque
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T, COLS, ROWS = 32, 48, 32

def is_dirt(p):
    r, g, b = p
    return r > 165 and g > 120 and b < 175 and r - b > 40 and r >= g and r - g < 80

def is_lawn(p):  # หญ้าโล่งสีเขียวอ่อนสว่าง (ไม่ใช่พุ่มไม้/ต้นไม้ที่เข้มและมีเงา)
    r, g, b = p
    return g > 175 and 90 < r < 200 and b < 110 and g - r > 25

def is_stone(p):  # ลานหิน/บันไดหินสีอ่อน (ใช้เฉพาะช่องที่ระบุใน STONE)
    r, g, b = p
    return 140 < r < 225 and abs(r - g) < 22 and abs(g - b) < 28

THR = {'village2': .3, 'field2': .3, 'bamboo': .3, 'rainforest': .3, 'mine': .3, 'peak': .3}
# (อักษร, x0, y0, x1, y1) รวมปลาย
LINK = {
    # พิกัดอ่านจากภาพตรวจ (ช่อง 32 px)
    'bamboo': [('.', 13, 8, 15, 11), ('.', 28, 7, 31, 10), ('.', 8, 17, 9, 19), ('.', 40, 15, 41, 17), ('.', 33, 25, 34, 28),
               ('.', 21, 15, 26, 17), ('.', 0, 12, 2, 13), ('.', 45, 12, 47, 13)],
    'rainforest': [('.', 7, 16, 8, 18), ('.', 12, 3, 13, 5), ('.', 17, 10, 21, 12), ('.', 16, 18, 20, 20), ('.', 29, 5, 30, 8),
                   ('.', 34, 12, 35, 14), ('.', 29, 23, 40, 24), ('.', 27, 21, 28, 23), ('.', 11, 25, 12, 28)],
    'mine': [('.', 7, 5, 9, 8), ('.', 14, 10, 16, 12), ('.', 13, 15, 15, 18), ('.', 28, 10, 30, 13), ('.', 41, 11, 43, 14),
             ('.', 25, 17, 27, 20), ('.', 11, 21, 18, 24), ('.', 26, 23, 28, 26)],
    'peak': [('.', 27, 16, 44, 24), ('.', 29, 8, 41, 12), ('.', 35, 12, 37, 16), ('.', 20, 8, 22, 10), ('.', 7, 19, 9, 21),
             ('.', 11, 20, 18, 22), ('.', 30, 27, 33, 30), ('.', 20, 14, 22, 16), ('.', 0, 16, 2, 17), ('.', 25, 0, 26, 3)],
    'field2': [('.', 12, 7, 15, 10), ('.', 25, 6, 27, 10), ('.', 29, 12, 32, 15), ('.', 20, 20, 23, 23), ('.', 28, 24, 37, 26), ('.', 6, 4, 9, 6), ('.', 24, 5, 28, 6)],
    'village2': [('.', 20, 13, 28, 18),  # ลานหินกลางหมู่บ้าน (สีหิน ไม่ใช่ดิน/หญ้า)
                 ('.', 4, 23, 22, 24), ('.', 12, 9, 13, 11), ('.', 35, 9, 37, 11), ('.', 35, 22, 37, 25), ('.', 24, 6, 26, 10), ('.', 24, 24, 26, 31)],
}
FIX = {
    'bamboo': [('#', 3, 1, 12, 6), ('#', 49, 0, 49, 0)],
    'peak': [('#', 34, 2, 44, 7)],
    'field2': [('#', 2, 17, 15, 22), ('#', 2, 9, 9, 15), ('E', 7, 3, 8, 3), ('E', 26, 4, 27, 4)],
    'village2': [  # หลังคามุงจาก/แปลงผัก = กีดขวาง (สีใกล้ทางดิน)
        ('#', 22, 0, 29, 4), ('#', 9, 4, 14, 7), ('#', 10, 13, 16, 16), ('#', 2, 18, 7, 22), ('#', 1, 10, 7, 14),
        ('#', 33, 4, 39, 7), ('#', 37, 10, 44, 14), ('#', 33, 12, 38, 14), ('#', 41, 17, 46, 21), ('#', 40, 1, 47, 8)],
}

# ต่อชิ้นทางเดินที่ขาดจากกัน (ช่องว่าง 2–5 ช่อง ตรงบันได/ระเบียง) — จากการตรวจหาชิ้นที่แยก
BRIDGE = {
    'village2': [('.', 32, 21, 33, 22), ('.', 15, 12, 20, 12), ('.', 32, 11, 35, 12)],
    'rainforest': [('.', 20, 20, 25, 20), ('.', 24, 10, 26, 11)],
    'mine': [('.', 38, 17, 39, 18)],
    'peak': [('.', 9, 20, 11, 20), ('.', 15, 10, 15, 13)],
}

# ทางออกที่ขอบภาพ: (x0, y0, x1, y1, ไปโซน) — ใช้ร่วมกับ tools/zone_links.py
EXITS = {
    'village2': [(23, 31, 27, 31, 'field2')],
    'field2': [(29, 31, 35, 31, 'village2'), (47, 21, 47, 24, 'field'), (7, 3, 8, 3, 'mine'), (26, 4, 27, 4, 'bamboo')],
    'bamboo': [(0, 12, 0, 13, 'field2'), (47, 11, 47, 13, 'rainforest')],
    'rainforest': [(0, 11, 0, 11, 'bamboo'), (0, 22, 0, 22, 'bamboo'), (47, 12, 47, 12, 'mine'), (47, 22, 47, 23, 'mine')],
    'mine': [(0, 11, 0, 11, 'rainforest'), (0, 30, 0, 31, 'field2'), (0, 31, 2, 31, 'field2'), (47, 14, 47, 15, 'peak')],
    'peak': [(0, 16, 0, 17, 'mine')],
}

# สัดส่วน (ดิน+หญ้าโล่ง) ขั้นต่ำที่นับว่าเดินได้ — V2-R23 ลดจาก .62 ให้เดินบนหญ้าได้กว้างขึ้นตามที่เจ้าของขอ
LAWN = {}

from draw_walkways import WALKWAYS  # V2-R24 ทางเดินไม้บนน้ำ = เดินได้
for _z, _ws in WALKWAYS.items():
    LINK.setdefault(_z, []).extend(('.', *w) for w in _ws)

def build(zid):
    im = Image.open(os.path.join(ROOT, 'assets/maps_src', zid + '.png')).convert('RGB')
    assert im.size == (COLS * T, ROWS * T), im.size
    px = im.load(); g = []
    for ty in range(ROWS):
        row = []
        for tx in range(COLS):
            n = d = l = 0
            for y in range(ty * T + 2, ty * T + T - 2, 3):
                for x in range(tx * T + 2, tx * T + T - 2, 3):
                    p = px[x, y]; n += 1; d += is_dirt(p); l += is_lawn(p)
            # ทางดิน หรือ ดิน+หญ้าโล่งรวมกันมาก (ลานหญ้า) — ช่องที่มีเงาเข้ม/หิน/น้ำ ไม่ผ่าน
            row.append('.' if d / n >= THR[zid] or (d + l) / n >= LAWN.get(zid, .3) else '#')
        g.append(row)
    def put(lst):
        for ch, x0, y0, x1, y1 in lst:
            for y in range(max(0, y0), min(ROWS, y1 + 1)):
                for x in range(max(0, x0), min(COLS, x1 + 1)):
                    g[y][x] = ch
    put(LINK.get(zid, []))
    W = lambda x, y: 0 <= x < COLS and 0 <= y < ROWS and g[y][x] in '.E'
    for _ in range(2):
        add = [(x, y) for y in range(ROWS) for x in range(COLS) if g[y][x] == '#' and sum(W(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 3]
        for x, y in add:
            g[y][x] = '.'
    put(FIX.get(zid, []))
    put(BRIDGE.get(zid, []))
    for x0, y0, x1, y1, _to in EXITS.get(zid, []):  # ทางออก: เฉพาะช่องที่เดินได้อยู่แล้ว
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if g[y][x] == '.':
                    g[y][x] = 'E'
    # เก็บก้อนใหญ่สุด
    seen = set(); comps = []
    for y in range(ROWS):
        for x in range(COLS):
            if W(x, y) and (x, y) not in seen:
                q = deque([(x, y)]); seen.add((x, y)); c = []
                while q:
                    cx, cy = q.popleft(); c.append((cx, cy))
                    for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nb = (cx + a, cy + b)
                        if W(*nb) and nb not in seen:
                            seen.add(nb); q.append(nb)
                comps.append(c)
    comps.sort(key=len, reverse=True)
    keep = set(c for comp in comps if len(comp) >= 10 for c in comp)  # ทางที่ขาดตอนจะต่อด้วย LINK หลังตรวจภาพ
    big = keep
    for c in comps:
        for x, y in c:
            if (x, y) not in keep:
                g[y][x] = '#'
    rows = [''.join(r) for r in g]
    os.makedirs(os.path.join(ROOT, 'assets/maps'), exist_ok=True)
    open(os.path.join(ROOT, 'assets/maps', zid + '.mask.txt'), 'w').write('\n'.join(rows) + '\n')
    # ภาพตรวจ
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for ty, r in enumerate(rows):
        for tx, ch in enumerate(r):
            if ch in '.E':
                d.rectangle((tx * T, ty * T, tx * T + T - 1, ty * T + T - 1), fill=(255, 0, 255, 120))
    for tx in range(0, COLS, 4):
        d.text((tx * T + 2, 2), str(tx), fill=(255, 255, 255, 255))
    for ty in range(0, ROWS, 2):
        d.text((2, ty * T + 2), str(ty), fill=(255, 255, 255, 255))
    out = im.convert('RGBA'); out.alpha_composite(ov); out.convert('RGB').save(os.path.join(ROOT, 'docs/evidence', 'map_' + zid + '_mask.png'))
    edge = {'L': [y for y in range(ROWS) if rows[y][0] == '.'], 'R': [y for y in range(ROWS) if rows[y][COLS - 1] == '.'],
            'T': [x for x in range(COLS) if rows[0][x] == '.'], 'B': [x for x in range(COLS) if rows[ROWS - 1][x] == '.']}
    print(zid, 'walkable', len(big), 'parts', [len(c) for c in comps if len(c) >= 10], 'edges', edge)

if __name__ == '__main__':
    for z in (sys.argv[1:] or THR):
        build(z)
