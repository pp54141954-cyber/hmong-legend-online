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

def black_bg(im):
    """พื้นดำ: เติมจากขอบผ่านพิกเซลมืด + ลบเศษสีแดงจัด (ภาพบางชุดมีขอบแดงเพี้ยน) + ก้อนเล็ก"""
    im = im.convert('RGBA'); W, H = im.size; px = im.load()
    def dk(p): return p[3] < 20 or max(p[:3]) < 42
    seen = bytearray(W * H); q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while q:
        x, y = q.popleft(); i = y * W + x
        if seen[i] or not dk(px[x, y]): continue
        seen[i] = 1; px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H: q.append((nx, ny))
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and r > 170 and g < 70 and b < 70: px[x, y] = (0, 0, 0, 0)
    seen2 = bytearray(W * H)
    for sy in range(H):
        for sx in range(W):
            p0 = px[sx, sy]
            if seen2[sy * W + sx] or not p0[3] or max(p0[:3]) >= 22: continue
            comp = []; q2 = deque([(sx, sy)]); seen2[sy * W + sx] = 1
            while q2:
                x, y = q2.popleft(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen2[ny * W + nx] and px[nx, ny][3] and max(px[nx, ny][:3]) < 22: seen2[ny * W + nx] = 1; q2.append((nx, ny))
            if len(comp) >= 40:  # พื้นดำที่ติดในช่องปิด (ระหว่างคันธนูกับสาย)
                for x, y in comp: px[x, y] = (0, 0, 0, 0)
    return im

def drop_small(im, mn=250):
    W, H = im.size; px = im.load(); seen = bytearray(W * H)
    for sy in range(H):
        for sx in range(W):
            if seen[sy * W + sx] or not px[sx, sy][3]: continue
            comp = []; q = deque([(sx, sy)]); seen[sy * W + sx] = 1
            while q:
                x, y = q.popleft(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and px[nx, ny][3]: seen[ny * W + nx] = 1; q.append((nx, ny))
            if len(comp) < mn:
                for x, y in comp: px[x, y] = (0, 0, 0, 0)
    return im

def grid4(name, box=None, bg='light'):
    """ตาราง 4 แถว (ลง/ขึ้น/ซ้าย/ขวา) × 4 เฟรม: แบ่งแถวตามช่องว่างแนวนอน"""
    f = os.path.join(SRC, name)
    if bg == 'light':
        src = Image.open(f).convert('RGB'); src = src.crop(box) if box else src
        tmp = '/tmp/hl_grid4.png'; src.save(tmp); im = unbg(tmp)
    else:
        src = Image.open(f); src = src.crop(box) if box else src; im = black_bg(src)
    im = drop_small(im); a = im.split()[3]; W, H = im.size
    occ = [sum(1 for x in range(0, W, 3) if a.getpixel((x, y))) > 2 for y in range(H)]
    bands, st = [], None
    for y, o in enumerate(occ + [False]):
        if o and st is None: st = y
        elif not o and st is not None:
            if y - st > H * .1: bands.append((st, y))
            st = None
    assert len(bands) == 4, (name, box, bands)
    return {d: row_frames(im.crop((0, b0, W, b1))) for d, (b0, b1) in zip('SNWE', bands)}

SETS = [  # (id, อาชีพ, เพศที่ใช้, ฟังก์ชัน)
    ('fighter_m', 'นักสู้', ['m'], lambda: fighter('m')),
    ('assassin_m', 'นักฆ่า', ['m'], lambda: grid4('assassin_mf4.png', (8, 8, 880, 880))),
    ('assassin_f', 'นักฆ่า', ['f'], lambda: grid4('assassin_mf4.png', (896, 8, 1766, 880))),
    ('archer_m', 'นักธนู', ['m'], lambda: grid4('archer_m.png')),
    ('archer_f', 'นักธนู', ['f'], lambda: grid4('archer_f.png', bg='black')),
    ('guardian_m', 'ผู้พิทักษ์', ['m'], lambda: grid4('guardian_m4.png', (225, 70, 1200, 1200))),
    ('guardian_f', 'ผู้พิทักษ์', ['f'], lambda: grid4('guardian_f4.png', (175, 90, 1230, 1215))),
    ('healer_m', 'ผู้รักษา', ['m'], lambda: grid4('healer_m4.png')),
    ('healer_f', 'ผู้รักษา', ['f'], lambda: grid4('healer_f4.png')),
    ('mage_m', 'ผู้ใช้มนตรา', ['m'], lambda: grid4('mage_mf4.png', (6, 6, 880, 880), bg='black')),
    ('mage_f', 'ผู้ใช้มนตรา', ['f'], lambda: grid4('mage_mf4.png', (894, 6, 1768, 880), bg='black')),
    ('fighter_f', 'นักสู้', ['f'], lambda: quad('fighter_f2.png')),  # แบบใหม่ (ชุดแดงหางม้า) แทนชุดในภาพนักสู้ชาย/หญิง
    ('spirit_m', 'ผู้สืบวิญญาณ', ['m'], lambda: panels('spirit_m.png')),
    ('spirit_f', 'ผู้สืบวิญญาณ', ['f'], lambda: quad('spirit_f.png')),
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
import runpy; runpy.run_path(os.path.join(ROOT, 'tools', 'clean_floor_shadow.py'))  # V2-R52: ลบเงาพื้นสีขาวใต้เท้า
