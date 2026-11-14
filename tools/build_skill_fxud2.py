#!/usr/bin/env python3
"""เอฟเฟกต์สกิลหันลง/ขึ้น แบบตัวละครพิกเซลสี (V2-R45): assets/design_refs/skills/updown2/<class>.png
ภาพเดียวมี 2 ตาราง: ซ้าย = DOWN, ขวา = UP (9 แถว × 5 จังหวะ READY · WIND-UP · ACTION · RELEASE · RECOVER) ตัวละครยืนกลางช่อง
ตัวละครในตารางมีสี (ใช้วิธีลบหุ่นเทาแบบเดิมไม่ได้) → เทียบกับช่อง READY ของแถวเดียวกัน: เก็บเฉพาะพิกเซลที่ "สว่างขึ้นมาก" (แสงเอฟเฟกต์)
ตัวละครที่ไม่ขยับจึงหายไป; ท่าที่ตัวละครขยับมาก ส่วนสว่างของตัวอาจติดมาเล็กน้อย
ผลลัพธ์: game/sprites/skfxud_<class>.webp (5 คอลัมน์ × 18 แถว: DOWN 0–8, UP 9–17) + ทะเบียน SKILL_FXUD (แทนตัวเดิมทั้งหมด)
รัน: python3 tools/build_skill_fxud2.py"""
import json, os, re
import numpy as np
from PIL import Image, ImageFilter
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fx_figures import strong_only
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/design_refs/skills/updown2')
CW, CH, FIG, AXY = 300, 300, 92, (150, 200)        # ช่องผลลัพธ์, ความสูงตัวละครหลังย่อ, จุดเท้า
FILES = {'นักดาบ': 'swordsman', 'นักธนู': 'archer', 'นักฆ่า': 'assassin', 'นักสู้': 'fighter', 'ผู้สืบวิญญาณ': 'spirit_heir', 'ผู้รักษา': 'healer', 'ผู้ใช้มนตรา': 'mage', 'ผู้พิทักษ์': 'guardian'}
T_ROWS = [91, 190, 286, 381, 476, 571, 666, 761, 857, 980]
T_COLS = {'down': [60, 197, 334, 474, 618, 754], 'up': [832, 969, 1106, 1246, 1390, 1525]}

def lines(prof, tmpl, thr=10, tol=12):
    det = [i for i in range(3, len(prof) - 3) if prof[i] - max(prof[i - 3], prof[i + 3]) > thr and prof[i] >= prof[i - 1] and prof[i] >= prof[i + 1]]
    return [min(det, key=lambda d: abs(d - t)) if det and min(abs(d - t) for d in det) <= tol else t for t in tmpl]

def figure(cell, bg):
    """ตัวละครในช่อง READY: พิกเซลที่ต่างจากพื้นหลังชัด → (x กลาง, เท้า y, ความสูง)"""
    d = np.abs(cell.astype(int) - bg[None, None, :]).sum(2) > 60
    h, w = d.shape; m = d[:, int(w * .2):int(w * .8)]
    ys = np.where(m.sum(1) > 2)[0]; xs = np.where(m.sum(0) > 2)[0] + int(w * .2)
    if len(ys) < 10: return (w / 2, h * .85, h * .7)
    return ((xs.min() + xs.max()) / 2, ys.max(), ys.max() - ys.min())

def glow(cell, ready, bg):
    c = cell.astype(int); r = ready.astype(int); lc = c.mean(2); lr = r.mean(2)
    # จางตำแหน่งตัวละคร READY เล็กน้อย (กันขอบตัวขยับ 1–2 px)
    lr_max = np.asarray(Image.fromarray(np.clip(lr, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))).astype(int)
    gain = lc - lr_max; sat = c.max(2) - c.min(2)
    w = np.clip((gain - 42) / 50, 0, 1) * np.clip((lc - 105) / 60, 0, 1) * np.clip((sat + 40) / 80, 0, 1)
    out = np.clip(c - bg[None, None, :] * 1.05, 0, 255) * w[..., None]
    out = strong_only(out, om_min=70)                        # V2-R52: ตัดส่วนตัวละครสีซีดที่สว่างขึ้นตอนขยับ
    h, ww = out.shape[:2]; e = 10
    fy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / e, 0, 1); fx = np.clip(np.minimum(np.arange(ww), ww - 1 - np.arange(ww)) / e, 0, 1)
    return (out * (fy[:, None] * fx[None, :])[..., None]).astype(np.uint8)

cat = {}
for cls, name in FILES.items():
    f = os.path.join(SRC, name + '.png')
    if not os.path.exists(f): print('ข้าม', name); continue
    im = np.asarray(Image.open(f).convert('RGB')); lum = im.astype(int).mean(2); W = im.shape[1]
    sheet = Image.new('RGBA', (CW * 5, CH * 18), (0, 0, 0, 0))
    for di, d in enumerate(('down', 'up')):
        x0, x1 = (0, W // 2) if d == 'down' else (W // 2, W)
        rows = lines(lum[:, x0:x1].mean(1), T_ROWS); cols = lines(lum[150:950].mean(0), T_COLS[d])
        cells = [[im[rows[r] + 3:rows[r + 1] - 2, cols[k] + 3:cols[k + 1] - 2] for k in range(5)] for r in range(9)]
        bg = np.median(np.concatenate([c[:6].reshape(-1, 3) for c in cells[0]]), axis=0)
        figs = [figure(cells[r][0], bg) for r in range(9)]
        s = FIG / float(np.median([g[2] for g in figs]))
        for r in range(9):
            cx, fy, _ = figs[r]
            for k in range(5):
                cell = cells[r][k]; rd = cells[r][0]
                hh, ww = min(cell.shape[0], rd.shape[0]), min(cell.shape[1], rd.shape[1])
                L = glow(cell[:hh, :ww], rd[:hh, :ww], bg)
                rgba = Image.fromarray(np.dstack([L, ((L.max(2) > 6) * 255).astype(np.uint8)]))
                rgba = rgba.resize((max(1, round(rgba.size[0] * s)), max(1, round(rgba.size[1] * s))), Image.LANCZOS)
                ox, oy = round(AXY[0] - cx * s), round(AXY[1] - fy * s)
                tile = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); tile.alpha_composite(rgba, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
                sheet.alpha_composite(tile, (k * CW, (di * 9 + r) * CH))
    sheet.save(os.path.join(ROOT, 'game/sprites', 'skfxud_' + name + '.webp'), 'WEBP', quality=72, method=6)
    chk = Image.new('RGBA', sheet.size, (24, 28, 40, 255)); chk.alpha_composite(sheet)
    chk.convert('RGB').resize((CW * 5 // 3, CH * 18 // 3)).save(os.path.join(ROOT, 'docs/evidence', 'skfxud_' + name + '_check.png'))
    cat[cls] = name; print('สร้าง', name)
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const SKILL_FXUD=' + json.dumps({'cw': CW, 'ch': CH, 'fig': FIG, 'anch': {'down': list(AXY), 'up': list(AXY)}, 'cls': cat}, ensure_ascii=False, separators=(',', ':')) + ';/*SKILL_FXUD*/'
s, n = re.subn(r'const SKILL_FXUD=\{.*?\};/\*SKILL_FXUD\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1: raise SystemExit('ไม่พบจุดฝัง SKILL_FXUD')
open(p, 'w', encoding='utf-8').write(s); print(js)
