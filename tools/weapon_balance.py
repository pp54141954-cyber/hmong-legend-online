#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ตารางสมดุลระบบอาวุธ (V2-R77) — ค่าข้อเสนอ ยังไม่ได้ใช้ในเกมหรือเซิร์ฟเวอร์

รัน: python3 tools/weapon_balance.py
- อ่านค่าตั้งต้นจากค่าที่เกมใช้อยู่ (CFG.player และสูตร pAtk ใน CFG.balance)
- ไม่แก้ไฟล์เกม ไม่เขียนฐานข้อมูล
- มีการตรวจตัวเอง (assert) และเทียบค่าวิเคราะห์กับการจำลองแบบสุ่ม
"""
import random

# ---- ค่าจากเกม (game/index.html: CFG.player.baseAtk=12, atkPerLv=3; CFG.balance.pAtk บวก 1 ต่อเลเวลจาก STR) ----
BASE_ATK = 12
ATK_PER_LV = 3 + 1


def p_atk(lv):
    """ATK อ้างอิงของผู้เล่นที่เลเวล lv (เป้าหมายสมดุลของ CFG.balance)"""
    return BASE_ATK + (lv - 1) * ATK_PER_LV


# ---- ค่าข้อเสนอ (ยังไม่อนุมัติ) ----
ENH_CAP = 15            # ตัวเลือก +15 ตามคำแนะนำในข้อเสนอ (+10 / +20 ใช้ค่านี้แทนได้ แต่ +20 ต้องมีอัตราเพิ่ม)
ENH_PER_LEVEL = 0.06    # โบนัสตีบวก = ATK ฐานอาวุธ × 0.06 × ระดับ (ค่านี้ให้ตัวอย่าง 286 = 220 + 66)
DROP_CHANCE_789 = 0.5   # โอกาสลด 1 ระดับเมื่อล้มเหลวที่ +7 ถึง +9 (ข้อเสนอเขียนว่า "มีโอกาส")
RATIO = {               # ATK ฐานอาวุธ = pAtk(เลเวลอาวุธ) × ตัวคูณความหายาก
    'ธรรมดา': 0.10, 'ชั้นดี': 0.15, 'หายาก': 0.20, 'มหากาพย์': 0.25,
    'ตำนาน': 0.30, 'เทพนิยาย': 0.35, 'ศักดิ์สิทธิ์': 0.40,
}
ENH_TIERS = [
    # (ช่วงเป้าหมาย, อัตราสำเร็จ, ผลเมื่อล้มเหลว)
    ((1, 3), 1.00, 'ไม่มี'),
    ((4, 6), 0.85, 'เสียวัตถุดิบ ระดับเดิม'),
    ((7, 9), 0.65, 'มีโอกาส 50% ลด 1 ระดับ'),
    ((10, 12), 0.40, 'ลด 1 ระดับ'),
    ((13, 15), 0.20, 'ลด 1 ระดับ'),
]
# จำนวนวัตถุดิบหินเสริมต่อการพยายาม 1 ครั้ง (ค่าทดลองของผู้ออกแบบ ไม่ใช่ข้อเสนอของเจ้าของ)
STONE_COST_TIER = [(1, 3, 1), (4, 6, 2), (7, 9, 3), (10, 12, 5), (13, 15, 8)]


def rate(t):
    """อัตราสำเร็จของการเสริมไปยังระดับ t (ใช้ระดับเป้าหมาย ไม่มีช่องว่างที่ +0)"""
    for (lo, hi), r, _ in ENH_TIERS:
        if lo <= t <= hi:
            return r
    raise ValueError('ระดับตีบวกนอกช่วงข้อเสนอ: %s' % t)


def stone_cost(t):
    for lo, hi, c in STONE_COST_TIER:
        if lo <= t <= hi:
            return c
    raise ValueError('ระดับตีบวกนอกช่วงข้อเสนอ: %s' % t)


def solve(A, b):
    """แก้ระบบสมการเชิงเส้นด้วยการกำจัดแบบเกาส์ (มีการเลือกแถวหลัก)"""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[piv] = M[piv], M[col]
        d = M[col][col]
        for r in range(n):
            if r != col and M[r][col] != 0.0:
                k = M[r][col] / d
                for c in range(col, n + 1):
                    M[r][c] -= k * M[col][c]
    return [M[i][n] / M[i][i] for i in range(n)]


def expected(cap, cost=lambda t: 1.0, drop_q=DROP_CHANCE_789, protect_from=None, protect_cost=0.0):
    """ค่าคาดหวัง (จำนวนครั้ง หรือปริมาณวัตถุดิบ) จากระดับ +0 ไปถึง +cap

    สถานะ s = ระดับปัจจุบัน 0..cap-1; E[cap] = 0
    protect_from: ถ้ากำหนด จะใช้หินป้องกันทุกครั้งที่ระดับเป้าหมาย >= ค่านี้ (ไม่ลดระดับ และเสียต้นทุนเพิ่ม)
    """
    A = [[0.0] * cap for _ in range(cap)]
    b = [0.0] * cap
    for s in range(cap):
        t = s + 1
        p = rate(t)
        f = 1.0 - p
        protected = protect_from is not None and t >= protect_from
        A[s][s] += 1.0
        b[s] = cost(t) + (protect_cost if protected else 0.0)
        if s + 1 < cap:
            A[s][s + 1] -= p
        if 4 <= t <= 6 or protected:
            outcomes = [(s, f)]
        elif 7 <= t <= 9:
            outcomes = [(max(s - 1, 0), f * drop_q), (s, f * (1.0 - drop_q))]
        elif t >= 10:
            outcomes = [(max(s - 1, 0), f)]
        else:
            outcomes = []
        for dest, pr in outcomes:
            A[s][dest] -= pr
    return solve(A, b)[0]


def simulate(cap, runs, seed=77):
    """จำลองแบบสุ่มเพื่อเทียบกับค่าวิเคราะห์ (จำนวนครั้งต่อการไปถึง cap)"""
    rng = random.Random(seed)
    total = 0
    for _ in range(runs):
        lv, n = 0, 0
        while lv < cap:
            t = lv + 1
            n += 1
            if rng.random() < rate(t):
                lv += 1
            elif 4 <= t <= 6:
                pass
            elif 7 <= t <= 9:
                if rng.random() < DROP_CHANCE_789:
                    lv = max(lv - 1, 0)
            else:
                lv = max(lv - 1, 0)
        total += n
    return total / runs


def self_check():
    assert abs(expected(1) - 1.0) < 1e-9
    assert abs(expected(4) - (3 + 1 / 0.85)) < 1e-9          # +1..+3 ไม่ล้มเหลว, +4 ล้มเหลวแล้วอยู่ที่เดิม
    assert abs(expected(15) - expected(14)) > 0              # เพิ่มระดับต้องใช้ครั้งมากขึ้นเสมอ
    base = 286 / (1 + ENH_PER_LEVEL * 5)
    assert abs(base - 220) < 1e-9 and abs(base * ENH_PER_LEVEL * 5 - 66) < 1e-9
    mc = simulate(10, 40000)
    an = expected(10)
    assert abs(mc - an) / an < 0.03, 'จำลอง %.2f ไม่ตรงกับวิเคราะห์ %.2f' % (mc, an)
    return mc, an


def main():
    mc, an = self_check()
    print('ตรวจตัวเอง: ผ่าน (การจำลอง cap 10 = %.2f ครั้ง, วิเคราะห์ = %.2f ครั้ง)\n' % (mc, an))

    print('## 1. ตัวอย่างของเจ้าของ: 286 ATK, +66 จากตีบวก, Lv.50, +5')
    base = 286 / (1 + ENH_PER_LEVEL * 5)
    print('- ATK ฐานอาวุธ = 286 / (1 + 0.06 × 5) = %.0f' % base)
    print('- โบนัสตีบวก = %.0f × 0.06 × 5 = %.0f' % (base, base * ENH_PER_LEVEL * 5))
    print('- ATK อ้างอิงผู้เล่น Lv.50 (pAtk) = %d → อาวุธฐาน = %.2f เท่าของ pAtk' % (p_atk(50), base / p_atk(50)))
    print('- ข้อเสนอในเอกสารใช้ 0.10–0.40 เท่าของ pAtk จึงตัวอย่างนี้แรงกว่าข้อเสนอมาก\n')

    print('## 2. ATK ฐานอาวุธตามเลเวลและความหายาก (ปัดเป็นจำนวนเต็ม)')
    levels = [1, 25, 50, 75, 100]
    print('| ความหายาก | ' + ' | '.join('Lv.%d' % lv for lv in levels) + ' |')
    print('| --- |' + ' --- |' * len(levels))
    for name, r in RATIO.items():
        print('| %s (×%.2f) | ' % (name, r) + ' | '.join('%d' % round(p_atk(lv) * r) for lv in levels) + ' |')
    print('- pAtk: ' + ', '.join('Lv.%d = %d' % (lv, p_atk(lv)) for lv in levels) + '\n')

    print('## 3. ตารางตีบวกรายระดับ (ระดับเป้าหมาย t, cap = t)')
    print('| เป้าหมาย | อัตราสำเร็จ | ผลเมื่อล้มเหลว | ตัวคูณ ATK | ครั้งที่คาดหวังจาก +0 | หินเสริมที่คาดหวังจาก +0 |')
    print('| --- | --- | --- | --- | --- | --- |')
    for t in range(1, ENH_CAP + 1):
        tier = next(x for x in ENH_TIERS if x[0][0] <= t <= x[0][1])
        print('| +%d | %d%% | %s | ×%.2f | %.1f | %.1f |' % (
            t, round(rate(t) * 100), tier[2], 1 + ENH_PER_LEVEL * t,
            expected(t), expected(t, cost=stone_cost)))
    print()

    print('## 4. ความไวต่อค่าที่ยังไม่ตัดสิน (เป้าหมาย +15 จาก +0)')
    print('| สถานการณ์ | ครั้งที่คาดหวัง | หินเสริมที่คาดหวัง |')
    print('| --- | --- | --- |')
    for q in (0.25, 0.5, 0.75):
        print('| โอกาสลด +7–9 = %d%% ไม่ใช้หินป้องกัน | %.1f | %.1f |' % (
            round(q * 100), expected(ENH_CAP, drop_q=q), expected(ENH_CAP, cost=stone_cost, drop_q=q)))
    print('| ใช้หินป้องกันทุกครั้งตั้งแต่ +7 (ทดลองราคา 1 ก้อนต่อครั้ง) | %.1f | %.1f |' % (
        expected(ENH_CAP, protect_from=7), expected(ENH_CAP, cost=stone_cost, protect_from=7, protect_cost=1.0)))


if __name__ == '__main__':
    main()
