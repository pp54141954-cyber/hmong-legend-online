#!/usr/bin/env python3
"""แบ่งแผนที่ถ้ำ (mine) เป็น 6 โซนตามวงที่เจ้าของทำเครื่องหมาย (V2-R58)
- วงทั้ง 6 (assets/maps_src/mine_regions.png: ค่า 1–6) = เนื้อหาของโซนหนึ่ง ๆ; ทางดินที่เชื่อมวงถูกแบ่งให้วงที่ใกล้ที่สุดตามเส้นทาง
- ขยายโซนให้เต็มแผนที่ (ขยายฐาน): ซูมเนื้อหาของโซนแบบสัดส่วนเดิม แล้วจำแนกพื้นที่เดินได้ใหม่บนภาพที่ขยาย
- ทางออก: จุดที่เส้นทางข้ามจากโซนหนึ่งไปอีกโซนหนึ่ง (หรือออกจากแผนที่) ตำแหน่งมาถึงคำนวณจากตำแหน่งเดียวกันในแผนที่เดิม
ผลลัพธ์: assets/maps/<โซน>.mask.txt, game/maps/<โซน>.webp, docs/evidence/map_mine_split.png, tools/mine_split.json
รัน: python3 tools/build_mine_split.py && python3 tools/embed_maps.py && node tools/extract-shared.js
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from mine_ground import classify

T, COLS, ROWS = 32, 48, 32
PW, PH = COLS * T, ROWS * T
VOID = np.array([14, 22, 18], float)
ZONES = {  # หมายเลขวง → (รหัสโซน, ชื่อ)
    1: ('mine_camp', 'ค่ายเหมืองบน'),
    2: ('mine_tunnel', 'ปากถ้ำเหมือง'),
    3: ('mine_plaza', 'ลานหินกลางเหมือง'),
    4: ('mine_station', 'สถานีรถแร่'),
    5: ('mine_river', 'ลำธารเหมือง'),
    6: ('mine_cliff', 'หน้าผาเหมือง'),
}
ZID = {v[0]: k for k, v in ZONES.items()}
# ทางดินที่ต้องอยู่กับโซนนี้ (ช่อง x0,y0,x1,y1) — แก้การแบ่งอัตโนมัติที่ทางข้างค่าย
ROAD_OVERRIDE = {1: [(0, 11, 22, 14)], 2: [(33, 21, 41, 26)], 6: [(38, 23, 41, 25)]}
# ช่องเดินที่ขาดตอนเล็กน้อยระหว่างวง (ทางแคบ/ทางลาดที่ตัวกรองสีพลาด) — (x, y, โซน)
FORCE_WALK = [(40, 24, 6), (41, 23, 6), (40, 23, 6), (39, 24, 6)]
# ทางออกจากแผนที่ถ้ำไปแผนที่อื่น (ช่องในแผนที่ถ้ำ → โซนปลายทาง, ตำแหน่งในแผนที่ปลายทาง)
EXT_OUT = [  # เดิมจาก mine: ไปโซนอื่น (ตำแหน่งปลายทางไม่เปลี่ยน)
    ((0, 11), 'rainforest', (45, 12)), ((0, 30), 'field2', (5, 3)), ((0, 31), 'field2', (5, 3)),
    ((1, 31), 'field2', (5, 3)), ((2, 31), 'field2', (5, 3)), ((47, 14), 'peak', (2, 16)), ((47, 15), 'peak', (2, 16)),
]
# ทางเข้าจากแผนที่อื่นมาที่แผนที่ถ้ำ (ช่องปลายทางในถ้ำเดิม) — ใช้หาจุดมาถึงของโซนที่เกี่ยวข้อง
ENTER_FROM = {'rainforest': (2, 11), 'field2': (2, 29), 'peak': (45, 14)}

def load():
    clean = np.asarray(Image.open(os.path.join(ROOT, 'assets/maps_src/mine.png')).convert('RGB')).astype(int)
    lab = np.asarray(Image.open(os.path.join(ROOT, 'assets/maps_src/mine_regions.png')))
    return clean, lab

def tile_walk_pix(A):
    m = classify(A).astype(float)
    return m.reshape(ROWS, T, COLS, T).mean(axis=(1, 3))

def partition(clean, lab, reach=8):
    """ป้ายโซนของแต่ละช่อง: ช่องในวง → วงนั้น; ทางเดินนอกวง → วงที่ใกล้ที่สุด (ไม่เกิน reach ช่อง) ทำให้เส้นทางระหว่างวงถูกแบ่งกลางทาง"""
    frac = {k: (lab == k).reshape(ROWS, T, COLS, T).mean(axis=(1, 3)) for k in ZONES}
    W = tile_walk_pix(clean) >= .45
    tl = np.zeros((ROWS, COLS), int)
    for k in ZONES:
        tl[(frac[k] >= .5) & (tl == 0)] = k
    yy, xx = np.mgrid[0:ROWS, 0:COLS]
    best = np.full((ROWS, COLS), 1e9); lab_near = np.zeros((ROWS, COLS), int)
    for k in ZONES:
        pts = np.argwhere(tl == k)
        if not len(pts): continue
        d = np.full((ROWS, COLS), 1e9)
        for py, px in pts:
            d = np.minimum(d, np.hypot(yy - py, xx - px))
        upd = d < best; best[upd] = d[upd]; lab_near[upd] = k
    add = (tl == 0) & W & (best <= reach)
    tl[add] = lab_near[add]
    for k, rects in ROAD_OVERRIDE.items():
        for x0, y0, x1, y1 in rects:
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    if W[y, x]: tl[y, x] = k
    for x, y, k in FORCE_WALK:
        W[y, x] = True; tl[y, x] = k
    rk = _rock_mask(clean)
    CARVED.clear()
    for a, b in CARVE:
        path = _carve_path(tl, W, rk, a, b)
        if path is None:
            print('ต่อโซนไม่ได้', a, b); continue
        half = len(path) // 2
        for i, (x, y) in enumerate(path):
            tl[y, x] = a if i < half else b; W[y, x] = True
            CARVED.setdefault(a if i < half else b, []).append((x, y))
    return tl, W

CARVED = {}

def _rock_mask(clean):
    r, g, b = clean[..., 0], clean[..., 1], clean[..., 2]
    lum = .3 * r + .59 * g + .11 * b; mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    rockp = ((b > r + 6) & (lum < 180) & (mx - mn < 70)) | ((b > r + 28) & (b > g + 5))
    return rockp.reshape(ROWS, T, COLS, T).mean(axis=(1, 3)) >= .5

def _carve_path(tl, W, rk, a, b):
    src = [(x, y) for y in range(ROWS) for x in range(COLS) if tl[y, x] == a and W[y, x]]
    dst = {(x, y) for y in range(ROWS) for x in range(COLS) if tl[y, x] == b and W[y, x]}
    prev = {}; q = deque()
    for s_ in src: prev[s_] = None; q.append(s_)
    found = None
    while q:
        x, y = q.popleft()
        if (x, y) in dst: found = (x, y); break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < COLS and 0 <= ny < ROWS) or (nx, ny) in prev: continue
            if rk[ny, nx] or tl[ny, nx] not in (0, a, b): continue
            prev[(nx, ny)] = (x, y); q.append((nx, ny))
    if found is None: return None
    path = []; cur = found
    while cur is not None: path.append(cur); cur = prev[cur]
    return path[::-1]

def _largest_piece(mask):
    """ชิ้นที่ต่อกัน (4 ทิศ) ใหญ่สุดของผังช่อง — ตัดเศษทางที่ลอยแยกจากวง"""
    lab_ = np.zeros(mask.shape, int); best = (0, None); n = 0
    for y in range(mask.shape[0]):
        for x in range(mask.shape[1]):
            if mask[y, x] and not lab_[y, x]:
                n += 1; q = deque([(x, y)]); lab_[y, x] = n; cells = []
                while q:
                    cx, cy = q.popleft(); cells.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < mask.shape[1] and 0 <= ny < mask.shape[0] and mask[ny, nx] and not lab_[ny, nx]:
                            lab_[ny, nx] = n; q.append((nx, ny))
                if len(cells) > best[0]: best = (len(cells), cells)
    out = np.zeros(mask.shape, bool)
    for x, y in (best[1] or []): out[y, x] = True
    return out

def zoom_zone(clean, lab, tl, k):
    """ขยายโซน k: วงของโซนเต็มแผนที่ (สัดส่วนเดิม ไม่เกิน 2.8 เท่า) ทางดินที่ออกนอกแผนที่จะถูกตัดที่ขอบ
    → (ภาพ, ตัวเลขการแปลง, หน้ากากเนื้อหาในภาพขยาย)"""
    circ = lab == k
    ys, xs = np.nonzero(circ)
    cx0, cx1, cy0, cy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    s = min(PW / (cx1 - cx0), PH / (cy1 - cy0), 2.8) * 0.94
    x0 = (cx0 + cx1) / 2 - PW / (2 * s); y0 = (cy0 + cy1) / 2 - PH / (2 * s)
    frac_k = circ.reshape(ROWS, T, COLS, T).mean(axis=(1, 3))
    yy, xx = np.mgrid[0:ROWS, 0:COLS]
    dist = np.full((ROWS, COLS), 1e9)
    for py, px in np.argwhere(frac_k >= .3):
        dist = np.minimum(dist, np.maximum(np.abs(yy - py), np.abs(xx - px)))
    tiles_k = ((tl == k) | (frac_k >= .3)) & (dist <= 6)
    tl_px = np.kron(tiles_k.astype(np.uint8), np.ones((T, T), np.uint8)).astype(bool)
    content = circ | (tl_px & (lab == 0))
    mt = Image.fromarray((content * 255).astype(np.uint8))
    data = (1 / s, 0, x0, 0, 1 / s, y0)
    crop = Image.fromarray(clean.astype(np.uint8)).transform((PW, PH), Image.AFFINE, data, resample=Image.BICUBIC, fillcolor=tuple(int(v) for v in VOID))
    cmask = mt.transform((PW, PH), Image.AFFINE, data, resample=Image.NEAREST, fillcolor=0)
    cmask = cmask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(4))
    alpha = np.asarray(cmask).astype(float)[..., None] / 255
    art = np.asarray(crop).astype(float) * alpha + VOID * (1 - alpha)
    art = Image.fromarray(np.clip(art, 0, 255).astype(np.uint8))
    conv = dict(x0=float(x0), y0=float(y0), s=float(s), ox=0.0, oy=0.0)
    return art, conv, np.asarray(cmask) >= 128

def to_zoom(conv, px, py):
    tx_ = int(np.floor(((px + .5 - conv['x0']) * conv['s'] + conv['ox']) / T)); ty_ = int(np.floor(((py + .5 - conv['y0']) * conv['s'] + conv['oy']) / T))
    return min(COLS - 1, max(0, tx_)), min(ROWS - 1, max(0, ty_))

def _dil(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            sh = np.zeros_like(m)
            ys = slice(max(0, dy), ROWS + min(0, dy)); yd = slice(max(0, -dy), ROWS + min(0, -dy))
            xs = slice(max(0, dx), COLS + min(0, dx)); xd = slice(max(0, -dx), COLS + min(0, -dx))
            sh[ys, xs] = m[yd, xd]
            out |= sh
    return out

def _ero(m, r):
    return ~_dil(~m, r)

def walk_zoom(art, cm, close=2, floor=None, force=None):
    """เดินได้บนภาพขยาย: จำแนกพิกเซล → ช่อง; ปิดช่องว่างแคบ ๆ (ขยายฐานให้ต่อเนื่อง); เพิ่มพื้นที่ FLOOR_ADD แต่ไม่ทับผาและน้ำ"""
    A = np.asarray(art).astype(int)
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    lum = .3 * r + .59 * g + .11 * b
    rockw = ((b > r + 6) & (lum < 180) & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 70)) | ((b > r + 28) & (b > g + 5))
    m = classify(A).astype(float) * cm
    if floor is not None:
        m = np.maximum(m, floor.astype(float) * cm * (~rockw))
    if force is not None:
        wat = ((b > r + 28) & (b > g + 5)) | (lum < 60)
        m = np.maximum(m, force.astype(float) * cm * (~wat))
    frac = m.reshape(ROWS, T, COLS, T).mean(axis=(1, 3))
    walk = frac >= .5
    content = cm.reshape(ROWS, T, COLS, T).mean(axis=(1, 3)) >= .5
    blocked = rockw.astype(float).reshape(ROWS, T, COLS, T).mean(axis=(1, 3)) >= .5
    if close:
        walk = _ero(_dil(walk, close), close) & content
    return walk & content, blocked & content

def nearest(Wz, x, y, r=4):
    best = None
    for yy in range(max(0, y - r), min(ROWS, y + r + 1)):
        for xx in range(max(0, x - r), min(COLS, x + r + 1)):
            if Wz[yy, xx]:
                d = abs(xx - x) + abs(yy - y)
                if best is None or d < best[0]: best = (d, xx, yy)
    return None if best is None else (best[1], best[2])

def bfs_reach(Wz, start):
    seen = np.zeros((ROWS, COLS), bool); q = deque([start]); seen[start[1], start[0]] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and Wz[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((nx, ny))
    return seen

def dist_from(sources, Wz):
    D = np.full((ROWS, COLS), 10 ** 6); q = deque()
    for x, y in sources: D[y, x] = 0; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and Wz[ny, nx] and D[ny, nx] > D[y, x] + 1:
                D[ny, nx] = D[y, x] + 1; q.append((nx, ny))
    return D

def build():
    clean, lab = load()
    tl, W = partition(clean, lab)
    out = {'zones': {}}
    arts, convs, Wz, cms, blk = {}, {}, {}, {}, {}
    for k in ZONES:
        art, conv, cm = zoom_zone(clean, lab, tl, k)
        arts[k], convs[k], cms[k] = art, conv, cm
        fl = np.zeros((PH, PW), bool)
        for x0, y0, x1, y1 in FLOOR_ADD.get(k, []):
            ptl = to_zoom(conv, x0 * T, y0 * T); pbr = to_zoom(conv, x1 * T + T - 1, y1 * T + T - 1)
            fl[max(0, ptl[1] * T):min(PH, (pbr[1] + 1) * T), max(0, ptl[0] * T):min(PW, (pbr[0] + 1) * T)] = True
        ff = np.zeros((PH, PW), bool)
        for x0, y0, x1, y1 in FLOOR_FORCE.get(k, []):
            ptl = to_zoom(conv, x0 * T, y0 * T); pbr = to_zoom(conv, x1 * T + T - 1, y1 * T + T - 1)
            ff[max(0, ptl[1] * T):min(PH, (pbr[1] + 1) * T), max(0, ptl[0] * T):min(PW, (pbr[0] + 1) * T)] = True
        for x, y in CARVED.get(k, []):
            ptl = to_zoom(conv, x * T, y * T); pbr = to_zoom(conv, x * T + T - 1, y * T + T - 1)
            ff[max(0, ptl[1] * T):min(PH, (pbr[1] + 1) * T), max(0, ptl[0] * T):min(PW, (pbr[0] + 1) * T)] = True
        Wz[k], blk[k] = walk_zoom(art, cm, floor=fl, force=ff)
    # ทางออกระหว่างโซนภายใน: คู่ช่องเดินได้ข้ามเขตกัน (ในแผนที่เดิม) — รอบที่ 1: ตำแหน่งทางออกในโซนต้นทาง
    cross = []   # (ka, ta, kb, eb_approx)
    for y in range(ROWS):
        for x in range(COLS):
            for dx, dy in ((1, 0), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx >= COLS or ny >= ROWS: continue
                a, b = tl[y, x], tl[ny, nx]
                if not a or not b or a == b or not W[y, x] or not W[ny, nx]: continue
                for (p, q_, ka, kb) in (((x, y), (nx, ny), a, b), ((nx, ny), (x, y), b, a)):
                    ea = to_zoom(convs[ka], p[0] * T + T // 2, p[1] * T + T // 2)
                    ta = nearest(Wz[ka], ea[0], ea[1], 3)
                    eb = to_zoom(convs[kb], q_[0] * T + T // 2, q_[1] * T + T // 2)
                    if ta: cross.append((ka, ta, kb, eb))
    Eset = {k: set() for k in ZONES}
    for ka, ta, kb, eb in cross: Eset[ka].add(ta)
    for k in ZONES:
        for (ox_, oy_), dest, dpos in EXT_OUT:
            if tl[oy_, ox_] == k:
                ez = to_zoom(convs[k], ox_ * T + T // 2, oy_ * T + T // 2)
                et = nearest(Wz[k], ez[0], ez[1], 3)
                if et: Eset[k].add(et)
    def far_from(zone, x, y, need=3):
        return all(max(abs(x - ex), abs(y - ey)) >= need for ex, ey in Eset[zone])
    # รอบที่ 2: จุดมาถึงต้องห่างทางออกของโซนนั้นอย่างน้อย 3 ช่อง
    E = {k: {} for k in ZONES}
    for ka, ta, kb, eb in cross:
        best = None
        for yy in range(max(0, eb[1] - 8), min(ROWS, eb[1] + 9)):
            for xx in range(max(0, eb[0] - 8), min(COLS, eb[0] + 9)):
                if Wz[kb][yy, xx] and far_from(kb, xx, yy):
                    d = abs(xx - eb[0]) + abs(yy - eb[1])
                    if best is None or d < best[0]: best = (d, xx, yy)
        if best and ta not in E[ka]: E[ka][ta] = (ZONES[kb][0], (best[1], best[2]), None)
    # ทางออกไปแผนที่อื่น
    ext = {k: [] for k in ZONES}
    for (ox_, oy_), dest, dpos in EXT_OUT:
        k = tl[oy_, ox_]
        ez = to_zoom(convs[k], ox_ * T + T // 2, oy_ * T + T // 2)
        ext[k].append((ez, dest, dpos))   # ตำแหน่งจริงจะถูกย้ายไปช่องเดินได้ใกล้ที่สุดในขั้นคัดกรอง
    # จุดมาถึงจากแผนที่อื่นเข้าโซนที่ถูกต้อง (ห่างทางออกอย่างน้อย 3 ช่อง)
    enter = {}
    for dest, (ex_, ey_) in ENTER_FROM.items():
        k = tl[ey_, ex_]
        ez = to_zoom(convs[k], ex_ * T + T // 2, ey_ * T + T // 2)
        best = None
        for yy in range(max(0, ez[1] - 8), min(ROWS, ez[1] + 9)):
            for xx in range(max(0, ez[0] - 8), min(COLS, ez[0] + 9)):
                if Wz[k][yy, xx] and far_from(k, xx, yy):
                    d = abs(xx - ez[0]) + abs(yy - ez[1])
                    if best is None or d < best[0]: best = (d, xx, yy)
        enter[dest] = (k, (best[1], best[2]) if best else None)
    return dict(clean=clean, tl=tl, W=W, arts=arts, convs=convs, Wz=Wz, blk=blk, cms=cms, E=E, ext=ext, enter=enter)

SPAWNS = {  # ชนิดมอนสเตอร์ประจำโซน (ชนิดเดียวกับแผนที่ถ้ำเดิม) และจำนวนต่อจุดเกิด
    'mine_camp': [('หมีเขา', 2), ('กระทิงผี', 2)],
    'mine_tunnel': [('โกเลมหิน', 2), ('ปีศาจ', 1)],
    'mine_plaza': [('ปีศาจ', 2), ('โกเลมหิน', 2)],
    'mine_station': [('หมีเขา', 2), ('ปีศาจ', 1)],
    'mine_river': [('กระทิงผี', 2), ('หมีเขา', 1)],
    'mine_cliff': [('โกเลมหิน', 2), ('กระทิงผี', 1)],
}
# พื้นที่ในวงที่เป็นพื้นเดินได้แต่ตัวกรองสีพลาด (พื้นถ้ำ ลานหญ้า) — (x0,y0,x1,y1) ช่องในแผนที่เดิม; ไม่รวมผาและน้ำ
FLOOR_ADD = {
    2: [(33, 5, 39, 11), (28, 9, 33, 13)],
    6: [(27, 23, 44, 31)],
}
# พื้นถ้ำที่สีเป็นหินเทาเย็น (รางรถแร่) ให้เดินได้ด้วย — ไม่รวมน้ำและส่วนมืด
FLOOR_FORCE = {2: [(34, 8, 39, 12)]}
# ต่อทางเดินระหว่างโซนที่ขาดตอนในแผนที่เดิม (ค้นทางจากโซนหนึ่งไปอีกโซนผ่านช่องที่ไม่ใช่ผา/น้ำ)
CARVE = [(2, 4), (6, 4)]
BOSS_ZONE = ('mine_plaza', 'มังกรภูเขาดำ', 'boss')  # บอสประจำถ้ำเดิม ย้ายมาอยู่ลานหินกลาง

def comps(Wz):
    lab = np.zeros((ROWS, COLS), int); n = 0
    for y in range(ROWS):
        for x in range(COLS):
            if Wz[y, x] and not lab[y, x]:
                n += 1; q = deque([(x, y)]); lab[y, x] = n
                while q:
                    cx, cy = q.popleft()
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < COLS and 0 <= ny < ROWS and Wz[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((nx, ny))
    return lab, n

def _zoom_carve(Wz, blk, cm, src, dst_set):
    """ต่อจุดที่ขาดจากส่วนหลักด้วยทางเดินสั้นที่สุดผ่านช่องในเนื้อหาที่ไม่ใช่ผา/น้ำ"""
    prev = {src: None}; q = deque([src]); found = None
    while q:
        x, y = q.popleft()
        if (x, y) in dst_set: found = (x, y); break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < COLS and 0 <= ny < ROWS) or (nx, ny) in prev: continue
            if not cm[ny, nx] or blk[ny, nx]: continue
            prev[(nx, ny)] = (x, y); q.append((nx, ny))
    if found is None: return None
    path = []; cur = found
    while cur is not None: path.append(cur); cur = prev[cur]
    return path

def finalize(R):
    """คัดช่องเดินได้: ส่วนหลักของโซน (ชิ้นใหญ่สุด) + จุดมาถึง/ทางออก; จุดที่ขาดจะต่อด้วยทางเดินสั้น ๆ หรือถูกตัดทิ้ง"""
    arrivals = {k: [] for k in ZONES}
    for k in ZONES:
        for (ex, ey), (dest, tb, _) in R['E'][k].items():
            arrivals[ZID[dest]].append(tb)
    for dest, (k, t) in R['enter'].items():
        if t: arrivals[k].append(t)
    out = {}
    for k in ZONES:
        Wz = R['Wz'][k].copy(); blk = R['blk'][k]; cm = R['cms'][k].reshape(ROWS, T, COLS, T).mean(axis=(1, 3)) >= .5
        cl, n = comps(Wz)
        anchors = [(ex, ey) for (ex, ey) in R['E'][k].keys()] + [tuple(t) for t in arrivals[k]] + [(e[0][0], e[0][1]) for e in R['ext'][k]]
        sizes = {c: int((cl == c).sum()) for c in range(1, n + 1)}
        anchored = {int(cl[y, x]) for (x, y) in anchors if cl[y, x]}
        main = max(sizes, key=lambda c: sizes[c]) if sizes else None   # ส่วนหลักของโซน = ชิ้นพื้นที่เดินได้ใหญ่สุด
        keep = (cl == main) if main else np.zeros((ROWS, COLS), bool)
        for (x, y) in anchors:
            if keep[y, x]: continue
            if not Wz[y, x] and not (cm[y, x] and not blk[y, x]):
                continue
            ys, xs = np.nonzero(keep)
            if not len(xs): break
            path = _zoom_carve(Wz, blk, cm, (x, y), set(zip(xs.tolist(), ys.tolist())))
            if path:
                for px_, py_ in path: keep[py_, px_] = True
        out[k] = dict(keep=keep, arr=[t for t in arrivals[k] if keep[t[1], t[0]]])
    for k in ZONES:
        keep = out[k]['keep']
        ys_, xs_ = np.nonzero(keep)

        def place(x, y, r=12):
            """ทางออก/จุดมาถึงที่ไม่ได้อยู่บนส่วนหลัก → ย้ายไปช่องส่วนหลักที่ใกล้ที่สุด (ไม่เกิน r ช่อง)"""
            if keep[y, x]: return (x, y)
            if not len(xs_): return None
            d = np.abs(xs_ - x) + np.abs(ys_ - y); i = int(np.argmin(d))
            return (int(xs_[i]), int(ys_[i])) if d[i] <= r else None
        exits, used = [], set()
        for (ex, ey), (dest, tb, _) in R['E'][k].items():
            pe = place(ex, ey)
            if pe and pe not in used:
                used.add(pe); exits.append({'x': pe[0], 'y': pe[1], 'to': dest, 'tt': tb})
        for (ex, ey), dest_id, dpos in R['ext'][k]:
            pe = place(ex, ey, 40)
            if pe and pe not in used:
                used.add(pe); exits.append({'x': pe[0], 'y': pe[1], 'to': dest_id, 'tt': dpos, 'ext': True})
        arr = []
        for t in arrivals[k]:
            pt = place(t[0], t[1])
            if pt: arr.append(pt)
        start = arr[0] if arr else None
        if start is None and len(xs_):
            start = (int(xs_.mean()), int(ys_.mean()))
        out[k].update(exits=exits, start=start, arr=arr)
    return out

def ensure_reciprocal(out):
    """ทางออกต้องไปกลับได้: ถ้าโซน A มีทางไป B แต่ B ไม่มีทางกลับ → เพิ่มทางกลับใน B และจุดมาถึงใน A"""
    names = {v[0]: k for k, v in ZONES.items()}
    def keep_pts(k):
        ys, xs = np.nonzero(out[k]['keep']); return list(zip(xs.tolist(), ys.tolist()))
    for a in ZONES:
        A = ZONES[a][0]
        for e in list(out[a]['exits']):
            if e.get('ext') or e['to'] not in names: continue
            b = names[e['to']]; B = ZONES[b][0]
            if any(x['to'] == A for x in out[b]['exits']): continue
            tb = tuple(e['tt'])
            cand = [p for p in keep_pts(b) if max(abs(p[0] - tb[0]), abs(p[1] - tb[1])) >= 3 and p not in {(x['x'], x['y']) for x in out[b]['exits']}]
            if not cand: continue
            pb = min(cand, key=lambda p: abs(p[0] - tb[0]) + abs(p[1] - tb[1]))
            pa_cands = [p for p in keep_pts(a) if max(abs(p[0] - e['x']), abs(p[1] - e['y'])) >= 3 and p not in {(x['x'], x['y']) for x in out[a]['exits']}]
            if not pa_cands: continue
            pa = min(pa_cands, key=lambda p: abs(p[0] - e['x']) + abs(p[1] - e['y']))
            out[b]['exits'].append({'x': pb[0], 'y': pb[1], 'to': A, 'tt': pa})

def pick_spawns(keep, start, avoid, n):
    """จุดเกิด n จุด: ห่างกันมากที่สุด; ไม่อยู่ใกล้ขอบแผนที่ ห่างทางออก/จุดเริ่มอย่างน้อย 3–4 ช่อง และรอบจุดเกิดมีช่องเดินได้พอให้มอนสเตอร์กระจาย"""
    if start is None or n == 0: return []
    avoid = list(avoid) or [start]
    def room(x, y):
        return int(keep[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum())
    cand = [(int(x), int(y)) for y, x in np.argwhere(keep)]
    cand = [c for c in cand if 4 <= c[0] <= COLS - 5 and 4 <= c[1] <= ROWS - 5
            and min(max(abs(c[0] - a[0]), abs(c[1] - a[1])) for a in avoid) >= 4
            and max(abs(c[0] - start[0]), abs(c[1] - start[1])) >= 9 and room(*c) >= 17]
    if not cand: return []
    pts = [max(cand, key=lambda c: min(max(abs(c[0] - a[0]), abs(c[1] - a[1])) for a in avoid + [start]))]
    while len(pts) < n and len(pts) < len(cand):
        nxt = max(cand, key=lambda c: min(abs(c[0] - p[0]) + abs(c[1] - p[1]) for p in pts))
        pts.append(nxt)
    return pts

R_ENTER = {}

def fix_arrivals(out):
    """จุดมาถึง (tt) ต้องห่างทางออกของโซนปลายทางอย่างน้อย 3 ช่อง และไม่ทับทางออก — ย้ายไปช่องใกล้ที่สุดที่ปลอดภัย"""
    names = {v[0]: k for k, v in ZONES.items()}
    for a in ZONES:
        for e in out[a]['exits']:
            if e.get('ext') or e['to'] not in names: continue
            b = names[e['to']]
            occupied = [(x['x'], x['y']) for x in out[b]['exits']]
            tx, ty = e['tt']
            def safe(p): return all(max(abs(p[0] - ox), abs(p[1] - oy)) >= 3 for ox, oy in occupied)
            if out[b]['keep'][ty, tx] and safe((tx, ty)):
                continue
            pts = [(int(x), int(y)) for y, x in np.argwhere(out[b]['keep']) if safe((int(x), int(y)))]
            if not pts: continue
            e['tt'] = min(pts, key=lambda p: abs(p[0] - tx) + abs(p[1] - ty))
    for k in ZONES:
        arr = out[k]['arr']
        occupied = [(x['x'], x['y']) for x in out[k]['exits']]
        safe_arr = [t for t in arr if all(max(abs(t[0] - ox), abs(t[1] - oy)) >= 3 for ox, oy in occupied)]
        if not safe_arr:
            pts = [(int(x), int(y)) for y, x in np.argwhere(out[k]['keep']) if all(max(abs(x - ox), abs(y - oy)) >= 3 for ox, oy in occupied)]
            safe_arr = [min(pts, key=lambda p: abs(p[0] - (out[k]['start'] or (0, 0))[0]) + abs(p[1] - (out[k]['start'] or (0, 0))[1]))] if pts else []
        out[k]['start'] = safe_arr[0] if safe_arr else out[k]['start']

def visible_art(R, F, k):
    """ภาพของโซน: ซ่อนเศษทางที่ไม่ต่อกับส่วนที่เดินได้ (ไม่ให้ลอยเป็นเกาะเล็ก ๆ บนพื้นว่าง)"""
    cm = R['cms'][k].reshape(ROWS, T, COLS, T).mean(axis=(1, 3)) >= .5
    keep = F[k]['keep']
    seen = keep.copy()
    q = deque((int(x), int(y)) for y, x in zip(*np.nonzero(keep)))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and cm[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((nx, ny))
    vis = np.kron(seen.astype(np.uint8), np.ones((T, T), np.uint8)).astype(bool)
    mask = Image.fromarray((vis * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    alpha = np.asarray(mask).astype(float)[..., None] / 255
    art = np.asarray(R['arts'][k]).astype(float)
    return Image.fromarray(np.clip(art * alpha + VOID * (1 - alpha), 0, 255).astype(np.uint8))

def write_outputs(R, F):
    ensure_reciprocal(F)
    fix_arrivals(F)
    rows_all = {}
    spawn_all = {}
    for k in ZONES:
        zi, name = ZONES[k]
        keep, exits, start = F[k]['keep'], F[k]['exits'], F[k]['start']
        E = {(e['x'], e['y']) for e in exits}
        rows = []
        for y in range(ROWS):
            rows.append(''.join('E' if (x, y) in E else ('.' if keep[y, x] else '#') for x in range(COLS)))
        rows_all[zi] = rows
        avoid = list(E) + [(t['tt'][0], t['tt'][1]) for t in exits]
        spec = SPAWNS.get(zi, [])
        pts = pick_spawns(keep, start, avoid, len(spec))
        spawn_all[zi] = [dict(type=t, tx=p[0], ty=p[1], count=c) for (t, c), p in zip(spec, pts)]
        if zi == 'mine_plaza':
            bt, bn, _ = BOSS_ZONE
    os.makedirs(os.path.join(ROOT, 'assets/maps'), exist_ok=True)
    for k in ZONES:
        zi = ZONES[k][0]
        open(os.path.join(ROOT, 'assets/maps', zi + '.mask.txt'), 'w').write('\n'.join(rows_all[zi]) + '\n')
        os.makedirs(os.path.join(ROOT, 'game/maps'), exist_ok=True)
        R['arts'][k] = visible_art(R, F, k)
        R['arts'][k].save(os.path.join(ROOT, 'game/maps', zi + '.webp'), 'WEBP', quality=82, method=6)
    meta = {}
    for k in ZONES:
        zi, name = ZONES[k]
        ex = []
        for e in F[k]['exits']:
            dest_name = {v[0]: v[1] for v in ZONES.values()}.get(e['to'], e['to'])
            label = dest_name if not e.get('ext') else {'rainforest': 'ลำธารและป่าดิบชื้น', 'field2': 'ทุ่งน้ำตก', 'peak': 'ยอดเขาทะเลหมอก'}[e['to']]
            ex.append(dict(x=e['x'], y=e['y'], w=1, h=1, to=e['to'], tx=e['tt'][0], ty=e['tt'][1], label=label))
        st = F[k]['start']
        meta[zi] = dict(id=zi, name=name, exits=ex, spawns=spawn_all[zi], start=[st[0], st[1]] if st else [2, 2])
    # จุดมาถึงจากแผนที่อื่น: ให้อยู่ใกล้ทางออกที่ต่อไปยังแผนที่นั้น (ไม่ทับทางออก)
    enter = {}
    for k in ZONES:
        keep = F[k]['keep']
        occ = [(e['x'], e['y']) for e in F[k]['exits']]
        for e in F[k]['exits']:
            if not e.get('ext'): continue
            if e['to'] in enter: continue
            ys_, xs_ = np.nonzero(keep)
            cand = [(int(x), int(y)) for y, x in zip(ys_, xs_) if all(max(abs(x - ox), abs(y - oy)) >= 3 for ox, oy in occ)]
            if cand:
                t = min(cand, key=lambda c: abs(c[0] - e['x']) + abs(c[1] - e['y']))
                enter[e['to']] = [ZONES[k][0], t[0], t[1]]
    for d, (k, t) in R['enter'].items():
        if t and d not in enter: enter[d] = [ZONES[k][0], t[0], t[1]]
    meta['_enter'] = enter
    # บอสประจำถ้ำเดิม (ตำแหน่งเดิม 28,15) → ย้ายไปจุดเดินได้ในลานหินกลางที่ใกล้ที่สุด
    bk = {v[0]: k for k, v in ZONES.items()}[BOSS_ZONE[0]]
    bz_tl = R['tl'][15, 28]
    if bz_tl:
        zi_b = ZONES[bz_tl][0]
        ez = to_zoom(R['convs'][bz_tl], 28 * T + T // 2, 15 * T + T // 2)
        keep_b = F[bz_tl]['keep']
        ys_, xs_ = np.nonzero(keep_b)
        if len(xs_):
            i_ = int(np.argmin(np.abs(xs_ - ez[0]) + np.abs(ys_ - ez[1])))
            meta['_boss'] = dict(zone=zi_b, tx=int(xs_[i_]), ty=int(ys_[i_]), type=BOSS_ZONE[1])
    for k in ZONES:   # จุดเริ่มของโซน = จุดมาถึงจากแผนที่อื่น (ถ้ามี)
        for d, (zi_, x_, y_) in enter.items():
            if zi_ == ZONES[k][0]:
                F[k]['start'] = (x_, y_); meta[ZONES[k][0]]['start'] = [x_, y_]; break
    for k in ZONES:   # จุดเกิดคำนวณใหม่หลังจุดเริ่มสุดท้าย (ห่างจุดเริ่มอย่างน้อย 9 ช่อง ไม่ให้มอนสเตอร์เข้าหาทันที)
        zi = ZONES[k][0]
        avoid = [(e['x'], e['y']) for e in F[k]['exits']] + [tuple(t) for t in F[k]['arr']]
        spec = SPAWNS.get(zi, [])
        pts = pick_spawns(F[k]['keep'], tuple(F[k]['start']), avoid, len(spec))
        meta[zi]['spawns'] = [dict(type=t, tx=p[0], ty=p[1], count=c) for (t, c), p in zip(spec, pts)]
    json.dump(meta, open(os.path.join(ROOT, 'tools/mine_split.json'), 'w'), ensure_ascii=False, indent=1)
    return meta, rows_all

def evidence(R, rows_all):
    W = 512; H = 341; sheet = Image.new('RGB', (W * 3, H * 2), (10, 10, 12))
    for n, k in enumerate(ZONES):
        zi = ZONES[k][0]
        im = R['arts'][k].convert('RGBA'); d = ImageDraw.Draw(im, 'RGBA')
        for y, r in enumerate(rows_all[zi]):
            for x, ch in enumerate(r):
                if ch == '.': d.rectangle((x * T, y * T, x * T + T - 1, y * T + T - 1), fill=(255, 0, 255, 60))
                if ch == 'E': d.rectangle((x * T, y * T, x * T + T - 1, y * T + T - 1), fill=(0, 255, 255, 150))
        d.text((12, 10), zi, fill=(255, 255, 0, 255))
        sheet.paste(im.convert('RGB').resize((W, H)), ((n % 3) * W, (n // 3) * H))
    os.makedirs(os.path.join(ROOT, 'docs/evidence'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'docs/evidence/map_mine_split.png'))

if __name__ == '__main__':
    R = build()
    R_ENTER.update(R['enter'])
    F = finalize(R)
    meta, rows_all = write_outputs(R, F)
    evidence(R, rows_all)
    for k in ZONES:
        zi = ZONES[k][0]
        print(zi, 'เดินได้', int(F[k]['keep'].sum()), 'ทางออก', [(e['x'], e['y'], e['to']) for e in F[k]['exits']], 'จุดเริ่ม', F[k]['start'], 'จุดเกิด', [(s_['type'], s_['tx'], s_['ty']) for s_ in meta[zi]['spawns']])
    print('มาจากแผนที่อื่น', meta['_enter'])
