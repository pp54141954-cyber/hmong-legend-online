#!/usr/bin/env python3
"""ภาพท่าทางอาชีพ (V2-R38): assets/sprites_src/class/<dir>/pose_src.png (4x4 เฟรม หันขวา จาก ChatGPT ตาม docs/prompts/class_pose_sprites.md)
→ game/sprites/pose_<id>.webp ขนาด 960x496 (ช่อง 240x124, ลำตัวที่ x=84, เท้า y=120, พิกเซลผม alpha=254) + ทะเบียน CLASS_POSE ใน game/index.html
ทะเบียน: assets/sprites_src/class/poses.json — seq = ลำดับเฟรม (0–15, แถว×4+คอลัมน์) ของท่าพื้นฐาน (basic) และท่าสกิล (skill)
รัน: python3 tools/build_class_poses.py"""
import json, os, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_char_sets import unbg, frames_grid, sheet, mark_hair, AW, CH
SRC = os.path.join(ROOT, 'assets/sprites_src/class')
reg = json.load(open(os.path.join(SRC, 'poses.json'), encoding='utf-8')); cat = {}
for e in reg:
    f = os.path.join(SRC, e['dir'], 'pose_src.png')
    if not os.path.exists(f): print('ข้าม (ยังไม่มีภาพ):', e['id']); continue
    fr = frames_grid(unbg(f), 4, 4); assert len(fr) == 16, (e['id'], len(fr))
    im = sheet(fr, 4, 4, AW, True); mark_hair(im)
    im.save(os.path.join(ROOT, 'game/sprites', 'pose_' + e['id'] + '.webp'), 'WEBP', lossless=True)
    chk = Image.new('RGBA', im.size, (70, 90, 70, 255)); chk.alpha_composite(im); chk.save(os.path.join(ROOT, 'docs/evidence', 'pose_' + e['id'] + '_check.png'))
    cat.setdefault(e['cls'], {})[e['g']] = {'id': e['id'], 'seq': e['seq']}; print('สร้าง', e['id'], im.size)
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const CLASS_POSE=' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';/*CLASS_POSE*/'
s, n = re.subn(r'const CLASS_POSE=\{.*?\};/\*CLASS_POSE\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1: raise SystemExit('ไม่พบจุดฝัง CLASS_POSE')
open(p, 'w', encoding='utf-8').write(s); print('ทะเบียน', js)
