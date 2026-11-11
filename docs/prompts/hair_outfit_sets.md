# ชุดคำสั่งทรงผม + แบบชุด (สำหรับ ChatGPT) — V2-R35

ระบบในเกมตัดภาพเป็น 2 ชั้น แล้วประกอบกันเองได้ทุกคู่:
- **ภาพทรงผม** → เกมใช้เฉพาะ "หัว + ผม" (ตัวต้องใส่ **ชุดพื้นฐานเดิม**)
- **ภาพแบบชุด** → เกมใช้เฉพาะ "คอลงไป" (ผมต้อง **มัดมวยเล็กบนหัว** ให้เห็นหลังและไหล่เต็ม)

ทุกแบบทำ 3 ภาพ (เดิน / ยืน / ฟัน) ตามคำสั่งแม่แบบด้านล่าง — **แนบภาพตัวละครพื้นฐานของเพศนั้นทุกครั้ง** (ชาย: ภาพชายที่ทำตาม `male_character_sprites.md`, หญิง: `docs/prompts/ref/female_*.png`)

> กติกา: ผม **สีดำ** (ระบบเปลี่ยนสีผมเอง) · ส่วนที่อยากให้เปลี่ยนสีได้ใช้ **ดำ + แดง** · สัดส่วนหัว/ตัว **เท่าภาพแนบ** (หัวสูงประมาณ 4 ใน 10 ของตัว) ไม่งั้นคอต่อไม่พอดี · พื้นหลังขาวได้ · จำนวนเฟรมต้องตรง
> ส่งไฟล์กลับมาพร้อม **รหัสแบบ** (เช่น `m_h1`) ผมใส่ให้เอง

## รายการที่ต้องทำ (เริ่มชุดแรก)

| รหัส | เพศ | ประเภท | ชื่อในเกม | คำอธิบายสำหรับใส่ในคำสั่ง [DESCRIPTION] |
| --- | --- | --- | --- | --- |
| m_h1 | ชาย | ทรงผม | มัดหาง | `black hair tied into a ponytail at the back of the head, red cloth headband kept` |
| m_h2 | ชาย | ทรงผม | ถักเปียข้าง | `black hair with one long braid hanging over the right shoulder, short sides, red cloth band at the braid end` |
| m_h3 | ชาย | ทรงผม | ผมยาวปล่อย | `long straight black hair loose to the shoulder blades, side-swept bangs, no headband` |
| f_h1 | หญิง | ทรงผม | มวยกลม | `black hair in a round bun on top of the head wrapped with a red cloth ribbon, short bangs` |
| f_h2 | หญิง | ทรงผม | ถักเปียคู่ | `black hair in two long braids hanging in front of the shoulders, red ribbons at the braid ends, straight bangs` |
| f_h3 | หญิง | ทรงผม | ปล่อยยาวตรง | `very long straight black hair loose to the waist, a small red flower hair pin on one side` |
| m_o1 | ชาย | ชุด | เกราะหนังนักรบ | `brown leather chest armor with shoulder pads over the black jacket, red embroidered sleeves, leather bracers, black trousers, red sash` |
| m_o2 | ชาย | ชุด | ชุดพิธีเงิน | `festival Hmong clothing: black jacket covered with rows of silver coins and silver chains on the chest, wide red embroidered collar, red sash with silver tassels, black trousers` |
| f_o1 | หญิง | ชุด | เกราะหนังนักรบ | `brown leather chest armor and shoulder guard over the black top, red embroidered sleeves, black pleated skirt with red band, leather boots` |
| f_o2 | หญิง | ชุด | ชุดพิธีเงิน | `festival Hmong clothing: black jacket with rows of silver coins on the front, large silver neck rings, red and pink embroidered collar, black pleated skirt with colorful embroidered band, red sash with silver coins` |

## แม่แบบ A — ทรงผม (แทน [DESCRIPTION] ด้วยคำอธิบายจากตาราง)

**A1 ท่าเดิน**
```
Same character as the attached sprite sheet — same face, body, outfit, colors, style, pixel size and proportions. Change ONLY the hairstyle to: [DESCRIPTION].
Keep the clothes exactly the same as the attached image. Hair must be pure dark black.
Canvas: 384 x 496 px, 4 columns x 4 rows, each cell 96 x 124 px, no gaps, no text.
Row 1 facing down, Row 2 facing up (back), Row 3 facing left, Row 4 facing right; 4 walk frames per row with legs alternating.
Same size and same feet baseline in every frame, character centered in each cell. Plain white background.
```
**A2 ท่ายืน**
```
Same character and same new hairstyle as the previous image ([DESCRIPTION]).
Canvas: 480 x 124 px, 5 frames in one row (96 x 124 each), facing down, idle breathing (hair and ribbons move slightly), feet on the same baseline. Plain white background, no text.
```
**A3 ท่าฟัน**
```
Same character and same new hairstyle ([DESCRIPTION]), same style as the attached attack sheet.
Canvas: 960 x 124 px, 4 frames in one row (240 x 124 each), facing right: 1 wind-up, 2 slash forward, 3 follow-through, 4 recover.
Body stays in the same place, only arms, sword and hair move. No effects, no text. Plain white background.
```

## แม่แบบ B — แบบชุด (แทน [DESCRIPTION] ด้วยคำอธิบายจากตาราง)

**B1 ท่าเดิน**
```
Same character as the attached sprite sheet — same face, body proportions, style and pixel size. Change ONLY the clothing to: [DESCRIPTION].
IMPORTANT: tie the hair into a SMALL BUN on top of the head so the neck, shoulders and back of the clothing are fully visible in every direction. Hair pure dark black.
Canvas: 384 x 496 px, 4 columns x 4 rows, each cell 96 x 124 px, no gaps, no text.
Row 1 facing down, Row 2 facing up (back), Row 3 facing left, Row 4 facing right; 4 walk frames per row with legs alternating.
Same size and same feet baseline in every frame, character centered in each cell. Plain white background.
```
**B2 ท่ายืน**
```
Same character, same new clothing ([DESCRIPTION]) and same small bun hairstyle as the previous image.
Canvas: 480 x 124 px, 5 frames in one row (96 x 124 each), facing down, idle breathing, feet on the same baseline. Plain white background, no text.
```
**B3 ท่าฟัน**
```
Same character, same new clothing ([DESCRIPTION]) and small bun hairstyle, same style as the attached attack sheet.
Canvas: 960 x 124 px, 4 frames in one row (240 x 124 each), facing right: 1 wind-up, 2 slash forward, 3 follow-through, 4 recover.
Body stays in the same place, only arms and sword move. No effects, no text. Plain white background.
```

## ลำดับที่แนะนำ
1. ทำตัวชายใหม่ให้เสร็จก่อน (`male_character_sprites.md`) — เป็นแบบของทรงผม/ชุดชาย
2. ทำทีละรหัส ส่งมาครบ 3 ภาพต่อรหัส (ส่งทีละรหัสได้ ไม่ต้องรอครบทุกแบบ)
3. ผมรัน `tools/build_char_sets.py` → แบบใหม่ขึ้นในหน้าสร้าง/แต่งตัวละครทันที และผสมกับทุกทรงผม/ชุด/สีได้
