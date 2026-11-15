# ชุดคำสั่งทำเฟรมสกิล 4 ทิศทาง (สำหรับ ChatGPT) — V2-R43

## ทิศไหนต้องทำ
| ทิศ | สถานะ |
| --- | --- |
| ขวา → | **มีแล้ว** (ตารางเดิม 7 อาชีพ) |
| ซ้าย ← | **ไม่ต้องทำ** เกมกลับด้านภาพขวาให้เอง |
| ลง ↓ (หันเข้าหากล้อง) | **ทำใหม่** — ตาราง DOWN |
| ขึ้น ↑ (หันหลังให้กล้อง) | **ทำใหม่** — ตาราง UP |

ทำ **อาชีพละ 2 ตาราง** (DOWN + UP) = 14 ภาพ · นักดาบยังไม่มีตาราง ทำ 3 ตาราง (RIGHT + DOWN + UP)
ทำทีละภาพ — **แนบตารางเดิมของอาชีพนั้นทุกครั้ง** (เช่น ARCHER) ให้เอฟเฟกต์เหมือนเดิม แค่หันทิศใหม่
ส่งมาพร้อมบอก **อาชีพ + ทิศ** (เช่น "ARCHER DOWN") ผมตัดเข้าเกมด้วย `tools/build_skill_fx.py`

## กติกาที่ระบบตัดภาพต้องใช้ (เหมือนเดิม + ตำแหน่งหุ่นใหม่)
- ตาราง 9 แถว × 5 คอลัมน์ (READY · WIND-UP · ACTION · RELEASE · RECOVER), เลขแถว 01–09, เส้นตารางสีเทาบาง, พื้นน้ำเงินเข้มเรียบ
- **แถวที่ 01–09 ต้องเป็นสกิลเดียวกับแถวเดียวกันในตารางเดิม** (ลำดับห้ามสลับ)
- ผู้ใช้สกิล = หุ่นสีเทาเรียบ ไม่มีสี · เป้าหมาย = หุ่นเทาอ่อน · เอฟเฟกต์ต้องมีสีสด · ช่อง READY ไม่มีเอฟเฟกต์
- **DOWN:** หุ่นผู้ใช้สกิลอยู่ **ด้านบนตรงกลางช่อง** หันหน้าเข้าหากล้อง เอฟเฟกต์พุ่ง/ตกลง **ด้านล่าง** ของช่อง เป้าหมายอยู่ด้านล่าง
- **UP:** หุ่นผู้ใช้สกิลอยู่ **ด้านล่างตรงกลางช่อง** หันหลังให้กล้อง เอฟเฟกต์พุ่ง/ตกขึ้น **ด้านบน** ของช่อง เป้าหมายอยู่ด้านบน (ตัวเล็กกว่าเพราะไกล)
- เท้าหุ่นผู้ใช้สกิลอยู่ตำแหน่งเดียวกันทุกช่องในแถว

## แม่แบบคำสั่ง — DOWN (แทน [CLASS] ด้วยชื่อตาราง เช่น ARCHER)

```
Redraw the attached [CLASS] skill chart with every skill facing DOWN (toward the camera).
Keep EXACTLY the same style, layout, title "[CLASS] - DOWN", 9 rows x 5 columns (READY, WIND-UP, ACTION, RELEASE, RECOVER), row labels 01-09, thin grey grid lines and plain dark navy background.
Each row must be the SAME skill with the SAME colors and effects as the same row in the attached chart — only the direction changes.
In every cell the caster (plain smooth grey mannequin, no colors) stands at the TOP CENTER of the cell, front view facing the camera, feet on the same spot in every cell of a row. Targets (light grey mannequins) are at the BOTTOM of the cell.
Projectiles, beams, dashes and slashes travel DOWNWARD toward the bottom of the cell; ground circles and area effects appear below the caster.
Effects must be brightly colored and glowing. No text inside cells.
```

## แม่แบบคำสั่ง — UP

```
Redraw the attached [CLASS] skill chart with every skill facing UP (away from the camera).
Keep EXACTLY the same style, layout, title "[CLASS] - UP", 9 rows x 5 columns (READY, WIND-UP, ACTION, RELEASE, RECOVER), row labels 01-09, thin grey grid lines and plain dark navy background.
Each row must be the SAME skill with the SAME colors and effects as the same row in the attached chart — only the direction changes.
In every cell the caster (plain smooth grey mannequin, no colors) stands at the BOTTOM CENTER of the cell, back view facing away from the camera, feet on the same spot in every cell of a row. Targets (light grey mannequins, slightly smaller) are at the TOP of the cell.
Projectiles, beams, dashes and slashes travel UPWARD toward the top of the cell; ground circles and area effects appear above the caster.
Effects must be brightly colored and glowing. No text inside cells.
```

## รายการที่ต้องทำ

| ลำดับ | อาชีพ | ไฟล์ที่แนบ | ตารางที่ทำ |
| --- | --- | --- | --- |
| 1 | นักธนู | ARCHER | ARCHER - DOWN, ARCHER - UP |
| 2 | นักฆ่า | ASSASSIN | ASSASSIN - DOWN, ASSASSIN - UP |
| 3 | นักสู้ | FIGHTER | FIGHTER - DOWN, FIGHTER - UP |
| 4 | ผู้สืบวิญญาณ | SPIRIT HEIR | SPIRIT HEIR - DOWN, SPIRIT HEIR - UP |
| 5 | ผู้รักษา | HEALER | HEALER - DOWN, HEALER - UP |
| 6 | ผู้ใช้มนตรา | MAGE | MAGE - DOWN, MAGE - UP |
| 7 | ผู้พิทักษ์ | GUARDIAN | GUARDIAN - DOWN, GUARDIAN - UP |
| 8 | นักดาบ | (ตารางอาชีพใดก็ได้ 1 ภาพ เป็นแบบสไตล์) | SWORDSMAN (ขวา) ก่อน แล้วค่อย DOWN, UP |

## นักดาบ — ตาราง SWORDSMAN (ทิศขวา) ทำก่อน
```
Create a skill animation reference chart in EXACTLY the same style and layout as the attached chart.
Title "SWORDSMAN". 9 rows x 5 columns (READY, WIND-UP, ACTION, RELEASE, RECOVER), row labels 01-09, thin grey grid lines, plain dark navy background.
The caster is a plain smooth grey mannequin holding a sword, on the LEFT of each cell facing right; targets are light grey mannequins on the right. Effects brightly colored and glowing, no text inside cells.
Row 01 Arcane Blade: gold runes circle the sword, the blade glows gold.
Row 02 Seal Strike: red crescent slash, a red seal stamps on the enemy.
Row 03 Awakened Edge (ultimate): a large purple crescent wave flies forward through enemies.
Row 04 Stone Splitter: orange slash upward, stone spikes burst from the ground in a line.
Row 05 Cliff Wave: sword stabbed into the ground, cracks run forward, a light-blue pillar bursts up.
Row 06 Mountain Breaker (ultimate): sword slams down, a huge orange shockwave ring and flying rocks.
Row 07 Shadow Step: teal dash line forward with afterimages, slash at the end.
Row 08 Counter Step: step back leaving a shadow, then a white crescent counter slash.
Row 09 Triple Flash (ultimate): three red dash lines, a red X slash, then a red beam explosion.
```
(แถว 01–09 = ลงอาคมคมดาบ, ฟันประทับตรา, ปลุกคมอาคม, ฟันแยกศิลา, คลื่นดาบผาขาด, ดาบทลายขุนเขา, ก้าวตัดเงา, ก้าวหลบสวนคม, พริบตาสามคม)

## ถ้าได้ภาพไม่ตรง
- หุ่นไม่อยู่ตำแหน่ง → `fix: the caster must be at the TOP CENTER (DOWN chart) / BOTTOM CENTER (UP chart) of every cell`
- เอฟเฟกต์ไม่หันตามทิศ → `fix: every projectile and slash must travel DOWNWARD (or UPWARD)`
- แถวสลับ → `keep row 01-09 in the same order as the attached chart`
