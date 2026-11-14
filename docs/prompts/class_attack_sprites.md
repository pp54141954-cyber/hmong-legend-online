# ชุดคำสั่งทำภาพท่าโจมตีแต่ละอาชีพ (สำหรับ ChatGPT) — V2-R53

ใช้ทำภาพ **ท่าโจมตีที่วาดจริง** แทนท่าที่เกมสร้างจากภาพเดิน (V2-R52) ของ 7 อาชีพที่มีตัวละครประจำอาชีพแล้ว
- ทำ **อาชีพละ 1 ภาพต่อเพศ** (ชาย + หญิง = 14 ภาพ)
- นักดาบ **ไม่ต้องทำ** เพราะมีภาพท่าฟันจริงอยู่แล้ว
- ทำทีละภาพ แล้วส่งมาพร้อมบอก **อาชีพ + เพศ** (เช่น "นักธนู ชาย") ผมจะตัดภาพ จัดขนาด แล้วใส่เข้าเกมให้

## แนบภาพทุกครั้ง (1 ภาพ)
แนบภาพเดินของตัวละครอาชีพนั้น ซึ่งผมเตรียมไว้ที่ `docs/prompts/ref/` (เป็นภาพเดียวกับที่อยู่ในเกม) ภาพนี้คือแบบหน้าตา ชุด อาวุธ และขนาดตัวที่ต้องคงไว้

| อาชีพ | ชาย | หญิง |
| --- | --- | --- |
| นักธนู | `class_archer_m_walk.png` | `class_archer_f_walk.png` |
| นักฆ่า | `class_assassin_m_walk.png` | `class_assassin_f_walk.png` |
| นักสู้ | `class_fighter_m_walk.png` | `class_fighter_f_walk.png` |
| ผู้สืบวิญญาณ | `class_spirit_m_walk.png` | `class_spirit_f_walk.png` |
| ผู้รักษา | `class_healer_m_walk.png` | `class_healer_f_walk.png` |
| ผู้ใช้มนตรา | `class_mage_m_walk.png` | `class_mage_f_walk.png` |
| ผู้พิทักษ์ | `class_guardian_m_walk.png` | `class_guardian_f_walk.png` |

## กติกาที่ระบบตัดภาพต้องใช้
- **ผังเหมือนภาพเดินที่แนบ:** 4 แถว × 4 เฟรม
  - แถว 1 = หันหน้าเข้ากล้อง (ลง)
  - แถว 2 = หันหลัง (ขึ้น)
  - แถว 3 = หันซ้าย
  - แถว 4 = หันขวา
- **4 เฟรมในแต่ละแถว:**
  1. ง้าง
  2. ฟาด/ปล่อย (ยืดสุด)
  3. ตามแรง
  4. กลับท่าพร้อม
- **ตัวละครเดิมทุกอย่าง:** หน้า ผม ชุด อาวุธ สี และขนาดตัวเท่ากับภาพที่แนบ
- **เท้าอยู่ที่เส้นเดียวกันทุกเฟรม** ในแถวเดียวกัน ลำตัวก้าวหรือโน้มได้นิดหน่อย แต่ต้องไม่เดินออกจากช่อง
- **เว้นช่องว่างระหว่างเฟรมให้ชัด** อาวุธ แขน หรือขาต้องไม่ล้ำไปแตะเฟรมข้าง ๆ และแถวต้องไม่ชนกัน (ระบบแยกเฟรมจากช่องว่าง)
- **ห้ามมีเอฟเฟกต์ แสง เส้นความเร็ว เงา ตัวหนังสือ หรือเส้นตาราง** เพราะเกมวาดเอฟเฟกต์เองแล้ว มีแค่ตัวละครกับอาวุธ
- **พื้นหลังสีขาวเรียบทั้งภาพ** ไม่มีเงาพื้นใต้เท้า

## แม่แบบคำสั่ง
แทน `[CLASS]`, `[WEAPON]` และ `[F1]`–`[F4]` ด้วยค่าจากตารางของอาชีพนั้นด้านล่าง

```
Same character as the attached sprite sheet — exactly the same face, hair, outfit, colors, weapon, pixel-art style, outline and body size. This is a [CLASS] using [WEAPON].
Make an ATTACK animation sprite sheet with the SAME layout as the attached walk sheet: 4 rows x 4 frames.
Row 1: facing DOWN (toward the camera). Row 2: facing UP (back to the camera). Row 3: facing LEFT. Row 4: facing RIGHT.
The same 4 attack frames in every row, drawn for that direction:
Frame 1: [F1]
Frame 2: [F2]
Frame 3: [F3]
Frame 4: [F4]
Feet stay on the same baseline in every frame of a row; the body may lean or step slightly but stays in its own space.
Leave clear empty space between all frames and rows — the weapon, arms and legs must never touch the neighbouring frame.
NO effects, NO glow, NO motion lines, NO shadows, NO text, NO grid lines. Plain solid white background.
```

## ค่าที่ใส่แต่ละอาชีพ

### นักธนู
- `[CLASS]` `Hmong archer`
- `[WEAPON]` `the same bow and arrows as in the attached sheet`
- `[F1]` `pull an arrow from the quiver and nock it on the string, bow held low`
- `[F2]` `full draw: bow arm straight toward the facing direction, string pulled back to the cheek`
- `[F3]` `release: string snapped forward, drawing hand flung back and open, body leaning back slightly`
- `[F4]` `lower the bow back to ready stance`

### นักฆ่า
- `[CLASS]` `Hmong assassin`
- `[WEAPON]` `the same twin daggers as in the attached sheet, one in each hand`
- `[F1]` `crouch low, both daggers pulled back behind the body`
- `[F2]` `lunge forward low and fast, front dagger stabbing far toward the facing direction`
- `[F3]` `second dagger slashes across in front, body twisted`
- `[F4]` `hop back into low crouch with daggers ready`

### นักสู้
- `[CLASS]` `Hmong martial artist`
- `[WEAPON]` `bare fists with the same hand wraps as in the attached sheet`
- `[F1]` `guard stance, rear fist pulled back to the hip, knees bent`
- `[F2]` `big step forward and straight punch fully extended toward the facing direction`
- `[F3]` `follow-up hook with the other fist, shoulders turned`
- `[F4]` `return to guard stance with both fists up`

### ผู้สืบวิญญาณ
- `[CLASS]` `Hmong spirit heir (shaman)`
- `[WEAPON]` `the same item the character holds in the attached sheet; if the hands are empty, a folded paper spirit talisman held between two fingers`
- `[F1]` `draw the hand back to the shoulder, other hand open in front like a prayer`
- `[F2]` `thrust the hand (and talisman) forward toward the facing direction, arm fully straight`
- `[F3]` `sweep the arm outward, palm open, sleeves and ribbons swinging`
- `[F4]` `bring hands back together at the chest`

### ผู้รักษา
- `[CLASS]` `Hmong healer`
- `[WEAPON]` `the same staff as in the attached sheet`
- `[F1]` `raise the staff up beside the head with both hands`
- `[F2]` `swing the staff head forward and down toward the facing direction`
- `[F3]` `staff pointed forward, free hand open palm forward`
- `[F4]` `bring the staff back upright to ready stance`

### ผู้ใช้มนตรา
- `[CLASS]` `Hmong mage`
- `[WEAPON]` `the same magic staff as in the attached sheet`
- `[F1]` `lift the staff high above the head, free hand drawn back`
- `[F2]` `point the staff tip straight toward the facing direction, free hand pushing forward with open palm`
- `[F3]` `staff held forward, body leaning in, robe and hat swinging`
- `[F4]` `lower the staff back to ready stance`

### ผู้พิทักษ์
- `[CLASS]` `Hmong guardian`
- `[WEAPON]` `the same shield and sword as in the attached sheet`
- `[F1]` `shield raised in front, sword pulled back behind the shield`
- `[F2]` `step forward and bash with the shield toward the facing direction`
- `[F3]` `sword thrust forward past the shield edge`
- `[F4]` `return to guard behind the shield`

## ลำดับที่แนะนำ
1. ทำ **นักสู้ ชาย** ก่อน 1 ภาพ (ท่าชัดที่สุด) แล้วส่งมาให้ผมลองใส่เกม เพื่อเช็กขนาดและทิศ
2. ถ้าใช้ได้ ทำอาชีพที่เหลือ ทั้งชายและหญิง
3. ถ้าภาพออกมาผิด สั่งแก้ซ้ำ เช่น:
   - ตัวละครเปลี่ยนหน้าหรือชุด → `keep exactly the same character as the attached sheet`
   - มีแสงหรือเอฟเฟกต์ → `remove all effects, glow and motion lines`
   - เฟรมชนกัน → `add more empty space between frames`
   - ทิศสลับ → `row 3 must face LEFT and row 4 must face RIGHT`

## สิ่งที่ผมทำเมื่อได้ภาพ
- ตัดภาพด้วยวิธีเดียวกับภาพเดิน (`tools/build_class_bodies.py` แบบ grid4) ให้ขนาดและจุดเท้าตรงกับตัวละครในเกม
- ใช้ 4 เฟรมนี้แทนท่าที่สร้างจากภาพเดินในทุกทิศ ทั้งการโจมตีปกติและการใช้สกิล โดยยังมีเอฟเฟกต์สกิลจากตารางเหมือนเดิม
- อาชีพที่ยังไม่มีภาพ ใช้ท่าแบบเอี้ยวตัว (V2-R52) ต่อไปได้ เกมไม่พัง
