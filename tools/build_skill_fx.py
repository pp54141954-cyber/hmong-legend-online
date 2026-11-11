#!/usr/bin/env python3
"""เอฟเฟกต์สกิลจากตารางท่าของเจ้าของ (V2-R41): assets/design_refs/skills/v2/<class>.png (9 ท่า × 5 จังหวะ)
- ตัดทีละช่อง → ลบพื้นหลังสีเข้ม (ลบสีพื้นออก ใช้วาดแบบบวกแสงในเกม) → ลบหุ่นสีเทา (ตัวละครในเกมวาดเอง) เก็บเฉพาะเอฟเฟกต์ที่มีสี + แกนสีขาวที่ติดกับสี
- จัดทุกแถวให้เท้าหุ่นผู้ใช้สกิล (ช่อง READY) อยู่จุดเดียวกัน และย่อให้หุ่นสูงเท่ากัน → ในเกมวางจุดนี้ที่เท้าตัวละคร
ผลลัพธ์: game/sprites/skfx_<class>.webp (5 คอลัมน์ × 9 แถว ช่อง CW×CH) + ทะเบียน SKILL_FX ใน game/index.html + docs/evidence/skfx_<class>_check.png
รัน: python3 tools/build_skill_fx.py"""
import json, os, re
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/design_refs/skills/v2')
CW, CH, AX, AY, FIG = 320, 200, 70, 172, 92   # ช่องในแผ่นผลลัพธ์, จุดเท้า, ความสูงหุ่นหลังย่อ
# เส้นตาราง (อ่านจากภาพ: tools ตรวจหาเส้นสว่าง แล้วยืนยันด้วยตา) — แถว 9 ท่า, คอลัมน์ 5 จังหวะ
GRID = {
 'นักธนู':       ('archer',      [116, 256, 396, 548, 692, 832, 972, 1110, 1252, 1420], [69, 252, 436, 612, 910, 1084]),
 'นักฆ่า':       ('assassin',    [124, 270, 414, 567, 715, 862, 1006, 1144, 1280, 1436], [138, 320, 498, 692, 901, 1084]),
 'นักสู้':       ('fighter',     [115, 273, 427, 581, 737, 891, 1048, 1198, 1329, 1506], [57, 240, 418, 608, 831, 1020]),
 'ผู้สืบวิญญาณ': ('spirit_heir', [119, 286, 421, 565, 696, 824, 980, 1110, 1252, 1420], [56, 254, 446, 648, 878, 1084]),
 'ผู้รักษา':     ('healer',      [104, 238, 377, 511, 644, 770, 903, 1014, 1134, 1306], [66, 286, 498, 715, 949, 1180]),
}

def fx_layer(cell, bg):
    a = cell.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2)
    col = sat > 40
    near = np.asarray(Image.fromarray((col * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0
    keep = col | ((lum > 205) & near)                       # สีเรือง + แกนขาวติดสี (หุ่นเทาไม่ผ่าน)
    out = np.clip(a - bg[None, None, :] * 1.05, 0, 255)      # ลบสีพื้น → วาดแบบบวกแสง
    out[~keep] = 0
    soft = np.clip((sat - 25) / 30, 0, 1); soft[(lum > 205) & near] = 1
    out = out * np.maximum(soft, keep * .0)[..., None]
    return out.astype(np.uint8)

def caster(cell):
    """หุ่นผู้ใช้สกิลในช่อง READY: กลุ่มพิกเซลเทาทางซ้ายสุด → (กึ่งกลาง x, เท้า y, ความสูง)"""
    a = cell.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2)
    g = (sat < 26) & (lum > 55) & (lum < 175)
    xs = np.where(g.sum(0) > 6)[0]
    if not len(xs): return None
    runs, run = [], [xs[0]]                       # กลุ่มคอลัมน์ติดกัน; เลือกกลุ่มแรกที่กว้างพอเป็นหุ่น (ตัดเส้น/ขอบบาง ๆ)
    for x in xs[1:]:
        if x - run[-1] <= 4: run.append(x)
        else: runs.append(run); run = [x]
    runs.append(run); runs = [r for r in runs if r[-1] - r[0] >= 18] or runs
    x0, x1 = runs[0][0], runs[0][-1]; ys = np.where(g[:, x0:x1 + 1].sum(1) > 1)[0]
    if len(ys) < 10: return None
    return ((x0 + x1) / 2, ys.max(), ys.max() - ys.min())

def build(cls, name, rows, cols):
    im = np.asarray(Image.open(os.path.join(SRC, name + '.png')).convert('RGB'))
    bg = np.median(im[rows[0] + 6:rows[0] + 16, cols[0] + 6:cols[1] - 6].reshape(-1, 3), axis=0)
    sheet = Image.new('RGBA', (CW * 5, CH * 9), (0, 0, 0, 0))
    for r in range(9):
        y0, y1 = rows[r] + 3, rows[r + 1] - 2
        c = caster(im[y0:y1, cols[0] + 3:cols[1] - 2])
        if not c: c = ((cols[1] - cols[0]) * .3, (y1 - y0) * .9, (y1 - y0) * .7)
        cx, fy, fh = c; s = FIG / max(40, fh)
        for k in range(5):
            x0, x1 = cols[k] + 3, cols[k + 1] - 2
            cell = im[y0:y1, x0:x1]; L = fx_layer(cell, bg)
            # ขยับให้เท้าหุ่น (อ้างอิงจากช่อง READY, x นับจากขอบซ้ายช่อง) อยู่ที่ AX,AY ของช่องผลลัพธ์
            alpha = (L.max(2) > 6).astype(np.uint8) * 255
            rgba = Image.fromarray(np.dstack([L, alpha]))
            w, h = rgba.size; rgba = rgba.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
            ox, oy = round(AX - cx * s), round(AY - fy * s)
            tile = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); tile.alpha_composite(rgba, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
            sheet.alpha_composite(tile, (k * CW, r * CH))
    sheet.save(os.path.join(ROOT, 'game/sprites', 'skfx_' + name + '.webp'), 'WEBP', quality=88)
    chk = Image.new('RGBA', sheet.size, (24, 28, 40, 255)); chk.alpha_composite(sheet)
    d = chk.load()
    for r in range(9):
        for k in range(5):
            for dy in range(-3, 4): d[k * CW + AX, r * CH + AY + dy] = (255, 255, 255, 255)
    chk.convert('RGB').resize((CW * 5 // 2, CH * 9 // 2)).save(os.path.join(ROOT, 'docs/evidence', 'skfx_' + name + '_check.png'))
    print('สร้าง', name, sheet.size)

cat = {}
for cls, (name, rows, cols) in GRID.items():
    if not os.path.exists(os.path.join(SRC, name + '.png')): print('ข้าม', name); continue
    build(cls, name, rows, cols); cat[cls] = name
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const SKILL_FX=' + json.dumps({'cw': CW, 'ch': CH, 'ax': AX, 'ay': AY, 'fig': FIG, 'cls': cat}, ensure_ascii=False, separators=(',', ':')) + ';/*SKILL_FX*/'
s, n = re.subn(r'const SKILL_FX=\{.*?\};/\*SKILL_FX\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1:
    s = s.replace('const CLASS_POSE={};/*CLASS_POSE*/', 'const CLASS_POSE={};/*CLASS_POSE*/', 1)
    raise SystemExit('ไม่พบจุดฝัง SKILL_FX')
open(p, 'w', encoding='utf-8').write(s); print(js)
