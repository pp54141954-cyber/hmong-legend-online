# ชุดคำสั่งทำโซนถ้ำ 6 โซน (สำหรับ ChatGPT)

ใช้ทำภาพแผนที่ของ 6 โซนถ้ำ ที่แบ่งจากแผ่นที่ของเจ้าของตามวงที่ทำเครื่องหมายไว้ และขยายพื้นที่ของแต่ละโซนให้เต็มภาพ โดยให้สไตล์เหมือนแผ่นที่ใหม่
ทำโซนละ 2 ภาพ รวม 12 ภาพ:
- **(ก) ภาพสะอาด** — พื้นแผนที่ของโซนในเกม ไม่มีตัวละคร มอนสเตอร์ ตัวหนังสือ หรือ UI
- **(ข) ภาพ Walk Path Model** — ผังทางเดิน ทางออก จุดเกิดมอนสเตอร์ และจุดเริ่ม วาดซ้อนบนภาพ (ก) ของโซนเดียวกัน

**ลำดับที่แนะนำ:** เริ่มที่ **ลานหินกลางเหมือง** เพราะเป็นศูนย์กลางที่เชื่อม 4 โซน และมีบอส แล้วค่อยทำ ค่ายเหมืองบน → ลำธารเหมือง → สถานีรถแร่ → ปากถ้ำเหมือง → หน้าผาเหมือง

ส่งกลับมาทีละโซน ตั้งชื่อไฟล์ตามนี้: `mine_camp_clean.png`, `mine_camp_walk.png` (เปลี่ยนชื่อโซนได้ตามตาราง: camp, tunnel, plaza, station, river, cliff)

---

## ภาพที่ต้องแนบ

| โซน | (ก) ภาพสะอาด แนบ | (ข) Walk Path Model แนบ |
| --- | --- | --- |
| ทุกโซน | `docs/prompts/ref/mine_sheet_clean.jpg` (สไตล์และสเกล) + ภาพบริเวณของโซนนั้น (ดูตารางด้านล่าง) | ภาพ (ก) ของโซนนั้น + `assets/design_refs/09_village_walkpath_model.jpg` (ตัวอย่างสไตล์ผัง) |
| ค่ายเหมืองบน | `zone_mine_camp_crop.jpg` | |
| ปากถ้ำเหมือง | `zone_mine_tunnel_crop.jpg` | |
| ลานหินกลางเหมือง | `zone_mine_plaza_crop.jpg` | |
| สถานีรถแร่ | `zone_mine_station_crop.jpg` | |
| ลำธารเหมือง | `zone_mine_river_crop.jpg` | |
| หน้าผาเหมือง | `zone_mine_cliff_crop.jpg` | |

`zone_mine_<โซน>_crop.jpg` คือบริเวณที่เจ้าของวงไว้ในแผ่นต้นฉบับ ให้ ChatGPT ขยายออกจากบริเวณนี้ ส่วน `zone_mine_<โซน>_now.jpg` คือผังของเกมตอนนี้ ใช้ดูประกอบเท่านั้น ไม่จำเป็นต้องแนบ

---

## กติกาที่ทุกโซนต้องตรง

- **ขนาด 1536 × 1024 px พอดี** — ตรงกับแผนที่ในเกม (48 × 32 ช่อง ช่องละ 32 px)
- **สเกลเหมือนแผ่นต้นฉบับ** — ต้นไม้ ทางเดิน ขั้นบันได หิน และรางรถแร่ต้องมีขนาดเท่าแผ่นต้นฉบับ ห้ามซูมบริเวณเดิมให้ใหญ่ขึ้นแล้วเบลอ
- **ขยายฐาน** — วาดพื้นดิน หิน หญ้า ทางเดิน และต้นไม้ต่อจากบริเวณในวงให้กลมกลืน จนเต็มทั้งภาพ
- **ทางเดิน** — ดินหรือหิน ความกว้างใกล้เคียงทางในแผ่นต้นฉบับ เดินถึงกันได้ทุกทาง มีลานโล่งอย่างน้อย 3 แห่งให้มอนสเตอร์เดิน
- **ทางออก** — ทุกจุดในตารางของโซนนั้นต้องเป็นทางดินที่เห็นชัดที่ตำแหน่งนั้น
- **สิ่งที่ห้ามมี** — ตัวละคร มอนสเตอร์ บอส ตัวหนังสือ ป้าย UI เส้นตาราง เงาที่ลอยออกนอกวัตถุ

---

## (ก) แม่แบบคำสั่ง — ภาพสะอาดของโซน

แทน `[ZONE]`, `[LEVEL]`, `[DETAILS]`, `[EXITS]` ด้วยค่าจากหัวข้อของแต่ละโซนด้านล่าง

```
Using the attached clean mine map as the style and scale reference, create a new in-game map for the zone: [ZONE] ([LEVEL]).
Use the attached zone crop as the content to expand: keep the same buildings, rails, cliffs, stairs, bridges and plants from the crop, and continue the terrain outward until it fills the whole frame.
Match the EXACT pixel art style, outline weight, camera angle and object scale of the attached clean mine map. Do not zoom or blur the crop; new terrain must have the same pixel detail.
Contents: [DETAILS]
Exits (dirt paths that must reach these positions): [EXITS]
Layout: dirt paths about the same width as in the reference, leading to every exit; open clearings for monsters; cliffs, water, dense trees, rocks, crystals and rail tracks are obstacles; nothing walkable under buildings.
No characters, no monsters, no boss, no text, no labels, no UI, no grid lines. Landscape exactly 1536 x 1024 px.
```

---

## (ข) แม่แบบคำสั่ง — ผัง Walk Path Model

แทน `[EXITS_MARK]`, `[SPAWN_MARK]`, `[START]`, `[BOSS_MARK]` ด้วยค่าจากหัวข้อของแต่ละโซนด้านล่าง

```
On the attached zone map, draw a Walk Path Model overlay in the same style as the attached village example:
- solid GREEN fill over ALL ground the player can walk on (dirt paths, clearings, grass, stone stairs, bridges);
- solid RED fill over every obstacle (cliffs, rocks, water, trees, rail tracks, mine carts, crates, barrels, fences, buildings, crystals);
- [EXITS_MARK]
- [SPAWN_MARK]
- [START]
- [BOSS_MARK]
Keep the map art visible under the overlay. Same image size (1536 x 1024). Only the labels listed above, no other text.
```

---

## ค่าของแต่ละโซน

ตำแหน่งเป็นเปอร์เซ็นต์ของภาพ (x จากซ้าย, y จากบน) ค่าเหล่านี้มาจากการแบ่งอัตโนมัติ ถ้าภาพที่วาดมีเส้นทางต่างไป ให้วางจุดตามเส้นทางจริงที่วาด
บรรทัดที่เป็นค่า (ก) และ (ข) วางแทนในแม่แบบได้เลย

### 1) ค่ายเหมืองบน (`mine_camp`)

- **[ZONE]:** Upper mining camp
- **[LEVEL]:** monsters level 27–32
- **[DETAILS]:** Upper mining camp: a wooden watermill with a waterfall pouring from the top-left cliff into a small pool, a canvas awning over a wooden table, barrels and crates, a mine cart full of blue crystals running on wooden rails, stone stairs climbing the cliff, a lantern on a wooden post, pine trees, grass and wildflowers, a wooden fence on the lower path.
- **[EXITS] (ก):** to the Central Plaza on the RIGHT edge (3 exits, 57–79% down the height); to the Mountain Stream along the BOTTOM edge (63% from the left); to the Rainforest on the LEFT side (21% from the left, 60% down)
- **[EXITS_MARK] (ข):** yellow dots on the path at (98%, 57%), (98%, 76%), (96%, 79%) labelled "ลานหินกลาง"; at (63%, 98%) labelled "ลำธารเหมือง"; at (21%, 60%) labelled "ป่าดิบชื้น"
- **[SPAWN_MARK] (ข):** purple dots, 4 monsters each, labelled "หมีเขา Lv27" at (61%, 35%); "กระทิงผี Lv32" at (90%, 54%); "หมีเขา Lv27" at (46%, 60%); "กระทิงผี Lv32" at (76%, 45%)
- **[START] (ข):** cyan dot labelled "จุดเริ่ม" at (28%, 60%)

### 2) ปากถ้ำเหมือง (`mine_tunnel`)

- **[ZONE]:** Mine tunnel entrance
- **[LEVEL]:** monsters level 32–37
- **[DETAILS]:** Mine tunnel entrance: a large dark cave mouth framed by thick timber beams with hanging lanterns, glowing blue crystals inside the cave, rail tracks leaving the cave and curving across the ground, a mine cart full of crystals, a wooden hoist frame with crates beside the entrance, carved stone stairs on the lower left, rock walls and sparse plants.
- **[EXITS] (ก):** to the Central Plaza on the LEFT edge (60% down); to the Mine Station on the RIGHT side (82% from the left, 54% down)
- **[EXITS_MARK] (ข):** yellow dot on the path at (5%, 60%) labelled "ลานหินกลาง"; at (82%, 54%) labelled "สถานีรถแร่"
- **[SPAWN_MARK] (ข):** purple dots, 4 monsters each, labelled "กระทิงผี Lv32" at (40%, 29%); "โกเลมหิน Lv37" at (71%, 64%); "กระทิงผี Lv32" at (19%, 54%); "โกเลมหิน Lv37" at (55%, 48%)
- **[START] (ข):** cyan dot labelled "จุดเริ่ม" at (53%, 79%)

### 3) ลานหินกลางเหมือง (`mine_plaza`) — มีบอส

- **[ZONE]:** Central open clearing, the hub of the mine
- **[LEVEL]:** monsters level 37–42, boss level 44
- **[DETAILS]:** Central open clearing and the hub of the mine: a wide round area of sand-coloured dirt with grass patches and wildflowers at the edges, two stone staircases (top-right and bottom-right), a lantern post on the right side, a cluster of blue crystals on the left rock wall, surrounded by tall grey rock cliffs; paths lead out in four directions; room for a large boss arena in the middle.
- **หมายเหตุ (ไม่ต้องคัดลอกไปยัง ChatGPT):** ต้นฉบับเป็นลานดินทรายกับหญ้า ไม่ใช่ลานหินทั้งผืน ทำตามต้นฉบับ เว้นแต่จะบอกให้เปลี่ยน
- **[EXITS] (ก):** to the Upper Mining Camp at the upper-middle (36% from the left, 35% down); to the Tunnel at the upper-middle-right (55% from the left, 35% down); to the Mountain Stream along the LEFT edge (3 exits, 73–85% down); to the Mine Station along the BOTTOM edge (2 exits, 57% from the left, 95–98% down)
- **[EXITS_MARK] (ข):** yellow dot at (36%, 35%) labelled "ค่ายเหมืองบน"; at (55%, 35%) labelled "ปากถ้ำเหมือง"; at (1%, 73%), (1%, 76%), (1%, 85%) labelled "ลำธารเหมือง"; at (57%, 95%) and (57%, 98%) labelled "สถานีรถแร่"
- **[SPAWN_MARK] (ข):** purple dots, 4 monsters each, labelled "โกเลมหิน Lv37" at (28%, 85%); "ปีศาจ Lv42" at (61%, 54%); "โกเลมหิน Lv37" at (34%, 48%); "ปีศาจ Lv42" at (46%, 60%)
- **[BOSS_MARK] (ข):** black square at (61%, 35%) labelled "บอส มังกรภูเขาดำ Lv44"
- **[START] (ข):** cyan dot labelled "จุดเริ่ม" at (55%, 26%)

### 4) สถานีรถแร่ (`mine_station`)

- **[ZONE]:** Mine-cart station
- **[LEVEL]:** monsters level 37–42
- **[DETAILS]:** Mine-cart station: an open wooden shelter with a sloped roof and a hanging lantern over a mine cart full of blue crystals on rails, a wooden fence along the path, a winding dirt path with cobblestones, lantern posts, blue crystal clusters on the rocks, pine trees and a stone staircase at the top.
- **[EXITS] (ก):** to the Tunnel on the LOWER-MIDDLE (4 exits, 26–48% from the left, 67–85% down); to the Central Plaza on the LOWER-LEFT (2 exits, 5% from the left, 85–92% down); to the Cliff on the RIGHT-MIDDLE (80% from the left, 54% down); to the Misty Peak on the RIGHT edge at the top (2 exits, 20–26% down)
- **[EXITS_MARK] (ข):** yellow dots at (42%, 67%), (48%, 67%), (26%, 79%), (26%, 85%) labelled "ปากถ้ำเหมือง"; at (5%, 85%), (5%, 92%) labelled "ลานหินกลาง"; at (80%, 54%) labelled "หน้าผาเหมือง"; at (98%, 20%), (98%, 26%) labelled "ยอดเขาทะเลหมอก"
- **[SPAWN_MARK] (ข):** purple dots, 4 monsters each, labelled "โกเลมหิน Lv37" at (61%, 42%); "ปีศาจ Lv42" at (34%, 82%); "โกเลมหิน Lv37" at (44%, 54%); "ปีศาจ Lv42" at (71%, 51%)
- **[START] (ข):** cyan dot labelled "จุดเริ่ม" at (92%, 20%)

### 5) ลำธารเหมือง (`mine_river`)

- **[ZONE]:** Mountain stream
- **[LEVEL]:** monsters level 27–32
- **[DETAILS]:** Mountain stream: a turquoise river flowing along the top-right with rocks in the water, a wooden rope bridge with a plank deck and posts crossing it, a winding dirt path along the bank, grass with flowers, pine trees, blue crystals, a lantern post and stone steps at the top-left.
- **[EXITS] (ก):** to the Upper Mining Camp on the UPPER-RIGHT (2 exits, 88–90% from the left, 20% down); to the Central Plaza on the RIGHT edge at the top (96% from the left, 20% down); to the Waterfall Field along the BOTTOM-LEFT (4 exits, 3–13% from the left, 89–95% down)
- **[EXITS_MARK] (ข):** yellow dots at (88%, 20%), (90%, 20%) labelled "ค่ายเหมืองบน"; at (96%, 20%) labelled "ลานหินกลาง"; at (3%, 89%), (3%, 95%), (7%, 95%), (13%, 95%) labelled "ทุ่งน้ำตก"
- **[SPAWN_MARK] (ข):** purple dots, 4 monsters each, labelled "หมีเขา Lv27" at (48%, 39%); "กระทิงผี Lv32" at (28%, 85%); "หมีเขา Lv27" at (32%, 54%); "กระทิงผี Lv32" at (63%, 32%)
- **[START] (ข):** cyan dot labelled "จุดเริ่ม" at (9%, 85%)

### 6) หน้าผาเหมือง (`mine_cliff`)

- **[ZONE]:** High cliff ledge
- **[LEVEL]:** monsters level 42–47
- **[DETAILS]:** High cliff ledge: a narrow grassy terrace along a rocky cliff with sharp grey rock formations, a cluster of glowing blue crystals in the rock face, wildflowers and short grass, a wooden barrel near the edge, a wooden fence along the top edge, a dirt path along the bottom edge, stone stairs at the top-left, a tree on the ridge; cooler colours for high altitude.
- **[EXITS] (ก):** to the Mine Station on the RIGHT-LOWER side (76% from the left, 70% down)
- **[EXITS_MARK] (ข):** yellow dot at (76%, 70%) labelled "สถานีรถแร่"
- **[SPAWN_MARK] (ข):** purple dots, 4 monsters each, labelled "ปีศาจ Lv42" at (9%, 60%); "วิญญาณไม้ Lv47" at (84%, 85%); "ปีศาจ Lv42" at (26%, 85%); "วิญญาณไม้ Lv47" at (63%, 73%)
- **[START] (ข):** cyan dot labelled "จุดเริ่ม" at (44%, 76%)

---

## หมายเหตุสำหรับการวาดผัง (ข)

- **[EXITS_MARK]** คือจุดสีเหลืองที่ทางออกแต่ละจุด ป้ายคือชื่อโซนปลายทาง วางบนทางดินที่เดินถึงได้ ไม่วางบนหิน
- **[SPAWN_MARK]** คือจุดสีม่วงที่จุดเกิดมอนสเตอร์ จุดละ 4 ตัว ป้ายเป็นชื่อมอนสเตอร์และเลเวล วางบนพื้นสีเขียวที่โล่ง ห่างทางออกอย่างน้อยสามช่อง
- **[START]** คือจุดสีฟ้า จุดเริ่มของผู้เล่น วางบนพื้นสีเขียวที่โล่ง
- **[BOSS_MARK]** เฉพาะลานหินกลาง คือช่องสีดำมีป้ายชื่อบอส วางในพื้นที่กลางที่โล่งพอให้บอสยืน
- ห้ามวาดมอนสเตอร์หรือบอสลงในภาพ (ก) เกมจะวางมอนสเตอร์เอง ค่าในตารางนี้คือตำแหน่งโดยประมาณ

---

## ส่งกลับมาแล้วเกิดอะไรต่อ

1. ส่งภาพ (ก) และ (ข) ของแต่ละโซน พร้อมชื่อไฟล์ตามที่กำหนดด้านบน
2. ผมอ่านผังเดินได้จากสีเขียวและสีแดงของภาพ (ข) แล้วนับสีในแต่ละช่อง 32 px เพื่อสร้างผังช่อง 48 × 32 ใหม่ แทนผังที่แบ่งอัตโนมัติ
3. อ่านจุดเหลือง ม่วง ฟ้า และดำ เป็นทางออก จุดเกิด จุดเริ่ม และบอส แล้วคำนวณจุดมาถึงของแต่ละทางออกให้เอง
4. ใช้ภาพ (ก) เป็นพื้นแผนที่ในเกม (`game/maps/mine_*.webp`) แทนภาพขยายอัตโนมัติเดิม
5. รันชุดทดสอบ และตรวจว่าเดินถึงทุกทางออก มอนสเตอร์ทุกตัวเกิดบนพื้นที่เดินถึงได้
6. ส่งภาพในเกมให้คุณอนุมัติก่อนแทนที่ของเดิม (ภาพเดิมยังอยู่ใน git และ `assets/maps_src/mine.png`)

## ข้อควรรู้

- ค่าตำแหน่งในตารางเป็นค่าประมาณ ถ้าภาพที่วาดมีเส้นทางต่างไป ให้วางจุดตามเส้นทางที่วาดจริง ผมจะย้ายทางออกและจุดเกิดตามนั้น
- ทางออกไปป่าดิบชื้นของค่ายเหมืองบนอยู่กลางด้านซ้ายของภาพ ไม่ได้อยู่ที่ขอบ ถ้าต้องการให้ทางเดินไปถึงขอบซ้าย ให้วาดทางดินไปถึงขอบ แล้ววางจุดเหลืองที่ปลายทางนั้น
- ทางเชื่อมบางคู่ในแผนที่ปัจจุบันยังไม่ตรงกับภาพต้นฉบับ เช่น ทางออกด้านซ้ายของลานหินกลาง ที่ไปลำธาร ผมจะแก้ตามผังที่คุณวาดให้ใหม่ทั้งหมด
