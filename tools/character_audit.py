"""ตรวจข้อมูลชุดภาพของตัวละครทุกตัว (V2-R63) — ไม่แก้ไฟล์ ใช้ตรวจซ้ำหลังสร้างภาพใหม่

  python3 -B tools/character_audit.py

ตรวจ 16 ตัว = 8 อาชีพ × ชาย/หญิง (นักดาบใช้ชุดภาพ pc_*_h/b ซ้อนกัน; อาชีพอื่นใช้ pcl_*/pca_*)
เกณฑ์ผ่านทุกข้อ: ทุกเฟรมมีภาพ · ไม่มีพิกเซลชนขอบช่อง (ภาพจะถูกตัดในเกม) ·
เท้าท่าโจมตีแต่ละทิศอยู่เส้นเดียวกับท่าเดินของทิศนั้น (ต่างกันไม่เกิน 1 px) · ความสูงท่าโจมตี/ท่าเดิน 0.92–1.08
ออกรหัส 1 ถ้ามีตัวละครใดไม่ผ่าน
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'game', 'sprites')
CLASSES = [('นักธนู', 'archer'), ('นักฆ่า', 'assassin'), ('นักสู้', 'fighter'), ('ผู้สืบวิญญาณ', 'spirit'),
           ('ผู้รักษา', 'healer'), ('ผู้ใช้มนตรา', 'mage'), ('ผู้พิทักษ์', 'guardian')]


def alpha(name):
    return np.asarray(Image.open(os.path.join(S, name)).convert('RGBA'))[..., 3] > 40


def cells(a, cw):
    out = []
    for r in range(4):
        row = []
        for c in range(a.shape[1] // cw):
            blk = a[r * 124:(r + 1) * 124, c * cw:(c + 1) * cw]
            ys = np.nonzero(blk.any(1))[0]
            xs = np.nonzero(blk.any(0))[0]
            if len(ys) == 0:
                row.append(None)
                continue
            row.append({'top': int(ys.min()), 'bot': int(ys.max()), 'left': int(xs.min()), 'right': int(xs.max()), 'h': int(ys.max() - ys.min() + 1)})
        out.append(row)
    return out


def check(label, walk_a, atk_a):
    W, A = cells(walk_a, 96), cells(atk_a, 240)
    empty = sum(1 for row in W for x in row if x is None) + sum(1 for row in A for x in row if x is None)
    clip = [(r, c) for r in range(4) for c, x in enumerate(W[r]) if x and (x['top'] == 0 or x['bot'] == 123 or x['left'] == 0 or x['right'] == 95)]
    clip += [(r, c) for r in range(4) for c, x in enumerate(A[r]) if x and (x['top'] == 0 or x['bot'] == 123 or x['left'] == 0 or x['right'] == 239)]
    wfoot = [int(np.median([x['bot'] for x in W[r] if x])) for r in range(4)]
    afoot = [int(np.median([x['bot'] for x in A[r] if x])) for r in range(4)]
    dfoot = [afoot[r] - wfoot[r] for r in range(4)]
    hr = float(np.median([x['h'] for row in A for x in row if x])) / float(np.median([x['h'] for row in W for x in row if x]))
    ok = empty == 0 and not clip and all(abs(d) <= 1 for d in dfoot) and 0.92 <= hr <= 1.08
    print(f"{label:24s} เท้าท่าเดิน {wfoot} โจมตี {afoot} ต่าง {dfoot} · ความสูง {hr:.2f} · ตัดขอบ {len(clip)} · ว่าง {empty} · {'PASS' if ok else 'FAIL'}")
    return ok


def main():
    results = []
    # นักดาบ: ชุดซ้อนหัว/ตัว (pc_<id>_h|b_walk, pc_<id>_h|b_atk4)
    for g in ['m', 'f']:
        w = alpha(f'pc_{g}0_h_walk.webp') | alpha(f'pc_{g}0_b_walk.webp')
        a = alpha(f'pc_{g}0_h_atk4.webp') | alpha(f'pc_{g}0_b_atk4.webp')
        results.append(check(f'นักดาบ {"ชาย" if g == "m" else "หญิง"}', w, a))
    for label, sid in CLASSES:
        for g in ['m', 'f']:
            results.append(check(f'{label} {"ชาย" if g == "m" else "หญิง"}', alpha(f'pcl_{sid}_{g}.webp'), alpha(f'pca_{sid}_{g}.webp')))
    print('ผลรวม', sum(results), '/', len(results))
    return 0 if all(results) else 1


if __name__ == '__main__':
    sys.exit(main())
