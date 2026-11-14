#!/usr/bin/env python3
"""ฝังภาพไอเทมจาก assets/items/items.json ลงใน game/index.html (บรรทัด const ITEM_ART=...;/*ITEM_ART*/)
รัน: python3 tools/build_item_icons.py && python3 tools/embed_item_icons.py
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
game = os.path.join(ROOT, 'game/index.html')
art = json.load(open(os.path.join(ROOT, 'assets/items/items.json')))
s = open(game, encoding='utf-8').read()
new, n = re.subn(r'const ITEM_ART=\{.*?\};/\*ITEM_ART\*/', lambda m: 'const ITEM_ART=' + json.dumps(art, separators=(',', ':')) + ';/*ITEM_ART*/', s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('ไม่พบจุดฝัง ITEM_ART ใน game/index.html')
open(game, 'w', encoding='utf-8').write(new)
print('ฝังภาพไอเทม', len(art), 'ชิ้น')
