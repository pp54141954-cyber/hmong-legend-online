# ชุดคำสั่งทำภาพตัวละครหญิง (สำหรับ ChatGPT) — V2-R30

แนบภาพตัวละครชายที่อนุมัติแล้ว 3 ไฟล์ทุกครั้ง (ใช้เป็นแบบสัดส่วน/สไตล์/ตำแหน่งเท้า):
`docs/prompts/ref/male_walk_384x496.png`, `male_idle_480x124.png`, `male_attack_960x124.png`

> กติกาสีที่ต้องทำตาม (ระบบแต่งตัวในเกมเปลี่ยนสีอัตโนมัติ): **ผมสีดำ**, **ชุดพื้นสีดำ**, **ลายปัก/ผ้าคาดสีแดง** — ห้ามใช้สีอื่นเป็นสีหลัก ไม่งั้นเปลี่ยนสีผม/ชุดในเกมไม่ได้

## คำสั่ง 1/3 — ท่าเดิน 4 ทิศ

```
Create a pixel-art sprite sheet of a chibi Hmong FEMALE swordswoman, matching EXACTLY the style, proportions (about 4 heads tall), outline, shading and palette of the attached male sprite sheet.
Canvas: 384 x 496 px, fully transparent background, PNG.
Grid: 4 columns x 4 rows, each cell 96 x 124 px, no gaps, no borders, no text.
Row 1: facing down (toward camera), 4 walk frames with legs alternating.
Row 2: facing up (back view), 4 walk frames.
Row 3: facing left, 4 walk frames.
Row 4: facing right, 4 walk frames.
Feet touch y = 118 inside every cell, character centered horizontally in each cell, same size in every frame.
Outfit: traditional Hmong women's clothing — black jacket with red cross-stitch embroidered collar and cuffs, black pleated skirt with a red embroidered band, red sash belt, small silver neck ring, black long hair tied with a red cloth band (hair must be pure dark black so it can be recolored), red eyes like the male, a short sword on the hip.
Main colors only: black (hair, clothes base) and red (embroidery, sash, accents), plus skin and silver.
```

## คำสั่ง 2/3 — ท่ายืนหายใจ (หันหน้า)

```
Same character, same style as the female walk sheet and the attached male idle sheet.
Canvas: 480 x 124 px, transparent PNG, 5 frames in one row, each frame 96 x 124 px.
Facing down (toward camera), idle breathing animation (subtle up/down of shoulders and hair), feet at y = 118, centered in each frame.
```

## คำสั่ง 3/3 — ท่าฟันดาบ (หันขวา)

```
Same character, same style as the attached male attack sheet.
Canvas: 960 x 124 px, transparent PNG, 4 frames in one row, each frame 240 x 124 px.
Facing right, sword attack: 1 wind-up, 2 slash forward, 3 follow-through, 4 recover.
The character's body center stays at x = 84 inside every frame (same place as the male sheet), feet at y = 118; the sword and slash may extend to the right.
No slash effect or text — only the character and sword.
```

## ส่งไฟล์กลับมา
ส่ง PNG 3 ไฟล์ตามขนาดข้างบน (ถ้าขนาดไม่ตรง ส่งมาได้ ผมปรับให้) — เมื่อได้ภาพแล้ว ตัวละครหญิงในเกมจะใช้ภาพจริงแทนผมยาวประกอบชั่วคราว และระบบเปลี่ยนสีผม/ชุดใช้ได้ทันที
