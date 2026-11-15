# ชุดคำสั่งทำนักสู้หญิงชุดม้ง (สำหรับ ChatGPT) — V2-R65

เปลี่ยนชุดของ **นักสู้หญิง** จากชุดเกราะแดง-ทองเป็น **ชุดม้งดั้งเดิม** ให้เข้ากับนักสู้ชายและตัวละครหญิงอื่น
โดยคงใบหน้า ทรงผมหางม้า สัดส่วนตัว และความหมายของแต่ละเฟรมท่าเดิมไว้

ชุดนี้ยังไม่มีผลในเกม ใช้เมื่อเจ้าของวาดภาพใหม่แล้วส่งกลับมาให้ตรวจ

## ภาพที่แนบ

| ลำดับ | ไฟล์ | ใช้ทำอะไร | ท่าเดิน | ท่าโจมตี |
| --- | --- | --- | --- | --- |
| 1 | `docs/prompts/ref/class_fighter_m_walk.png` | สไตล์และชุดม้งของนักสู้ชาย (ตัวอ้างอิงหลัก) | ✓ | ✓ |
| 2 | `docs/prompts/ref/female_walk_384x496.png` | ชุดม้งของตัวละครหญิง (ลายปัก กระโปรงจีบ สายคาดเอว) | ✓ | ✓ |
| 3 | `docs/prompts/ref/class_fighter_f_walk.png` | ตัวเดิมของนักสู้หญิง: ใบหน้า หางม้า สัดส่วน และผังท่าเดิน (ต้องคง) | ✓ | |
| 4 | `docs/prompts/ref/class_fighter_f_attack.png` | ผังท่าโจมตี 5 เฟรมของตัวเดิม (ต้องคงความหมายของแต่ละเฟรม) | | ✓ |

## ชุดม้งของนักสู้หญิง (ต้องตรงทุกภาพ)

- **เสื้อ:** เสื้อคลุมสั้นสีดำ ปกและปลายแขนปักลายแดง-ชมพูแบบเรขาคณิต เหมือนนักสู้ชาย
- **กระโปรงและกางเกง:** กระโปรงจีบสั้นสีดำมีแถบปักแดงที่ชายกระโปรง ใต้กระโปรงเป็นกางเกงรัดขาสีดำมีแถบปักแดงที่ข้อเท้า
- **เข็มขัด:** สายคาดเอวสีแดงมีชายห้อยสองข้าง
- **เครื่องประดับ:** ห่วงเงินเล็กรอบคอ ไม่มีอุปกรณ์สีทอง
- **รองเท้า:** รองเท้าผ้าสีดำหุ้มข้อ ไม่ใช่รองเท้าบูททอง
- **ผม:** หางม้าสูงทรงเดิม มัดด้วย **ผ้าแดง** ไม่ใช้สายรัดทอง
- **มือ:** มือเปล่า พันผ้าแดงที่กำปั้นทั้งสองข้าง
- **ห้ามมี:** สีทอง เกราะ ไหล่เกราะ แผ่นโลหะ หมวกทอง และผ้าคลุมไหล่สีแดงแบบเกราะเดิม

ใบหน้า ดวงตาสีแดง ขนาดหัว และสัดส่วนตัว ให้เหมือนภาพที่ 3

## แม่แบบคำสั่ง 1: ท่าเดิน (4 แถว × 4 เฟรม)

```
Same art style, pixel size, outline and palette as the attached sprite sheets. Use image 1 (the Hmong male martial artist) for the style and the Hmong costume, image 2 (the Hmong female costume) for the female outfit details, and image 3 (the current female martial artist) for the face, the high ponytail, body size and proportions.
Create a WALK sprite sheet of a chibi Hmong FEMALE martial artist with the SAME layout as image 3: 4 rows x 4 frames.
Row 1: facing DOWN (toward the viewer). Row 2: facing UP (back to the viewer). Row 3: facing LEFT. Row 4: facing RIGHT.
Each row is one 4-frame walk cycle. Feet stay on the same baseline in every frame of a row.
Outfit: traditional Hmong women's clothing: short black jacket with red and pink cross-stitch embroidered collar, cuffs and hem bands; short black pleated skirt with a red embroidered band at the hem; black leggings with red embroidered ankle bands; red sash belt with hanging ends; small silver neck ring; black cloth shoes.
Hair: the same high ponytail as image 3, tied with a RED cloth band. Hands: bare fists with red cloth wraps.
NO gold, NO metal armour, NO shoulder plates, NO gold headband, NO gold trim.
Same face, red eyes, head size and body proportions as image 3.
NO effects, NO glow, NO motion lines, NO shadows, NO text, NO grid lines. Clear empty space between frames. Transparent background (or plain solid white).
```

## แม่แบบคำสั่ง 2: ท่าโจมตี (4 แถว × 5 เฟรม)

ลำดับ 5 เฟรมนี้ต้องตรงกับเกม: เฟรม 1 ตั้งท่า · เฟรม 2 ง้าง · เฟรม 3 ต่อย (จังหวะโดน) · เฟรม 4 ชูหมัดขึ้น · เฟรม 5 ทุบลงพื้น
ท่าโจมตีปกติใช้เฟรม 1→2→3 และท่าสกิลใช้เฟรม 1→4→5

```
Same character, costume, face and hair as the attached sprite sheets (images 1, 2 and 4). Keep the Hmong costume exactly as described: black jacket with red and pink embroidered bands, black pleated skirt with red band, red sash, silver neck ring, black shoes, red hair band, red cloth fist wraps. NO gold, NO armour.
Create an ATTACK sprite sheet with the SAME layout as image 4: 4 rows x 5 frames.
Row 1: facing DOWN. Row 2: facing UP. Row 3: facing LEFT. Row 4: facing RIGHT.
Frame 1: guard stance, both fists up in front, knees bent (ready)
Frame 2: wind-up, rear fist pulled back to the hip, body coiled
Frame 3: straight punch fully extended toward the facing direction, body leaning into the punch
Frame 4: both fists raised high above the head (power-up pose)
Frame 5: slam, body crouched low, both fists striking down toward the ground
Use the same frame meaning in every row. Feet stay on the same baseline in every frame of a row. Clear empty space between frames so no fist, hair or cloth touches the neighbouring frame.
NO effects, NO glow, NO motion lines, NO shadows, NO ground cracks, NO text, NO grid lines. Transparent background (or plain solid white).
```

## วิธีส่งกลับ

1. ส่งภาพท่าเดินเป็น `fighter_f_walk_v3.png` และภาพท่าโจมตีเป็น `fighter_f_attack_v3.png` บอกชื่อไฟล์ทุกครั้ง
2. ขนาดไม่ต้องตรงพิกเซล ผมจะปรับเอง แต่ต้องเป็น 4 แถวเท่านั้น (ท่าเดิน 4 เฟรม ท่าโจมตี 5 เฟรม)
3. ถ้าภาพไม่ตรง สั่งแก้เฉพาะจุด เช่น
   - ยังมีสีทองหรือเกราะ → `remove all gold and armour, use only black, red and silver`
   - ทรงผมไม่ตรง → `keep the exact same high ponytail shape as image 3`
   - ความหมายของเฟรมโจมตีเปลี่ยน → `frame 4 must raise both fists overhead, frame 5 must slam down`
   - มีเอฟเฟกต์ → `remove all effects and motion lines`

## เมื่อได้ภาพแล้ว (ผมดำเนินการ)

1. วางไฟล์ไว้ที่ `assets/sprites_src/classbody/`
2. เปลี่ยนตัวสร้างภาพของนักสู้หญิง
   - `tools/build_class_bodies.py`: `quad('fighter_f2.png')` → `grid_tr('fighter_f_walk_v3.png')` (ตารางโปร่งใส 4×4 ตามอาชีพอื่น)
   - `tools/build_attack4.py`: `fighter_f_attack.png` → `fighter_f_attack_v3.png` (ยังคง 5 เฟรม)
3. รันตัวสร้างภาพ แล้วตรวจด้วย `python3 -B tools/character_audit.py` (ต้องได้ 16/16) และชุดทดสอบ smoke, sim, online
4. จับภาพในเกมให้เจ้าของดูก่อนบันทึก

## ตรวจก่อนรับ (เจ้าของตรวจด้วยตา)

- [ ] ชุดตรงภาพที่ 1–2: สีดำ มีลายปักแดง-ชมพู ไม่มีทองหรือเกราะ
- [ ] ผมหางม้าผูกผ้าแดง ใบหน้าเหมือนภาพที่ 3
- [ ] ท่าเดิน 4 ทิศ 4 เฟรม เท้าอยู่เส้นเดียวกันในแต่ละแถว
- [ ] ท่าโจมตี 4 ทิศ 5 เฟรม ตามลำดับ ตั้งท่า → ง้าง → ต่อย → ชูหมัด → ทุบพื้น
- [ ] ไม่มีเอฟเฟกต์ เส้นความเร็ว เงา หรือตัวหนังสือ

สถานะ: **ออกแบบแล้ว · รอภาพจากเจ้าของ**
