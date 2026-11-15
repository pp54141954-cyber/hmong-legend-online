#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""คำนวณค่าสมดุลตีบวกอาวุธตามข้อกำหนด V1.2 ฉบับยืนยัน (V2-R78) — ไม่แก้เกมและไม่เขียนฐานข้อมูล

- อ่านค่าจริงจาก CFG.enhance ใน shared/world.js (ไฟล์เดียวกับที่เกมและเซิร์ฟเวอร์ใช้) จึงไม่คลาดเคลื่อนจากโค้ด
- กติกา (กฎหินป้องกันแบบ A): ทุกครั้งใช้หินป้องกัน 1 ก้อน · สำเร็จ +1 · ล้มเหลวคงระดับเดิม (ไม่ลด ไม่แตก ไม่หาย)
  จึงไม่มีการย้อนระดับ: จำนวนครั้งที่คาดหวังของแต่ละขั้น = 1 / อัตราสำเร็จ
- มีการจำลองแบบสุ่มเพื่อเทียบกับค่าที่คำนวณได้ (ถ้าต่างเกิน 2% จะหยุดพร้อมข้อผิดพลาด)

รัน: python3 -B tools/weapon_balance.py
"""
import json, os, random, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXP_TIGER = 193   # EXP ของเสือ (Lv 22) จาก docs/BALANCE.md — ใช้เป็นมอนสเตอร์ทั่วไปที่ให้เงินสูงสุดในตารางนั้น
GOLD_PER_EXP = 0.12  # CFG.economy.goldPerExp


def load_cfg():
    out = subprocess.run(['node', '-e', "console.log(JSON.stringify(require('./shared/world.js').CFG.enhance))"],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def step(cfg, lv):
    """ค่าของขั้น lv หลังใช้เพดานเงินต่อการพยายาม (เพดานมีผลตั้งแต่ระดับ goldCapFrom ขึ้นไป)"""
    s = cfg['steps'][lv]
    g = min(s['gold'], cfg['goldCap']) if lv >= cfg['goldCapFrom'] else s['gold']
    return s['rate'], g, s['stone'], bool(s.get('prov'))


def expected(cfg, a, b):
    """ค่าคาดหวังจากระดับ +a ถึง +b: (จำนวนครั้ง, เงิน, หินป้องกัน)"""
    att = gold = stone = 0.0
    for lv in range(a, b):
        r, g, st, _ = step(cfg, lv)
        att += 1 / r
        gold += g / r
        stone += st / r
    return att, gold, stone


def simulate(cfg, a, b, runs, seed=78):
    rng = random.Random(seed)
    ta = tg = ts = 0
    for _ in range(runs):
        lv, n, g, s = a, 0, 0, 0
        while lv < b:
            r, gg, st, _ = step(cfg, lv)
            n += 1; g += gg; s += st
            if rng.random() < r:
                lv += 1
        ta += n; tg += g; ts += s
    return ta / runs, tg / runs, ts / runs


def close(x, y, tol=0.02):
    return abs(x - y) <= tol * max(abs(y), 1e-9)


def main():
    cfg = load_cfg()
    assert cfg['cap'] == 15, 'ระดับสูงสุดต้องเป็น +15'
    # ตรวจว่าค่า +10 ถึง +14 ตรงกับข้อกำหนด V1.2
    v12 = [(.35, 40000), (.15, 60000), (.10, 90000), (.10, 140000), (.05, 200000)]
    for k, (r, g) in enumerate(v12):
        s = cfg['steps'][10 + k]
        assert abs(s['rate'] - r) < 1e-12 and s['gold'] == g and s['stone'] == 1 and not s.get('prov'), 'ไม่ตรงข้อกำหนด +%d' % (10 + k)

    print('## 1. ตารางตีบวก +10 ถึง +15 (อ่านจาก CFG.enhance; เพดานเงินต่อครั้ง %s ตั้งแต่ +%d ขึ้นไป)' % (f"{cfg['goldCap']:,}", cfg['goldCapFrom']))
    print('| จาก → ไป | โอกาสสำเร็จ | เงินตาม V1.2 | เงินที่ใช้จริง | หินป้องกันต่อครั้ง | ครั้งที่คาดหวังในขั้นนี้ | เงินที่คาดหวังในขั้นนี้ |')
    print('| --- | --- | --- | --- | --- | --- | --- |')
    for lv in range(10, 15):
        r, g, st, _ = step(cfg, lv)
        a, gg, ss = expected(cfg, lv, lv + 1)
        print('| +%d → +%d | %d%% | %s | %s | %d | %.1f | %s |' % (lv, lv + 1, round(r * 100), f"{cfg['steps'][lv]['gold']:,}", f'{g:,}', st, a, f'{gg:,.0f}'))
    a10, g10, s10 = expected(cfg, 10, 15)
    print('| **รวม +10 → +15** | | | | | **%.1f** | **%s** |' % (a10, f'{g10:,.0f}'))
    print()
    print('- หินป้องกันที่คาดหวังจาก +10 ถึง +15: %.1f ก้อน (ครั้งละ 1 ก้อน ทุกการพยายาม)' % s10)

    print('\n## 2. การจำลองแบบสุ่มเทียบกับค่าคำนวณ (100,000 ครั้ง ต่อช่วง)')
    ma, mg, ms = simulate(cfg, 10, 15, 100000)
    print('- +10 → +15: จำลอง %.2f ครั้ง · %s เงิน · %.2f หิน | คำนวณ %.2f · %s · %.2f' % (
        ma, f'{mg:,.0f}', ms, a10, f'{g10:,.0f}', s10))
    assert close(ma, a10) and close(mg, g10) and close(ms, s10), 'การจำลองไม่ตรงกับค่าคำนวณ'

    a0, g0, s0 = expected(cfg, 0, 15)
    print('\n## 3. จาก +0 ถึง +15 (รวมค่าชั่วคราวของ +0 ถึง +9)')
    print('- ครั้งที่คาดหวัง %.1f · เงิน %s · หินป้องกัน %.1f ก้อน' % (a0, f'{g0:,.0f}', s0))
    prov_g = sum(step(cfg, lv)[1] / step(cfg, lv)[0] for lv in range(0, 10))
    print('- ส่วนที่เป็นค่าชั่วคราว (+0 ถึง +9): เงิน %s' % f'{prov_g:,.0f}')

    print('\n## 4. ค่าใช้จ่ายเทียบกับเศรษฐกิจปัจจุบัน')
    per_kill = GOLD_PER_EXP * EXP_TIGER
    print('- เงินจากการล่าปัจจุบัน: EXP × %.2f เงิน — เสือ (EXP %d) ให้ประมาณ %.0f เงินต่อตัว' % (GOLD_PER_EXP, EXP_TIGER, per_kill))
    print('- ต้องล่าประมาณ %s ตัว เพื่อจ่ายเงิน +10 ถึง +15 (ไม่รวมหิน)' % f'{g10 / per_kill:,.0f}')
    print('- ต้องล่าประมาณ %s ตัว เพื่อไปถึง +15 จาก +0 (ค่าชั่วคราว)' % f'{g0 / per_kill:,.0f}')

    print('\n## 5. ค่าโจมตีอาวุธตามระดับตีบวก (โบนัส = ATK ฐาน × %.2f × ระดับ)' % cfg['powerPerLv'])
    print('| ระดับ | ตัวคูณ | ดาบไม้ฝึกหัด (ATK 4) | ดาบด้ามแดงม้ง (ATK 24) |')
    print('| --- | --- | --- | --- |')
    for lv in range(0, 16):
        m = 1 + cfg['powerPerLv'] * lv
        print('| +%d | ×%.2f | %.2f | %.2f |' % (lv, m, 4 * m, 24 * m))


if __name__ == '__main__':
    main()
