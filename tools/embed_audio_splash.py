#!/usr/bin/env python3
"""ฝังหน้าโหลด + เพลง/เสียง (assets/ui/audio_splash.html) ลงท้าย game/index.html ระหว่างเครื่องหมาย — รันซ้ำได้
รัน: python3 tools/embed_audio_splash.py"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A, B = '<!--AUDIO_SPLASH_BEGIN-->', '<!--AUDIO_SPLASH_END-->'
src = open(os.path.join(ROOT, 'assets/ui/audio_splash.html'), encoding='utf-8').read()
p = os.path.join(ROOT, 'game/index.html'); s = open(p, encoding='utf-8').read()
block = A + '\n' + src + B + '\n'
if A in s:
    i, j = s.index(A), s.index(B) + len(B) + 1
    s = s[:i] + block + s[j:]
else:
    s = s.replace('</body>', block + '</body>', 1)
open(p, 'w', encoding='utf-8').write(s)
print('ฝังหน้าโหลด + เสียง', len(src.encode()) // 1024, 'KB')
