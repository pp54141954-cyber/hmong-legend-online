#!/usr/bin/env python3
"""สร้างแผนที่หมู่บ้านกางเขา (village2) จากชุดกระเบื้อง Kenney Tiny Town (CC0)

- ผังชน (มาสก์) คำนวณจากชนิดกระเบื้องที่วางจริง: ต้นไม้ พุ่มไม้ หิน กำแพง หลังคา รั้ว = ปิดทาง; หญ้า ทาง ลาน = เดินได้
- ใช้แม่แบบผังเดิม (assets/maps_src/village2_r74_mask.json) เพื่อให้ทางออกด้านล่างและจุดเกิดยังอยู่ที่เดิม
- ลานกลางหมู่บ้านและพื้นที่เริ่มต้นถูกล็อกให้เดินได้เสมอ, ตรวจว่าจุดเกิด ร้านค้า และทางออกเชื่อมถึงกัน
- ผลลัพธ์กำหนดได้แน่นอน (seed เดียวกัน) ทุกครั้งที่รัน

รัน: python3 tools/build_village2_tinytown.py            (เขียนไฟล์ใน assets/maps_src)
     python3 tools/build_village2_tinytown.py --install  (คัดลอกเข้า game/maps และฝังผังชนใน game/index.html)
"""
import json, os, random, shutil, sys
from collections import Counter, deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, 'assets/third_party/kenney-tiny-town/Tiles')
SRC = os.path.join(ROOT, 'assets/maps_src')
W, H = 48, 32
EXITS = [(x, 31) for x in range(23, 28)]        # ทางออกไป field2 (ต้องคงไว้)
START, NPC, LANDING = (24, 20), (22, 22), (25, 29)
PLAZA_BOX = [(x, y) for y in range(13, 19) for x in range(20, 29)]   # ลานกลางหมู่บ้าน (เดินได้เสมอ)
WALK = {'GRASS', 'FLOWER', 'PATH', 'PLAZA'}
GREEN = [4, 5, 16, 28, 6, 7, 8, 18, 19, 20, 30, 31, 32]
AUTUMN = [9, 11, 15, 27, 21, 22, 23, 33, 34, 35, 10]
ROLE_TILES = {'GRASS': [0, 0, 0, 1], 'FLOWER': [2, 2, 17, 29], 'PATH': [25, 25, 40, 41, 42], 'PLAZA': [43],
              'ROCK': [92, 111, 112, 113, 114, 126], 'WALL': [72, 73, 75], 'ROOF': [52, 53, 54], 'FENCE': [44, 45, 46]}
POLY = [(24, 31), (25, 29), (24, 25), (24, 20)]   # เส้นทางหลักจากทางออกถึงจุดเกิด


def build(out_dir):
    template = json.load(open(os.path.join(SRC, 'village2_r74_mask.json'), encoding='utf-8'))
    walk_old = [[c != '#' for c in row] for row in template]
    rng = random.Random(751)
    centers = [(rng.randrange(W), rng.randrange(H), i % 2) for i in range(7)]

    def palette_at(x, y):
        best = min(centers, key=lambda c: (c[0] - x) ** 2 + (c[1] - y) ** 2)
        return GREEN if best[2] == 0 else AUTUMN

    def near_poly(x, y, r=1):
        for (ax, ay), (bx, by) in zip(POLY, POLY[1:]):
            for t in range(0, 101, 4):
                px, py = ax + (bx - ax) * t / 100, ay + (by - ay) * t / 100
                if abs(px - x) <= r and abs(py - y) <= r:
                    return True
        return False

    def reach(grid, start=START):
        seen = {start}; q = deque([start])
        while q:
            cx, cy = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and grid[ny][nx] in WALK:
                    seen.add((nx, ny)); q.append((nx, ny))
        return seen

    def ok(grid):
        r = reach(grid)
        return all(e in r for e in EXITS) and LANDING in r and NPC in r

    def near_key(x, y, d):
        if near_poly(x, y, d):
            return True
        return max(abs(x - START[0]), abs(y - START[1])) <= 3 or max(abs(x - NPC[0]), abs(y - NPC[1])) <= 2

    role = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if not walk_old[y][x]:
                role[y][x] = 'ROCK' if rng.random() < 0.05 else ('TREE' if rng.random() < 0.6 else 'BUSH')
    for y in range(H):
        for x in range(W):
            if (x, y) in PLAZA_BOX:
                role[y][x] = 'PLAZA' if max(abs(x - START[0]), abs(y - START[1])) <= 2 else 'GRASS'
                continue
            if not walk_old[y][x]:
                continue
            if (x, y) in EXITS or near_poly(x, y, 1):
                role[y][x] = 'PATH'
            elif max(abs(x - START[0]), abs(y - START[1])) <= 2:
                role[y][x] = 'PLAZA'
            else:
                role[y][x] = 'FLOWER' if rng.random() < 0.05 else 'GRASS'
    assert ok(role), 'ผังเริ่มต้นต้องเชื่อมถึงกัน'
    houses = 0
    for y in range(2, H - 4):
        for x in range(2, W - 4):
            if houses >= 6:
                break
            cells = [(x + i, y + j) for i in range(3) for j in range(2)]
            if any((cx, cy) in PLAZA_BOX for cx, cy in cells):
                continue
            if not all(walk_old[cy][cx] and role[cy][cx] in ('GRASS', 'FLOWER') and not near_key(cx, cy, 3) for cx, cy in cells):
                continue
            prev = [role[cy][cx] for cx, cy in cells]
            for cx, cy in cells:
                role[cy][cx] = 'ROOF' if cy == y else 'WALL'
            if ok(role):
                houses += 1
            else:
                for (cx, cy), p in zip(cells, prev):
                    role[cy][cx] = p
    cands = [(x, y) for y in range(H) for x in range(W)
             if walk_old[y][x] and role[y][x] in ('GRASS', 'FLOWER') and not near_key(x, y, 2) and (x, y) not in PLAZA_BOX]
    rng.shuffle(cands)
    for (x, y) in cands:
        if rng.random() > 0.10:
            continue
        prev = role[y][x]
        role[y][x] = rng.choice(['TREE', 'BUSH'])
        if not ok(role):
            role[y][x] = prev

    cache = {}
    def tile(i):
        if i not in cache:
            cache[i] = Image.open(os.path.join(TILES, 'tile_%04d.png' % i)).convert('RGBA').resize((32, 32), Image.NEAREST)
        return cache[i]
    img = Image.new('RGBA', (W * 32, H * 32), (0, 0, 0, 255))
    for y in range(H):
        for x in range(W):
            r = role[y][x]; px = (x * 32, y * 32)
            if r in ('TREE', 'BUSH'):
                img.alpha_composite(tile(0), px); img.alpha_composite(tile(rng.choice(palette_at(x, y))), px)
            elif r in ('ROCK', 'WALL', 'ROOF', 'FENCE', 'FLOWER'):
                img.alpha_composite(tile(0), px); img.alpha_composite(tile(rng.choice(ROLE_TILES[r])), px)
            else:
                img.alpha_composite(tile(rng.choice(ROLE_TILES[r])), px)
    os.makedirs(out_dir, exist_ok=True)
    img.convert('RGB').save(os.path.join(out_dir, 'village2_tinytown.png'))
    mask = [''.join('E' if (x, y) in EXITS else ('.' if role[y][x] in WALK else '#') for x in range(W)) for y in range(H)]
    json.dump(mask, open(os.path.join(out_dir, 'village2_tinytown.mask.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('ตึก', houses, '| ต้นไม้เพิ่ม', 'ตามกติกา', '| ลานเดินได้:', all(role[y][x] in WALK for x, y in PLAZA_BOX))
    print('กระเบื้องแต่ละชนิด:', dict(Counter(r for row in role for r in row)))
    return mask


def install(mask):
    game = os.path.join(ROOT, 'game/maps/village2.webp')
    shutil.copy(game, os.path.join(SRC, 'village2_before_tinytown.webp'))
    Image.open(os.path.join(SRC, 'village2_tinytown.png')).convert('RGB').save(game, 'WEBP', lossless=True, method=6)
    path = os.path.join(ROOT, 'game/index.html')
    s = open(path, encoding='utf-8').read()
    key = '"village2":['
    assert s.count(key) == 1, 'ไม่พบผังชนของ village2 ใน game/index.html'
    i = s.index(key) + len(key) - 1
    j = s.index(']', i)
    s = s[:i] + json.dumps(mask, ensure_ascii=False) + s[j + 1:]
    open(path, 'w', encoding='utf-8').write(s)
    print('ติดตั้งแล้ว: game/maps/village2.webp และผังชนใน game/index.html (ต้องรัน node tools/extract-shared.js ต่อ)')


if __name__ == '__main__':
    out = SRC
    if '--out' in sys.argv:
        out = sys.argv[sys.argv.index('--out') + 1]
    mask = build(out)
    if '--install' in sys.argv:
        install(mask)
