#!/usr/bin/env python3
"""ไอคอนสกิลนักดาบ (V2-R26) วาดเองแบบพิกเซลอาร์ต 32x32 → ขยาย ×2 = 64x64
สีพื้นตามสาย: เริ่มต้น=เทาทอง, ดาบอาคม=ม่วงคราม, ดาบทลายขุนเขา=ส้มดิน, ดาบก้าวพริบตา=ฟ้าเขียว
ผลลัพธ์: game/icons/sk_<n>.png (n = ลำดับใน CFG.skills, 0 = ท่าพื้นฐาน, p = สกิลติดตัว), docs/evidence/skill_icons.png
รัน: python3 tools/build_skill_icons.py
"""
import os, math
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'game/icons'); os.makedirs(OUT, exist_ok=True)
N = 32
PATH = {'start': ((92, 84, 70), (150, 132, 98)), 'arcane': ((52, 40, 104), (104, 72, 178)),
        'earth': ((112, 52, 22), (190, 98, 40)), 'wind': ((18, 82, 88), (40, 150, 150)), 'pas': ((40, 48, 60), (80, 96, 120))}
STEEL, STEEL_L, STEEL_D, GOLD, HILT, WHITE = (200, 212, 226), (250, 252, 255), (120, 132, 150), (242, 193, 78), (90, 56, 28), (255, 255, 255)

def base(path):
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    dk, lt = PATH[path]
    d.rounded_rectangle((0, 0, N - 1, N - 1), 6, fill=dk)
    for y in range(2, N - 2):  # ไล่สีจากบนลงล่าง
        t = y / N; c = tuple(int(lt[i] * (1 - t) + dk[i] * t) for i in range(3))
        d.line((2, y, N - 3, y), fill=c)
    d.rounded_rectangle((0, 0, N - 1, N - 1), 6, outline=(20, 16, 12), width=1)
    d.line((3, 2, N - 4, 2), fill=tuple(min(255, v + 50) for v in lt))
    return im, d

def sword(d, x0, y0, x1, y1, glow=None):
    """ดาบจากปลาย (x0,y0) ถึงด้าม (x1,y1)"""
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; px, py = -uy, ux
    hx, hy = x0 + ux * L * .72, y0 + uy * L * .72
    if glow: d.line((x0, y0, hx, hy), fill=glow, width=5)
    d.line((x0, y0, hx, hy), fill=STEEL, width=3)
    d.line((x0 + px * .8, y0 + py * .8, hx + px * .8, hy + py * .8), fill=STEEL_L, width=1)
    d.line((hx - px * 4, hy - py * 4, hx + px * 4, hy + py * 4), fill=GOLD, width=2)
    d.line((hx, hy, x1, y1), fill=HILT, width=2)
    d.point((x1, y1), fill=GOLD)

def slash(d, cx, cy, r, a0, a1, col, w=2):
    d.arc((cx - r, cy - r, cx + r, cy + r), a0, a1, fill=col, width=w)

def save(im, name):
    im.resize((64, 64), Image.NEAREST).save(os.path.join(OUT, name + '.png'))
    return im

icons = {}
# 0 ท่าพื้นฐาน
im, d = base('start'); slash(d, 16, 18, 11, 200, 330, WHITE); sword(d, 24, 6, 9, 25); icons[0] = save(im, 'sk_0')
# 1 ท่าเคลื่อนที่: รองเท้า + เส้นความเร็ว
im, d = base('start')
for y, x in ((10, 4), (14, 2), (18, 5)): d.line((x, y, x + 8, y), fill=(230, 220, 190), width=1)
d.polygon([(14, 8), (21, 8), (21, 19), (27, 21), (27, 25), (13, 25)], fill=(120, 72, 38)); d.line((13, 25, 27, 25), fill=(60, 36, 18), width=2)
d.line((15, 12, 20, 12), fill=GOLD); d.line((15, 15, 20, 15), fill=GOLD); icons[1] = save(im, 'sk_1')
# 2 ท่าป้องกัน: โล่
im, d = base('start')
d.polygon([(8, 7), (24, 7), (24, 17), (16, 27), (8, 17)], fill=(150, 40, 44), outline=(40, 20, 16))
d.polygon([(11, 10), (21, 10), (21, 16), (16, 23), (11, 16)], fill=(196, 64, 60)); d.line((16, 9, 16, 24), fill=GOLD, width=2); d.line((10, 14, 22, 14), fill=GOLD, width=2)
icons[2] = save(im, 'sk_2')
# 3 ลงอาคมคมดาบ: ดาบตั้ง + อักขระเรือง
im, d = base('arcane'); sword(d, 16, 4, 16, 28, glow=(150, 110, 255))
for x, y in ((7, 9), (25, 12), (8, 20), (24, 22)): d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(255, 220, 120)); d.point((x, y), fill=WHITE)
icons[3] = save(im, 'sk_3')
# 4 ฟันประทับตรา: รอยฟัน + ตราแดง
im, d = base('arcane'); slash(d, 12, 20, 12, 250, 20, WHITE, 2)
d.polygon([(22, 15), (28, 21), (22, 27), (16, 21)], fill=(220, 40, 30), outline=(255, 200, 120)); d.polygon([(22, 18), (25, 21), (22, 24), (19, 21)], fill=(255, 120, 80))
icons[4] = save(im, 'sk_4')
# 5 ปลุกคมอาคม (อัลติ): คลื่นพระจันทร์เสี้ยวพุ่ง
im, d = base('arcane')
for r, c in ((13, (120, 90, 255)), (10, (180, 150, 255)), (7, WHITE)): slash(d, 10, 16, r, 300, 60, c, 2)
for x in (20, 24, 27): d.line((x, 14, x + 2, 14), fill=(200, 180, 255)); d.line((x, 18, x + 2, 18), fill=(200, 180, 255))
d.point((28, 5), fill=GOLD); d.point((4, 27), fill=GOLD); icons[5] = save(im, 'sk_5')
# 6 ฟันแยกศิลา: หินแหลมพุ่งจากดิน
im, d = base('earth'); d.rectangle((3, 24, 28, 28), fill=(80, 44, 20))
for x, h in ((7, 9), (14, 15), (21, 11)): d.polygon([(x - 4, 25), (x, 25 - h), (x + 4, 25)], fill=(150, 138, 124), outline=(60, 50, 42)); d.line((x - 1, 24, x, 26 - h), fill=(210, 200, 186))
d.line((4, 26, 27, 26), fill=GOLD); icons[6] = save(im, 'sk_6')
# 7 คลื่นดาบผาขาด: เสาหินแตก + รอยฟันตั้ง
im, d = base('earth'); d.rectangle((10, 6, 21, 27), fill=(140, 120, 100), outline=(60, 44, 30))
d.line((15, 6, 13, 12, 17, 18, 14, 27), fill=(40, 26, 14), width=2); d.line((6, 4, 6, 28), fill=WHITE, width=1); d.line((25, 4, 25, 28), fill=WHITE, width=1)
d.rectangle((4, 27, 27, 28), fill=GOLD); icons[7] = save(im, 'sk_7')
# 8 ดาบทลายขุนเขา (อัลติ): ดาบปักภูเขา + วงคลื่น
im, d = base('earth'); d.polygon([(2, 27), (12, 13), (17, 19), (21, 15), (30, 27)], fill=(110, 92, 80), outline=(50, 36, 26))
d.polygon([(10, 16), (12, 13), (14, 16)], fill=WHITE); d.ellipse((4, 23, 28, 30), outline=GOLD, width=1)
sword(d, 16, 26, 16, 3); icons[8] = save(im, 'sk_8')
# 9 ก้าวตัดเงา: ดาบเฉียง + เส้นเร็ว + เงา
im, d = base('wind')
for y in (9, 14, 19, 24): d.line((2, y, 9, y), fill=(160, 240, 230))
sword(d, 28, 6, 12, 24, glow=(60, 220, 210)); d.line((22, 10, 9, 27), fill=(20, 40, 44), width=1); icons[9] = save(im, 'sk_9')
# 10 ก้าวหลบสวนคม: ลูกศรวนรอบดาบ
im, d = base('wind'); slash(d, 16, 16, 11, 200, 340, (160, 240, 230), 2); slash(d, 16, 16, 11, 20, 160, (160, 240, 230), 2)
d.polygon([(26, 10), (29, 15), (23, 14)], fill=(160, 240, 230)); d.polygon([(6, 22), (3, 17), (9, 18)], fill=(160, 240, 230))
sword(d, 22, 9, 10, 23); icons[10] = save(im, 'sk_10')
# 11 พริบตาสามคม (อัลติ): สามรอยฟัน
im, d = base('wind')
for i, c in enumerate(((120, 240, 230), (200, 255, 250), WHITE)): d.line((6 + i * 7, 27, 12 + i * 7, 4), fill=c, width=2)
d.line((4, 16, 28, 16), fill=GOLD); d.point((27, 4), fill=GOLD); d.point((4, 26), fill=GOLD); icons[11] = save(im, 'sk_11')
# p สกิลติดตัว
im, d = base('pas'); d.polygon([(16, 4), (19, 13), (28, 16), (19, 19), (16, 28), (13, 19), (4, 16), (13, 13)], fill=GOLD, outline=(120, 80, 20)); d.rectangle((15, 15, 17, 17), fill=WHITE)
icons['p'] = save(im, 'sk_p')

sheet = Image.new('RGBA', (13 * 70, 70), (24, 30, 40, 255))
for i, k in enumerate([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 'p']):
    sheet.paste(icons[k].resize((64, 64), Image.NEAREST), (i * 70 + 3, 3), icons[k].resize((64, 64), Image.NEAREST))
sheet.save(os.path.join(ROOT, 'docs/evidence/skill_icons.png'))
print('ไอคอนสกิล', len(icons), 'รูป →', OUT)
