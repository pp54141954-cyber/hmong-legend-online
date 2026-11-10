#!/usr/bin/env python3
"""ฝังภาพมอนสเตอร์จาก assets/sprites/sprites.json ลงใน game/index.html (const MON_SPR=...;/*MON_SPR*/)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
game = os.path.join(ROOT, 'game/index.html')
spr = json.load(open(os.path.join(ROOT, 'assets/sprites/sprites.json'), encoding='utf-8'))
s = open(game, encoding='utf-8').read()
new, n = re.subn(r'const MON_SPR=\{.*?\};/\*MON_SPR\*/', lambda m: 'const MON_SPR=' + json.dumps(spr, ensure_ascii=False, separators=(',', ':')) + ';/*MON_SPR*/', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('ไม่พบจุดฝัง MON_SPR')
open(game, 'w', encoding='utf-8').write(new)
print('ฝังภาพมอนสเตอร์', len(spr), 'ชนิด', 'ขนาดไฟล์เกม', len(new.encode()) // 1024, 'KB')
