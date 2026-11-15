#!/usr/bin/env python3
"""ภาพอ้างอิงสำหรับชุดคำสั่งทำโซนถ้ำ 6 โซน (V2-R60) → docs/prompts/ref/
- mine_sheet_clean.jpg: แผนที่ถ้ำสะอาดของเจ้าของ (ต้นแบบสไตล์และสเกล)
- zone_mine_<โซน>_crop.jpg: บริเวณที่เจ้าของวงไว้ของโซนนั้น (ต้นฉบับจากภาพสะอาด ไม่ขยาย) — ให้ ChatGPT ขยายจากบริเวณนี้
- zone_mine_<โซน>_now.jpg: ผังปัจจุบันในเกม (ทางเดิน/กีดขวาง/ทางออก/จุดเกิด) เพื่อดูว่าตอนนี้เป็นอย่างไร
ใช้ข้อมูลจาก assets/maps_src/mine.png, assets/maps_src/mine_regions.png, game/maps/mine_*.webp, assets/maps/mine_*.mask.txt, tools/mine_split.json
รัน: python3 tools/make_zone_prompt_refs.py"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'docs/prompts/ref')
FONT = '/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'
T = 32
# หมายเลขวงตรงกับ tools/build_mine_split.py (ZONES): 4 = สถานีรถแร่ (วงขวา), 5 = ลำธาร (วงซ้ายล่าง)
ZONES = {'mine_camp': 1, 'mine_tunnel': 2, 'mine_plaza': 3, 'mine_station': 4, 'mine_river': 5, 'mine_cliff': 6}
NAMES = {'mine_camp': 'ค่ายเหมืองบน', 'mine_tunnel': 'ปากถ้ำเหมือง', 'mine_plaza': 'ลานหินกลางเหมือง',
         'mine_station': 'สถานีรถแร่', 'mine_river': 'ลำธารเหมือง', 'mine_cliff': 'หน้าผาเหมือง'}
LEVEL = {'หมีเขา': 27, 'กระทิงผี': 32, 'โกเลมหิน': 37, 'ปีศาจ': 42, 'วิญญาณไม้': 47, 'มังกรภูเขาดำ': 44}
OTHER = {'mine_camp': 'ค่ายเหมืองบน', 'mine_tunnel': 'ปากถ้ำเหมือง', 'mine_plaza': 'ลานหินกลาง', 'mine_station': 'สถานีรถแร่',
         'mine_river': 'ลำธารเหมือง', 'mine_cliff': 'หน้าผาเหมือง', 'rainforest': 'ป่าดิบชื้น', 'field2': 'ทุ่งน้ำตก', 'peak': 'ยอดเขาทะเลหมอก'}

def make_sheet_and_crops(lab):
    src = Image.open(os.path.join(ROOT, 'assets/maps_src/mine.png')).convert('RGB')
    src.save(os.path.join(REF, 'mine_sheet_clean.jpg'), quality=92)
    for z, k in ZONES.items():
        ys, xs = np.nonzero(lab == k)
        m = 60
        box = (max(0, xs.min() - m), max(0, ys.min() - m), min(src.size[0], xs.max() + m), min(src.size[1], ys.max() + m))
        src.crop(box).save(os.path.join(REF, 'zone_' + z + '_crop.jpg'), quality=92)

def label(d, xy, text, font, fill=(0, 0, 0), bg=(255, 255, 255, 230)):
    x, y = xy
    w = d.textlength(text, font=font) if hasattr(d, 'textlength') else font.getlength(text)
    d.rectangle((x - 3, y - 3, x + w + 3, y + 22), fill=bg)
    d.text((x, y), text, font=font, fill=fill)

def main():
    os.makedirs(REF, exist_ok=True)
    meta = json.load(open(os.path.join(ROOT, 'tools/mine_split.json'), encoding='utf-8'))
    lab = np.asarray(Image.open(os.path.join(ROOT, 'assets/maps_src/mine_regions.png')))
    make_sheet_and_crops(lab)
    font = ImageFont.truetype(FONT, 22); small = ImageFont.truetype(FONT, 17)
    for z in ZONES:
        art = Image.open(os.path.join(ROOT, 'game/maps', z + '.webp')).convert('RGB')
        rows = open(os.path.join(ROOT, 'assets/maps', z + '.mask.txt'), encoding='utf-8').read().split()
        base = Image.blend(art, Image.new('RGB', art.size, (10, 14, 18)), .35).convert('RGBA')
        ov = Image.new('RGBA', base.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                box = (x * T, y * T, x * T + T - 1, y * T + T - 1)
                if ch in '.E': d.rectangle(box, fill=(60, 255, 120, 90))
                else: d.rectangle(box, fill=(255, 60, 60, 50))
        base.alpha_composite(ov)
        d2 = ImageDraw.Draw(base)
        for x in range(0, 48, 4): d2.text((x * T + 3, 2), str(x), font=small, fill=(255, 255, 0, 255))
        for y in range(0, 32, 4): d2.text((2, y * T + 3), str(y), font=small, fill=(255, 255, 0, 255))
        m = meta[z]
        groups = {}
        for e in m['exits']: groups.setdefault(e['to'], []).append(e)
        for to, es in groups.items():
            for e in es:
                cx, cy = e['x'] * T + T // 2, e['y'] * T + T // 2
                d2.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(255, 220, 0, 255), outline=(0, 0, 0, 255), width=2)
            cx = sum(e['x'] for e in es) / len(es) * T + T // 2; cy = sum(e['y'] for e in es) / len(es) * T + T // 2
            lbl = 'ไป' + OTHER.get(to, to) + (' x' + str(len(es)) if len(es) > 1 else '')
            w = d2.textlength(lbl, font=small)
            tx = min(max(4, cx - w / 2), 1536 - w - 10); ty = cy - 40
            d2.rectangle((tx - 4, ty - 2, tx + w + 4, ty + 22), fill=(255, 240, 150, 240))
            d2.text((tx, ty), lbl, font=small, fill=(0, 0, 0))
        for s_ in m['spawns']:
            cx, cy = s_['tx'] * T + T // 2, s_['ty'] * T + T // 2
            d2.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), outline=(200, 80, 255, 255), width=4)
            lbl = s_['type'] + ' Lv' + str(LEVEL.get(s_['type'], '?')) + ' x4'
            d2.rectangle((cx + 12, cy - 2, cx + 12 + d2.textlength(lbl, font=small) + 6, cy + 20), fill=(230, 200, 255, 240))
            d2.text((cx + 15, cy), lbl, font=small, fill=(0, 0, 0))
        if z == 'mine_plaza':
            b = meta['_boss']; cx, cy = b['tx'] * T + T // 2, b['ty'] * T + T // 2
            d2.rectangle((cx - 11, cy - 11, cx + 11, cy + 11), fill=(0, 0, 0, 255), outline=(255, 255, 255, 255), width=2)
            lbl = 'บอส ' + b['type'] + ' Lv44'
            d2.rectangle((cx + 14, cy - 2, cx + 14 + d2.textlength(lbl, font=small) + 6, cy + 20), fill=(255, 210, 210, 240))
            d2.text((cx + 17, cy), lbl, font=small, fill=(0, 0, 0))
        sx, sy = m['start']
        cx, cy = sx * T + T // 2, sy * T + T // 2
        d2.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(0, 230, 255, 255), outline=(0, 0, 0, 255), width=2)
        d2.rectangle((cx + 12, cy - 30, cx + 12 + d2.textlength('จุดเริ่ม', font=small) + 6, cy - 10), fill=(200, 245, 255, 240))
        d2.text((cx + 15, cy - 30), 'จุดเริ่ม', font=small, fill=(0, 0, 0))
        # คำอธิบายสัญลักษณ์ มุมขวาบน
        lx, ly = 1536 - 430, 12
        d2.rectangle((lx, ly, 1524, ly + 150), fill=(255, 255, 255, 240))
        d2.text((lx + 10, ly + 6), NAMES[z] + ' (' + z + ')', font=font, fill=(0, 0, 0))
        rows_leg = [((60, 255, 120), 'เขียว = พื้นเดินได้'), ((255, 60, 60), 'แดง = กีดขวาง'),
                    ((255, 220, 0), 'เหลือง = ทางออกไปโซนอื่น'), ((200, 80, 255), 'ม่วง = จุดเกิดมอนสเตอร์ (4 ตัว)'),
                    ((0, 230, 255), 'ฟ้า = จุดเริ่มของผู้เล่น'), ((0, 0, 0), 'ดำ = บอส')]
        for i, (col, txt) in enumerate(rows_leg):
            yy = ly + 40 + i * 18
            d2.rectangle((lx + 12, yy + 3, lx + 26, yy + 17), fill=col)
            d2.text((lx + 34, yy), txt, font=small, fill=(0, 0, 0))
        base.convert('RGB').save(os.path.join(REF, 'zone_' + z + '_now.jpg'), quality=90)
        print('ok', z)

if __name__ == '__main__':
    main()
