# ชุดคำสั่งทำภาพตัวละครชายใหม่ (สำหรับ ChatGPT) — V2-R35

ทำให้ตัวชายเข้าชุดกับตัวหญิงที่เพิ่งทำ (สไตล์ สัดส่วน ความคมของพิกเซล เดียวกัน)

**แนบภาพทุกครั้ง** (ใช้เป็นแบบ):
- ตัวหญิง (แบบสไตล์): `docs/prompts/ref/female_walk_384x496.png`, `female_idle_480x124.png`, `female_attack_960x124.png`
- ตัวชายเดิม (แบบหน้าตา/ทรงผม/ผ้าคาดหัว): `docs/prompts/ref/male_walk_384x496.png`

> กติกาสีที่ต้องทำตาม (ระบบแต่งตัวในเกมเปลี่ยนสีอัตโนมัติ): **ผมสีดำ**, **ชุดพื้นสีดำ**, **ลายปัก/ผ้าคาดสีแดง** — ห้ามใช้สีอื่นเป็นสีหลัก
> พื้นหลังเป็นสีขาวหรือลายตารางได้ (ผมลบให้) ขนาดไม่ตรงเป๊ะก็ได้ (ผมปรับให้) แต่ **จำนวนเฟรมและลำดับต้องตรง**

## คำสั่ง 1/3 — ท่าเดิน 4 ทิศ

```
Create a pixel-art sprite sheet of a chibi Hmong MALE swordsman. He must look like the male counterpart of the attached female swordswoman: EXACTLY the same art style, pixel size, outline thickness, shading, proportions (about 4 heads tall), red eyes and overall size. Keep the face, short spiky black hair and red embroidered headband of the attached old male sprite.
Canvas: 384 x 496 px, PNG, 4 columns x 4 rows, each cell 96 x 124 px, no gaps, no borders, no text.
Row 1: facing down (toward camera), 4 walk frames with legs clearly alternating.
Row 2: facing up (back view), 4 walk frames.
Row 3: facing left, 4 walk frames.
Row 4: facing right, 4 walk frames.
Feet touch the same baseline in every cell, character centered horizontally, same size in every frame.
Outfit: traditional Hmong men's clothing — short black jacket with red cross-stitch embroidered collar, cuffs and hem, wide black trousers with a red embroidered band at the ankles, long red sash belt with hanging ends, small silver neck ring, black cloth shoes, a sheathed sword on the hip (same sword as the female).
Main colors only: black (hair and clothes base) and red (embroidery, sash, headband), plus skin and silver. Hair must be pure dark black.
Plain white or transparent background.
```

## คำสั่ง 2/3 — ท่ายืนหายใจ (หันหน้า)

```
Same male character, same style as the male walk sheet and the attached female idle sheet.
Canvas: 480 x 124 px, PNG, 5 frames in one row, each frame 96 x 124 px.
Facing down (toward camera), idle breathing animation: subtle up/down of shoulders and the headband tails, feet stay planted on the same baseline, centered in each frame.
Plain white or transparent background, no text.
```

## คำสั่ง 3/3 — ท่าฟันดาบ (หันขวา)

```
Same male character, same style as the attached female attack sheet.
Canvas: 960 x 124 px, PNG, 4 frames in one row, each frame 240 x 124 px.
Facing right, sword attack: 1 wind-up (sword raised behind), 2 slash forward (arm extended), 3 follow-through (sword low in front), 4 recover (back to ready stance, sword at the side).
The body stays in the same place in every frame (feet on the same baseline); only the arms and sword move. The sword may extend to the right side of the frame.
No slash effect, no glow, no text — only the character and sword. Plain white or transparent background.
```

## ส่งไฟล์กลับมา
ส่งภาพ 3 ไฟล์มาได้เลย — ผมจะลบพื้นหลัง จัดขนาด/ตำแหน่งเท้าให้ตรงกับตัวหญิง ทำเครื่องหมายส่วนผม (ให้ระบบเปลี่ยนสีผม/ชุดใช้ได้) แล้วใส่แทนตัวชายเดิม
ถ้าภาพที่ได้ไม่ถูกใจ (หน้าไม่เหมือน/ขาไม่สลับ) ให้สั่งซ้ำพร้อมบอกจุดที่ต้องแก้ เช่น "keep the same character, fix: legs must alternate in row 3"
