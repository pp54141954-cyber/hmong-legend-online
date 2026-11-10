#!/usr/bin/env python3
"""ฝังรูปหน้าเป้าหมายจาก assets/portraits/portraits.json ลงใน game/index.html (const MON_ART=...;/*MON_ART*/)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
game = os.path.join(ROOT, 'game/index.html')
art = json.load(open(os.path.join(ROOT, 'assets/portraits/portraits.json'), encoding='utf-8'))
s = open(game, encoding='utf-8').read()
new, n = re.subn(r'const MON_ART=\{.*?\};/\*MON_ART\*/', lambda m: 'const MON_ART=' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';/*MON_ART*/', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('ไม่พบจุดฝัง MON_ART')
open(game, 'w', encoding='utf-8').write(new)
print('ฝังรูปมอนสเตอร์', len(art), 'ตัว')
