# ชุดคำสั่งสร้างภาพมอนสเตอร์ด้วย ChatGPT

ใช้สร้าง sprite sheet ของมอนสเตอร์ 14 ตัว และบอส 6 ตัว ให้ตรงกับที่เกม Hmong Legend ต้องการ

## วิธีใช้

1. เปิดแชตใหม่ใน ChatGPT แยก 1 แชตต่อมอนสเตอร์ 1 ตัว เพื่อไม่ให้หน้าตาของตัวก่อนหน้าปนเข้ามา
2. **แนบภาพ** `assets/design_refs/08_monsters14_bosses6_animset.png` (ภาพรวมมอนสเตอร์ที่คุณทำไว้) ทุกครั้ง เพื่อให้หน้าตาและสีตรงกับแบบ
3. คัดลอก **คำสั่งที่ 1 (ท่าเดิน)** ของมอนสเตอร์ตัวนั้นไปวาง แล้วส่ง
4. ตรวจภาพตามรายการตรวจด้านล่าง ถ้าไม่ผ่านให้ส่ง **คำสั่งแก้** ที่อยู่ท้ายไฟล์
5. ได้ท่าเดินแล้ว ส่ง **คำสั่งที่ 2 (ท่าโจมตี รับดาเมจ ตาย)** ในแชตเดิม
6. ดาวน์โหลดเป็นไฟล์ PNG แล้วส่งกลับมาในแชตนี้ ตั้งชื่อไฟล์ตามตาราง เช่น `boar_walk.png` และ `boar_action.png`

### รายการตรวจภาพก่อนส่งกลับ

- [ ] พื้นหลังโปร่งใส (หรือเป็นสีเดียวเรียบ ๆ ไม่มีฉาก)
- [ ] ตาราง 4 × 4 ช่องเท่ากัน ไม่มีเส้นตาราง ตัวอักษร หรือกรอบ
- [ ] แถวที่ 1 หันหน้าเข้าหาจอ แถว 2 หันหลัง แถว 3 หันซ้าย แถว 4 หันขวา
- [ ] ในแถวเดียวกัน ขาก้าวสลับกันจริง ไม่ใช่ภาพนิ่งซ้ำ 4 ภาพ
- [ ] ตัวมอนสเตอร์ขนาดเท่ากันทุกช่อง เท้าอยู่ระดับเดียวกัน ไม่ล้นหรือถูกตัดขอบ
- [ ] หน้าตา สี และลักษณะตรงกับภาพแบบ 08

---

## คำสั่งหลัก (ส่วนที่ทุกตัวใช้ร่วมกัน)

คำสั่งของแต่ละตัวด้านล่างรวมส่วนนี้ไว้แล้ว ไม่ต้องคัดลอกแยก ส่วนนี้ใส่ไว้ให้อ่านว่าคำสั่งขออะไรบ้าง

```
STYLE: 2D pixel art game sprite, top-down 3/4 RPG view, crisp pixels, clean dark outline, soft cel shading, same art style and colors as the attached reference sheet.
LAYOUT: one sprite sheet, 1024x1024 px, a 4x4 grid of equal square cells (256x256 each). No grid lines, no borders, no text, no labels, no numbers.
ROWS: row 1 = facing down (toward viewer), row 2 = facing up (away from viewer), row 3 = facing left, row 4 = facing right.
COLUMNS: 4-frame walk cycle, legs clearly alternating (frame 1 contact, frame 2 passing, frame 3 opposite contact, frame 4 passing).
CONSISTENCY: the same creature in every cell, same size, same proportions, centered in its cell, feet on the same baseline about 85% down the cell, nothing cropped.
BACKGROUND: fully transparent PNG. No ground, no scenery, no shadow, no glow effects outside the body.
```

---

## มอนสเตอร์ทั่วไป 14 ตัว

| # | ชื่อในเกม | ชื่อไฟล์ | ลักษณะ (อังกฤษ ใช้ในคำสั่ง) |
| --- | --- | --- | --- |
| 1 | หมูป่า | `boar` | a wild boar with dark brown bristly fur, a mane along its back, curved white tusks, small fierce red eyes |
| 2 | กระต่ายมีเขา | `horned_rabbit` | a horned rabbit with white fur and light brown patches, long ears, small branching antlers, red eyes |
| 3 | หมาป่า | `wolf` | a grey-blue wolf with a lighter belly, shaggy neck fur, bared teeth, yellow eyes |
| 4 | ลิงป่า | `monkey` | a forest monkey with brown fur, a light tan face and chest, long curled tail, mischievous expression |
| 5 | ไก่ฟ้า | `pheasant` | a pheasant with a deep blue and purple body, red face, long sweeping red-orange tail feathers |
| 6 | กวางภูเขา | `mountain_deer` | a mountain deer with tan-brown fur, white chest, large branching antlers |
| 7 | กระทิงผี | `ghost_bull` | a ghost bull with dark navy-black hide, large curved pale horns, purple ghostly flames rising from its shoulders, glowing eyes |
| 8 | เสือ | `tiger` | a tiger with bright orange fur, bold black stripes, white chest and face markings, snarling |
| 9 | ก็อบลิน | `goblin` | a small goblin with green skin, pointed ears, a simple leather tunic, holding a wooden spear |
| 10 | นักรบเผ่าป่า | `forest_warrior` | a forest tribe warrior, human, red cloth headband, brown leather armor, bare arms, holding a long spear |
| 11 | หมีเขา | `horned_bear` | a large brown bear with white bone spikes growing along its back and shoulders |
| 12 | ปีศาจ | `demon` | a hunched red-skinned demon with curved horns, long claws, muscular arms, glowing eyes |
| 13 | โกเลมหิน | `stone_golem` | a stone golem made of grey boulders, glowing blue cracks and crystals in its chest and joints |
| 14 | วิญญาณไม้ | `tree_spirit` | a tree spirit with a wooden bark body, moss and leaves on its head and shoulders, root-like legs, glowing green eyes |

### คำสั่งที่ 1 — ท่าเดิน (ใช้กับมอนสเตอร์ทั่วไป)

คัดลอกทั้งกล่อง แล้วเปลี่ยน `[NAME]` เป็นชื่อไฟล์ และ `[DESCRIPTION]` เป็นลักษณะจากตารางด้านบน

```
Create a game sprite sheet for the monster "[NAME]": [DESCRIPTION].
Match the look and colors of this monster in the attached reference sheet.

STYLE: 2D pixel art game sprite, top-down 3/4 RPG view, crisp pixels, clean dark outline, soft cel shading, same art style and colors as the attached reference sheet.
LAYOUT: one sprite sheet, 1024x1024 px, a 4x4 grid of equal square cells (256x256 each). No grid lines, no borders, no text, no labels, no numbers.
ROWS: row 1 = facing down (toward viewer), row 2 = facing up (away from viewer), row 3 = facing left, row 4 = facing right.
COLUMNS: 4-frame walk cycle, legs clearly alternating (frame 1 contact, frame 2 passing, frame 3 opposite contact, frame 4 passing).
CONSISTENCY: the same creature in every cell, same size, same proportions, centered in its cell, feet on the same baseline about 85% down the cell, nothing cropped. The creature should fill about 60% of the cell height.
BACKGROUND: fully transparent PNG. No ground, no scenery, no shadow, no glow effects outside the body.
```

**ตัวอย่างที่เติมแล้ว (หมูป่า):**

```
Create a game sprite sheet for the monster "boar": a wild boar with dark brown bristly fur, a mane along its back, curved white tusks, small fierce red eyes.
Match the look and colors of this monster in the attached reference sheet.

STYLE: 2D pixel art game sprite, top-down 3/4 RPG view, crisp pixels, clean dark outline, soft cel shading, same art style and colors as the attached reference sheet.
LAYOUT: one sprite sheet, 1024x1024 px, a 4x4 grid of equal square cells (256x256 each). No grid lines, no borders, no text, no labels, no numbers.
ROWS: row 1 = facing down (toward viewer), row 2 = facing up (away from viewer), row 3 = facing left, row 4 = facing right.
COLUMNS: 4-frame walk cycle, legs clearly alternating (frame 1 contact, frame 2 passing, frame 3 opposite contact, frame 4 passing).
CONSISTENCY: the same creature in every cell, same size, same proportions, centered in its cell, feet on the same baseline about 85% down the cell, nothing cropped. The creature should fill about 60% of the cell height.
BACKGROUND: fully transparent PNG. No ground, no scenery, no shadow, no glow effects outside the body.
```

### คำสั่งที่ 2 — ท่าโจมตี รับดาเมจ ตาย (ส่งในแชตเดิมหลังได้ท่าเดิน)

ท่าเหล่านี้ทำแค่หันขวา เพราะเกมกลับภาพซ้าย-ขวาเองได้

```
Using the exact same monster, size and style as the walk sheet you just made, create a second sprite sheet, 1024x1024 px, a 4x4 grid of equal 256x256 cells, all frames facing right:
row 1 = attack, 4 frames (wind-up, lunge, hit, recover),
row 2 = hurt, 2 frames (flinch back, recover) then 2 empty transparent cells,
row 3 = death, 4 frames (stagger, fall, lying down, fading),
row 4 = idle, 4 frames (subtle breathing).
Same baseline and scale as the walk sheet. Transparent background, no text, no grid lines, no shadow. Attack effects may extend slightly but must stay inside the cell.
```

---

## บอส 6 ตัว

บอสใช้คำสั่งเดียวกัน แต่ให้ตัวใหญ่กว่า (เต็มช่องราว 85%) และมีออร่าจาง ๆ ได้ แต่ห้ามล้นช่อง

| # | ชื่อในเกม | ชื่อไฟล์ | ลักษณะ (อังกฤษ ใช้ในคำสั่ง) |
| --- | --- | --- | --- |
| 1 | วิญญาณแห่งป่า | `boss_forest_spirit` | a majestic forest spirit stag with mossy green-teal fur, huge glowing cyan crystal antlers, glowing patterns on its body |
| 2 | เทพหมาป่าภูเขา | `boss_mountain_wolf_god` | a giant white wolf god with thick fur, glowing blue markings and a cold blue aura, fierce blue eyes |
| 3 | มังกรภูเขาดำ | `boss_black_mountain_dragon` | a black mountain dragon with dark grey scales, large purple bat-like wings, horns and glowing eyes, four legs |
| 4 | ราชาปีศาจภูเขา | `boss_mountain_demon_king` | a demon king in heavy red and black armor, large curved horns, a huge jagged sword, fiery red aura |
| 5 | วิญญาณหมาป่าศักดิ์สิทธิ์ | `boss_sacred_wolf_spirit` | a sacred wolf spirit with white and gold fur, golden flame-like mane and tail, radiant glow |
| 6 | มังกรแห่งหุบเขาหมอก | `boss_misty_valley_dragon` | a long serpentine eastern dragon with white and pale blue scales, flowing whiskers and mane, coiled body surrounded by soft mist |

### คำสั่งที่ 1 สำหรับบอส — ท่าเดิน

เปลี่ยน `[NAME]` และ `[DESCRIPTION]` ตามตารางบอส

```
Create a game sprite sheet for the boss monster "[NAME]": [DESCRIPTION].
Match the look and colors of this boss in the attached reference sheet.

STYLE: 2D pixel art game sprite, top-down 3/4 RPG view, crisp pixels, clean dark outline, soft cel shading, same art style and colors as the attached reference sheet.
LAYOUT: one sprite sheet, 1024x1024 px, a 4x4 grid of equal square cells (256x256 each). No grid lines, no borders, no text, no labels, no numbers.
ROWS: row 1 = facing down (toward viewer), row 2 = facing up (away from viewer), row 3 = facing left, row 4 = facing right.
COLUMNS: 4-frame walk cycle (for flying or serpentine bosses: a 4-frame movement loop), clearly different from frame to frame.
CONSISTENCY: the same boss in every cell, same size, same proportions, centered in its cell, feet (or lowest point) on the same baseline about 90% down the cell, nothing cropped. The boss should fill about 85% of the cell.
BACKGROUND: fully transparent PNG. No ground, no scenery. A faint aura close to the body is allowed but must stay inside the cell.
```

คำสั่งที่ 2 (ท่าโจมตี รับดาเมจ ตาย) ใช้กล่องเดียวกับมอนสเตอร์ทั่วไปได้เลย

---

## คำสั่งแก้ (ใช้เมื่อภาพไม่ผ่านรายการตรวจ)

| ปัญหา | คัดลอกไปส่ง |
| --- | --- |
| พื้นหลังไม่โปร่งใส | `Make the background fully transparent. Remove the ground, scenery and shadow. Keep everything else the same.` |
| มีตัวอักษร เส้นตาราง หรือกรอบ | `Remove all text, numbers, grid lines and borders. Keep the 4x4 layout and the creature exactly the same.` |
| ทิศผิดแถว | `Reorder the rows: row 1 facing down, row 2 facing up, row 3 facing left, row 4 facing right. Keep the frames the same.` |
| ขาไม่สลับ / 4 เฟรมเหมือนกัน | `The walk frames look identical. Redraw each row as a real 4-frame walk cycle with the legs clearly alternating.` |
| ขนาดแต่ละช่องไม่เท่ากัน | `Make the creature exactly the same size in every cell, centered, with the feet on the same baseline in every cell.` |
| หน้าตาไม่ตรงกับแบบ | `The creature does not match the attached reference. Use the exact colors, horns, markings and proportions from the reference sheet.` |
| ตัวถูกตัดขอบ | `Some frames are cropped. Shrink the creature slightly so the whole body fits inside every cell with a small margin.` |

---

## ส่งกลับมาแล้วเกิดอะไรต่อ

ผมจะ
1. ตรวจขนาด ตัดเป็นเฟรม และลบพื้นหลังถ้ายังไม่โปร่งใส
2. ปรับให้ทุกตัวสูงพอดีกับตัวละครในเกม
3. ทำภาพเปรียบเทียบในฉากเกมให้คุณอนุมัติก่อนใส่จริง
4. เชื่อมเข้ากับเกม (เดิน 4 ทิศ โจมตี รับดาเมจ ตาย) โดยเก็บแบบวาดด้วยโค้ดไว้สำรอง
