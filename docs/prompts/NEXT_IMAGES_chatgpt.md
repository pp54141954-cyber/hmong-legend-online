# ภาพที่ต้องทำต่อ — ชุดคำสั่ง ChatGPT (คัดลอกวางได้เลย)

กติกาทุกข้อ:
- เปิดแชตใหม่ 1 แชตต่อ 1 ภาพ
- **แนบภาพแบบตามที่ระบุทุกครั้ง** เพื่อให้สไตล์และมุมกล้องเหมือนกัน
- ดาวน์โหลดเป็น PNG แล้วส่งกลับมาพร้อมบอกว่าเป็นข้อไหน (เช่น "A1", "B3")

---

## ชุด A — แผนที่สะอาดของ 2 โซนที่ใช้อยู่ (สำคัญที่สุด)

### A1 หมู่บ้าน
แนบ: `09_village_walkpath_model.jpg`

```
Recreate the attached village map as a clean in-game background, 1536x1024.
Keep EXACTLY the same layout, buildings, paths, stairs, bridge, waterfall, river, fences, farm and plaza in the same positions, same camera angle and same pixel art style.
REMOVE only these overlays: all text labels, the legend box, the mini map, yellow dots, red collision boxes and outlines, green path lines and arrows.
Keep ALL ground, grass, dirt paths, cliffs and water fully painted and bright across the whole image. Do not darken, blur or erase the middle. No characters, no monsters, no UI.
```

### A2 ทุ่งน้ำตก
แนบ: `11_field_walkpath_model.png`

```
Recreate the attached waterfall field map as a clean in-game background, 1536x1024.
Keep EXACTLY the same layout: cliffs, grass terraces, stairs, rope bridge, waterfall, river, trees, rocks, the cave entrance, the stone portal, the well hut and the farm, same positions, same camera angle and same pixel art style.
REMOVE only these overlays: red outlines, yellow dots, green dashed path lines.
Keep ALL ground, grass, dirt paths, cliffs and water fully painted and bright across the whole image. Do not darken, blur or erase the middle. No characters, no monsters, no text, no UI.
```

**ตรวจก่อนส่ง:** ภาพต้องสว่างทั้งภาพ ผังเหมือนเดิมทุกจุด ไม่มีเส้น จุด หรือตัวอักษร

---

## ชุด B — โซนใหม่ 4 โซน (โซนละ 2 ภาพ: สะอาด + เส้นทางเดิน)

แนบ: ภาพ A1 (หมู่บ้านสะอาด) หรือ `09_village_walkpath_model.jpg` ถ้ายังไม่มี

### คำสั่งภาพสะอาด — เปลี่ยน `[ZONE]` และ `[DETAILS]` ตามตาราง

```
Create a new game map, 1536x1024, in EXACTLY the same pixel art style, camera angle and scale as the attached village map.
Zone: [ZONE].
Contents: [DETAILS]
Layout rules: clear walking paths about the same width as the village paths, connecting every area; an entrance path touching the LEFT edge of the image and an exit path touching the RIGHT edge; 4 to 6 open clearings along the paths where monsters can roam; cliffs, water, dense trees and rocks are obstacles.
Keep the whole image fully painted and bright, no dark or empty areas. No characters, no monsters, no text, no labels, no UI.
```

| ข้อ | `[ZONE]` | `[DETAILS]` |
| --- | --- | --- |
| B1 | Bamboo forest and valley, Hmong highlands, level 10 to 20 | dense bamboo groves, a valley stream with stepping stones, a hunter's hut with drying racks, bamboo fences, herb patches, a small stone shrine with red cloth |
| B2 | Stream and tropical rainforest, level 20 to 30 | a winding river with two wooden bridges, huge rainforest trees with hanging vines, ferns, mossy rocks, a waterfall pool, a rope bridge over a ravine |
| B3 | Cave and rocky mountain, level 30 to 40 | grey rocky terraces with carved stone stairs, glowing blue crystal clusters, a large dark cave entrance, mine carts and wooden supports, sparse pine trees |
| B4 | Misty mountain peak, level 40 to 50, final zone | a high peak above a sea of clouds, snowy stone paths, an ancient Hmong-style stone altar with silver ornaments at the summit, prayer flags, twisted old pines, a wide flat arena for boss fights. Exit path touches the TOP edge instead of the right edge |

### คำสั่งภาพเส้นทางเดิน (ทำหลังได้ภาพสะอาด ในแชตเดิม)

```
On the clean map you just made, draw a Walk Path Model overlay in the same style as the attached village example:
green fill for walkable ground, red outlines around obstacles, dashed green lines for main paths, yellow dots for key points: entrance, exit, monster clearings, boss arena, shrine or altar, bridges. Same image size, same map underneath.
```

---

## ชุด C — ภาพมอนสเตอร์ที่ยังขาด

แนบ: `08_monsters14_bosses6_animset.png` และใช้คำสั่งใน `monster_sprites_chatgpt.md` (คำสั่งที่ 1 = เดิน 4 ทิศ, คำสั่งที่ 2 = โจมตี/รับดาเมจ/ตาย/ยืน)

| ข้อ | ตัว | ต้องทำ | ลักษณะ (ใส่ใน `[DESCRIPTION]`) |
| --- | --- | --- | --- |
| C1 | กระทิงผี `ghost_bull` | คำสั่งที่ 1 (เดิน) | a ghost bull with dark navy-black hide, large curved pale horns, purple ghostly flames rising from its shoulders, glowing eyes |
| C2 | กระต่ายมีเขา `horned_rabbit` | คำสั่งที่ 2 (ท่า) | a horned rabbit with white fur and light brown patches, long ears, small branching antlers, red eyes |
| C3 | บอส วิญญาณแห่งป่า `boss_forest_spirit` | คำสั่งบอส 1 + คำสั่งที่ 2 | a majestic forest spirit stag with mossy green-teal fur, huge glowing cyan crystal antlers, glowing patterns on its body |
| C4 | บอส เทพหมาป่าภูเขา `boss_mountain_wolf_god` | คำสั่งบอส 1 + คำสั่งที่ 2 | a giant white wolf god with thick fur, glowing blue markings and a cold blue aura, fierce blue eyes |
| C5 | บอส มังกรภูเขาดำ `boss_black_mountain_dragon` | คำสั่งบอส 1 + คำสั่งที่ 2 | a black mountain dragon with dark grey scales, large purple bat-like wings, horns and glowing eyes, four legs |
| C6 | บอส 3 ตัวที่มีท่าเดินแล้ว (ราชาปีศาจ, หมาป่าศักดิ์สิทธิ์, มังกรหุบเขาหมอก) | คำสั่งที่ 2 (ท่า) | ใช้ลักษณะเดิมจากตารางบอส |

**ต่อท้ายทุกคำสั่งในชุด C:**
```
The background must be fully transparent (or plain solid white). No glow, aura or smoke outside the body. No text.
```

---

## ลำดับที่แนะนำ
1. A1, A2 — เกมเห็นผลทันที (เอาเส้นและป้ายออกจากแผนที่ที่ใช้อยู่)
2. B1 — เปิดโซนถัดไปต่อจากปากถ้ำ/ประตูหิน
3. C1, C2 — เติมท่าที่ขาดของมอนสเตอร์ที่อยู่ในเกมแล้ว
4. B2–B4 และ C3–C6 — ใช้ตอนทำระบบบอส
