# ชุดคำสั่งทำภาพท่าทางแต่ละอาชีพ (สำหรับ ChatGPT) — V2-R38

ใช้ทำภาพท่าทางตอนโจมตี/ใช้สกิลของ 7 อาชีพ (นักดาบมีแล้ว) — **อาชีพละ 1 ภาพต่อเพศ** (ชาย + หญิง = 14 ภาพ)
ทำทีละภาพ ส่งมาพร้อมบอก **อาชีพ + เพศ** ผมจะตัด จัดขนาด และผูกท่าเข้ากับสกิลให้

## แนบภาพทุกครั้ง
- ตัวชาย: `docs/prompts/ref/male_attack_960x124.png` (ภาพท่าฟันชายใหม่ที่คุณทำ) + ภาพเดินชาย
- ตัวหญิง: `docs/prompts/ref/female_attack_960x124.png` + `female_walk_384x496.png`
- ตารางท่าของอาชีพนั้น (ARCHER / ASSASSIN / FIGHTER / SPIRIT HEIR / HEALER ที่คุณทำไว้) — ใช้เป็นแบบท่าทาง

## กติกาสำคัญ (ระบบในเกมต้องใช้)
- **ตัวละครเดิม** หน้า/ผม/ชุดเหมือนภาพแนบ — ผม **ดำ**, ชุดพื้น **ดำ** ลาย **แดง** (ระบบเปลี่ยนสีผม/ชุดเอง)
- **หันขวาทุกเฟรม**, ลำตัวอยู่ตำแหน่งเดิมทุกเฟรม เท้าแตะเส้นเดียวกัน — ขยับแค่แขน/อาวุธ/ลำตัวท่อนบน
- **ไม่ใส่เอฟเฟกต์ ไม่มีแสง ไม่มีตัวหนังสือ** (เอฟเฟกต์ในเกมวาดแยกแล้ว) — มีแค่ตัวละครกับอาวุธ
- พื้นหลังขาวได้ · ขนาดไม่เป๊ะก็ได้ (ผมปรับให้) · **แต่ต้องเป็น 4 แถว × 4 เฟรมเสมอ**

## แม่แบบคำสั่ง (แทน [CLASS], [WEAPON], [ROW1]–[ROW4] จากตารางด้านล่าง)

```
Same character as the attached sprite sheets — same face, hair, body proportions, black-and-red Hmong outfit, pixel-art style, pixel size and outline. This character is now a [CLASS] holding [WEAPON] (replace the sword with this weapon).
Use the attached [CLASS] pose chart only as a reference for the body poses.
Canvas: 960 x 496 px, PNG, 4 rows x 4 columns, each cell 240 x 124 px, no gaps, no borders, no text.
The character always FACES RIGHT. The body center stays at the same x position (about 84 px from the left of each cell) and the feet stay on the same baseline in every frame; only arms, upper body and weapon move. The weapon may extend to the right side of the cell.
Row 1 (4 frames): [ROW1]
Row 2 (4 frames): [ROW2]
Row 3 (4 frames): [ROW3]
Row 4 (4 frames): [ROW4]
Hair pure dark black, clothes black with red embroidery. NO glow, NO magic effects, NO motion lines, NO text. Plain white background.
```

## ค่าที่ใส่แต่ละอาชีพ

### นักธนู (ARCHER)
- [CLASS] `Hmong archer` · [WEAPON] `a wooden recurve bow with red cloth wraps, and a quiver of arrows on the back`
- [ROW1] `basic shot: 1 hold bow ready, 2 nock arrow, 3 full draw aiming forward, 4 release with bow arm extended`
- [ROW2] `power shot (charts 01–03): 1 crouch low gathering strength, 2 rise and draw bow fully, 3 hold full draw leaning back, 4 release and step back`
- [ROW3] `trap throw (charts 04–06): 1 reach to belt pouch, 2 wind up arm, 3 throw underhand forward, 4 kneel and touch the ground`
- [ROW4] `sky volley (charts 07–09): 1 draw bow aimed upward 45 degrees, 2 full draw upward, 3 release upward, 4 recover to standing`

### นักฆ่า (ASSASSIN)
- [CLASS] `Hmong assassin` · [WEAPON] `two short curved daggers, one in each hand, and a dark red cloth mask over the lower face`
- [ROW1] `basic attack: 1 low crouch with daggers ready, 2 lunge forward, 3 slash across, 4 return to crouch`
- [ROW2] `shadow dash (charts 01–03): 1 crouch very low, 2 dash forward body almost horizontal, 3 cross both daggers in an X slash, 4 land in crouch`
- [ROW3] `poison (charts 04–06): 1 hold a small vial up, 2 pour it on the dagger, 3 flick the hand forward throwing needles, 4 ready stance`
- [ROW4] `spirit strike (charts 07–09): 1 kneel with eyes closed, 2 point two fingers forward, 3 thrust one dagger far forward, 4 recover`

### นักสู้ (FIGHTER)
- [CLASS] `Hmong martial artist` · [WEAPON] `no weapon, red cloth hand wraps on both fists, sleeves rolled up`
- [ROW1] `basic attack: 1 guard stance fists up, 2 step in, 3 straight punch fully extended, 4 return to guard`
- [ROW2] `combo and ground slam (charts 01–03): 1 left jab, 2 right punch, 3 both fists raised high, 4 smash both fists down to the ground in a low squat`
- [ROW3] `iron body and throw (charts 04–06): 1 flex arms crossed in front, 2 brace shoulder forward, 3 grab forward with both hands, 4 throw over the shoulder downward`
- [ROW4] `beast form (charts 07–09): 1 drop to all fours like a tiger, 2 pounce forward low, 3 claw swipe with one hand, 4 roar with chest out and arms wide`

### ผู้สืบวิญญาณ (SPIRIT HEIR)
- [CLASS] `Hmong spirit heir (shaman)` · [WEAPON] `a wooden staff topped with a silver ring and red tassels, a silver neck ring`
- [ROW1] `basic attack: 1 hold staff upright, 2 swing staff back, 3 thrust staff tip forward, 4 return upright`
- [ROW2] `call ancestors (charts 01–03): 1 hands together in prayer with staff, 2 arms open wide, 3 both arms raised up to the sky, 4 point staff forward`
- [ROW3] `summon beast (charts 04–06): 1 crouch and touch the ground, 2 rise with one palm forward, 3 command pointing forward, 4 both palms pushing forward`
- [ROW4] `spirit bond (charts 07–09): 1 stretch one hand pulling something, 2 pull back with both hands, 3 yank hard leaning back, 4 snap the hand open`

### ผู้รักษา (HEALER)
- [CLASS] `Hmong healer` · [WEAPON] `a short wooden staff with green leaves and a silver bell, a small herb pouch on the belt`
- [ROW1] `basic attack: 1 hold staff, 2 raise staff, 3 point staff forward, 4 lower staff`
- [ROW2] `healing (charts 01–03): 1 hands cupped at the chest, 2 push both palms gently forward, 3 arms open wide to the sides, 4 return to calm stance`
- [ROW3] `blessing (charts 04–06): 1 raise one hand high, 2 kneel and touch the ground, 3 rise with arms spreading, 4 hands together`
- [ROW4] `judgement (charts 07–09): 1 point one finger forward, 2 thrust palm forward, 3 both arms raised high to the sky, 4 bring arms down`

### ผู้ใช้มนตรา (MAGE) — ยังไม่มีตาราง ใช้คำบรรยายนี้
- [CLASS] `Hmong mage` · [WEAPON] `a paper talisman book in the left hand and a short ritual dagger in the right hand`
- [ROW1] `basic attack: 1 hold book open, 2 draw back the right hand, 3 push the right palm forward, 4 recover`
- [ROW2] `destruction: 1 both hands together, 2 raise both hands, 3 slam both palms forward, 4 recover`
- [ROW3] `curse: 1 hold a talisman between two fingers, 2 flick the talisman forward, 3 clench the fist, 4 recover`
- [ROW4] `seal: 1 draw a square in the air, 2 palm forward, 3 both arms crossed, 4 arms thrown open`

### ผู้พิทักษ์ (GUARDIAN) — ยังไม่มีตาราง ใช้คำบรรยายนี้
- [CLASS] `Hmong guardian` · [WEAPON] `a large round wooden shield with red Hmong patterns on the left arm and a short sword in the right hand`
- [ROW1] `basic attack: 1 shield up, 2 step in, 3 sword thrust beside the shield, 4 recover`
- [ROW2] `fortress: 1 plant feet wide, 2 raise shield in front of the face, 3 brace low behind the shield, 4 stand tall`
- [ROW3] `protector: 1 turn and reach back with the shield, 2 step forward, 3 sweep the shield in an arc, 4 recover`
- [ROW4] `shield bash: 1 pull shield back, 2 charge forward, 3 slam the shield forward, 4 recover`

## ลำดับที่แนะนำ
1. นักธนู ชาย → ส่งมาให้ผมลองใส่ก่อน 1 ภาพ (ดูว่าท่าตรงกับสกิลดีไหม)
2. ถ้าโอเค ทำอาชีพที่เหลือ ชาย/หญิง
3. ถ้าได้ภาพแปลก (หันซ้าย/ตัวเลื่อน/มีเอฟเฟกต์) สั่งซ้ำ: `keep the same character, fix: face right in every frame, no effects`
