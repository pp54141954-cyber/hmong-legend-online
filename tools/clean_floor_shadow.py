#!/usr/bin/env python3
"""ลบเงาพื้นสีขาวซีดใต้เท้าที่ติดมากับภาพตัวละครอาชีพ (V2-R52)
แต่ละคอลัมน์ของแต่ละช่อง: ไล่จากล่างขึ้นบน ลบพิกเซลสีซีด (สว่าง สีไม่จัด) จนเจอพิกเซลทึบที่ไม่ซีด — เฉพาะช่วง 7 px ล่างสุดของตัวละคร
รัน: python3 tools/clean_floor_shadow.py  (ทำหลัง build_class_bodies.py)"""
import glob, os
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CW, CH = 96, 124
for f in sorted(glob.glob(os.path.join(ROOT, 'game/sprites/pcl_*.webp'))):
    a = np.array(Image.open(f).convert('RGBA')).astype(int); n = 0
    for r in range(a.shape[0] // CH):
        for c in range(a.shape[1] // CW):
            cell = a[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW]
            op = cell[..., 3] > 20
            if not op.any(): continue
            bot = np.nonzero(op.any(1))[0].max()
            lum = cell[..., :3].mean(2); sat = cell[..., :3].max(2) - cell[..., :3].min(2); pale = (lum > 140) & (sat < 50)
            for x in range(CW):
                for y in range(bot, bot - 7, -1):
                    if not op[y, x]: continue
                    if not pale[y, x]: break
                    cell[y, x, 3] = 0; n += 1
    Image.fromarray(a.astype(np.uint8)).save(f, 'WEBP', lossless=True)
    print(os.path.basename(f), 'ลบ', n)
