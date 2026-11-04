#!/usr/bin/env python3
# (러너 밖 · T1153 그림 · 읽기만) — t1153-terrain-census.js 의 JSON 을 지도 PNG 셋으로.
#   쓰는 법: python3 scripts/t1153-draw.py <census.json> <out_dir>
#   ① 생업 지도: 칸마다 N=20 을 먹이는 축(농사 연두 · 고기잡이 파랑 · 숲 진초록 · 사냥 갈색 · 광업 보라 · 둘 이상 = 밝게) · 빈 땅 빨강 · 물 남색 · 바위 회색 · 마을(점) · 4일(종전 시계) 외톨이(동그라미)
#   ② 빈 땅을 무엇이 살리나: ① 지류 20셀(하늘) · ② 숲(초록) · ③ 자잘 광맥(보라) · 셋 다 못 살림(빨강) — 순서대로 처음 살린 것
#   ③ 마을 자리 — 지금(흰 점) · 규칙 초안(노란 점)
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
d = json.load(open(src))
Z = d['zone']; G = d['grid']; W = d['cells']['W']; H = d['cells']['H']
S = 6  # 격자 한 칸 = 6px
gw, gh = (W + G - 1) // G, (H + G - 1) // G
AX = ['farm', 'hunt', 'wood', 'fish', 'mine']
COL = {'farm': (150, 200, 80), 'hunt': (160, 110, 60), 'wood': (30, 110, 50), 'fish': (60, 130, 220), 'mine': (150, 90, 190)}
PRI = ['farm', 'fish', 'hunt', 'wood', 'mine']
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 11)
except Exception:
    try:
        FONT = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 11)
    except Exception:
        FONT = ImageFont.load_default()

def caption(dr, text):
    words = text.split(' · '); lines = []; cur = ''
    for w in words:
        t = (cur + ' · ' + w) if cur else w
        if dr.textlength(t, font=FONT) > gw * S - 12 and cur: lines.append(cur); cur = w
        else: cur = t
    if cur: lines.append(cur)
    for i, ln in enumerate(lines[:2]): dr.text((6, gh * S + 40 + i * 15), ln, fill=(200, 200, 200), font=FONT)

def base():
    return Image.new('RGB', (gw * S, gh * S + 72), (20, 20, 24))

def cellxy(cx, cy):
    return (cx // G) * S, (cy // G) * S

def legend(dr, items):
    x = 6; y = gh * S + 6
    for lab, c in items:
        dr.rectangle([x, y, x + 10, y + 10], fill=c); dr.text((x + 14, y - 2), lab, fill=(230, 230, 230), font=FONT); x += 14 + int(dr.textlength(lab, font=FONT)) + 12
        if x > gw * S - 60: x = 6; y += 16

def sites(dr, color=(255, 255, 255), names=True):
    lon = set(d['nbLive']['loners'])
    st = d['nbLive']['nOld']; crowd = set(r['name'] for r in d['nbLive']['rows'] if r['nOld'] >= st['mean'] + st['sd'])
    for s in d['sites']:
        if s['skip'] or not s['seeded']: continue
        x, y = cellxy(s['cx'], s['cy']); x += S // 2; y += S // 2
        noax = s['a20'] is not None and not s['a20']
        dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 60, 60) if noax else color, outline=(0, 0, 0))
        if s['name'] in lon: dr.ellipse([x - 8, y - 8, x + 8, y + 8], outline=(255, 230, 0), width=2)
        if s['name'] in crowd: dr.ellipse([x - 8, y - 8, x + 8, y + 8], outline=(230, 120, 255), width=2)
        if names and (noax or s['name'] in lon): dr.text((x + 5, y - 6), s['name'], fill=(255, 255, 255), font=FONT)

# ① 생업 지도
im = base(); dr = ImageDraw.Draw(im)
for c in d['cellsOut']:
    cx, cy, k = c[0], c[1], c[2]
    x, y = cellxy(cx, cy)
    if k == 'w': col = (25, 35, 80)
    elif k == 'r': col = (90, 90, 90)
    else:
        p = [int(ch) for ch in k]
        on = [AX[i] for i in range(5) if p[i] >= 1]
        if not on: col = (220, 40, 40)
        else:
            a = next(a for a in PRI if a in on); col = COL[a]
            if len(on) >= 2: col = tuple(min(255, int(v * 1.25 + 20)) for v in col)
    dr.rectangle([x, y, x + S - 1, y + S - 1], fill=col)
sites(dr)
legend(dr, [('농사', COL['farm']), ('고기잡이', COL['fish']), ('사냥', COL['hunt']), ('숲(교역)', COL['wood']), ('광업(교역)', COL['mine']), ('빈 땅', (220, 40, 40)), ('물', (25, 35, 80)), ('바위', (90, 90, 90))])
caption(dr, f"{d['displayName']} · 칸 {G}셀 · 20명 기준 · 빨간 점 = 축 없는 마을 · 노란 원 = 4일(종전 시계) 외톨이 · 보라 원 = 몰린 곳(이웃 ≥ 평균+표준편차)")
im.save(os.path.join(out, f'{Z}_1_생업지도.png'))

# ② 빈 땅을 무엇이 살리나
ids = d['scenIds']; iT = ids.index('strm'); iS = ids.index('s20'); iF = ids.index('f62'); iO = ids.index('o')
im = base(); dr = ImageDraw.Draw(im)
for c in d['cellsOut']:
    cx, cy, k = c[0], c[1], c[2]
    x, y = cellxy(cx, cy)
    if k == 'w': col = (25, 35, 80)
    elif k == 'r': col = (90, 90, 90)
    else:
        p = [int(ch) for ch in k]
        if any(v >= 1 for v in p): col = (55, 55, 60)
        else:
            fx = c[3].split(',') if c[3] else []
            if fx and fx[iT] != '-': col = (0, 230, 230)
            elif fx and fx[iS] != '-': col = (110, 160, 240)
            elif fx and fx[iF] != '-': col = (60, 180, 80)
            elif fx and fx[iO] != '-': col = (170, 100, 210)
            else: col = (220, 40, 40)
    dr.rectangle([x, y, x + S - 1, y + S - 1], fill=col)
sites(dr, names=False)
legend(dr, [('①′ 있는 개울을 물로', (0, 230, 230)), ('① 새 지류 20셀', (110, 160, 240)), ('② 숲으로 삶', (60, 180, 80)), ('③ 광맥으로 삶', (170, 100, 210)), ('못 삶', (220, 40, 40)), ('이미 생업 있음', (55, 55, 60))])
caption(dr, f"{d['displayName']} · 빈 땅만 · ①②③ 순서로 처음 살린 것(재민 9월 순서)")
im.save(os.path.join(out, f'{Z}_2_빈땅처방.png'))

# ③ 자리 — 지금 vs 규칙
im = base(); dr = ImageDraw.Draw(im)
for c in d['cellsOut']:
    cx, cy, k = c[0], c[1], c[2]
    x, y = cellxy(cx, cy)
    col = (25, 35, 80) if k == 'w' else (90, 90, 90) if k == 'r' else ((60, 60, 66) if any(int(ch) >= 1 for ch in k) else (110, 40, 40))
    dr.rectangle([x, y, x + S - 1, y + S - 1], fill=col)
sites(dr, names=False)
if d.get('rule'):
    for p in d['rule']['pts']:
        x, y = cellxy(p['cx'], p['cy']); x += S // 2; y += S // 2
        dr.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(255, 210, 0), outline=(0, 0, 0))
legend(dr, [('지금 마을', (255, 255, 255)), ('규칙 초안 자리', (255, 210, 0)), ('생업 있음', (60, 60, 66)), ('빈 땅', (110, 40, 40))])
caption(dr, f"{d['displayName']} · 규칙: 생업 ≥1(20명) · 같은 수 · 가장 먼 점(곧은 간격 {d['rule']['gapCells'] if d.get('rule') else '-'}셀)")
im.save(os.path.join(out, f'{Z}_3_자리규칙.png'))
print('ok', Z)
