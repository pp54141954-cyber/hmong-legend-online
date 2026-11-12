#!/usr/bin/env python3
"""ตัวละครต้นแบบของแต่ละอาชีพ (V2-R46) จากภาพของเจ้าของ: assets/sprites_src/classbody/
แต่ละแบบ → game/sprites/pcl_<id>.webp 4 คอลัมน์ (เฟรมเดิน) × 4 แถว (ลง S, ขึ้น N, ซ้าย W, ขวา E) ช่อง 96×124 เท้า y=120 สูงเท่าตัวละครเดิม
ทิศที่ยังไม่มีภาพ → ใช้ภาพหันหน้า (ชั่วคราว) · ทะเบียน CLASS_BODY ฝังใน game/index.html
รัน: python3 tools/build_class_bodies.py"""
import json, os, re, sys
from collections import deque
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_char_sets import unbg, frames_grid, frames_cols, sheet, CW
SRC = os.path.join(ROOT, 'assets/sprites_src/classbody')

def light(path, box=None):
    im = unbg(path)
    return im.crop(box) if box else im

def dark(path, box):
    """พื้นหลังน้ำเงินเข้ม: เติมจากขอบช่องผ่านพิกเซลมืดอมน้ำเงิน (ตัวละครมีเส้นขอบดำ/น้ำตาล กั้นไว้)"""
    im = Image.open(path).convert('RGBA').crop(box); W, H = im.size; px = im.load()
    def bgp(p):
        r, g, b, _ = p; return (r + g + b) / 3 < 70 and b - r > 8
    seen = bytearray(W * H); q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while q:
        x, y = q.popleft(); i = y * W + x
        if seen[i] or not bgp(px[x, y]): continue
        seen[i] = 1; px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H: q.append((nx, ny))
    return im

def row_frames(im, n=4):
    fr = frames_cols(im); fr = [f for f in fr if f.size[1] > im.size[1] * .35]
    return fr[:n]

def fighter(g):
    f = os.path.join(SRC, 'fighter_mf.png'); ox = 0 if g == 'm' else 768
    boxes = {'S': (ox + 30, 684, ox + 366, 790), 'N': (ox + 402, 684, ox + 740, 790), 'W': (ox + 30, 842, ox + 366, 946), 'E': (ox + 402, 842, ox + 740, 946)}
    return {d: row_frames(dark(f, b)) for d, b in boxes.items()}

def assassin(g):
    f = os.path.join(SRC, 'assassin_mf.png'); im = unbg(f); x0 = 0 if g == 'm' else 768
    return {'S': row_frames(im.crop((x0, 140, x0 + 768, 500))), 'N': row_frames(im.crop((x0, 500, x0 + 768, 860)))}

def grid16(front, back):
    fr = frames_grid(unbg(os.path.join(SRC, front)), 4, 4)[:4]; bk = frames_grid(unbg(os.path.join(SRC, back)), 4, 4)[:4]
    return {'S': fr, 'N': bk}

def quad(name):
    """ภาพแบบ 2×2 กลุ่ม (ไม่มีกรอบ): แถวบน ซ้าย=หน้า ขวา=หลัง · แถวสอง ซ้าย=หันซ้าย ขวา=หันขวา"""
    im = unbg(os.path.join(SRC, name)); W = im.size[0]
    return {'S': row_frames(im.crop((0, 70, W // 2, 290))), 'N': row_frames(im.crop((W // 2, 70, W, 290))),
            'W': row_frames(im.crop((0, 290, W // 2, 510))), 'E': row_frames(im.crop((W // 2, 290, W, 510)))}

def panels(name):
    """ภาพแบบกรอบ 4 ช่อง DOWN/UP/LEFT/RIGHT (ใช้ชุดบน)"""
    f = os.path.join(SRC, name); out = {}
    for d, (x0, x1) in zip('SNWE', ((14, 372), (398, 754), (782, 1140), (1166, 1524))):
        tmp = os.path.join('/tmp', 'hl_panel.png'); Image.open(f).convert('RGB').crop((x0, 160, x1, 392)).save(tmp)
        out[d] = row_frames(unbg(tmp))
    return out

def two_rows(name, split):
    im = unbg(os.path.join(SRC, name)); W, H = im.size
    return {'S': row_frames(im.crop((0, 0, W, split))), 'N': row_frames(im.crop((0, split, W, H)))}

SETS = [  # (id, อาชีพ, เพศที่ใช้, ฟังก์ชัน)
    ('fighter_m', 'นักสู้', ['m'], lambda: fighter('m')),
    ('fighter_f', 'นักสู้', ['f'], lambda: quad('fighter_f2.png')),  # แบบใหม่ (ชุดแดงหางม้า) แทนชุดในภาพนักสู้ชาย/หญิง
    ('spirit_m', 'ผู้สืบวิญญาณ', ['m'], lambda: panels('spirit_m.png')),
    ('spirit_f', 'ผู้สืบวิญญาณ', ['f'], lambda: quad('spirit_f.png')),
    ('guardian_m', 'ผู้พิทักษ์', ['m'], lambda: two_rows('guardian_m.png', 440)),
    ('guardian_f', 'ผู้พิทักษ์', ['f'], lambda: two_rows('guardian_f.png', 505)),
    ('assassin_m', 'นักฆ่า', ['m'], lambda: assassin('m')),
    ('assassin_f', 'นักฆ่า', ['f'], lambda: assassin('f')),
    ('mage', 'ผู้ใช้มนตรา', ['m', 'f'], lambda: grid16('mage_front.png', 'mage_back.png')),
    ('healer', 'ผู้รักษา', ['m', 'f'], lambda: grid16('healer_front.png', 'healer_back.png')),
]
cat = {}
for sid, cls, gs, fn in SETS:
    d = fn()
    for k in ('S', 'N'): assert len(d.get(k, [])) == 4, (sid, k, len(d.get(k, [])))
    full = [k for k in 'SNWE' if len(d.get(k, [])) == 4]
    frames = d['S'] + d['N'] + d.get('W', d['S']) + d.get('E', d['S'])
    out = sheet(frames, 4, 4, CW)
    out.save(os.path.join(ROOT, 'game/sprites', 'pcl_' + sid + '.webp'), 'WEBP', lossless=True)
    chk = Image.new('RGBA', out.size, (70, 90, 70, 255)); chk.alpha_composite(out); chk.resize((out.size[0] * 2, out.size[1] * 2), Image.NEAREST).save(os.path.join(ROOT, 'docs/evidence', 'pcl_' + sid + '_check.png'))
    for g in gs: cat.setdefault(cls, {})[g] = {'id': sid, 'dirs': ''.join(full)}
    print('สร้าง', sid, 'ทิศที่มีภาพจริง', ''.join(full))
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const CLASS_BODY=' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';/*CLASS_BODY*/'
s, n = re.subn(r'const CLASS_BODY=\{.*?\};/\*CLASS_BODY\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1: raise SystemExit('ไม่พบจุดฝัง CLASS_BODY')
open(p, 'w', encoding='utf-8').write(s); print(js)
