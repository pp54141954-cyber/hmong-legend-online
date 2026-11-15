"""ผังชนของโซนแผนที่ (V2-R63) — อ่าน MAP_ART, MAP_MASKS และทางออก (exits) จาก game/index.html

  python3 tools/zone_mask_ref.py refs
      เขียน docs/prompts/ref/zone_<id>_mask.png ทั้ง 11 โซนที่มีภาพในเกม
      (เขียว = เดินได้, แดง = ชน, กรอบเหลือง = ทางออก) ใช้เป็นภาพอ้างอิงเลย์เอาต์ในชุดคำสั่งทำโซน
  python3 tools/zone_mask_ref.py check <id> <ภาพใหม่> <ไฟล์ผล>
      ซ้อนผังจาง ๆ ทับภาพใหม่ เพื่อตรวจว่าช่องชนตรงกับสิ่งกีดขวางในภาพ และทางออกยังเป็นทาง
"""
import json, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T, COLS, ROWS = 32, 48, 32          # ช่องละ 32 px ตามที่เกมใช้ (48 × 32 ช่อง)
W, H = COLS * T, ROWS * T


def _obj(s, key):
    i = s.index(key + '={') + len(key) + 1
    j = s.index('};', i) + 1
    return json.loads(s[i:j])


def load():
    s = open(os.path.join(ROOT, 'game/index.html'), encoding='utf-8').read()
    art, masks = _obj(s, 'MAP_ART'), _obj(s, 'MAP_MASKS')
    exits = {}
    for b in re.split(r'\n (?=[a-z0-9_]+:\{name:)', s[s.index('const ZONES={'):]):
        m = re.match(r'([a-z0-9_]+):\{name:', b)
        if not m:
            continue
        ex = re.search(r'exits:\[(.*?)\],\s*\n', b, re.S)
        exits[m.group(1)] = [tuple(map(int, t)) for t in re.findall(r"\{x:(\d+),y:(\d+),w:(\d+),h:(\d+),to:'", ex.group(1))] if ex else []
    return art, masks, exits


def cells_layer(rows, solid):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if solid:
                col = (224, 72, 72, 255) if ch == '#' else (120, 220, 120, 255)
            else:
                col = (230, 40, 40, 110) if ch == '#' else (40, 230, 80, 40)
            d.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=col)
    return ov


def exits_layer(exits, solid):
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for x, y, w, h in exits:
        d.rectangle([x * T, y * T, (x + w) * T - 1, (y + h) * T - 1], outline=(250, 220, 60, 255 if solid else 230), width=6)
    return ov


def refs():
    art, masks, exits = load()
    out_dir = os.path.join(ROOT, 'docs/prompts/ref')
    for z in art:
        im = Image.new('RGBA', (W, H), (255, 255, 255, 255))
        im = Image.alpha_composite(im, cells_layer(masks[z], True))
        im = Image.alpha_composite(im, exits_layer(exits.get(z, []), True))
        im.convert('RGB').save(os.path.join(out_dir, 'zone_%s_mask.png' % z), 'PNG', optimize=True)
        print('เขียน zone_%s_mask.png  ทางออก %d' % (z, len(exits.get(z, []))))


def check(z, src, dst):
    art, masks, exits = load()
    im = Image.open(src).convert('RGBA')
    if im.size != (W, H):
        print('เตือน: ขนาด', im.size, 'ควรเป็น', (W, H), '→ ปรับขนาดให้ตรงก่อนซ้อนผัง')
        im = im.resize((W, H), Image.LANCZOS)
    im = Image.alpha_composite(im, cells_layer(masks[z], False))
    im = Image.alpha_composite(im, exits_layer(exits.get(z, []), False))
    im.convert('RGB').save(dst, 'PNG')
    print('ซ้อนผังแล้ว', dst)


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == 'refs':
        refs()
    elif len(sys.argv) == 5 and sys.argv[1] == 'check':
        check(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        print(__doc__)
