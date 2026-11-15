#!/usr/bin/env python3
"""สร้างไอคอนไอเทมของเกมจากภาพ CC0 ใน assets/third_party/496-rpg-icons/

ใช้ตรง 10 ชิ้น และปรับเป็นสไตล์เกม 4 ชิ้น (ดาบไม้ เขาสัตว์ เขี้ยวสัตว์ป่า เสื้อผ้าฝ้ายปัก)
ผลลัพธ์:
  assets/items/<id>.png         ไฟล์ภาพ 34x34 ต่อชิ้น
  assets/items/items.json       data URI ทั้งหมด สำหรับฝังในเกม (tools/embed_item_icons.py)
รัน: python3 tools/build_item_icons.py   (ต้องมี Pillow)
"""
import base64, io, json, os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/third_party/496-rpg-icons')
OUT = os.path.join(ROOT, 'assets/items')

def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')

def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]

def lerp(c0, c1, t):
    return tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))

def ramp(stops, t):
    """ไล่สีตามจุดหยุด [(ตำแหน่ง 0–1, (r,g,b)), ...]"""
    t = max(0.0, min(1.0, t))
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            return lerp(ca, cb, (t - a) / (b - a) if b > a else 0)
    return stops[-1][1]

def remap(im, stops, pick=lambda p: True, outline=45):
    """เปลี่ยนสีพิกเซลที่ pick() เลือก ตามความสว่างเดิม (คงเส้นขอบดำและความโปร่งใส)"""
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] == 0 or lum(p) < outline or not pick(p):
                continue
            px[x, y] = ramp(stops, lum(p) / 255) + (p[3],)
    return im

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
WOOD = [(0, HEX('#4a2f14')), (.45, HEX('#7a5230')), (.75, HEX('#a57a52')), (1, HEX('#d9b98a'))]
HORN = [(0, HEX('#2a1d12')), (.45, HEX('#4f3420')), (.75, HEX('#7d5a38')), (1, HEX('#b8925f'))]
CLOTH = [(0, HEX('#141318')), (.5, HEX('#24232a')), (.8, HEX('#3a3842')), (1, HEX('#55525f'))]

def sword_wood():
    # ใบดาบ (โทนฟ้า/ขาว) → ไม้ ส่วนด้ามคงเดิม
    return remap(load('W_Sword001'), WOOD, pick=lambda p: p[2] >= p[0] - 5)

def horn():
    # เขาสัตว์: โทนน้ำตาลเข้ม + ลายวงขวางตามแนวโค้ง ให้ต่างจากเขี้ยวสีงาช้าง
    im = remap(load('I_Fang'), HORN); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and lum(p) >= 30 and (x + y) % 5 == 0:
                px[x, y] = tuple(int(c * .7) for c in p[:3]) + (p[3],)
    return im

def fang_pair():
    f = load('I_Fang')
    small = f.resize((18, 18), Image.NEAREST)
    im = Image.new('RGBA', f.size, (0, 0, 0, 0))
    im.alpha_composite(ImageOps.mirror(small), (0, 9))
    im.alpha_composite(small, (16, 7))
    return im

def coat_cloth():
    # เสื้อขาว → ผ้าดำ + แถบปักแดงลายขาว (ตามชุดตัวละครหลัก)
    im = remap(load('A_Clothing01'), CLOTH); px = im.load()
    inside = lambda x, y: px[x, y][3] > 0 and lum(px[x, y]) >= 18
    for y in range(21, 25):
        for x in range(im.width):
            if inside(x, y):
                px[x, y] = HEX('#c4222c') + (255,)
    for x in range(im.width):
        if inside(x, 22) and x % 4 == 1:
            px[x, 22] = HEX('#efe6dc') + (255,)
        if inside(x, 24) and x % 4 == 3:
            px[x, 24] = HEX('#f2c14e') + (255,)
    return im

RECIPE = {
    'potion_s': lambda: load('P_Green01'),
    'potion_m': lambda: load('P_Red01'),
    'hide': lambda: load('I_WolfFur'),
    'horn': horn,
    'tusk': lambda: load('I_Fang'),
    'feather': lambda: load('I_Feather02'),
    'fang': fang_pair,
    'ore': lambda: load('I_Rock03'),
    'spirit': lambda: load('I_Amethist'),
    'sword_wood': sword_wood,
    'sword_iron': lambda: load('W_Sword004'),
    'coat_cloth': coat_cloth,
    'coat_leather': lambda: load('A_Armour01'),
    'charm_silver': lambda: load('Ac_Ring02'),
}

def main():
    os.makedirs(OUT, exist_ok=True)
    uris = {}
    for k, f in RECIPE.items():
        im = f()
        im.save(os.path.join(OUT, k + '.png'), optimize=True)
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
        uris[k] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    with open(os.path.join(OUT, 'items.json'), 'w') as fh:
        json.dump(uris, fh, separators=(',', ':'))
    print('items:', len(uris), 'bytes:', sum(len(v) for v in uris.values()))

if __name__ == '__main__':
    main()
