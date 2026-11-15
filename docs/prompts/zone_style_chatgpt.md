# ชุดคำสั่งทำภาพโซนสไตล์ใหม่ (สำหรับ ChatGPT) — V2-R63

ใช้วาดแผนที่ 11 โซนที่มีภาพในเกม (ตาราง `MAP_ART`) ใหม่ให้เป็นสไตล์ของภาพหน้าจอที่เจ้าของส่งมา
**ผังทางเดินและสิ่งกีดขวางยึดตามผังชนของเกม** — เปลี่ยนแค่หน้าตา ไม่เปลี่ยนตำแหน่ง

ชุดนี้ยังไม่มีผลในเกม ใช้เมื่อเจ้าของวาดภาพใหม่แล้วส่งกลับมาให้ตรวจ

## ลำดับที่แนะนำ

1. **ทุ่งน้ำตก (`field2`) เป็นโซนนำร่องก่อน 1 โซน** — ให้เจ้าของดูว่าสไตล์ตรงกับภาพหน้าจอหรือไม่ แล้วค่อยทำที่เหลือ
2. หมู่บ้านกางเขา (`village2`) → ป่าไผ่ (`bamboo`) → ลำธารและป่าดิบชื้น (`rainforest`) → ยอดเขา (`peak`)
3. โซนถ้ำ 6 โซน (`mine_*`) — ถ้าต้องการสไตล์นี้ด้วย ใช้ชุดคำสั่งนี้แทนขั้นตอน (ก) ใน `mine_zones_chatgpt.md` ได้เลย ไม่ต้องทำขั้นตอน (ข) เพราะผังชนของเกมมีให้แล้ว

## ภาพที่แนบทุกครั้ง (3 ภาพ)

| ลำดับ | ภาพ | ที่มา | ใช้ทำอะไร |
| --- | --- | --- | --- |
| 1 | ภาพหน้าจอสไตล์ | เจ้าของแนบจากเครื่องตัวเอง (ไม่เก็บไว้ในโครงการ) | สี ความคมของพิกเซล ความหนาแน่นของพืช |
| 2 | `docs/prompts/ref/zone_<id>_mask.png` | สร้างจากผังชนในเกมด้วย `tools/zone_mask_ref.py refs` | เลย์เอาต์ที่ต้องตรงทุกช่อง · เขียว = เดินได้ · แดง = ชน · กรอบเหลือง = ทางออก |
| 3 | `docs/prompts/ref/zone_<id>_now.jpg` | ภาพของโซนในเกมตอนนี้ | ดูว่าในโซนมีอะไรและอยู่ตรงไหน |

ไฟล์ `_mask` มีครบ 11 โซน · ไฟล์ `_now` ของ 5 โซนที่ไม่ใช่ถ้ำอยู่ใน `docs/prompts/ref/` และของ 6 โซนถ้ำคือ `zone_mine_<x>_now.jpg` (มีอยู่แล้ว)

## โซนที่ต้องทำ

| id (ชื่อไฟล์) | ชื่อในเกม | บรรยากาศ | จำนวนทางออก |
| --- | --- | --- | --- |
| `field2` | ทุ่งน้ำตก | ทุ่งหญ้า น้ำตก สระน้ำ สะพาน | 4 |
| `village2` | หมู่บ้านกางเขา | หมู่บ้านบนเนินเขา แสงอุ่นยามบ่าย | 1 |
| `bamboo` | ป่าไผ่และหุบเขา | ป่าไผ่สูง หุบเขาลึก หมอกบาง | 2 |
| `rainforest` | ลำธารและป่าดิบชื้น | ป่าดิบชื้น ลำธาร เถาวัลย์ ใบกว้าง | 4 |
| `peak` | ยอดเขาทะเลหมอก | ยอดเขาหิน ทะเลหมอก แสงเย็น | 1 |
| `mine_camp` | ค่ายเหมืองบน | ค่ายเหมือง ราวไม้ กองหิน รางรถแร่ | 5 |
| `mine_tunnel` | ปากถ้ำเหมือง | ปากถ้ำหิน คบไฟ ทางหินมืด | 2 |
| `mine_plaza` | ลานหินกลางเหมือง | ลานหินกลาง กรวด หินแตก | 7 |
| `mine_river` | ลำธารเหมือง | ลำธารในเหมือง น้ำใส หินเปียก สะพาน | 7 |
| `mine_station` | สถานีรถแร่ | สถานีรถแร่ ราง ตู้รถแร่ กองแร่ | 9 |
| `mine_cliff` | หน้าผาเหมือง | หน้าผาหินสูง บันได ลมแรง | 1 |

"จำนวนทางออก" คือจำนวนกรอบเหลืองในผัง ทุกกรอบต้องเป็นทางดินที่เห็นชัดตรงตำแหน่งนั้น

ยังไม่มีไฟล์ภาพของ **หมู่บ้านเริ่มต้น** (`village`) และ **ทุ่งมอนสเตอร์** (`field`) เกมวาดพื้นจากผังช่องแทน จึงไม่อยู่ในชุดนี้

## สไตล์ (จากภาพหน้าจอ)

- พิกเซลคม ความละเอียดเท่าภาพหน้าจอ ไม่เบลอ ไม่ไล่สีแบบภาพวาด
- หญ้าเขียวสดอิ่มสี ขอบใบไม้สว่างกว่าเงาด้านล่าง
- ทางดินสีครีมอุ่น ขอบเข้ม มีกรวดเล็ก
- หิน หน้าผามีตะไคร่และรอยแตก เส้นขอบเข้ม
- ดอกไม้และเห็ดขึ้นเป็นกลุ่มเล็ก ๆ ไม่รกจนบังทาง
- มุมกล้องบนลง 3/4 เหมือนภาพหน้าจอ

## แม่แบบคำสั่ง (ภาษาอังกฤษ)

คัดลอกไปวางพร้อมภาพทั้ง 3 ภาพ แล้วแทน `[ZONE]` และ `[MOOD]` ด้วยค่าจากตารางด้านบน

```
Redraw the attached in-game map (image 3) as a new pixel-art game background in the look of the attached style reference (image 1).
Match the style reference: crisp pixel art at the same pixel density, clean dark outlines, bright saturated greens on grass and leaves, warm cream dirt paths with darker edges, grey stone with moss and cracks, small clusters of flowers and mushrooms, soft top-lit shading, same top-down three-quarter camera angle. No painterly blur, no gradients, no lens effects.
Image 2 is the exact walkable layout of the game and must be followed cell by cell (48 x 32 cells, each cell 32 px): GREEN cells must be walkable ground (dirt, grass, stone steps, bridges); RED cells must be obstacles (rocks, trees, cliffs, water, fences, buildings, rail tracks); YELLOW outlined cells are exits and must be clear dirt paths at those positions.
Do not move any path or obstacle. Do not enlarge any tree, rock or building beyond its red cells. Decorations (grass, flowers, mushrooms, small stones on the ground) may sit on green cells, but no tall or solid object may sit on a green cell.
Keep the contents of image 3 (buildings, waterfall, bridge, stairs, rails, cave entrance, farm and so on) in the same places, restyled.
Zone: [ZONE]. Mood: [MOOD].
Do NOT copy any character, monster, building, icon, logo or UI element from the style reference; use it only for rendering style, palette and density.
No characters, no monsters, no boss, no text, no labels, no UI, no grid lines, no shadows outside objects.
The output must be only the restyled map: no red, green or yellow overlay, no cell marking. Landscape, exactly 1536 x 1024 px, PNG.
```

## สิ่งที่ห้ามมี

- ตัวละคร มอนสเตอร์ บอส ตัวหนังสือ ป้าย UI เส้นตาราง
- สีแดง เขียว หรือเหลืองของผังลงไปในภาพผลลัพธ์ ผลลัพธ์ต้องเป็นภาพแผนที่ล้วน
- การคัดลอกตัวละคร มอนสเตอร์ อาคาร ไอคอน โลโก้ หรือ UI จากภาพหน้าจอ ภาพสไตล์ใช้แค่เรื่องการวาด สี และความหนาแน่น

## ส่งกลับและการนำไปใช้

1. เจ้าของส่งภาพกลับเป็น PNG ขนาด 1536 × 1024 ตั้งชื่อ `zone_<id>_new.png` ทีละโซน
2. ผมซ้อนผังทับภาพใหม่ด้วย `python3 tools/zone_mask_ref.py check <id> <ไฟล์ใหม่> <ไฟล์ผล>` แล้วตรวจว่า ช่องแดงอยู่บนสิ่งกีดขวาง ช่องเขียวอยู่บนพื้นเดิน และกรอบเหลืองยังเป็นทาง
3. ถ้ามีจุดที่เลื่อนจากผัง ผมจะบอกตำแหน่งที่ต้องแก้ แล้วให้สั่งแก้เฉพาะจุดนั้น
4. เจ้าของดูภาพแล้วอนุมัติ ผมแปลงเป็น `game/maps/<id>.webp` และเก็บของเดิมไว้ที่ `game/versions/maps_before_style/`
5. รันชุดทดสอบ (smoke, sim, online) ก่อนบันทึกผล
6. `MAP_MASKS` ไม่ต้องแก้ เพราะเลย์เอาต์เท่าเดิม
