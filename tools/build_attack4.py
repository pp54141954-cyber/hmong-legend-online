#!/usr/bin/env python3
"""ท่าโจมตี 4 ทิศที่วาดจริง (V2-R53) จากภาพของเจ้าของ (ทำตาม docs/prompts/class_attack_sprites.md)
ภาพต้นฉบับ: 4 แถว (ลง/ขึ้น/ซ้าย/ขวา) × 4 เฟรม (ง้าง · ฟาด · ตามแรง · กลับ) พื้นขาว
- ตัวละครพื้นฐานนักดาบ (ชุดแยกชั้นหัว/ตัว): ATK4_SETS → game/sprites/pc_<ชุด>_<h|b>_atk4.webp (เปลี่ยนสีผม/ชุดได้เหมือนท่าอื่น)
ช่องผลลัพธ์ 240×124 จุดกึ่งกลางเท้า x=120 y=120 · ย่อให้ตัวสูงเท่าภาพเดิน (วัดจากเฟรมท่าพร้อม ที่อาวุธไม่ชูเหนือหัว)
รัน: python3 tools/build_attack4.py"""
import json, os, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_char_sets import unbg, col_segments, shrink, mark_hair, split, CH, H_TARGET, FOOT
SRC = os.path.join(ROOT, 'assets/sprites_src/classbody')
CW4, AX4 = 240, 120
ATK4_SETS = [  # (ชุด, ไฟล์ต้นฉบับ) — ตัวละครพื้นฐานแบบแยกชั้น (นักดาบ)
    ('m0', 'swordsman_m_attack.png'),
    ('f0', 'swordsman_f_attack.png'),
]
BODY_SETS = [  # (id, อาชีพ, เพศ, ไฟล์ต้นฉบับ) — ตัวละครประจำอาชีพ → game/sprites/pca_<id>.webp (V2-R54) จำนวนเฟรมต่อแถวตามภาพ (4 หรือ 5)
    ('fighter_f', 'นักสู้', 'f', 'fighter_f_attack.png'),
    ('assassin_m', 'นักฆ่า', 'm', 'assassin_m_attack.png'),
    ('assassin_f', 'นักฆ่า', 'f', 'assassin_f_attack.png'),
    ('archer_m', 'นักธนู', 'm', 'archer_m2_attack.png'),
    ('archer_f', 'นักธนู', 'f', 'archer_f2_attack.png'),
]

def bands(im):
    a = im.split()[3]; W, H = im.size
    occ = [sum(1 for x in range(0, W, 3) if a.getpixel((x, y))) > 2 for y in range(H)]
    out, st = [], None
    for y, o in enumerate(occ + [False]):
        if o and st is None: st = y
        elif not o and st is not None:
            if y - st > H * .1: out.append((st, y))
            st = None
    return out

def feet(f):
    """กึ่งกลางเท้า + เส้นเท้า จากพิกเซลสีเข้ม (รองเท้า/กางเกง) ช่วงล่างของภาพ — ไม่นับใบดาบสีเงิน"""
    px = f.load(); w, h = f.size
    pts = [(x, y) for y in range(int(h * .8), h) for x in range(w) if px[x, y][3] and sum(px[x, y][:3]) / 3 < 110 and max(px[x, y][:3]) - min(px[x, y][:3]) < 70]
    if len(pts) < 30: pts = [(x, y) for y in range(int(h * .88), h) for x in range(w) if px[x, y][3]]   # รองเท้าสีสว่าง: ใช้ทุกพิกเซลช่วงล่าง
    if not pts: return w / 2, h - 1
    xs = sorted(x for x, _ in pts); cx = xs[len(xs) // 2]
    fy = max(y for x, y in pts if abs(x - cx) < w * .25)
    return cx, fy

def holes(im, mn=150):
    """พื้นขาวที่ถูกล้อมไว้ (ระหว่างคันธนูกับสาย ฯลฯ): ก้อนสีขาวเรียบ ≥ mn px ที่ส่วนใหญ่ขาวจัด → โปร่งใส (ผ้า/ขนสีขาวมีลายเงา ไม่ผ่าน)"""
    from collections import deque
    W, H = im.size; px = im.load(); seen = bytearray(W * H); n = 0
    wh = lambda p: p[3] and min(p[:3]) >= 244 and max(p[:3]) - min(p[:3]) < 16
    for sy in range(H):
        for sx in range(W):
            if seen[sy * W + sx] or not wh(px[sx, sy]): continue
            comp = []; q = deque([(sx, sy)]); seen[sy * W + sx] = 1
            while q:
                x, y = q.popleft(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and wh(px[nx, ny]): seen[ny * W + nx] = 1; q.append((nx, ny))
            if len(comp) >= mn and sum(1 for x, y in comp if min(px[x, y][:3]) >= 250) > len(comp) * .7:
                for x, y in comp: px[x, y] = (0, 0, 0, 0)
                n += 1
    return n

def cut(name):
    im = unbg(os.path.join(SRC, name)); print('  พื้นขาวที่ถูกล้อม:', holes(im), 'ก้อน'); B = bands(im)
    assert len(B) == 4, (name, 'แถว', B)
    rows = []
    for b0, b1 in B:
        band = im.crop((0, b0, im.size[0], b1)); segs = col_segments(band)
        fr = [band.crop((x0, 0, x1, band.size[1])) for x0, x1 in segs]; fr = [f.crop(f.getbbox()) for f in fr]
        assert len(fr) in (4, 5), (name, 'เฟรมในแถว', len(fr)); rows.append(fr)
    assert len({len(r) for r in rows}) == 1, (name, 'จำนวนเฟรมแต่ละแถวไม่เท่ากัน', [len(r) for r in rows])
    ref = sorted(r[0].size[1] for r in rows); s = H_TARGET / ref[len(ref) // 2]   # เฟรมแรก = ท่าพร้อม (ยืนตรง)
    n = len(rows[0]); out = Image.new('RGBA', (CW4 * n, CH * 4), (0, 0, 0, 0))
    for r, fr in enumerate(rows):
        for c, f in enumerate(fr):
            g = shrink(f, s); fx, fy = feet(g)
            x0, y0 = c * CW4 + round(AX4 - fx), r * CH + FOOT - fy
            t = Image.new('RGBA', out.size, (0, 0, 0, 0)); t.alpha_composite(g, (max(0, x0), max(0, y0)), (max(0, -x0), max(0, -y0)))
            cell = (c * CW4, r * CH, (c + 1) * CW4, (r + 1) * CH); out.alpha_composite(t.crop(cell), cell[:2])
    return out, n, s

def check(out, sid, n):
    chk = Image.new('RGBA', out.size, (70, 90, 70, 255)); chk.alpha_composite(out)
    d = chk.load()
    for r in range(4):
        for c in range(n):
            for k in range(-4, 5): d[c * CW4 + AX4 + k, r * CH + FOOT] = (255, 255, 0, 255)
    chk.resize((out.size[0] * 2, out.size[1] * 2), Image.NEAREST).save(os.path.join(ROOT, 'docs/evidence', 'atk4_%s_check.png' % sid))

def mark_hair_atk(im, warm=7, front_warm=6.5):
    """ทำเครื่องหมายผม (alpha 254) สำหรับท่าโจมตี (ตัวละครหญิงผมยาว):
    - ไล่จากผมด้านบนเหมือน mark_hair แต่ไม่ลามเข้าผ้าดำอมแดง (r−b > warm) และไม่เกินความกว้างของหัวด้านที่หัน
    - ด้านหน้าหัว ใต้ระดับตา (ที่แขนยื่นฟัน): ต้องเป็นสีดำอมเทาจริง — ค่าเฉลี่ย r−b รอบ ๆ ≤ front_warm (ผมดำ ≈ 4–5, ผ้าดำ ≈ 8–11)"""
    import numpy as np
    from collections import deque
    A = np.asarray(im).astype(float); dk = (A[..., 3] > 0) & (A[..., :3].max(2) < 100)
    rb = np.where(dk, A[..., 0] - A[..., 2], 0); k = np.ones(7)
    conv = lambda m: np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, m))
    WARM = conv(rb) / np.maximum(conv(dk.astype(float)), 1)
    W, H = im.size; px = im.load(); seen = set()
    def dark(x, y):
        r, g, b, a = px[x, y]; return a and max(r, g, b) < 100 and max(r, g, b) - min(r, g, b) < 40 and r - b <= warm
    for ri, fy in enumerate(range(0, H, CH)):
        for fx in range(0, W, CW4):
            top = [y for y in range(fy, fy + CH) if any(px[x, y][3] for x in range(fx, fx + CW4))]
            if not top: continue
            hx = [x for y in range(top[0], top[0] + 26) for x in range(fx, fx + CW4) if px[x, y][3]]
            lo, hi, cxh = min(hx) - 22, max(hx) + 22, (min(hx) + max(hx)) / 2
            if ri == 2: lo = min(hx) - 2      # หันซ้าย
            if ri == 3: hi = max(hx) + 2      # หันขวา
            front = (lambda x, y: x > cxh) if ri == 3 else (lambda x, y: x < cxh) if ri == 2 else (lambda x, y: False)
            ok = lambda x, y: dark(x, y) and not (front(x, y) and y > top[0] + 24 and WARM[y, x] > front_warm)
            q = deque((x, y) for y in range(fy, fy + 44) for x in range(max(fx, lo), min(fx + CW4, hi + 1)) if ok(x, y)); seen.update(q)
            while q:
                x, y = q.popleft()
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if not (max(fx, lo) <= nx <= min(fx + CW4 - 1, hi) and fy <= ny < fy + 110) or (nx, ny) in seen or not ok(nx, ny): continue
                    seen.add((nx, ny)); q.append((nx, ny))
    for x, y in seen:
        r, g, b, a = px[x, y]; px[x, y] = (r, g, b, 254)
    return len(seen)

def build(sid, name):
    out, n, s = cut(name); assert n == 4, (sid, 'ชุดแยกชั้นต้องมี 4 เฟรม')
    (mark_hair_atk if sid.startswith('f') else mark_hair)(out)
    head, body = split(out)
    head.save(os.path.join(ROOT, 'game/sprites', 'pc_%s_h_atk4.webp' % sid), 'WEBP', lossless=True)
    body.save(os.path.join(ROOT, 'game/sprites', 'pc_%s_b_atk4.webp' % sid), 'WEBP', lossless=True)
    check(Image.alpha_composite(body, head), sid, n)
    print('สร้าง', sid, 'scale', round(s, 3))

done = []
for sid, name in ATK4_SETS:
    if os.path.exists(os.path.join(SRC, name)): build(sid, name); done.append(sid)
    else: print('ข้าม', sid)
body = {}
for sid, cls, g, name in BODY_SETS:
    if not os.path.exists(os.path.join(SRC, name)): print('ข้าม', sid); continue
    out, n, sc = cut(name); out.save(os.path.join(ROOT, 'game/sprites', 'pca_%s.webp' % sid), 'WEBP', lossless=True); check(out, sid, n)
    body.setdefault(cls, {})[g] = {'id': sid, 'n': n}; print('สร้าง', sid, 'เฟรม', n, 'scale', round(sc, 3))
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
js = 'const ATK4={cw:%d,ax:%d,sets:%s,body:%s};/*ATK4*/' % (CW4, AX4, json.dumps(done), json.dumps(body, ensure_ascii=False, separators=(',', ':')))
s, n = re.subn(r'const ATK4=\{.*?\};/\*ATK4\*/', lambda m: js, s, count=1, flags=re.S)
if n != 1:
    a = 'const CBIMG={};'; assert s.count(a) == 1; s = s.replace(a, js + '\n' + a, 1)
open(p, 'w', encoding='utf-8').write(s); print(js)
