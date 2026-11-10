#!/usr/bin/env python3
"""ตัด sprite sheet มอนสเตอร์จาก ChatGPT (assets/sprites_src/) เป็นภาพที่เกมใช้ (assets/sprites/)

ขั้นตอนต่อภาพ:
  1. ลบพื้นหลัง: ภาพโปร่งใส → ตัดพิกเซลที่จางมาก (alpha < 128) ทิ้ง
                 ภาพพื้นขาว → เติมความโปร่งใสจากขอบช่องเข้าไปตามพิกเซลสีขาว/เทาอ่อน (หยุดที่เส้นขอบตัว)
  2. แบ่ง 4x4 ช่อง แล้วเก็บเฉพาะก้อนพิกเซลที่ใหญ่ (ตัดจุดเศษ)
  3. ปรับขนาด: ทุกเฟรมของตัวเดียวกันใช้สเกลเดียว ให้ความสูงเฟรมด้านข้างเฉลี่ยเท่ากับความสูงเป้าหมาย
     เท้าชิดขอบล่าง กึ่งกลางแนวนอน
  4. รวมเป็นแผ่นเดียว 4 แถว x 4 คอลัมน์ ลำดับแถว: ลง(หน้า) ขึ้น(หลัง) ซ้าย ขวา
     (ท่าโจมตี: โจมตี / รับดาเมจ / ตาย / ยืน — หันขวา)
ผลลัพธ์: assets/sprites/<ชื่อ>.png + assets/sprites/sprites.json (ฝังด้วย tools/embed_monster_sprites.py)
รัน: python3 tools/build_monster_sprites.py
"""
import base64, io, json, os, sys
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/sprites_src')
OUT = os.path.join(ROOT, 'assets/sprites')
SS = 2  # เก็บภาพละเอียด 2 เท่าของขนาดในเกม

# ชื่อในเกม → (ไฟล์ท่าเดิน, ไฟล์ท่าโจมตี, ความสูงในเกม px, แถวที่ต้องสลับ)
# swapLR: แถว 3/4 ใน sheet หันกลับด้าน (ตรวจด้วยตาจาก docs/evidence/sprites_rows_check.png)
SHEETS = {
    'หมูป่า':       dict(walk='boar_walk', act='boar_action', h=40),
    'กระต่ายมีเขา': dict(walk='horned_rabbit_walk', h=30),
    'หมาป่า':       dict(walk='wolf_walk', act='wolf_action', h=40),
    'ลิงป่า':       dict(walk='monkey_walk', act='monkey_action', h=34),
    'ไก่ฟ้า':       dict(walk='pheasant_walk', act='pheasant_action', h=32),
    'กวางภูเขา':    dict(walk='mountain_deer_walk', act='mountain_deer_action', h=50),
    'เสือ':         dict(walk='tiger_walk', act='tiger_action', h=46),
    'ก็อบลิน':      dict(walk='goblin_walk', act='goblin_action', h=40),
    'นักรบเผ่าป่า': dict(walk='forest_warrior_walk', act='forest_warrior_action', h=52),
    'หมีเขา':       dict(walk='horned_bear_walk', act='horned_bear_action', h=54),
    'ปีศาจ':        dict(walk='demon_walk', act='demon_action', h=56, act_layout='demon'),
    'โกเลมหิน':     dict(walk='stone_golem_walk', act='stone_golem_action', h=62),
    'วิญญาณไม้':    dict(walk='tree_spirit_walk', act='tree_spirit_action', h=58),
    # กระทิงผี: ยังไม่มีท่าเดิน 4 ทิศ — ใช้แถวยืน/โจมตีจาก action เป็นด้านข้าง (หน้า/หลังใช้ภาพด้านข้าง) จนกว่าจะได้ภาพเดิน
    'กระทิงผี':     dict(walk=None, act='ghost_bull_action', h=46),
    # บอส (ยังไม่มีในเกม — สร้างไฟล์ไว้ก่อน)
    'boss:วิญญาณแห่งป่า':  dict(walk='boss_forest_spirit_walk', act='boss_forest_spirit_action', h=88, amin=200),
    'boss:เทพหมาป่าภูเขา': dict(walk='boss_mountain_wolf_god_walk', act='boss_mountain_wolf_god_action', h=84, amin=225),
    'boss:มังกรภูเขาดำ':   dict(walk='boss_black_mountain_dragon_walk', act='boss_black_mountain_dragon_action', h=96, amin=170),
    'boss:มังกรแห่งหุบเขาหมอก':    dict(walk='boss_misty_valley_dragon_walk', h=96),
    'boss:ราชาปีศาจภูเขา':         dict(walk='boss_mountain_demon_king_walk_v2', h=90),
    'boss:วิญญาณหมาป่าศักดิ์สิทธิ์': dict(walk='boss_sacred_wolf_spirit_walk_v2', h=80),
}
# ลำดับแถวท่าโจมตีมาตรฐาน: 0 โจมตี 4 เฟรม / 1 รับดาเมจ 2 เฟรม / 2 ตาย 4 เฟรม / 3 ยืน 4 เฟรม
# ภาพปีศาจเรียงต่าง: แถว 1 ยืน/ย่าง, แถว 2 โจมตี, แถว 3 = รับดาเมจ 1 + ตาย 3, แถว 4 ยืน
ACT_LAYOUT = {'demon': lambda g: [g[1], [g[2][0], g[0][0], g[0][0], g[0][0]], [g[2][1], g[2][2], g[2][3], g[2][3]], g[3]]}
SWAP_LR = set(json.loads(os.environ.get('SWAP_LR', '[]')))  # ใช้ตอนตรวจ; ค่าจริงอยู่ใน SWAP ด้านล่าง
SWAP = {'stone_golem_walk', 'demon_walk', 'forest_warrior_walk', 'tree_spirit_walk', 'boss_mountain_demon_king_walk'} | SWAP_LR
SWAP -= set(json.loads(os.environ.get('NO_SWAP', '[]')))

def is_bg_dark(p):
    return max(p[:3]) <= 14

def is_bg_light(p):
    r, g, b = p[:3]
    return min(r, g, b) >= 228 and max(r, g, b) - min(r, g, b) <= 24

AMIN = 128

def clean_alpha(im):
    im = im.convert('RGBA'); px = im.load(); w, h = im.size
    opaque_bg = sum(1 for x in range(0, w, 7) for y in (1, h - 2) if px[x, y][3] > 200) > w // 14
    dark = opaque_bg and sum(1 for x in range(0, w, 7) for y in (1, h - 2) if is_bg_dark(px[x, y])) > w // 14
    isbg = is_bg_dark if dark else is_bg_light
    if opaque_bg or im.getchannel('A').getextrema()[0] > 200:
        # พื้นขาว/อ่อน: เติมความโปร่งใสจากขอบภาพ และจากเส้นแบ่งช่อง
        seen = bytearray(w * h); q = deque()
        starts = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
        for k in range(1, 4):
            starts += [(x, h * k // 4) for x in range(w)] + [(w * k // 4, y) for y in range(h)]
        for x, y in starts:
            if isbg(px[x, y]) and not seen[y * w + x]:
                seen[y * w + x] = 1; q.append((x, y))
        while q:
            x, y = q.popleft(); px[x, y] = (0, 0, 0, 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and isbg(px[nx, ny]):
                    seen[ny * w + nx] = 1; q.append((nx, ny))
    # ตัดพิกเซลจางทั้งหมด (ฝุ่น/ออร่าจางจากการสร้างภาพ)
    a = im.getchannel('A').point(lambda v: 255 if v >= AMIN else 0)
    im.putalpha(a)
    return im

def keep_big(cell):
    """เก็บก้อนพิกเซลที่ใหญ่อย่างน้อย 3% ของก้อนใหญ่สุด (ตัดจุดเศษ เครื่องหมาย ฯลฯ ที่หลุดมา)"""
    w, h = cell.size; a = cell.getchannel('A').load()
    lab = [0] * (w * h); sizes = []; comp = 0
    for y in range(h):
        for x in range(w):
            if a[x, y] and not lab[y * w + x]:
                comp += 1; n = 0; q = deque([(x, y)]); lab[y * w + x] = comp
                while q:
                    cx, cy = q.popleft(); n += 1
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and a[nx, ny] and not lab[ny * w + nx]:
                            lab[ny * w + nx] = comp; q.append((nx, ny))
                sizes.append(n)
    if not sizes:
        return cell
    keep = {i + 1 for i, s in enumerate(sizes) if s >= max(sizes) * .03}
    out = cell.copy(); px = out.load()
    for y in range(h):
        for x in range(w):
            if lab[y * w + x] and lab[y * w + x] not in keep:
                px[x, y] = (0, 0, 0, 0)
    return out

def cells(name):
    im = clean_alpha(Image.open(os.path.join(SRC, name + '.png')))
    w, h = im.size; out = []
    for r in range(4):
        row = []
        for c in range(4):
            cell = keep_big(im.crop((w * c // 4, h * r // 4, w * (c + 1) // 4, h * (r + 1) // 4)))
            row.append((cell, cell.getbbox()))
        out.append(row)
    if name in SWAP:
        out[2], out[3] = out[3], out[2]
    return out

def pack(grid, target_h, ref_rows):
    """ทุกเฟรมสเกลเดียวกัน: ความสูงเฉลี่ยของแถวอ้างอิง = target_h; ช่องเท่ากันทุกช่อง เท้าชิดล่าง"""
    hs = [b[3] - b[1] for r in ref_rows for (_, b) in grid[r] if b]
    scale = target_h * SS / (sum(hs) / len(hs))
    boxes = [b for row in grid for (_, b) in row if b]
    cw = int(max(b[2] - b[0] for b in boxes) * scale) + 4
    ch = int(max(b[3] - b[1] for b in boxes) * scale) + 4
    sheet = Image.new('RGBA', (cw * 4, ch * 4), (0, 0, 0, 0))
    for r, row in enumerate(grid):
        for c, (cell, b) in enumerate(row):
            if not b:
                continue
            fr = cell.crop(b); fr = fr.resize((max(1, round(fr.width * scale)), max(1, round(fr.height * scale))), Image.LANCZOS)
            a = fr.getchannel('A').point(lambda v: 255 if v >= 110 else 0); fr.putalpha(a)
            sheet.alpha_composite(fr, (c * cw + (cw - fr.width) // 2, r * ch + ch - 2 - fr.height))
    return sheet, cw, ch

def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    only = set(sys.argv[1:])
    for key, s in SHEETS.items():
        if only and key not in only:
            continue
        global AMIN
        AMIN = s.get('amin', 128)
        e = {'ss': SS}
        if s.get('walk'):
            walk, cw, ch = pack(cells(s['walk']), s['h'], ref_rows=(2, 3))
            fn = s['walk'] + '.png'; walk.save(os.path.join(OUT, fn), optimize=True)
            e.update(walk=fn, cw=cw // SS, ch=ch // SS)
        if s.get('act'):
            # ท่าโจมตีใช้สเกลเทียบกับแถว "ยืน" (แถว 4) ให้ขนาดเท่าท่าเดิน
            g = cells(s['act'])
            if s.get('act_layout'):
                g = ACT_LAYOUT[s['act_layout']](g)
            act, aw, ah = pack(g, s['h'], ref_rows=(3,))
            fa = s['act'] + '.png'; act.save(os.path.join(OUT, fa), optimize=True)
            e.update(act=fa, aw=aw // SS, ah=ah // SS)
        meta[key] = e
        print(key, e)
    uris = {}
    for key, e in meta.items():
        d = dict(e); key = key.replace('boss:', '')  # V2-R16: ฝังภาพบอสด้วย (คีย์ = ชื่อบอส)
        for k in ('walk', 'act'):
            if k in e:
                # ฝังเป็น WebP (เล็กกว่า PNG ~5 เท่า) — Safari 14+, Chrome, Firefox รองรับ
                b = io.BytesIO(); Image.open(os.path.join(OUT, e[k])).save(b, 'WEBP', quality=82, method=6, alpha_quality=90)
                d[k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
        uris[key] = d
    json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(uris, open(os.path.join(OUT, 'sprites.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('embed bytes', sum(len(v.get('walk', '')) + len(v.get('act', '')) for v in uris.values()))
    if only:
        print('หมายเหตุ: สร้างเฉพาะ', only, '— sprites.json มีแค่ตัวที่สร้างรอบนี้ ให้รันใหม่แบบไม่ใส่ชื่อก่อนฝัง')

if __name__ == '__main__':
    main()
