# ทรัพยากรภาพจากภายนอก

บันทึกทุกภาพที่ไม่ได้สร้างในโครงการ: ที่มา ผู้สร้าง สัญญาอนุญาต และการแก้ไข

| ใช้ในเกม | ไฟล์ต้นฉบับ | ชุด / ผู้สร้าง | สัญญา | การแก้ไข |
| --- | --- | --- | --- | --- |
| ยาสมุนไพรเล็ก | P_Green01 | 496 pixel art icons / gnola14 | CC0 | ไม่แก้ |
| ยาสมุนไพรกลาง | P_Red01 | 〃 | CC0 | ไม่แก้ |
| หนังสัตว์ | I_WolfFur | 〃 | CC0 | ไม่แก้ |
| เขาสัตว์ | I_Fang | 〃 | CC0 | เปลี่ยนเป็นโทนน้ำตาลเข้ม + ลายวง |
| เขี้ยวหมูป่า | I_Fang | 〃 | CC0 | ไม่แก้ |
| ขนไก่ฟ้า | I_Feather02 | 〃 | CC0 | ไม่แก้ |
| เขี้ยวสัตว์ป่า | I_Fang | 〃 | CC0 | ย่อ วางคู่ กลับด้าน 1 อัน |
| เศษหินแร่ | I_Rock03 | 〃 | CC0 | ไม่แก้ |
| เศษวิญญาณ | I_Amethist | 〃 | CC0 | ไม่แก้ |
| ดาบไม้ฝึกหัด | W_Sword001 | 〃 | CC0 | ใบดาบเปลี่ยนเป็นสีไม้ |
| ดาบเหล็กตีมือ | W_Sword004 | 〃 | CC0 | ไม่แก้ |
| เสื้อผ้าฝ้ายปัก | A_Clothing01 | 〃 | CC0 | ผ้าเป็นสีดำ + แถบปักแดงลายขาว/ทอง ตามชุดตัวละครหลัก |
| เสื้อหนังสัตว์ | A_Armour01 | 〃 | CC0 | ไม่แก้ |
| กำไลเงิน | Ac_Ring02 | 〃 | CC0 | ไม่แก้ |

- ต้นฉบับ: `assets/third_party/496-rpg-icons/` (ดู `SOURCE.md`)
- สร้างไฟล์ที่เกมใช้: `python3 tools/build_item_icons.py` → `assets/items/` แล้ว `python3 tools/embed_item_icons.py` ฝังลง `game/index.html`
- CC0 ไม่บังคับให้ใส่เครดิต แต่โครงการบันทึกไว้เพื่อตรวจย้อนได้

## ตัวเลือกภาพมอนสเตอร์ (V2-R7) — รอเจ้าของเลือก ยังไม่ใส่ในเกม

ชุด "Dungeon Crawl 32x32 tiles" (ศิลปิน Dungeon Crawl Stone Soup, ผู้อัปโหลด MedicineStorm, OpenGameArt) — **CC0** ตรวจซ้ำ 2026-11-10 จากหน้าต้นทางและ `LICENSE.txt` ใน zip

- ต้นฉบับ: `assets/third_party/dungeon-crawl-32x32/` (38 ไฟล์ ไม่แก้ไข ดู `SOURCE.md`)
- สร้างตัวเลือก: `python3 tools/build_monster_candidates.py` → `assets/monster_candidates/` (46 ภาพ + `candidates.json`)
- ภาพเปรียบเทียบในเกม: `node tools/monster-compare.js` → `docs/evidence/monsters_r7/` และ `docs/evidence/monsters_r7_overview.png`
- ปรับสไตล์พื้นฐานทุกภาพ: ลบเงาดำของชุด (เกมวาดเงาเอง), หันขวา, เส้นขอบดำ → สีเข้มของสีข้างเคียง, ครอปขอบ; ในภาพเปรียบเทียบย่อ/ขยายให้พื้นที่เท่ามอนสเตอร์ปัจจุบันที่วัดจากเกมจริง
- ชุดนี้**ไม่มี** กระต่าย ไก่ฟ้า เสือ ลิง กวาง — ใช้สัตว์ใกล้เคียง (ควอกก้า นกกา แมวส้ม โทรลล์หิน วัวอาพิส) แล้วปรับสี/เติมรายละเอียด

| ชนิด | ตัวเลือก | ไฟล์ | ต้นฉบับ | ปรับเพิ่ม |
| --- | --- | --- | --- | --- |
| หมูป่า | A | `boar_a` | animals/hog_new.png | เปลี่ยนสีชมพูเป็นน้ำตาลเข้ม เติมเขี้ยวงาช้าง |
| หมูป่า | B | `boar_b` | animals/hell_hog_new.png | - |
| หมูป่า | C | `boar_c` | animals/hog_new.png | - |
| กระต่ายมีเขา | A | `rabbit_a` | animals/quokka_new.png | เปลี่ยนเป็นขนขาว เติมเขาเดี่ยวสีน้ำตาล |
| กระต่ายมีเขา | B | `rabbit_b` | animals/quokka_new.png | - |
| หมาป่า | A | `wolf_a` | animals/wolf.png | - |
| หมาป่า | B | `wolf_b` | animals/warg.png | - |
| หมาป่า | C | `wolf_c` | animals/jackal_new.png | - |
| หมาป่า | D | `wolf_d` | animals/hound.png | - |
| ไก่ฟ้า | A | `pheasant_a` | raven.png | ตัวสีทองแดง-แดง หัวเขียว (ชุดนี้ไม่มีไก่ฟ้า ใช้นกกาแทน) |
| ไก่ฟ้า | B | `pheasant_b` | raven.png | - |
| ไก่ฟ้า | C | `pheasant_c` | phoenix.png | - |
| ก็อบลิน | A | `goblin_a` | goblin_new.png | ผิว/ชุดสีแดง → เขียวแบบก็อบลินในเกม |
| ก็อบลิน | B | `goblin_b` | goblin_new.png | - |
| ก็อบลิน | C | `goblin_c` | hobgoblin_new.png | - |
| ก็อบลิน | D | `goblin_d` | kobold_new.png | - |
| เสือ | A | `tiger_a` | player/felids/cat_9.png | สีส้มเข้มขึ้น เติมลายดำ (ชุดนี้ไม่มีเสือ ใช้แมวส้มแทน) |
| เสือ | B | `tiger_b` | player/felids/cat_9.png | - |
| เสือ | C | `tiger_c` | manticore.png | - |
| หมีเขา | A | `bear_a` | animals/grizzly_bear.png | สีเทา → น้ำตาล เติมเขาคู่สีกระดูก |
| หมีเขา | B | `bear_b` | animals/bear.png | - |
| หมีเขา | C | `bear_c` | animals/black_bear_new.png | - |
| โกเลมหิน | A | `golem_a` | nonliving/stone_golem.png | - |
| โกเลมหิน | B | `golem_b` | nonliving/earth_elemental.png | - |
| โกเลมหิน | C | `golem_c` | nonliving/clay_golem.png | - |
| โกเลมหิน | D | `golem_d` | nonliving/gargoyle.png | - |
| กระทิงผี | A | `ghostbull_a` | animals/death_yak_new.png | ขนเทา → ม่วงเข้ม คงตาแดง เติมแสงเรืองแดงแบบในเกม |
| กระทิงผี | B | `ghostbull_b` | animals/death_yak_new.png | - |
| กระทิงผี | C | `ghostbull_c` | animals/catoblepas.png | - |
| ลิงป่า | A | `monkey_a` | rock_troll.png | สีแดงอิฐ → น้ำตาลลิง (ชุดนี้ไม่มีลิง) |
| ลิงป่า | B | `monkey_b` | rock_troll.png | - |
| ลิงป่า | C | `monkey_c` | faun.png | - |
| กวางภูเขา | A | `deer_a` | holy/apis.png | ลบจานสุริยะ เปลี่ยนเป็นสีน้ำตาลกวาง เติมเขากวาง (ชุดนี้ไม่มีกวาง) |
| กวางภูเขา | B | `deer_b` | holy/apis.png | ลบจานสุริยะบนหัว |
| กวางภูเขา | C | `deer_c` | animals/yak_new.png | - |
| นักรบเผ่าป่า | A | `tribal_a` | human_slave.png | ผ้านุ่งส้ม → น้ำตาล เติมขนนกแดง/ขาว และหอก |
| นักรบเผ่าป่า | B | `tribal_b` | slave_freed.png | - |
| นักรบเผ่าป่า | C | `tribal_c` | orc_warrior_new.png | - |
| ปีศาจ | A | `demon_a` | demons/red_devil_new.png | - |
| ปีศาจ | B | `demon_b` | demons/fiend.png | - |
| ปีศาจ | C | `demon_c` | demons/hairy_devil.png | - |
| ปีศาจ | D | `demon_d` | demons/imp.png | - |
| วิญญาณไม้ | A | `treespirit_a` | fungi_plants/treant.png | - |
| วิญญาณไม้ | B | `treespirit_b` | unique/leshy.png | - |
| วิญญาณไม้ | C | `treespirit_c` | player/transform/tree_form.png | - |
| วิญญาณไม้ | D | `treespirit_d` | dryad.png | - |

ภาพอื่นทั้งหมดในเกม (ตัวละคร แผนที่ มอนสเตอร์ วัตถุ) สร้างภายในโครงการ
