#!/usr/bin/env python3
"""ใส่ผลการแบ่งถ้ำ (tools/mine_split.json จาก build_mine_split.py) ลงใน game/index.html (V2-R58)
- แทนโซน mine เดิมด้วย 6 โซน (mine_camp, mine_tunnel, mine_plaza, mine_station, mine_river, mine_cliff)
- แก้ทางออกของทุ่งน้ำตก/ป่าดิบชื้น/ยอดเขาที่เคยไปถ้ำเดิม ให้ไปโซนใหม่ที่ถูกต้อง
- ย้ายบอส มังกรภูเขาดำ ไปลานหินกลาง; อัปเดตลำดับแผนที่โลก
รัน: python3 tools/build_mine_split.py && python3 tools/apply_mine_split.py && python3 tools/embed_maps.py && node tools/extract-shared.js
(apply อ่านไฟล์เกมจาก HEAD ของ git — ต้อง commit ไฟล์เกมก่อนรันซ้ำ หรือเปลี่ยนเป็นไฟล์สำรองที่ต้องการ)
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'game/index.html')
M = json.load(open(os.path.join(ROOT, 'tools/mine_split.json'), encoding='utf-8'))
ENTER = M.pop('_enter'); BOSS = M.pop('_boss')
ORDER = ['mine_camp', 'mine_tunnel', 'mine_plaza', 'mine_river', 'mine_station', 'mine_cliff']
T_ = '32'

def jstr(v):
    return "'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'"

def zone_js(zid):
    z = M[zid]
    ex = ','.join("{x:%d,y:%d,w:1,h:1,to:%s,tx:%d,ty:%d,label:%s}" % (e['x'], e['y'], jstr(e['to']), e['tx'], e['ty'], jstr(e['label'])) for e in z['exits'])
    sp = ','.join("{type:%s,tx:%d,ty:%d,count:%d}" % (jstr(s['type']), s['tx'], s['ty'], s['count']) for s in z['spawns'])
    sx, sy = z['start']
    return (" %s:{name:%s,painted:%s,safe:()=>false,treeEdge:0,treeIn:0,sakura:0,keepTrees:1,\n"
            "  layout(A){A.mask(MAP_MASKS.%s)},border(){},stairs:[],\n"
            "  exits:[%s],\n"
            "  objects(){},\n"
            "  spawns:[%s],start:[%d.5*T,%d.5*T]},\n") % (zid, jstr(z['name']), jstr(zid), zid, ex, sp, sx, sy)

# เริ่มจากไฟล์เกมที่ commit ไว้ล่าสุด (V2-R57) ทุกครั้ง ทำให้รันซ้ำได้โดยไม่ซ้อนกัน
import subprocess
s = subprocess.run(['git', '-C', ROOT, 'show', 'HEAD:game/index.html'], capture_output=True, check=True).stdout.decode('utf-8')
# 1) โซนถ้ำ: แทนบล็อก mine เดิม
a = s.index("\n mine:{name:'ถ้ำและภูเขาหิน'")
b = s.index("\n peak:{name:", a)
blocks = "/* ===== ถ้ำแบ่งเป็น 6 โซนตามวงที่เจ้าของทำเครื่องหมาย (V2-R58) — สร้างโดย tools/build_mine_split.py + apply_mine_split.py ===== */\n" + ''.join(zone_js(z) for z in ORDER)
s = s[:a] + "\n" + blocks + s[b + 1:]
# 2) ทางออกจากโซนอื่นเข้าถ้ำ
def rep(old, new, count=1):
    global s
    n = s.count(old); assert n == count, (old[:60], n)
    s = s.replace(old, new)
rep("{x:7,y:3,w:2,h:1,to:'mine',tx:2,ty:29,label:'mine'}",
    "{x:7,y:3,w:2,h:1,to:'mine_river',tx:%d,ty:%d,label:'ลำธารเหมือง'}" % tuple(ENTER['field2'][1:]))
rep("to:'mine',tx:2,ty:11,label:'mine'}",
    "to:'mine_camp',tx:%d,ty:%d,label:'ค่ายเหมืองบน'}" % tuple(ENTER['rainforest'][1:]), count=2)
rep("{x:0,y:16,w:1,h:2,to:'mine',tx:45,ty:14,label:'mine'}",
    "{x:0,y:16,w:1,h:2,to:'mine_station',tx:%d,ty:%d,label:'สถานีรถแร่'}" % tuple(ENTER['peak'][1:]))
# 3) บอส + แผนที่โลก
rep("  mine:[{type:'มังกรภูเขาดำ',tx:28,ty:15,when:'always'}],",
    "  mine_plaza:[{type:%s,tx:%d,ty:%d,when:'always'}]," % (jstr(BOSS['type']), BOSS['tx'], BOSS['ty']))
rep("const WORLD_ORDER=['village2','field2','field','bamboo','rainforest','mine','peak'];",
    "const WORLD_ORDER=['village2','field2','field','bamboo','rainforest','mine_camp','mine_tunnel','mine_plaza','mine_river','mine_station','mine_cliff','peak'];")
open(GAME, 'w', encoding='utf-8').write(s)
print('ok: โซนถ้ำ', ORDER, 'บอส', BOSS['tx'], BOSS['ty'])
