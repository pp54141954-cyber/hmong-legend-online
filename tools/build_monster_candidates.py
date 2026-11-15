#!/usr/bin/env python3
"""สร้างภาพตัวเลือกมอนสเตอร์ 14 ชนิด จากชุด CC0 "Dungeon Crawl 32x32 tiles"

ต้นฉบับ: assets/third_party/dungeon-crawl-32x32/  (คัดลอกจาก zip โดยไม่แก้ ดู SOURCE.md)
ผลลัพธ์:
  assets/monster_candidates/<id>.png     ภาพตัวเลือก (ขนาดพิกเซลเดิม ครอปขอบ หันขวา)
  assets/monster_candidates/candidates.json   รายการตัวเลือกต่อชนิด + ไฟล์ต้นฉบับ + การแก้ไข
รัน: python3 tools/build_monster_candidates.py   (ต้องมี Pillow)

ทุกภาพผ่าน "ปรับสไตล์พื้นฐาน" เหมือนกัน:
  1) ลบเงาดำทึบของชุด DCSS (เกมวาดเงาวงรีเอง)
  2) หันหน้าไปทางขวา (เกมกลับด้านเองเมื่อเดินไปทางซ้าย)
  3) เส้นขอบดำ → สีเข้มของสีข้าง ๆ (นุ่มลง เข้ากับมอนสเตอร์วาดด้วยโค้ดที่ไม่มีเส้นขอบ)
  4) ครอปพื้นที่ว่างออก
บางตัวเลือกปรับเพิ่ม (เปลี่ยนสี เติมเขา/เขี้ยว/ขนนก/หอก ลายเสือ แสงเรือง) — ระบุใน candidates.json
"""
import json, os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/third_party/dungeon-crawl-32x32')
OUT = os.path.join(ROOT, 'assets/monster_candidates')
PAD = 4  # เผื่อขอบสำหรับเขา/ขนนกที่เติม (พิกัดในสูตรเป็นพิกัดภาพต้นฉบับ 32x32)

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
lum = lambda p: 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
BLACK = (0, 0, 0)

def lerp(c0, c1, t):
    return tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))

def ramp(stops, t):
    t = max(0.0, min(1.0, t))
    pts = [(i / (len(stops) - 1), HEX(c)) for i, c in enumerate(stops)]
    for (a, ca), (b, cb) in zip(pts, pts[1:]):
        if t <= b:
            return lerp(ca, cb, (t - a) / (b - a))
    return pts[-1][1]

def load(name):
    im = Image.open(os.path.join(SRC, name)).convert('RGBA')
    out = Image.new('RGBA', (im.width + PAD * 2, im.height + PAD * 2), (0, 0, 0, 0))
    out.paste(im, (PAD, PAD))
    return out

def opaque(px, x, y, w, h):
    return 0 <= x < w and 0 <= y < h and px[x, y][3] > 0

def is_black(p):
    return p[3] > 0 and p[:3] == BLACK

def remove_shadow(im):
    """เงา DCSS เป็นพิกเซลดำทึบ (0,0,0) ใต้ตัว: ลบพิกเซลดำที่ติดพิกเซลสีไม่เกิน 1 จุด (8 ทิศ) ซ้ำจนนิ่ง"""
    im = im.copy(); px = im.load(); w, h = im.size
    for _ in range(12):
        kill = []
        for y in range(h):
            for x in range(w):
                if not is_black(px[x, y]):
                    continue
                near = sum(opaque(px, x + dx, y + dy, w, h) and not is_black(px[x + dx, y + dy])
                           for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
                if near <= 1:
                    kill.append((x, y))
        for x, y in kill:
            px[x, y] = (0, 0, 0, 0)
        if not kill:
            break
    return im

def recolor(stops, pick=lambda p, x, y: True, lo=0, hi=255):
    """เปลี่ยนสีตามความสว่างเดิม (คงเส้นขอบดำ) เฉพาะพิกเซลที่ pick เลือก"""
    def op(im):
        im = im.copy(); px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if p[3] == 0 or is_black(p) or not pick(p, x - PAD, y - PAD):
                    continue
                t = (lum(p) - lo) / max(1, hi - lo)
                px[x, y] = ramp(stops, t) + (p[3],)
        return im
    return op

def erase(pick):
    def op(im):
        im = im.copy(); px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                if px[x, y][3] and pick(px[x, y], x - PAD, y - PAD):
                    px[x, y] = (0, 0, 0, 0)
        return im
    return op

def dots(color, pts):
    """เติมพิกเซล (พิกัดภาพต้นฉบับ) — ใช้วาดเขา เขี้ยว ขนนก หอก"""
    def op(im):
        im = im.copy(); px = im.load(); c = HEX(color) + (255,)
        for x, y in pts:
            px[x + PAD, y + PAD] = c
        return im
    return op

def stripes(pick, every=4, color='#2a1a10'):
    def op(im):
        im = im.copy(); px = im.load(); c = HEX(color) + (255,)
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if p[3] and not is_black(p) and pick(p, x - PAD, y - PAD) and (x + y // 3) % every == 0:
                    px[x, y] = c
        return im
    return op

def glow(color, alpha=90, radius=2):
    """แสงเรืองรอบตัว (แทน shadowBlur ของการวาดด้วยโค้ด)"""
    def op(im):
        a = im.split()[3].point(lambda v: 255 if v else 0).filter(ImageFilter.MaxFilter(radius * 2 + 1))
        a = a.filter(ImageFilter.GaussianBlur(1)).point(lambda v: v * alpha // 255)
        halo = Image.new('RGBA', im.size, HEX(color) + (0,)); halo.putalpha(a)
        halo.alpha_composite(im)
        return halo
    return op

def outline_added(im):
    """ใส่ขอบเข้มให้พิกเซลสว่างที่ติดพื้นโปร่ง (เฉพาะส่วนที่เติมเอง — ส่วนเดิมมีขอบดำอยู่แล้ว)"""
    im = im.copy(); px = im.load(); w, h = im.size; add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if opaque(px, x + dx, y + dy, w, h) and px[x + dx, y + dy][3] == 255 and lum(px[x + dx, y + dy]) > 60:
                    add.append((x, y)); break
    for x, y in add:
        px[x, y] = (0, 0, 0, 255)
    return im

def soften_outline(im, k=0.32):
    """เส้นขอบดำ (0,0,0) → สีข้าง ๆ ที่เข้มลง"""
    im = im.copy(); src = im.copy().load(); px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            if not is_black(src[x, y]):
                continue
            cols = [src[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                    if (dx or dy) and opaque(src, x + dx, y + dy, w, h) and not is_black(src[x + dx, y + dy])
                    and src[x + dx, y + dy][3] == 255]
            if cols:
                avg = [sum(c[i] for c in cols) / len(cols) for i in range(3)]
                px[x, y] = tuple(int(v * k) for v in avg) + (255,)
            else:
                px[x, y] = (26, 20, 18, 255)
    return im

def crop(im):
    return im.crop(im.getbbox())

def build(src, flip, ops):
    im = remove_shadow(load(src))
    for op in ops:
        im = op(im)
    im = remove_shadow(im)
    im = outline_added(im)
    im = soften_outline(im)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return crop(im)

# ตัวกรองสี
red = lambda p, x, y: p[0] > p[1] + 40 and p[0] > p[2] + 40
pinkish = lambda p, x, y: p[0] > 150 and p[0] > p[2] + 20
yellowish = lambda p, x, y: p[0] > p[2] + 50 and p[1] > p[2] + 25
greyish = lambda p, x, y: max(p[:3]) - min(p[:3]) < 40
not_red = lambda p, x, y: not (p[0] > 150 and p[1] < 80)
orange_cloth = lambda p, x, y: p[0] > p[2] + 80 and p[1] < p[0] * .75 and 15 <= y <= 24
sun_disk = lambda p, x, y: y <= 5 and 13 <= x <= 21

# id: (ชนิด, ป้าย, ไฟล์ต้นฉบับ, หันซ้ายอยู่เดิม=flip, การปรับเพิ่ม(ข้อความ), [ops])
C = [
 ('boar_a', 'หมูป่า', 'hog_new + สีหมูป่า + เขี้ยว', 'animals/hog_new.png', True, 'เปลี่ยนสีชมพูเป็นน้ำตาลเข้ม เติมเขี้ยวงาช้าง',
  [recolor(['#22170f', '#3d2c24', '#5a4236', '#7a5a46'], pinkish, 110, 250), dots('#f3ead2', [(5, 21), (5, 20), (4, 19), (4, 18)])]),
 ('boar_b', 'หมูป่า', 'hell_hog_new', 'animals/hell_hog_new.png', True, '-', []),
 ('boar_c', 'หมูป่า', 'hog_new (เดิม)', 'animals/hog_new.png', True, '-', []),

 ('rabbit_a', 'กระต่ายมีเขา', 'quokka_new + ขนขาว + เขา', 'animals/quokka_new.png', True, 'เปลี่ยนเป็นขนขาว เติมเขาเดี่ยวสีน้ำตาล',
  [recolor(['#9a968c', '#d8d4cc', '#eceae4', '#ffffff'], lambda p, x, y: lum(p) > 40, 40, 200),
   dots('#8a6a3a', [(9, 4), (9, 3), (10, 2), (10, 1), (11, 0)])]),
 ('rabbit_b', 'กระต่ายมีเขา', 'quokka_new (เดิม)', 'animals/quokka_new.png', True, '-', []),

 ('wolf_a', 'หมาป่า', 'wolf', 'animals/wolf.png', True, '-', []),
 ('wolf_b', 'หมาป่า', 'warg', 'animals/warg.png', True, '-', []),
 ('wolf_c', 'หมาป่า', 'jackal_new', 'animals/jackal_new.png', True, '-', []),
 ('wolf_d', 'หมาป่า', 'hound', 'animals/hound.png', True, '-', []),

 ('pheasant_a', 'ไก่ฟ้า', 'raven + สีไก่ฟ้า', 'raven.png', True, 'ตัวสีทองแดง-แดง หัวเขียว (ชุดนี้ไม่มีไก่ฟ้า ใช้นกกาแทน)',
  [recolor(['#3a160c', '#8a2a1e', '#b8322a', '#e08a3a'], lambda p, x, y: y > 9 or x > 14, 0, 110),
   recolor(['#123a22', '#2f7a4a', '#4aa86a', '#9ad89a'], lambda p, x, y: y <= 9 and x <= 14, 0, 110)]),
 ('pheasant_b', 'ไก่ฟ้า', 'raven (เดิม)', 'raven.png', True, '-', []),
 ('pheasant_c', 'ไก่ฟ้า', 'phoenix', 'phoenix.png', False, '-', []),

 ('goblin_a', 'ก็อบลิน', 'goblin_new + ผิวเขียว', 'goblin_new.png', False, 'ผิว/ชุดสีแดง → เขียวแบบก็อบลินในเกม',
  [recolor(['#1f3412', '#3f6a26', '#5d8a3a', '#9ac46a'], red, 30, 200)]),
 ('goblin_b', 'ก็อบลิน', 'goblin_new (เดิม)', 'goblin_new.png', False, '-', []),
 ('goblin_c', 'ก็อบลิน', 'hobgoblin_new', 'hobgoblin_new.png', False, '-', []),
 ('goblin_d', 'ก็อบลิน', 'kobold_new', 'kobold_new.png', False, '-', []),

 ('tiger_a', 'เสือ', 'cat_9 + สีเสือ + ลาย', 'player/felids/cat_9.png', True, 'สีส้มเข้มขึ้น เติมลายดำ (ชุดนี้ไม่มีเสือ ใช้แมวส้มแทน)',
  [recolor(['#7a3a0c', '#c8701e', '#d98a2a', '#f0b050'], yellowish, 60, 240), stripes(lambda p, x, y: p[0] > p[2] + 60, 4)]),
 ('tiger_b', 'เสือ', 'cat_9 (เดิม)', 'player/felids/cat_9.png', True, '-', []),
 ('tiger_c', 'เสือ', 'manticore', 'manticore.png', True, '-', []),

 ('bear_a', 'หมีเขา', 'grizzly_bear + สีน้ำตาล + เขา', 'animals/grizzly_bear.png', True, 'สีเทา → น้ำตาล เติมเขาคู่สีกระดูก',
  [recolor(['#2a1a0e', '#6b4a2e', '#83603e', '#a07850'], greyish, 20, 200),
   dots('#d8c8a0', [(6, 6), (5, 5), (5, 4), (6, 3), (10, 6), (10, 5), (11, 4), (11, 3)])]),
 ('bear_b', 'หมีเขา', 'bear', 'animals/bear.png', True, '-', []),
 ('bear_c', 'หมีเขา', 'black_bear_new', 'animals/black_bear_new.png', True, '-', []),

 ('golem_a', 'โกเลมหิน', 'stone_golem', 'nonliving/stone_golem.png', False, '-', []),
 ('golem_b', 'โกเลมหิน', 'earth_elemental', 'nonliving/earth_elemental.png', False, '-', []),
 ('golem_c', 'โกเลมหิน', 'clay_golem', 'nonliving/clay_golem.png', False, '-', []),
 ('golem_d', 'โกเลมหิน', 'gargoyle', 'nonliving/gargoyle.png', False, '-', []),

 ('ghostbull_a', 'กระทิงผี', 'death_yak + สีม่วงผี + แสงแดง', 'animals/death_yak_new.png', True, 'ขนเทา → ม่วงเข้ม คงตาแดง เติมแสงเรืองแดงแบบในเกม',
  [recolor(['#140a16', '#2a1a2c', '#4a2e52', '#7a5a86'], lambda p, x, y: greyish(p, x, y) and lum(p) < 200, 20, 200), glow('#ff3030', 80, 1)]),
 ('ghostbull_b', 'กระทิงผี', 'death_yak_new (เดิม)', 'animals/death_yak_new.png', True, '-', []),
 ('ghostbull_c', 'กระทิงผี', 'catoblepas', 'animals/catoblepas.png', True, '-', []),

 ('monkey_a', 'ลิงป่า', 'rock_troll + สีลิง', 'rock_troll.png', False, 'สีแดงอิฐ → น้ำตาลลิง (ชุดนี้ไม่มีลิง)',
  [recolor(['#2a180c', '#6a4428', '#7a5232', '#a07850'], lambda p, x, y: p[0] > p[2] + 20, 20, 160)]),
 ('monkey_b', 'ลิงป่า', 'rock_troll (เดิม)', 'rock_troll.png', False, '-', []),
 ('monkey_c', 'ลิงป่า', 'faun', 'faun.png', False, '-', []),

 ('deer_a', 'กวางภูเขา', 'apis + สีกวาง + เขากวาง', 'holy/apis.png', True, 'ลบจานสุริยะ เปลี่ยนเป็นสีน้ำตาลกวาง เติมเขากวาง (ชุดนี้ไม่มีกวาง)',
  [erase(sun_disk), recolor(['#3a2814', '#8a6a48', '#9a7a56', '#c8a882'], lambda p, x, y: True, 10, 130),
   dots('#d8c8a0', [(12, 3), (12, 2), (11, 1), (11, 0), (10, -1), (10, -2), (11, -2), (12, -3),
                    (14, 3), (15, 2), (15, 1), (16, 0), (16, -1), (17, -2), (15, -1), (14, -2)])]),
 ('deer_b', 'กวางภูเขา', 'apis ลบจานสุริยะ', 'holy/apis.png', True, 'ลบจานสุริยะบนหัว', [erase(sun_disk)]),
 ('deer_c', 'กวางภูเขา', 'yak_new', 'animals/yak_new.png', True, '-', []),

 ('tribal_a', 'นักรบเผ่าป่า', 'human_slave + ขนนก + หอก', 'human_slave.png', False, 'ผ้านุ่งส้ม → น้ำตาล เติมขนนกแดง/ขาว และหอก',
  [recolor(['#2a2012', '#4a3a22', '#5e4a2a', '#8a7048'], orange_cloth, 60, 200),
   dots('#d8402a', [(16, 4), (16, 3), (17, 2), (17, 1)]), dots('#efe6dc', [(14, 4), (14, 3), (13, 2)]),
   dots('#8a6238', [(24, y) for y in range(5, 29)]), dots('#c8ccd4', [(24, 4), (24, 3), (24, 2)])]),
 ('tribal_b', 'นักรบเผ่าป่า', 'slave_freed', 'slave_freed.png', False, '-', []),
 ('tribal_c', 'นักรบเผ่าป่า', 'orc_warrior_new', 'orc_warrior_new.png', False, '-', []),

 ('demon_a', 'ปีศาจ', 'red_devil_new', 'demons/red_devil_new.png', False, '-', []),
 ('demon_b', 'ปีศาจ', 'fiend', 'demons/fiend.png', False, '-', []),
 ('demon_c', 'ปีศาจ', 'hairy_devil', 'demons/hairy_devil.png', False, '-', []),
 ('demon_d', 'ปีศาจ', 'imp', 'demons/imp.png', False, '-', []),

 ('treespirit_a', 'วิญญาณไม้', 'treant', 'fungi_plants/treant.png', False, '-', []),
 ('treespirit_b', 'วิญญาณไม้', 'leshy', 'unique/leshy.png', False, '-', []),
 ('treespirit_c', 'วิญญาณไม้', 'tree_form', 'player/transform/tree_form.png', False, '-', []),
 ('treespirit_d', 'วิญญาณไม้', 'dryad', 'dryad.png', False, '-', []),
]

ORDER = ['หมูป่า', 'กระต่ายมีเขา', 'หมาป่า', 'ไก่ฟ้า', 'ก็อบลิน', 'เสือ', 'หมีเขา', 'โกเลมหิน',
         'กระทิงผี', 'ลิงป่า', 'กวางภูเขา', 'นักรบเผ่าป่า', 'ปีศาจ', 'วิญญาณไม้']

def main():
    os.makedirs(OUT, exist_ok=True)
    man = {k: [] for k in ORDER}
    for cid, mon, label, src, flip, note, ops in C:
        im = build(src, flip, ops)
        im.save(os.path.join(OUT, cid + '.png'), optimize=True)
        man[mon].append({'id': cid, 'label': label, 'source': src, 'flipped': flip,
                         'extra': note, 'size': list(im.size)})
    with open(os.path.join(OUT, 'candidates.json'), 'w', encoding='utf-8') as fh:
        json.dump(man, fh, ensure_ascii=False, indent=1)
    print('candidates:', len(C), 'monsters:', sum(1 for v in man.values() if v))

if __name__ == '__main__':
    main()
