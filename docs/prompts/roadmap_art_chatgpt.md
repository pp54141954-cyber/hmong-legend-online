# ชุดคำสั่งภาพที่ยังขาด (สำหรับ ChatGPT) — V2-R71

ใช้คู่กับ `docs/PLAN_NEXT.md` ทำทีละชุด แล้วส่งภาพกลับพร้อมระบุชื่อชุด เช่น "A1 ป้าขายของ"
ภาพทุกชุดต้องเป็นของใหม่ทั้งหมดของโครงการ ไม่ลอกจากเกมอื่น และบันทึกในตาราง `docs/ASSETS.md` ก่อนนำเข้า

## กติกาทั่วไป (แนบทุกครั้ง)

- Original artwork only. Do not imitate any character, logo, UI, icon or map from any commercial game.
- No text, letters, numbers, watermarks, signatures, frames, grid lines, minimap or labels in the image.
- No glow, motion lines, ground shadow or effects unless the set says so.
- Sprites, icons and props: plain solid white background (ระบบตัดพื้นขาวให้เอง). Ground tiles: full-bleed, no border.
- Keep the Hmong theme: woven patterns, embroidered bands in red, pink, white and gold, silver ornaments. Keep character continuity.
- Output PNG at the exact size given. ห้ามส่ง JPG

## A. NPC ร้านค้า (2 ตัว)

| ชุด | ตัวละคร | ไฟล์ส่งมอบ | ขนาด |
| --- | --- | --- | --- |
| A1 | ป้าขายของ | `npc_shop_f_idle.png` | 384 × 496 |
| A2 | พ่อค้าเครื่องเงิน | `npc_silver_m_idle.png` | 384 × 496 |

ผัง: 4 แถว × 4 เฟรม แถว 1 หันลง แถว 2 หันขึ้น แถว 3 หันซ้าย แถว 4 หันขวา ช่องละ 96 × 124 px เท้าอยู่แนวเดียวกันทุกเฟรม ช่องว่างระหว่างเฟรมอย่างน้อย 4 px
ภาพอ้างอิงสไตล์: `docs/prompts/ref/class_guardian_m_walk.png`

Prompt A1
```
Same pixel-art style, outline, shading and body proportions as the attached reference character. Create an original Hmong village shopkeeper: a friendly woman merchant in a traditional-inspired outfit with embroidered red and white bands, silver neck ornaments, carrying a woven basket. She is not a fighter: no weapon.
Make an idle sprite sheet with exactly 4 rows x 4 frames.
Row 1: facing DOWN (toward the camera). Row 2: facing UP (away from camera). Row 3: facing LEFT. Row 4: facing RIGHT.
In every row the 4 frames are a gentle idle loop: the body rises and falls by at most 1-2 pixels; the feet never move.
Feet on the same baseline in every frame. Clear empty space (at least 4 px) between all frames and rows.
NO text, NO numbers, NO logos, NO ground shadow, NO glow, NO effects, NO grid lines. Plain solid white background.
```

Prompt A2
```
Same pixel-art style, outline, shading and body proportions as the attached reference character. Create an original Hmong silver-jewelry merchant: a man wearing a traditional-inspired outfit with embroidered bands, silver necklaces and bracelets, holding a small wooden box of silver pieces. He is not a fighter: no weapon.
Make an idle sprite sheet with exactly 4 rows x 4 frames.
Row 1: facing DOWN. Row 2: facing UP. Row 3: facing LEFT. Row 4: facing RIGHT.
In every row the 4 frames are a gentle idle loop (at most 1-2 px of body movement); the feet never move.
Feet on the same baseline in every frame. Clear empty space (at least 4 px) between all frames and rows.
NO text, NO numbers, NO logos, NO ground shadow, NO glow, NO effects, NO grid lines. Plain solid white background.
```

หมายเหตุ: หลังได้ภาพ ระบบจะตัดภาพด้วย `grid4` ใน `tools/build_class_bodies.py` ซึ่งเรียงแถวลง ขึ้น ซ้าย ขวา แล้วตรวจด้วยสคริปต์ตรวจตัวละครก่อนใส่เกม

## B. ไอคอนอาวุธ (30 ภาพใหม่ มีอยู่แล้ว 2 ภาพ)

ขนาด 34 × 34 px PNG ให้สไตล์และความหนาของเส้นขอบเหมือน `assets/items/sword_iron.png` และ `assets/items/potion_s.png` (วางเทียบก่อนส่ง) ไอคอนมีวัตถุเดียวอยู่กลาง

ระดับ (ชื่อและค่าเป็นข้อเสนอ ยังไม่ยืนยัน)

| ระดับ | ชื่อ | ลักษณะ |
| --- | --- | --- |
| 1 | ไม้ (wood) | ไม้น้ำตาลอ่อน ผ้าพันง่าย ๆ (มีแล้วสำหรับดาบ) |
| 2 | เหล็ก (iron) | เหล็กเทา ขอบเข้ม (มีแล้วสำหรับดาบ) |
| 3 | เงิน (silver) | เงินวาววับ มีอัญมณีฟ้าเล็ก |
| 4 | แดง-ม้ง (hmong) | ผ้าปักแดงลายขาวและทอง ห้อยเหรียญเงิน |

| ชนิดอาวุธ (ค่าในเกม) | ไอคอนที่ต้องทำ (ตามระดับ) | อธิบายวัตถุ |
| --- | --- | --- |
| bow | bow_wood, bow_iron, bow_silver, bow_hmong | ธนูโค้งมีสาย มองด้านข้าง |
| daggers | daggers_wood, daggers_iron, daggers_silver, daggers_hmong | มีดสั้นคู่ไขว้กัน |
| fists | fists_wood, fists_iron, fists_silver, fists_hmong | ผ้าพันมือหรือถุงมือ |
| staff | staff_wood, staff_iron, staff_silver, staff_hmong | ไม้เท้าวิญญาณ มีวงเงินที่ปลาย |
| leafstaff | leafstaff_wood, leafstaff_iron, leafstaff_silver, leafstaff_hmong | ไม้เท้ารักษา ปลายเป็นรูปใบไม้ |
| book | book_wood, book_iron, book_silver, book_hmong | คัมภีร์ปิดฝา |
| shield | shield_wood, shield_iron, shield_silver, shield_hmong | โล่กลม |
| sword | sword_silver, sword_hmong (มี sword_wood, sword_iron แล้ว) | ดาบเงินประดับ / ดาบด้ามพันผ้าแดง |

Prompt (แทน [ITEM] และ [TIER])
```
Pixel-art game item icon, 34x34 px, one item centered, same outline thickness and shading as the attached reference icons (sword_iron.png, potion_s.png). Item: [ITEM]. Material and tier: [TIER]. Original design. No text, no border frame, no glow, no background scene. Plain solid white background.
```

## C. ต้นไม้ พุ่มไม้ หิน ดอกไม้ และหญ้า

| ชุด | ไฟล์ | ขนาด | จำนวน | หมายเหตุ |
| --- | --- | --- | --- | --- |
| C1 | `prop_tree_01` … `03.png` | 96 × 128 | 3 | มุมมอง 3/4 จากบน พื้นขาว |
| C2 | `prop_bush_01` … `02.png` | 48 × 40 | 2 | |
| C3 | `prop_rock_01` … `03.png` | 32 × 24 | 3 | |
| C4 | `prop_flower_01` … `03.png` | 16 × 16 | 3 | ดอกไม้เล็กบนพื้นหญ้า |
| C5 | `prop_grass_01` … `03.png` | 16 × 16 | 3 | หญ้าพุ่มสูง |
| C6 | `ground_grass_01` … `04.png` | 32 × 32 | 4 | ทำซ้ำได้ ไม่มีขอบ ไม่มีวัตถุ |

โทนสีและความคมชัดให้เข้ากับแผนที่จริง `game/maps/bamboo.webp` และกติกาใน `docs/prompts/zone_style_chatgpt.md`

Prompt C6 (พื้นหญ้า)
```
Seamless tileable pixel-art grass ground tile, 32x32 px, top-down view, full bleed to all edges, no border, no shadow, no objects, no flowers. Palette and pixel style matching the attached map (bamboo.webp). Variant [N]: [VARIANT].
```

Prompt C1 (ต้นไม้)
```
Pixel-art tree prop, 96x128 px, single tree centered, 3/4 view from above, clear canopy and trunk, same outline and shading as the attached map palette. Original design, [VARIANT]. No ground shadow, no text, plain solid white background.
```

## D. แผนที่หมู่บ้านเริ่มต้นและทุ่งมอนสเตอร์ (2 แผ่น)

ขนาดแต่ละแผ่น 1536 × 1024 px (48 × 32 ช่อง ช่องละ 32 px) มุมมองเดียวกับแผนที่เดิม ตามกติกาใน `docs/prompts/zone_style_chatgpt.md`

ทางออกต้องเปิดโล่ง (พิกัดตรงกับผังในเกม)

| โซน | ขอบ | ช่อง | พิกเซล | ไปยัง |
| --- | --- | --- | --- | --- |
| หมู่บ้านเริ่มต้น (`village`) | ขวา | x = 47, y = 29–30 | x 1504–1535, y 928–991 | ทุ่งมอนสเตอร์ (`field`) |
| ทุ่งมอนสเตอร์ (`field`) | ซ้าย | x = 0, y = 14–15 | x 0–31, y 448–511 | ทุ่งน้ำตก (`field2`) |

พื้นที่ปลอดภัยของหมู่บ้าน: ช่อง x 0–20, y 8–24 (พิกเซล x 0–671, y 256–799) ควรเป็นพื้นที่สงบ ไม่มีสัตว์ประหลาด

Prompt D1 (หมู่บ้านเริ่มต้น)
```
Top-down 3/4 pixel-art village map, exactly 1536x1024 px, original design, Hmong village style: wooden houses with grass roofs, a stream with a water wheel, a small market yard, stone paths. Keep a clear open path at the right edge between y 928 and 991 px, and keep the right-edge exit open. Calm, safe atmosphere, no monsters. No text, no signs, no minimap, no frame, no border, no watermark. Palette matching the attached reference map (village2.webp).
```

Prompt D2 (ทุ่งมอนสเตอร์)
```
Top-down 3/4 pixel-art meadow map, exactly 1536x1024 px, original design: open grassland with low stone walls, flower patches, two small hills, a stone portal gate near the top right, three crystal rocks. Keep a clear open path at the left edge between y 448 and 511 px. No text, no minimap, no frame, no border, no watermark. Palette matching the attached reference map (bamboo.webp).
```

หมายเหตุ: สคริปต์สร้างภาพอ้างอิงผังชน (`tools/zone_mask_ref.py`) ต้องตรวจก่อนใช้กับสองโซนนี้ ตอนนี้ยังไม่มีภาพอ้างอิงของทั้งสองโซน

## E. ภาพย่อโซนสำหรับแผนที่โลก (เลือกทำ)

ค่าเริ่มต้นใช้ภาพย่อจากแผนที่เดิม ชุดนี้ใช้เมื่อเจ้าของต้องการภาพแบบวาดขึ้นใหม่ ขนาด 320 × 200 px จำนวน 13 ภาพ ไม่มีตัวอักษร (ชื่อโซนเกมวาดเอง)

| id | ชื่อในเกม | คำอธิบายเบื้องต้น (ปรับได้หลังเห็นภาพจริง) |
| --- | --- | --- |
| village | หมู่บ้านเริ่มต้น | หมู่บ้านไม้กลางทุ่ง มีบ้านและกังหันน้ำ |
| village2 | หมู่บ้านกางเขา | หมู่บ้านบนเนินเขา |
| field | ทุ่งมอนสเตอร์ | ทุ่งหญ้าเปิด มีดอกไม้และหิน |
| field2 | ทุ่งน้ำตก | ทุ่งหญ้าริมน้ำตก |
| bamboo | ป่าไผ่และหุบเขา | ป่าไผ่ริมหุบเขา |
| rainforest | ลำธารและป่าดิบชื้น | ป่าดิบชื้นมีลำธาร |
| mine_camp | ค่ายเหมืองบน | ค่ายเต็นท์บนเนินเหมือง |
| mine_tunnel | ปากถ้ำเหมือง | ปากถ้ำหิน |
| mine_plaza | ลานหินกลางเหมือง | ลานหินกลางเหมือง |
| mine_river | ลำธารเหมือง | ลำธารใต้ถ้ำ |
| mine_station | สถานีรถแร่ | สถานีรางรถแร่ |
| mine_cliff | หน้าผาเหมือง | หน้าผาหิน |
| peak | ยอดเขาทะเลหมอก | ยอดเขาเหนือหมอก |

## การตรวจรับภาพทุกชุด

1. ขนาดและรูปแบบไฟล์ตรงสเปก (PNG, พื้นโปร่งใสหรือขาว)
2. ไม่มีตัวอักษร ลายน้ำ เส้นตาราง หรือกรอบ
3. ลิขสิทธิ์: บันทึกชุดคำสั่งและวันที่สร้างใน `docs/ASSETS.md` (ภาพที่สร้างด้วย ChatGPT ตามที่เจ้าของส่ง)
4. ตัวละครและ NPC ตรวจด้วยสคริปต์ตรวจตัวละครก่อนใส่เกมทุกครั้ง
