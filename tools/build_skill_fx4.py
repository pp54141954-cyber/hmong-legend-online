#!/usr/bin/env python3
"""เอฟเฟกต์สกิลทิศขึ้น/ลง (V2-R43) จากตารางแบบ 4 ทิศของเจ้าของ: assets/design_refs/skills/dir4/<class>.png
ตาราง 9 แถว × 4 คอลัมน์ (FRONT · BACK · LEFT · RIGHT) ทิศละ 1 ภาพ (จังหวะเอฟเฟกต์เต็มที่)
- ใช้ FRONT = ตัวละครหันลง, BACK = หันขึ้น (ซ้าย/ขวา ใช้ตาราง 5 จังหวะเดิมที่ภาพเคลื่อนไหวครบกว่า)
- ลบพื้นหลัง + หุ่นสีเทา เหมือน build_skill_fx.py, ยึดเท้าหุ่นที่อยู่กลางช่อง
ผลลัพธ์: game/sprites/skfx4_<class>.webp (2 คอลัมน์ × 9 แถว) + ทะเบียน SKILL_FX4 ใน game/index.html
รัน: python3 tools/build_skill_fx4.py"""
import json, os, re
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/design_refs/skills/dir4')
CW, CH, AX, AY, FIG = 300, 260, 150, 226, 92
GRID = {
 'ผู้รักษา': ('healer', [104, 238, 377, 511, 643, 770, 901, 1013, 1134, 1306], [65, 341, 618]),
}

def fx_layer(a, bg):
    a = a.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2)
    col = sat > 40
    near = np.asarray(Image.fromarray((col * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0
    keep = col | ((lum > 232) & near)
    out = np.clip(a - bg[None, None, :] * 1.05, 0, 255); out[~keep] = 0
    soft = np.clip((sat - 25) / 30, 0, 1); soft[(lum > 232) & near] = 1
    out = out * soft[..., None]
    h, w = out.shape[:2]; e = 18
    fy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / e, 0, 1); fx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / e, 0, 1)
    return (out * (fy[:, None] * fx[None, :])[..., None]).astype(np.uint8)

def center_figure(a):
    """หุ่นสีเทาที่อยู่ใกล้กลางช่องที่สุด → (x กลาง, เท้า y, ความสูง)"""
    a = a.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2); h, w = lum.shape
    g = (sat < 30) & (lum > 55) & (lum < 225)
    cols = g.sum(0) > 6; runs, cur = [], []
    for x in range(w):
        if cols[x]: cur.append(x)
        elif cur: runs.append(cur); cur = []
    if cur: runs.append(cur)
    runs = [r for r in runs if r[-1] - r[0] >= 16]
    if not runs: return (w / 2, h * .9, h * .7)
    r = min(runs, key=lambda r: abs((r[0] + r[-1]) / 2 - w / 2))
    ys = np.where(g[:, r[0]:r[-1] + 1].sum(1) > 1)[0]
    return ((r[0] + r[-1]) / 2, ys.max(), max(40, ys.max() - ys.min()))

cat = {}
for cls, (name, rows, cols) in GRID.items():
    f = os.path.join(SRC, name + '.png')
    if not os.path.exists(f): print('ข้าม', name); continue
    im = np.asarray(Image.open(f).convert('RGB'))
    bg = np.median(im[rows[0] + 6:rows[0] + 16, cols[0] + 6:cols[0] + 40].reshape(-1, 3), axis=0)
    sheet = Image.new('RGBA', (CW * 2, CH * 9), (0, 0, 0, 0))
    cells = {(r, k): im[rows[r] + 3:rows[r + 1] - 2, cols[k] + 3:cols[k + 1] - 2] for r in range(9) for k in range(2)}
    figs = {rk: center_figure(c) for rk, c in cells.items()}
    s = FIG / float(np.median([f[2] for f in figs.values()]))   # ขนาดเดียวทั้งตาราง (หุ่นที่ถูกเอฟเฟกต์บังวัดความสูงได้ไม่เต็ม)
    for r in range(9):
        for k in range(2):
            cell = cells[(r, k)]; cx, fy, fh = figs[(r, k)]
            L = fx_layer(cell, bg); rgba = Image.fromarray(np.dstack([L, ((L.max(2) > 6) * 255).astype(np.uint8)]))
            rgba = rgba.resize((max(1, round(rgba.size[0] * s)), max(1, round(rgba.size[1] * s))), Image.LANCZOS)
            ox, oy = round(AX - cx * s), round(AY - fy * s)
            tile = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); tile.alpha_composite(rgba, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
            sheet.alpha_composite(tile, (k * CW, r * CH))
    sheet.save(os.path.join(ROOT, 'game/sprites', 'skfx4_' + name + '.webp'), 'WEBP', quality=88)
    chk = Image.new('RGBA', sheet.size, (24, 28, 40, 255)); chk.alpha_composite(sheet)
    chk.convert('RGB').resize((CW, CH * 9 // 2)).save(os.path.join(ROOT, 'docs/evidence', 'skfx4_' + name + '_check.png'))
    cat[cls] = name; print('สร้าง', name)
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const SKILL_FX4=' + json.dumps({'cw': CW, 'ch': CH, 'ax': AX, 'ay': AY, 'fig': FIG, 'cls': cat}, ensure_ascii=False, separators=(',', ':')) + ';/*SKILL_FX4*/'
s, n = re.subn(r'const SKILL_FX4=\{.*?\};/\*SKILL_FX4\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1: raise SystemExit('ไม่พบจุดฝัง SKILL_FX4')
open(p, 'w', encoding='utf-8').write(s); print(js)
