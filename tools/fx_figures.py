"""ลบหุ่นในตารางท่าสกิล (V2-R52): หุ่นผู้ใช้สกิล หุ่นเป้า และส่วนของหุ่นที่ถูกแสงสาดจนมีสี
ใช้ร่วมกันโดย build_skill_fx.py
- grey(cell,bg): พิกเซลสีเทา (ตัวหุ่น) ที่ต่างจากพื้นหลัง
- silhouettes(mask): ปิดช่องว่าง + เติมรู → เงาหุ่นทั้งตัว (รวมส่วนที่ถูกแสงสาดภายในตัว) เก็บเฉพาะก้อนใหญ่
- targets(ready,bg,caster_x): เงาหุ่นเป้าในช่อง READY (ทุกก้อนที่ไม่ใช่ผู้ใช้สกิล) → ใช้ลบออกจากทุกช่องในแถว"""
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def _f(m, flt):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(flt)) > 127

def dilate(m, r): return _f(m, ImageFilter.MaxFilter(2 * r + 1)) if r else m
def erode(m, r): return _f(m, ImageFilter.MinFilter(2 * r + 1)) if r else m

def fill_holes(m):
    p = np.pad(m, 1).astype(np.uint8) * 255; im = Image.fromarray(p).copy(); ImageDraw.floodfill(im, (0, 0), 128)
    return (np.array(im) != 128)[1:-1, 1:-1]

def grey(cell, bg):
    a = cell.astype(int); lum = a.mean(2); sat = a.max(2) - a.min(2); d = np.abs(a - bg[None, None, :]).sum(2)
    lo = 12 if float(np.mean(bg)) > 50 else 40               # พื้นสว่าง (ตารางนักดาบ) หุ่นเป็นสีเข้ม
    g = (sat < 34) & (lum > lo) & (lum < 228) & (d > 40)
    g[:6] = g[-6:] = False; g[:, :6] = g[:, -6:] = False      # เส้นกรอบตาราง
    return g

def components(m, mn):
    h, w = m.shape; lab = np.zeros((h, w), np.int32); out = []; n = 0
    ys, xs = np.nonzero(m)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]: continue
        n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n; pts = []
        while q:
            y, x = q.popleft(); pts.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
        if len(pts) >= mn:
            c = np.zeros((h, w), bool); yy, xx = zip(*pts); c[list(yy), list(xx)] = True; out.append(c)
    return out

def silhouettes(m, close=4, mn=250):
    m = erode(dilate(m, close), close)
    comps = components(m, mn)
    out = np.zeros(m.shape, bool)
    for c in comps:
        f = fill_holes(c)
        if f.mean() < .35: out |= f                            # ก้อนใหญ่ผิดปกติ (เส้นกรอบ/พื้น) ไม่ใช่หุ่น
    return out, comps

def targets(ready, bg, caster_x):
    _, comps = silhouettes(grey(ready, bg))
    out = np.zeros(ready.shape[:2], bool)
    for c in comps:
        xs = np.nonzero(c.any(0))[0]
        f = fill_holes(c)
        if xs.min() > caster_x + 25 and f.mean() < .35: out |= f
    return out

def nonbg(cell, bg):
    return np.abs(cell.astype(int) - bg[None, None, :]).sum(2) > 45

def match_targets(cell, bg, tmpls, dys=range(-10, 11, 2)):
    """หาหุ่นเป้า (แม่แบบจากช่อง READY) ในช่องนี้: เลื่อนหาตำแหน่งที่รูปร่างตรงกันมากที่สุด
    คะแนน = ส่วนในแม่แบบที่เป็นวัตถุ − ส่วนของวงรอบแม่แบบที่เป็นวัตถุ (หุ่นยืนเดี่ยว ๆ รอบตัวเป็นพื้นหลัง)"""
    N = nonbg(cell, bg); H, W = N.shape; out = np.zeros((H, W), bool); found = []
    for T in tmpls:
        ys, xs = np.nonzero(T); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        t = T[y0:y1, x0:x1]; ring = dilate(np.pad(t, 6), 5) & ~dilate(np.pad(t, 6), 1); th, tw = t.shape; nt, nr = t.sum(), ring.sum()
        Np = np.pad(N, 6); best = (-1, 0, 0)
        for dy in dys:
            yy = y0 + dy
            if yy < 0 or yy + th > H: continue
            for xx in range(0, W - tw + 1, 2):
                sc = (Np[yy + 6:yy + 6 + th, xx + 6:xx + 6 + tw] & t).sum() / nt
                if sc < .6: continue
                rc = (Np[yy:yy + th + 12, xx:xx + tw + 12] & ring).sum() / nr
                v = sc - rc
                if v > best[0]: best = (v, yy, xx)
        found.append(best)
        if best[0] > .3:
            m = np.zeros((H, W), bool); m[best[1]:best[1] + th, best[2]:best[2] + tw] = t; out |= dilate(m, 3)
    return out, found

def target_templates(ready, bg):
    """แม่แบบหุ่นเป้าในช่อง READY: แบ่งตามช่วงคอลัมน์ที่มีพิกเซลเทาหนาแน่น (ตัดเส้นบาง ๆ ที่เชื่อมหุ่น) — ช่วงแรกคือผู้ใช้สกิล ที่เหลือคือหุ่นเป้า"""
    g = grey(ready, bg); xs = np.where(g.sum(0) > 6)[0]
    if not len(xs): return []
    runs, run = [], [xs[0]]
    for x in xs[1:]:
        if x - run[-1] <= 4: run.append(x)
        else: runs.append(run); run = [x]
    runs.append(run); runs = [r for r in runs if r[-1] - r[0] >= 18]
    out = []
    for r in runs[1:]:
        m = np.zeros(g.shape, bool); m[:, r[0]:r[-1] + 1] = g[:, r[0]:r[-1] + 1]
        sil, _ = silhouettes(m, mn=150)
        if sil.any(): out.append(sil)
    return out

def grow_pale(fig, cell, bg, n=45, sat_max=60):
    """ขยายเงาหุ่นเข้าไปในพิกเซลสีซีดที่ต่อกัน (ใบดาบ/มีด/คันธนูที่หุ่นถือ) — แสงเอฟเฟกต์มีสีจัดจึงไม่ถูกกิน"""
    a = cell.astype(int); pale = ((a.max(2) - a.min(2)) < sat_max) & nonbg(cell, bg)
    m = fig.copy()
    for _ in range(n):
        nm = dilate(m, 1) & (pale | m)
        if (nm == m).all(): break
        m = nm
    return m

def strong_only(out, oc_min=.3, om_min=50, core=170):
    """หลังลบสีพื้น: เก็บเฉพาะแสงสีจัด + แกนสว่างที่ติดแสงสีจัด (ตัด ขอบอาวุธ/ตัวละครสีซีดที่หลุดมา)"""
    from PIL import ImageFilter
    om = out.max(2).astype(float); oc = (om - out.min(2)) / np.maximum(om, 1); strong = (oc > oc_min) & (om > om_min)
    nearS = np.asarray(Image.fromarray((strong * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
    out = out.copy(); out[~(strong | (nearS & (om > core)))] = 0
    return out
