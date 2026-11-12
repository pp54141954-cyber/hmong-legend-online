#!/usr/bin/env python3
"""เอฟเฟกต์สกิลทิศขึ้น/ลงแบบ 5 จังหวะ (V2-R44): assets/design_refs/skills/updown/<class>_down.png, <class>_up.png
ตาราง 9 แถว × 5 คอลัมน์ (READY · WIND-UP · ACTION · RELEASE · RECOVER) ตาม docs/prompts/skill_charts_4dir.md
- DOWN: หุ่นผู้ใช้สกิลด้านบนกลางช่อง · UP: หุ่นด้านล่างกลางช่อง — หาจากหุ่นเทาตัวใหญ่สุดในช่อง READY
ผลลัพธ์: game/sprites/skfxud_<class>.webp (5 คอลัมน์ × 18 แถว: 9 DOWN แล้ว 9 UP) + ทะเบียน SKILL_FXUD
ลำดับความสำคัญในเกม: ตารางนี้ > ตาราง 4 ทิศ (ภาพเดียว) > ตารางหันขวา
รัน: python3 tools/build_skill_fxud.py"""
import json, os, re
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/design_refs/skills/updown')
CW, CH, FIG = 440, 280, 92
ANCH = {'down': (220, 86), 'up': (220, 256)}     # จุดเท้าผู้ใช้สกิลในช่องผลลัพธ์
GRID = {
 'ผู้พิทักษ์': ('guardian', {'up': ([115, 255, 397, 547, 691, 830, 970, 1109, 1251, 1420], [69, 252, 435, 613, 910, 1084]),
                            'down': ([115, 255, 396, 547, 691, 831, 970, 1109, 1251, 1420], [69, 253, 435, 614, 910, 1084])}),
 'นักธนู': ('archer', {'up': ([131, 256, 378, 502, 623, 742, 859, 978, 1106, 1245], [88, 309, 529, 752, 973, 1194]),
                      'down': ([127, 254, 376, 500, 621, 738, 857, 975, 1106, 1255], [88, 309, 529, 750, 972, 1194])}),
}

def fx_layer(a, bg):
    a = a.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2)
    col = sat > 45
    near = np.asarray(Image.fromarray((col * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0
    keep = col | ((lum > 240) & near)
    out = np.clip(a - bg[None, None, :] * 1.05, 0, 255); out[~keep] = 0
    soft = np.clip((sat - 30) / 30, 0, 1); soft[(lum > 240) & near] = 1
    out = out * soft[..., None]
    h, w = out.shape[:2]; e = 16
    fy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / e, 0, 1); fx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / e, 0, 1)
    return (out * (fy[:, None] * fx[None, :])[..., None]).astype(np.uint8)

def caster(a, d):
    """หุ่นเทาตัวใหญ่สุด (สูงสุด) ในช่อง → (x กลาง, เท้า y, ความสูง) — ใช้ connected components ของพิกเซลเทา"""
    a = a.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2); h, w = lum.shape
    g = (sat < 30) & (lum > 60) & (lum < 250)
    lab = np.zeros((h, w), np.int32); comps = []; nid = 0
    from collections import deque
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if not g[y, x] or lab[y, x]: continue
            nid += 1; q = deque([(y, x)]); lab[y, x] = nid; ys = []; xs = []
            while q:
                cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and g[ny, nx] and not lab[ny, nx]: lab[ny, nx] = nid; q.append((ny, nx))
            if len(ys) > 150: comps.append(((min(xs) + max(xs)) / 2, max(ys), max(ys) - min(ys)))
    if not comps: return (w / 2, h * .5, h * .4)
    mh = max(c[2] for c in comps); big = [c for c in comps if c[2] >= mh * .6]
    # DOWN: ผู้ใช้สกิลอยู่บนสุด · UP: อยู่ล่างสุด (เป้าหมายตัวเท่ากันได้ในภาพพิกเซล)
    return min(big, key=lambda c: c[1]) if d == 'down' else max(big, key=lambda c: c[1])

cat = {}
for cls, (name, dirs) in GRID.items():
    if not all(os.path.exists(os.path.join(SRC, f'{name}_{d}.png')) for d in dirs): print('ข้าม', name); continue
    sheet = Image.new('RGBA', (CW * 5, CH * 18), (0, 0, 0, 0))
    for di, d in enumerate(('down', 'up')):
        rows, cols = dirs[d]; im = np.asarray(Image.open(os.path.join(SRC, f'{name}_{d}.png')).convert('RGB'))
        bg = np.median(im[rows[0] + 6:rows[0] + 14, cols[0] + 6:cols[0] + 30].reshape(-1, 3), axis=0)
        ready = [caster(im[rows[r] + 3:rows[r + 1] - 2, cols[0] + 3:cols[1] - 2], d) for r in range(9)]
        s = FIG / float(np.median([c[2] for c in ready])); ax, ay = ANCH[d]
        for r in range(9):
            cx, fy, _ = ready[r]
            for k in range(5):
                cell = im[rows[r] + 3:rows[r + 1] - 2, cols[k] + 3:cols[k + 1] - 2]
                L = fx_layer(cell, bg); rgba = Image.fromarray(np.dstack([L, ((L.max(2) > 6) * 255).astype(np.uint8)]))
                rgba = rgba.resize((max(1, round(rgba.size[0] * s)), max(1, round(rgba.size[1] * s))), Image.LANCZOS)
                ox, oy = round(ax - cx * s), round(ay - fy * s)
                tile = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); tile.alpha_composite(rgba, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
                sheet.alpha_composite(tile, (k * CW, (di * 9 + r) * CH))
    sheet.save(os.path.join(ROOT, 'game/sprites', 'skfxud_' + name + '.webp'), 'WEBP', quality=70, method=6)
    chk = Image.new('RGBA', sheet.size, (24, 28, 40, 255)); chk.alpha_composite(sheet)
    chk.convert('RGB').resize((CW * 5 // 3, CH * 18 // 3)).save(os.path.join(ROOT, 'docs/evidence', 'skfxud_' + name + '_check.png'))
    cat[cls] = name; print('สร้าง', name)
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const SKILL_FXUD=' + json.dumps({'cw': CW, 'ch': CH, 'fig': FIG, 'anch': ANCH, 'cls': cat}, ensure_ascii=False, separators=(',', ':')) + ';/*SKILL_FXUD*/'
s, n = re.subn(r'const SKILL_FXUD=\{.*?\};/\*SKILL_FXUD\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1: raise SystemExit('ไม่พบจุดฝัง SKILL_FXUD')
open(p, 'w', encoding='utf-8').write(s); print(js)
