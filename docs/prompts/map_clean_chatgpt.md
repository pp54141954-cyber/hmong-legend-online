# ชุดคำสั่งสร้างภาพแผนที่ "สะอาด" สำหรับใช้ในเกม

ใช้กับภาพแบบ `assets/design_refs/09_village_walkpath_model.jpg` และ `10_monster_field_concept.png`
แนบภาพแบบทุกครั้ง แล้วคัดลอกคำสั่งไปวาง ส่งภาพที่ได้กลับมาเป็น PNG

## 1) หมู่บ้าน — ภาพพื้นแผนที่สะอาด

```
Recreate the attached village map as a clean in-game background.
Keep EXACTLY the same layout, buildings, paths, stairs, bridge, waterfall, river, fences, farm and plaza in the same positions, same camera angle and same pixel art style.
REMOVE everything that is not part of the world: all text labels, the legend box, the mini map, yellow dots, red collision boxes and outlines, green path lines and arrows.
No characters, no monsters, no UI.
Make it as large and sharp as possible (landscape, 3:2).
```

## 2) หมู่บ้าน — ภาพหลังคา/สิ่งที่บังตัวละคร (ถ้าทำได้)

ใช้วาดทับตัวละครตอนเดินหลังบ้าน (ไม่มีก็ได้ ผมตัดจากภาพข้อ 1 เองได้)

```
Using the same clean village image, keep only the parts that should appear IN FRONT of a character walking behind them: roofs, tree canopies, tall banners and the top of the waterfall. Make everything else fully transparent. Same size and position, transparent PNG.
```

## 3) ทุ่งมอนสเตอร์ — ภาพพื้นแผนที่สะอาด

```
Recreate the attached monster field map as a clean in-game background.
Keep EXACTLY the same layout: cliffs, terraces, dirt paths, stairs, rope bridge, waterfalls, river, trees, rocks, the cave entrance and the stone portal, same camera angle and same pixel art style.
REMOVE all creatures and monsters (wolves, boars, rabbits, goblins, bull, tiger, bear, golem, ghost, tree spirit). Fill those spots with matching ground.
No text, no UI. Make it as large and sharp as possible (landscape, 3:2).
```

## 4) ทุ่งมอนสเตอร์ — ภาพเส้นทางเดิน (ทำแบบเดียวกับหมู่บ้าน)

```
On the attached clean monster field map, draw a Walk Path Model overlay in the same style as the attached village example:
green for walkable ground, red boxes for obstacles (cliffs, water, trees, rocks), dashed green lines for main paths, yellow dots for key points: monster spawn areas, the cave entrance, the stone portal, the bridge and the exits. Same image size.
```

## ส่งกลับมาแล้วเกิดอะไรต่อ
1. ผมวางภาพสะอาดเป็นพื้นแผนที่ในเกม (ขยายให้ตัวละครสูงพอดีกับบ้าน)
2. วาดขอบเขตเดินได้/ไม่ได้ตามภาพ Walk Path Model ให้ทั้งเกมและเซิร์ฟเวอร์ใช้ชุดเดียวกัน
3. ตั้งจุดเกิดมอนสเตอร์ ทางเชื่อมโซน และจุดสำคัญตามจุดเหลือง
4. ส่งภาพในเกมให้คุณอนุมัติก่อนแทนแผนที่เดิม (แผนที่เดิมสำรองไว้)

---

# โซน 3–6 (สร้างใหม่ ใช้รูปแบบเดียวกับหมู่บ้าน)

ลำดับโซนตามแผน: หมู่บ้าน (เลเวล 1, ปลอดภัย) → ทุ่งมอนสเตอร์/นาขั้นบันได (1–10) → **ป่าไผ่และหุบเขา (10–20)** → **ลำธารและป่าดิบชื้น (20–30)** → **ถ้ำและภูเขาหิน (30–40)** → **ยอดเขาทะเลหมอก (40–50)**

ทุกโซนขอ 2 ภาพ: (ก) ภาพสะอาดสำหรับใช้ในเกม (ข) ภาพ Walk Path Model แบบเดียวกับหมู่บ้าน
แนบภาพหมู่บ้านทุกครั้งเพื่อให้สไตล์และมุมกล้องเหมือนกัน

## คำสั่ง (ก) — ภาพสะอาด

เปลี่ยน `[ZONE]` และ `[DETAILS]` ตามตารางด้านล่าง

```
Create a new game map in EXACTLY the same pixel art style, camera angle and scale as the attached village map.
Zone: [ZONE].
Contents: [DETAILS]
Layout rules: clear dirt or stone walking paths about the same width as the village paths, connecting all areas; an entrance path touching the LEFT edge of the image and an exit path touching the RIGHT edge (or TOP edge for the final zone); 4–6 open clearings along the paths where monsters can roam; cliffs, water, dense trees and rocks are obstacles.
No characters, no monsters, no text, no labels, no UI. Landscape 3:2, 1536x1024 or larger.
```

| โซน | `[ZONE]` | `[DETAILS]` |
| --- | --- | --- |
| 3 | Bamboo forest and valley (Hmong highlands, level 10–20) | dense bamboo groves, a small valley stream with stepping stones, a hunter's hut with drying racks, bamboo fences, herb patches, a stone shrine with red cloth |
| 4 | Stream and tropical rainforest (level 20–30) | a winding river with two wooden bridges, large rainforest trees with hanging vines, ferns, mossy rocks, a small waterfall pool, a rope bridge over a ravine |
| 5 | Cave and rocky mountain (level 30–40) | grey rocky terraces with carved stone stairs, glowing blue crystal clusters, a large dark cave entrance, mine carts and wooden supports, sparse pine trees, a stone golem statue |
| 6 | Misty mountain peak (level 40–50, final zone, bosses) | high mountain peak above a sea of clouds, snowy stone paths, an ancient Hmong-style stone altar with silver ornaments at the summit, prayer flags, twisted old pines, a wide flat arena for boss fights near the top |

## คำสั่ง (ข) — ภาพ Walk Path Model

```
On the attached clean map, draw a Walk Path Model overlay in the same style as the attached village example:
green for walkable ground, red boxes for obstacles, dashed green lines for main paths, yellow dots with short Thai labels for key points: entrance, exit, monster areas, boss arena, shrine/altar, bridges. Add a small legend. Same image size.
```
