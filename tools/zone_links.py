#!/usr/bin/env python3
"""พิมพ์ข้อมูลทางออก + จุดมาถึงของแต่ละโซน (JSON) จาก EXITS ใน build_clean_masks.py และผังช่อง
จุดมาถึง = ช่องเดินได้ที่ใกล้ทางออกฝั่งตรงข้ามที่สุด แต่ห่างจากช่อง E อย่างน้อย 2 ช่อง"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_clean_masks import EXITS, ROOT
M = {z: open(os.path.join(ROOT, 'assets/maps', z + '.mask.txt')).read().split() for z in EXITS}
def arrive(z, frm):
    """จุดมาถึงในโซน z เมื่อมาจากโซน frm: ใกล้ทางออกของ z ที่ไป frm"""
    ex = [e for e in EXITS[z] if e[4] == frm]
    if not ex: return None
    x0, y0, x1, y1, _ = ex[0]; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    R = M[z]; best = None
    for y in range(32):
        for x in range(48):
            if R[y][x] != '.': continue
            de = min(abs(x - ex_x) + abs(y - ex_y) for e in EXITS[z] for ex_x in range(e[0], e[2] + 1) for ex_y in range(e[1], e[3] + 1))
            if de < 2: continue
            d = abs(x - cx) + abs(y - cy)
            if best is None or d < best[0]: best = (d, x, y)
    return [best[1], best[2]]
out = {}
for z, lst in EXITS.items():
    out[z] = []
    for x0, y0, x1, y1, to in lst:
        a = arrive(to, z) if to in EXITS else ([2, 15] if to == 'field' else None)
        out[z].append({'x': x0, 'y': y0, 'w': x1 - x0 + 1, 'h': y1 - y0 + 1, 'to': to, 'tx': a[0], 'ty': a[1]})
print(json.dumps(out, ensure_ascii=False))
print('field2 arrive from field:', arrive('field2', 'field'))
