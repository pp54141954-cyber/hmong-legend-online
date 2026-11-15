#!/usr/bin/env python3
"""รุ่นของไฟล์สปริต (V2-R63): ใส่แฮชของ game/sprites/*.webp ลงใน game/index.html เป็น ASSET_V
ทุกครั้งที่โหลดสปริตจะต่อ URL ด้วย ?v=ASSET_V (เช่น sprites/pcl_assassin_m.webp?v=ab12...)
→ เมื่อไฟล์เปลี่ยน URL ก็เปลี่ยน เครื่องที่แคชไฟล์เก่าไว้จะดึงไฟล์ใหม่ทันที (เซิร์ฟเวอร์ส่ง max-age 1 วันจึงต้องทำแบบนี้)
เรียกอัตโนมัติจาก tools/build_class_bodies.py และ tools/build_attack4.py
รัน: python3 tools/asset_version.py"""
import glob, hashlib, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def stamp():
    h = hashlib.sha1()
    for f in sorted(glob.glob(os.path.join(ROOT, 'game/sprites/*.webp'))):
        h.update(os.path.basename(f).encode()); h.update(open(f, 'rb').read())
    v = h.hexdigest()[:10]
    p = os.path.join(ROOT, 'game/index.html')
    s = open(p, encoding='utf-8').read()
    s, n = re.subn(r"const ASSET_V='[^']*';/\*ASSET_V\*/", lambda m: "const ASSET_V='%s';/*ASSET_V*/" % v, s, count=1)
    if n != 1: raise SystemExit('ไม่พบจุดฝัง ASSET_V ใน game/index.html')
    open(p, 'w', encoding='utf-8').write(s)
    print('ASSET_V', v)
    return v

if __name__ == '__main__':
    stamp()
