# ชุดคำสั่งทำตารางท่าสกิล: ผู้ใช้มนตรา + ผู้พิทักษ์ (สำหรับ ChatGPT) — V2-R42

ทำเหมือนตาราง ARCHER / ASSASSIN / FIGHTER / SPIRIT HEIR / HEALER ที่ทำไปแล้ว — **แนบตาราง HEALER หรือ ARCHER 1 ภาพเป็นแบบสไตล์ทุกครั้ง**
ได้ภาพแล้วส่งมา ผมตัดเป็นเอฟเฟกต์สกิลเข้าเกมด้วย `tools/build_skill_fx.py` เหมือนรอบก่อน

## กติกาที่ระบบตัดภาพต้องใช้ (สำคัญ)
- ตาราง **9 แถว × 5 คอลัมน์** (READY · WIND-UP · ACTION · RELEASE · RECOVER) มีหัวตาราง + เลขแถว 01–09 ทางซ้าย + **เส้นตารางสีเทาบาง ๆ**
- พื้นหลัง **สีน้ำเงินเข้มเรียบ** ทุกช่อง (ไม่มีลาย ไม่มีไล่สีแรง)
- ตัวผู้ใช้สกิล = **หุ่นสีเทาเรียบ ไม่มีสี** ยืนฝั่งซ้ายของช่อง หันขวา เท้าแตะเส้นเดียวกันทุกช่องในแถว
- ศัตรู/เป้าหมาย = หุ่นสีเทาอ่อน ฝั่งขวาของช่อง
- **เอฟเฟกต์ต้องมีสีสด** (ฟ้า ม่วง เขียว ทอง แดง) — ส่วนที่เป็นสีเทา/ขาวล้วนจะถูกลบออกตอนตัด
- ช่อง READY ไม่มีเอฟเฟกต์

## คำสั่ง 1/2 — ผู้ใช้มนตรา (MAGE)

```
Create a skill animation reference chart in EXACTLY the same style and layout as the attached chart.
Title at the top: "MAGE".
Grid: 9 rows x 5 columns with thin grey grid lines. Column headers: READY, WIND-UP, ACTION, RELEASE, RECOVER. Row labels on the left: 01 to 09.
Every cell has the same plain dark navy background.
The caster is a plain smooth grey mannequin (no colors, no clothes) standing on the LEFT of each cell, facing right, holding a small book; feet on the same line in every cell of a row. Enemies are light grey mannequins on the right.
All magic effects must be brightly colored and glowing; no text inside cells.
Row 01 Arcane Bolt: palm glows blue, then a blue magic orb flies forward and hits the enemy.
Row 02 Arcane Collapse: both hands raised, a blue magic circle appears above the enemy, then blue energy crashes down on it.
Row 03 Grand Annihilation (ultimate): caster floats with arms wide, huge blue runic circle on the ground, a giant blue beam of light explodes over the whole area.
Row 04 Curse Mark: two fingers point, a purple curse symbol flies and stamps on the enemy's chest.
Row 05 Arcane Bind: purple glowing chains shoot from the ground and wrap around the enemy.
Row 06 Corroding Hex (ultimate): purple-black poisonous mist spreads in a wide circle, enemies glow purple and crack.
Row 07 Talisman Seal: caster throws a glowing cyan paper talisman, it sticks to the enemy and freezes it in a cyan square.
Row 08 Seal Field: caster draws a cyan square seal on the ground, the area becomes a cyan glowing field with runes.
Row 09 Seal Burst (ultimate): many cyan talismans circle the enemy, then explode together in a big cyan blast.
```

## คำสั่ง 2/2 — ผู้พิทักษ์ (GUARDIAN)

```
Create a skill animation reference chart in EXACTLY the same style and layout as the attached chart.
Title at the top: "GUARDIAN".
Grid: 9 rows x 5 columns with thin grey grid lines. Column headers: READY, WIND-UP, ACTION, RELEASE, RECOVER. Row labels on the left: 01 to 09.
Every cell has the same plain dark navy background.
The caster is a plain smooth grey mannequin (no colors, no clothes) standing on the LEFT of each cell, facing right, holding a round shield and a short sword; feet on the same line in every cell of a row. Allies and enemies are light grey mannequins on the right.
All effects must be brightly colored and glowing; no text inside cells.
Row 01 Shield Stance: shield raised, a light-blue glowing barrier forms in front of the caster.
Row 02 Taunt: caster bangs the shield, red shockwave rings spread out and red marks appear on the enemies.
Row 03 Unbreakable Fortress (ultimate): caster plants the shield, a huge light-blue dome wall rises around him.
Row 04 Guardian Bond: a golden thread links caster and ally, a golden shield symbol appears on the ally.
Row 05 Rescue Step: caster dashes forward with a golden trail and stands in front of the ally with shield up.
Row 06 Circle of Shields (ultimate): many golden shields orbit in a wide circle around the caster and allies.
Row 07 Shield Bash: caster slams the shield forward, orange impact burst hits the enemy.
Row 08 Armor Breaker: shield edge strikes, orange cracks spread over the enemy's body.
Row 09 Retribution (ultimate): enemy attacks bounce off the shield and an orange-red blast reflects back at all enemies.
```

## ถ้าได้ภาพไม่ตรง
- หุ่นมีสี/ใส่ชุด → `keep the same chart, fix: the caster must be a plain grey mannequin with no colors`
- เอฟเฟกต์เป็นสีขาวล้วน → `make all effects brightly colored (blue / purple / cyan / gold / orange)`
- ตารางไม่ครบ 9×5 → `the chart must have exactly 9 rows and 5 columns`
