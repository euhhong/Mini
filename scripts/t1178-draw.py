#!/usr/bin/env python3
# (러너 밖 · T1178 그림 · 읽기만) — t1153-terrain-census.js 판 JSON 을 생업 지도 + 자리 규칙(노란 점) · 작물 지도로 나란히.
#   쓰는 법: python3 scripts/t1178-draw.py axes <out.png> <제목> <판.json:이름> ...   (칸 = 먹이는 축 · 빨강 = 축 없음 · 흰 점 = 지금 마을 · 노란 네모 = 그 판의 규칙 자리)
#           python3 scripts/t1178-draw.py crop <out.png> <제목> <판.json:이름> ...   (칸 = 영토에서 가장 많이 고른 작물)
import json, sys
from PIL import Image, ImageDraw, ImageFont
mode, out, title, *runs = sys.argv[1:]
S = 4
try: FONT = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 12)
except Exception: FONT = ImageFont.load_default()
AX = ['farm', 'hunt', 'wood', 'fish', 'mine']
COL = {'farm': (150, 200, 80), 'hunt': (200, 130, 60), 'wood': (30, 110, 50), 'fish': (60, 130, 220), 'mine': (150, 90, 190)}
PRI = ['farm', 'fish', 'hunt', 'wood', 'mine']
CC = {'정본': (60, 140, 220), 'rice': (120, 200, 240), 'foxtail_millet': (230, 200, 60), 'millet': (240, 150, 50), 'barley': (180, 210, 90), 'wheat': (210, 170, 120), 'soybean': (170, 110, 60)}
CK = {'정본': '논(정본 물 항)', 'rice': '쌀', 'foxtail_millet': '조', 'millet': '기장', 'barley': '보리', 'wheat': '밀', 'soybean': '콩'}
ds = [(json.load(open(r.split(':')[0])), r.split(':', 1)[1]) for r in runs]
G = ds[0][0]['grid']; W = ds[0][0]['cells']['W']; H = ds[0][0]['cells']['H']
gw, gh = (W + G - 1) // G, (H + G - 1) // G
pw = gw * S + 10
im = Image.new('RGB', (max(pw * len(ds), 640), gh * S + 76), (20, 20, 24)); dr = ImageDraw.Draw(im)
for k, (d, name) in enumerate(ds):
    ox = k * pw
    for c in d['cellsOut']:
        x = ox + (c[0] // G) * S; y = (c[1] // G) * S
        if c[2] == 'w': col = (25, 35, 80)
        elif c[2] == 'r': col = (90, 90, 90)
        elif mode == 'crop': col = CC.get(c[6] if len(c) > 6 else '', (60, 60, 60))
        else:
            on = [AX[i] for i in range(5) if int(c[2][i]) >= 1]
            if not on: col = (220, 40, 40)
            else:
                col = COL[next(a for a in PRI if a in on)]
                if len(on) >= 2: col = tuple(min(255, int(v * 1.2 + 15)) for v in col)
        dr.rectangle([x, y, x + S - 1, y + S - 1], fill=col)
    for s in d['sites']:
        if s['skip'] or not s['seeded']: continue
        x = ox + (s['cx'] // G) * S + S // 2; y = (s['cy'] // G) * S + S // 2
        dr.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 255), outline=(0, 0, 0))
    if mode == 'axes' and d.get('rule'):
        for p in d['rule']['pts']:
            x = ox + (p['cx'] // G) * S + S // 2; y = (p['cy'] // G) * S + S // 2
            dr.rectangle([x - 2, y - 2, x + 2, y + 2], fill=(255, 210, 0), outline=(0, 0, 0))
    lab = f"{name} · 빈 땅 {d['empty']['n20']:.1%}" + (f" · CV {d['rule']['nb']['nn']['cv']}" if mode == 'axes' and d.get('rule') else '')
    dr.text((ox + 4, gh * S + 4), lab, fill=(235, 235, 235), font=FONT)
x = 6; y = gh * S + 26
items = ([('농사', COL['farm']), ('고기잡이', COL['fish']), ('사냥', COL['hunt']), ('숲', COL['wood']), ('광업', COL['mine']), ('축 없음', (220, 40, 40)), ('지금 마을', (255, 255, 255)), ('규칙 자리', (255, 210, 0))]
         if mode == 'axes' else [(CK[k], v) for k, v in CC.items()])
for labx, c in items:
    dr.rectangle([x, y, x + 10, y + 10], fill=c); dr.text((x + 14, y - 3), labx, fill=(220, 220, 220), font=FONT); x += 22 + int(dr.textlength(labx, font=FONT))
dr.text((6, gh * S + 50), title, fill=(200, 200, 200), font=FONT)
im.save(out); print('ok', out)
