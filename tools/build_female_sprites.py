#!/usr/bin/env python3
"""ภาพตัวละครหญิง (เจ้าของทำด้วย ChatGPT ตามชุดคำสั่ง docs/prompts/female_character_sprites.md) → แผ่นภาพขนาดเดียวกับตัวชาย
ต้นฉบับ: assets/sprites_src/female/{walk,idle,attack}_src.png (พื้นหลังลายตารางสีอ่อน ไม่ใช่โปร่งใสจริง)
1) ลบพื้นหลัง: เติมจากขอบภาพผ่านพิกเซลสีอ่อนไม่มีสี (รวมเงาเทาใต้เท้า) — สีขาวในตัวละคร (คอเสื้อ) ไม่ติดขอบจึงไม่ถูกลบ
2) แยกเฟรม: ท่าเดินแบ่งตาราง 4x4, ท่ายืน/ฟัน แบ่งตามช่องว่างแนวตั้ง
3) ย่อให้สูงเท่าตัวชาย (107 px) เท้าที่ y=120 — เดิน/ยืน กึ่งกลาง x=48, ท่าฟัน ลำตัวที่ x=84 (เหมือนตัวชาย)
ผลลัพธ์: game/sprites/player_f_{walk,idle,attack}.webp, docs/evidence/female_sprites_check.png
"""
import os
from collections import deque
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/sprites_src/female')
CW, CH, AW, AAX, H_TARGET, FOOT = 96, 124, 240, 84, 107, 120

def unbg(path):
    im = Image.open(path).convert('RGBA'); W, H = im.size; px = im.load()
    def bg(p):
        r, g, b, _ = p; return min(r, g, b) >= 170 and max(r, g, b) - min(r, g, b) < 22
    seen = bytearray(W * H); q = deque()
    for x in range(W):
        for y in (0, H - 1): q.append((x, y))
    for y in range(H):
        for x in (0, W - 1): q.append((x, y))
    while q:
        x, y = q.popleft(); i = y * W + x
        if seen[i] or not bg(px[x, y]): continue
        seen[i] = 1; px[x, y] = (0, 0, 0, 0)
        if x > 0: q.append((x - 1, y))
        if x < W - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < H - 1: q.append((x, y + 1))
    # พื้นหลังที่ติดอยู่ในช่องปิด (ระหว่างผมกับตัว): ก้อนสีอ่อนที่มีลายตาราง 2 เฉด (~245 และ ~254) = พื้นหลัง, คอเสื้อสีขาวเป็นสีเดียว
    seen2 = bytearray(W * H)
    for sy in range(H):
        for sx in range(W):
            i = sy * W + sx
            if seen2[i] or px[sx, sy][3] == 0 or not bg(px[sx, sy]) or min(px[sx, sy][:3]) < 236: continue
            comp, q2 = [], deque([(sx, sy)]); seen2[i] = 1
            while q2:
                x, y = q2.popleft(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen2[ny * W + nx] and px[nx, ny][3] and bg(px[nx, ny]) and min(px[nx, ny][:3]) >= 236:
                        seen2[ny * W + nx] = 1; q2.append((nx, ny))
            hi = sum(1 for x, y in comp if min(px[x, y][:3]) >= 251); lo = len(comp) - hi
            if len(comp) >= 60 and hi > len(comp) * .2 and lo > len(comp) * .2:
                for x, y in comp: px[x, y] = (0, 0, 0, 0)
    return im

def col_segments(im, min_w=40):
    a = im.split()[3]; W, H = im.size; occ = [any(a.getpixel((x, y)) for y in range(0, H, 3)) for x in range(W)]
    segs, start = [], None
    for x, o in enumerate(occ + [False]):
        if o and start is None: start = x
        elif not o and start is not None:
            if x - start >= min_w: segs.append((start, x))
            elif segs and start - segs[-1][1] < 12: segs[-1] = (segs[-1][0], x)  # ชิ้นเล็กติดกัน (ปลายดาบ) รวมกับเฟรมก่อน
            start = None
    return segs

def frames_grid(im, cols, rows):
    W, H = im.size; out = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * W // cols, r * H // rows, (c + 1) * W // cols, (r + 1) * H // rows)); bb = cell.getbbox()
            out.append(cell.crop(bb))
    return out

def frames_cols(im):
    return [im.crop((x0, 0, x1, im.size[1])).crop(im.crop((x0, 0, x1, im.size[1])).getbbox()) for x0, x1 in col_segments(im)]

def scale_of(frames):
    hs = sorted(f.size[1] for f in frames); return H_TARGET / hs[len(hs) // 2]

def shrink(f, s):
    w, h = max(1, round(f.size[0] * s)), max(1, round(f.size[1] * s))
    g = f.resize((w, h), Image.LANCZOS); px = g.load()
    for y in range(h):
        for x in range(w):
            r, gg, b, a = px[x, y]
            px[x, y] = (r, gg, b, 255) if a >= 110 else (0, 0, 0, 0)  # ขอบคม (พิกเซลอาร์ต)
    return g

def leg_center(f):
    """กึ่งกลางลำตัวจากแถวล่าง 25% (ขา/กระโปรง) — ไม่นับดาบที่ยื่นไปข้างหน้า"""
    a = f.split()[3]; w, h = f.size; xs = [x for y in range(int(h * .75), h) for x in range(w) if a.getpixel((x, y))]
    return sum(xs) / len(xs) if xs else w / 2

def sheet(frames, cols, rows, cw, anchor):
    s = scale_of(frames); out = Image.new('RGBA', (cw * cols, CH * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        g = shrink(f, s); c, r = i % cols, i // cols
        ax = anchor(g); x = round(c * cw + (cw / 2 if anchor is None else 0) + (0 if anchor is None else 0))
        x0 = c * cw + (round(cw / 2 - g.size[0] / 2) if ax is None else round(ax))
        y0 = r * CH + FOOT - g.size[1]
        out.alpha_composite(g.crop((max(0, -x0 + c * cw) if x0 < c * cw else 0, 0, g.size[0], g.size[1])), (max(x0, c * cw), max(0, y0)))
    return out

walk = frames_grid(unbg(os.path.join(SRC, 'walk_src.png')), 4, 4)
idle = frames_cols(unbg(os.path.join(SRC, 'idle_src.png')))
atk = frames_cols(unbg(os.path.join(SRC, 'attack_src.png')))
print('เฟรม: เดิน', len(walk), 'ยืน', len(idle), 'ฟัน', len(atk))
assert len(walk) == 16 and len(idle) == 5 and len(atk) == 4, 'จำนวนเฟรมไม่ตรง'
W = sheet(walk, 4, 4, CW, lambda g: None)
I = sheet(idle, 5, 1, CW, lambda g: None)
A = sheet(atk, 4, 1, AW, lambda g: AAX - leg_center(g))
def mark_hair(im, lo=20, seed_y=44, max_y=96):
    """ทำเครื่องหมายพิกเซลผม: alpha = 254 (เกมใช้เปลี่ยนสีผมเฉพาะส่วนนี้) — โตจากบริเวณหัวผ่านพิกเซลสีเข้มที่ติดกัน หยุดที่เส้นขอบเข้ม (กั้นผมกับเสื้อสีดำ)"""
    W, H = im.size; px = im.load(); seen = set()
    def dark(x, y):
        r, g, b, a = px[x, y]; return a and max(r, g, b) < 100 and max(r, g, b) - min(r, g, b) < 40
    for fy in range(0, H, CH):
        q = deque((x, y) for y in range(fy, fy + seed_y) for x in range(W) if dark(x, y)); seen.update(q)
        while q:
            x, y = q.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if not (0 <= nx < W and fy <= ny < fy + max_y) or (nx, ny) in seen or not dark(nx, ny): continue
                r, g, b, a = px[nx, ny]
                if .3 * r + .59 * g + .11 * b < lo and ny - fy > seed_y: continue
                seen.add((nx, ny)); q.append((nx, ny))
    for x, y in seen:
        r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 254)
    return len(seen)
for im in (W, I, A): print('พิกเซลผม', mark_hair(im))
os.makedirs(os.path.join(ROOT, 'game/sprites'), exist_ok=True)
for name, im in (('walk', W), ('idle', I), ('attack', A)):
    im.save(os.path.join(ROOT, 'game/sprites', 'player_f_' + name + '.webp'), 'WEBP', lossless=True)
    im.save(os.path.join(SRC, 'player_f_' + name + '.png'))
    print(name, im.size)
chk = Image.new('RGBA', (max(W.size[0], A.size[0]), W.size[1] + CH * 2 + 20), (70, 90, 70, 255))
chk.alpha_composite(W, (0, 0)); chk.alpha_composite(I, (0, W.size[1] + 10)); chk.alpha_composite(A, (0, W.size[1] + CH + 20))
chk.resize((chk.size[0] * 2, chk.size[1] * 2), Image.NEAREST).save(os.path.join(ROOT, 'docs/evidence/female_sprites_check.png'))
