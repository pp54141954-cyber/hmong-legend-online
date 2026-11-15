#!/usr/bin/env python3
"""จำแนกพื้นที่เดินได้ของแผนที่ถ้ำ (V2-R58) จากภาพสะอาด assets/maps_src/mine.png — ใช้โดย tools/build_mine_split.py
พิกเซลละ 1 ประเภท: ดินทราย / หญ้าสว่าง / หินอ่อน-บันได = เดินได้; น้ำ คริสตัล ไม้ อาคาร ต้นไม้เข้ม ผาหินเทาเข้ม = กีดขวาง"""
import numpy as np

def classify(A):
    """A: ndarray (H,W,3) int → bool เดินได้ (H,W)
    ดินทรายอมชมพู/น้ำตาลอ่อน, หญ้าเหลืองเขียว, หินอ่อน/บันไดสีกลาง ๆ = เดินได้
    น้ำ/คริสตัลฟ้า, ผาหินอมน้ำเงินเทา, ไม้เข้ม/อาคาร, ต้นสนเข้ม = กีดขวาง"""
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); lum = .3 * r + .59 * g + .11 * b
    sat = mx - mn
    dirt = (r > 120) & (r - g > 10) & (g - b > 5) & (r - b > 30) & (lum > 100) & (lum < 235)   # ทางดินสีทราย/ชมพูอ่อน
    grass = (r > 95) & (g > r + 15) & (g > b + 35) & (g > 130)                                  # หญ้าสว่างสีเหลืองเขียว
    stone = (sat < 30) & (lum > 150) & (lum < 240) & (r >= b - 3)                              # หินอ่อน/บันได/ลานหินสีกลาง ๆ (ไม่ใช่ผาอมน้ำเงิน)
    water = (b > r + 28) & (b > g + 5)                                                          # น้ำ/ลำธาร/คริสตัลฟ้า
    rock = (b > r + 6) & (lum < 180) & (sat < 70)                                              # ผาหินอมน้ำเงินเทา
    return (dirt | grass | stone) & ~water & ~rock

def tile_walk(A, T=32, thr=.45):
    """ผังช่อง (ROWS,COLS) เดินได้ถ้าพิกเซลในช่องเดินได้ >= thr"""
    H, W = A.shape[:2]; m = classify(A).astype(float)
    return m.reshape(H // T, T, W // T, T).mean(axis=(1, 3)) >= thr
