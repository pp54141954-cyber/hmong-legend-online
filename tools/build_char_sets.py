#!/usr/bin/env python3
"""ชุดภาพตัวละคร: ทรงผม/แบบชุด แยกเป็นชั้น "หัว" (หัว + ผมทั้งหมด) กับ "ตัว" (คอลงไป) แล้วให้เกมประกอบกันได้ทุกคู่ (V2-R35)

ทะเบียน: assets/sprites_src/char/sets.json — แต่ละรายการ
  {"id": "f_h1", "g": "f", "kind": "hair" | "outfit" | "base", "name": "...", "dir": "<โฟลเดอร์ต้นฉบับ>", "pre": false}
  - kind "base"   = ใช้ได้ทั้งเป็นทรงผมและเป็นชุด (ตัวละครพื้นฐานของเพศนั้น)
  - kind "hair"   = เอาเฉพาะชั้นหัว (ภาพทำด้วยชุดพื้นฐาน)
  - kind "outfit" = เอาเฉพาะชั้นตัว (ภาพทำด้วยผมมัดมวยเล็ก ให้เห็นหลัง/ไหล่เต็ม)
  - "pre": true = ต้นฉบับเป็นแผ่นขนาดเกมอยู่แล้ว (walk.png 384x496, idle.png 480x124, attack.png 960x124) ไม่ต้องลบพื้น/ย่อ
  ต้นฉบับจาก ChatGPT: walk_src.png, idle_src.png, attack_src.png (พื้นหลังสีขาว/ลายตาราง ขนาดใดก็ได้ แต่จำนวนเฟรมต้องตรง)
ผลลัพธ์: game/sprites/pc_<id>_<h|b>_<walk|idle|attack>.webp + ทะเบียนฝังใน game/index.html (CHAR_CAT)
  พิกเซลผม alpha = 254 (เกมใช้เปลี่ยนสีผม), ชั้นหัว = แถว y < NECK ในแต่ละช่อง + พิกเซลผมทั้งหมด, ชั้นตัว = ส่วนที่เหลือ
รัน: python3 tools/build_char_sets.py
"""
import json, os, re, sys
from collections import deque
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
CW, CH, AW, AAX, H_TARGET, FOOT, NECK = 96, 124, 240, 84, 107, 120, 52
SRC = os.path.join(ROOT, 'assets/sprites_src/char')
OUT = os.path.join(ROOT, 'game/sprites')

# ---------- ลบพื้นหลัง / แยกเฟรม / ย่อ (เหมือน build_female_sprites.py) ----------
def bg(p):
    r, g, b, _ = p; return min(r, g, b) >= 170 and max(r, g, b) - min(r, g, b) < 22
def unbg(path):
    im = Image.open(path).convert('RGBA'); W, H = im.size; px = im.load()
    if im.getextrema()[3][0] < 250 and sum(1 for x in range(0, W, 7) for y in (0, H - 1) if px[x, y][3] == 0) > W // 14:
        return im  # โปร่งใสจริงอยู่แล้ว
    seen = bytearray(W * H); q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while q:
        x, y = q.popleft(); i = y * W + x
        if seen[i] or not bg(px[x, y]): continue
        seen[i] = 1; px[x, y] = (0, 0, 0, 0)
        if x > 0: q.append((x - 1, y))
        if x < W - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < H - 1: q.append((x, y + 1))
    seen2 = bytearray(W * H)
    for sy in range(H):
        for sx in range(W):
            i = sy * W + sx; p = px[sx, sy]
            if seen2[i] or p[3] == 0 or not bg(p) or min(p[:3]) < 236: continue
            comp, q2 = [], deque([(sx, sy)]); seen2[i] = 1
            while q2:
                x, y = q2.popleft(); comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen2[ny * W + nx]:
                        pp = px[nx, ny]
                        if pp[3] and bg(pp) and min(pp[:3]) >= 236: seen2[ny * W + nx] = 1; q2.append((nx, ny))
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
            elif segs and start - segs[-1][1] < 12: segs[-1] = (segs[-1][0], x)
            start = None
    return segs
def frames_grid(im, cols, rows):
    W, H = im.size; out = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * W // cols, r * H // rows, (c + 1) * W // cols, (r + 1) * H // rows)); out.append(cell.crop(cell.getbbox()))
    return out
def frames_cols(im):
    return [im.crop((x0, 0, x1, im.size[1])).crop(im.crop((x0, 0, x1, im.size[1])).getbbox()) for x0, x1 in col_segments(im)]
def shrink(f, s):
    w, h = max(1, round(f.size[0] * s)), max(1, round(f.size[1] * s)); g = f.resize((w, h), Image.LANCZOS); px = g.load()
    for y in range(h):
        for x in range(w):
            r, gg, b, a = px[x, y]; px[x, y] = (r, gg, b, 255) if a >= 110 else (0, 0, 0, 0)
    return g
def leg_center(f):
    a = f.split()[3]; w, h = f.size; xs = [x for y in range(int(h * .75), h) for x in range(w) if a.getpixel((x, y))]
    return sum(xs) / len(xs) if xs else w / 2
def sheet(frames, cols, rows, cw, attack=False):
    hs = sorted(f.size[1] for f in frames); s = H_TARGET / hs[len(hs) // 2]; out = Image.new('RGBA', (cw * cols, CH * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        g = shrink(f, s); c, r = i % cols, i // cols
        x0 = c * cw + (round(AAX - leg_center(g)) if attack else round(cw / 2 - g.size[0] / 2)); y0 = r * CH + FOOT - g.size[1]
        cx = max(0, c * cw - x0); out.alpha_composite(g.crop((cx, 0, g.size[0], g.size[1])), (x0 + cx, max(0, y0)))
    return out
def mark_hair(im, lo=20, seed_y=44, max_y=96):
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
def split(im):
    """ชั้นหัว = แถวบนคอ + พิกเซลผมทุกตำแหน่ง, ชั้นตัว = ที่เหลือ"""
    W, H = im.size; px = im.load(); head = Image.new('RGBA', im.size, (0, 0, 0, 0)); body = Image.new('RGBA', im.size, (0, 0, 0, 0)); hp, bp = head.load(), body.load()
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if p[3] == 0: continue
            if y % CH < NECK or p[3] == 254: hp[x, y] = p
            else: bp[x, y] = p
    return head, body

def build_set(e):
    d = os.path.join(SRC, e['dir'])
    if e.get('pre'):
        Ws, Is, As = (Image.open(os.path.join(d, n + '.png')).convert('RGBA') for n in ('walk', 'idle', 'attack'))
        for im in (Ws, Is, As):  # แผ่นขนาดเกมอยู่แล้ว: ล้างค่า alpha 254 เดิม แล้วทำเครื่องหมายผมใหม่
            px = im.load()
            for y in range(im.size[1]):
                for x in range(im.size[0]):
                    r, g, b, a = px[x, y]
                    if a == 254: px[x, y] = (r, g, b, 255)
    else:
        walk = frames_grid(unbg(os.path.join(d, 'walk_src.png')), 4, 4); atk = frames_cols(unbg(os.path.join(d, 'attack_src.png')))
        ip = os.path.join(d, 'idle_src.png')
        idle = frames_cols(unbg(ip)) if os.path.exists(ip) else [walk[0], walk[0], walk[3], walk[0], walk[0]]  # ยังไม่มีภาพท่ายืน: ใช้ท่าเดินหันหน้าชั่วคราว
        assert (len(walk), len(idle), len(atk)) == (16, 5, 4), (e['id'], 'จำนวนเฟรม เดิน/ยืน/ฟัน =', len(walk), len(idle), len(atk), 'ต้องเป็น 16/5/4')
        Ws, Is, As = sheet(walk, 4, 4, CW), sheet(idle, 5, 1, CW), sheet(atk, 4, 1, AW, True)
    for im in (Ws, Is, As): mark_hair(im)
    for name, im in (('walk', Ws), ('idle', Is), ('attack', As)):
        head, body = split(im)
        if e['kind'] in ('base', 'hair'): head.save(os.path.join(OUT, 'pc_%s_h_%s.webp' % (e['id'], name)), 'WEBP', lossless=True)
        if e['kind'] in ('base', 'outfit'): body.save(os.path.join(OUT, 'pc_%s_b_%s.webp' % (e['id'], name)), 'WEBP', lossless=True)
    return Ws

def main():
    sets = json.load(open(os.path.join(SRC, 'sets.json'), encoding='utf-8'))
    cat = {'m': {'hair': [], 'outfit': []}, 'f': {'hair': [], 'outfit': []}}
    prev = []
    for e in sets:
        if not all(os.path.exists(os.path.join(SRC, e['dir'], n)) for n in (('walk.png', 'idle.png', 'attack.png') if e.get('pre') else ('walk_src.png', 'attack_src.png'))):
            print('ข้าม (ยังไม่มีภาพ):', e['id'], e['name']); continue
        Ws = build_set(e); prev.append((e, Ws))
        if e['kind'] in ('base', 'hair'): cat[e['g']]['hair'].append({'id': e['id'], 'n': e.get('hname', e['name'])})
        if e['kind'] in ('base', 'outfit'): cat[e['g']]['outfit'].append({'id': e['id'], 'n': e.get('oname', e['name'])})
        print('สร้าง', e['id'], e['kind'], e['name'])
    p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
    js = 'const CHAR_CAT=' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';/*CHAR_CAT*/'
    s, n = re.subn(r'const CHAR_CAT=\{.*?\};/\*CHAR_CAT\*/', lambda m: js, s, count=1, flags=re.S)
    if n != 1: raise SystemExit('ไม่พบจุดฝัง CHAR_CAT ใน game/index.html')
    open(p, 'w', encoding='utf-8').write(s)
    # ภาพตรวจ: ทุกชุด เฟรมแรกของแต่ละทิศ
    chk = Image.new('RGBA', (CW * 4 * max(1, len(prev)), CH), (70, 90, 70, 255))
    for i, (e, Ws) in enumerate(prev):
        for r in range(4): chk.alpha_composite(Ws.crop((0, r * CH, CW, r * CH + CH)), (i * CW * 4 + r * CW, 0))
    chk.resize((chk.size[0] * 2, CH * 2), Image.NEAREST).save(os.path.join(ROOT, 'docs/evidence/char_sets_check.png'))
    print('ทะเบียน:', json.dumps(cat, ensure_ascii=False))

if __name__ == '__main__':
    main()
