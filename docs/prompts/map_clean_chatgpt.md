# ชุดคำสั่งสร้างภาพแผนที่ "สะอาด" สำหรับใช้ในเกม

ใช้กับภาพแบบ `assets/design_refs/09_village_walkpath_model.jpg` และ `10_monster_field_concept.png`
แนบภาพแบบทุกครั้ง แล้วคัดลอกคำสั่งไปวาง ส่งภาพที่ได้กลับมาเป็น PNG

## 1) หมู่บ้าน — ภาพพื้นแผนที่สะอาด

```
Recreate the attached village map as a clean in-game background.
Keep EXACTLY the same layout, buildings, paths, stairs, bridge, waterfall, river, fences, farm and plaza in the same positions, same camera angle and same pixel art style.
REMOVE everything that is not part of the world: all text labels, the legend box, the mini map, yellow dots, red collision boxes and outlines, green path lines and arrows.
No characters, no monsters, no UI.
Make it as large and sharp as possible (landscape, 3:2).
```

## 2) หมู่บ้าน — ภาพหลังคา/สิ่งที่บังตัวละคร (ถ้าทำได้)

ใช้วาดทับตัวละครตอนเดินหลังบ้าน (ไม่มีก็ได้ ผมตัดจากภาพข้อ 1 เองได้)

```
Using the same clean village image, keep only the parts that should appear IN FRONT of a character walking behind them: roofs, tree canopies, tall banners and the top of the waterfall. Make everything else fully transparent. Same size and position, transparent PNG.
```

## 3) ทุ่งมอนสเตอร์ — ภาพพื้นแผนที่สะอาด

```
Recreate the attached monster field map as a clean in-game background.
Keep EXACTLY the same layout: cliffs, terraces, dirt paths, stairs, rope bridge, waterfalls, river, trees, rocks, the cave entrance and the stone portal, same camera angle and same pixel art style.
REMOVE all creatures and monsters (wolves, boars, rabbits, goblins, bull, tiger, bear, golem, ghost, tree spirit). Fill those spots with matching ground.
No text, no UI. Make it as large and sharp as possible (landscape, 3:2).
```

## 4) ทุ่งมอนสเตอร์ — ภาพเส้นทางเดิน (ทำแบบเดียวกับหมู่บ้าน)

```
On the attached clean monster field map, draw a Walk Path Model overlay in the same style as the attached village example:
green for walkable ground, red boxes for obstacles (cliffs, water, trees, rocks), dashed green lines for main paths, yellow dots for key points: monster spawn areas, the cave entrance, the stone portal, the bridge and the exits. Same image size.
```

## ส่งกลับมาแล้วเกิดอะไรต่อ
1. ผมวางภาพสะอาดเป็นพื้นแผนที่ในเกม (ขยายให้ตัวละครสูงพอดีกับบ้าน)
2. วาดขอบเขตเดินได้/ไม่ได้ตามภาพ Walk Path Model ให้ทั้งเกมและเซิร์ฟเวอร์ใช้ชุดเดียวกัน
3. ตั้งจุดเกิดมอนสเตอร์ ทางเชื่อมโซน และจุดสำคัญตามจุดเหลือง
4. ส่งภาพในเกมให้คุณอนุมัติก่อนแทนแผนที่เดิม (แผนที่เดิมสำรองไว้)
