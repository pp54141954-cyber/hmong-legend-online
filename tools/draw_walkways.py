#!/usr/bin/env python3
"""V2-R24 ทางเดินไม้บนน้ำ (สะพานทางเดิน) วาดทับภาพแผนที่สะอาด แบบพิกเซลอาร์ต
ต้นฉบับไม่ถูกแก้: assets/maps_src/<zone>_base.png → assets/maps_src/<zone>.png
ช่องที่วาดต้องเปิดใน LINK ของ tools/build_clean_masks.py ด้วย (WALKWAYS ใช้ร่วมกัน)
รัน: python3 tools/draw_walkways.py && python3 tools/build_clean_masks.py && python3 tools/embed_maps.py && node tools/extract-shared.js
"""
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = 32
# (x0, y0, x1, y1) ช่อง 32 px รวมปลาย — แนวนอน (ไม้กระดานเรียงตั้ง)
WALKWAYS = {
    'field2': [
        (32, 18, 42, 19),   # ข้ามแอ่งน้ำตก ไปลานซากุระฝั่งขวา
        (5, 27, 6, 29),     # ทางลงจากลานซากุระซ้ายล่าง
        (5, 29, 29, 30),    # ทางยาวกลางลำธารด้านล่าง
        (13, 28, 18, 30),   # ลานไม้กลางน้ำ (จุดเกิดมอนสเตอร์)
    ],
}
WOOD, WOOD_L, WOOD_D, GAP, POST, SHADOW = (156, 101, 56), (196, 140, 84), (110, 68, 34), (74, 44, 22), (86, 52, 26), (20, 40, 50, 110)
ROPE = (222, 196, 140)

def draw(zid):
    im = Image.open(os.path.join(ROOT, 'assets/maps_src', zid + '_base.png')).convert('RGBA')
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
    for x0, y0, x1, y1 in WALKWAYS[zid]:  # เงาบนผิวน้ำ
        ds.rectangle((x0 * T + 4, y1 * T + T, x1 * T + T + 4, y1 * T + T + 7), fill=SHADOW)
    im.alpha_composite(sh); d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in WALKWAYS[zid]:
        L, Tp, R, B = x0 * T, y0 * T + 2, x1 * T + T - 1, y1 * T + T - 1
        d.rectangle((L, Tp, R, B), fill=WOOD)
        for x in range(L, R, 8):  # แผ่นไม้ + ลายเสี้ยน
            d.line((x, Tp, x, B), fill=GAP)
            d.line((x + 1, Tp, x + 1, B), fill=WOOD_L)
            for y in range(Tp + 5 + (x // 8 % 3) * 4, B - 2, 13):
                d.line((x + 3, y, x + 5, y), fill=WOOD_D)
        d.rectangle((L, Tp, R, Tp + 2), fill=WOOD_L)          # ขอบบนสว่าง
        d.rectangle((L, B - 3, R, B), fill=WOOD_D)            # ขอบล่างมืด
        d.rectangle((L, Tp, L + 1, B), fill=WOOD_D); d.rectangle((R - 1, Tp, R, B), fill=WOOD_D)
    for x0, y0, x1, y1 in WALKWAYS[zid]:  # ราวเชือก + เสา (วาดหลังพื้นทุกช่วง ไม่ให้ทับกัน)
        L, Tp, R, B = x0 * T, y0 * T + 2, x1 * T + T - 1, y1 * T + T - 1
        for yy in (Tp, B - 2):
            if any(o != (x0, y0, x1, y1) and o[0] * T <= L + 8 and o[2] * T + T >= R - 8 and o[1] * T <= yy <= o[3] * T + T for o in WALKWAYS[zid]):
                continue
            xs = list(range(L + 2, R - 6, 48)) + [R - 7]
            d.line((L + 4, yy - 8, R - 4, yy - 8), fill=ROPE, width=2)
            for x in xs:
                d.rectangle((x, yy - 13, x + 5, yy + 2), fill=POST); d.rectangle((x, yy - 13, x + 5, yy - 12), fill=WOOD_L); d.rectangle((x + 4, yy - 12, x + 5, yy + 2), fill=GAP)
    im.convert('RGB').save(os.path.join(ROOT, 'assets/maps_src', zid + '.png'))
    print(zid, 'วาดทางเดิน', len(WALKWAYS[zid]), 'ช่วง')

if __name__ == '__main__':
    for z in WALKWAYS:
        draw(z)
