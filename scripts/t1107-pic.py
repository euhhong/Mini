#!/usr/bin/env python3
# (@regress 없음 — 러너 밖 · T1107 그림 칸)
# =============================================================================
# T1107 — 마을 둘레(영토 + 40셀)를 위에서 본 그림. `t1107-observe.js` 가 찍은 칸 글자 지도를 PNG 로 굽는다.
#   칸 색: 물 · 바위 · 트인 땅(풀밭) · 영토 · 밭 · 집 · 큰 나무 · 어린나무 · 벤 자리 · 둘레 밖(흰 바탕)
#   한 장 = 판 여럿(열) × 날 둘(행 — 1년 · 3년) · 마을 하나. 칸 아래에 트인 땅 % · 선 나무 칸 · 밭 칸을 적는다.
# 쓰는 법: python3 scripts/t1107-pic.py <출력.png> <마을> <제목> <열이름=판.t1107.json> … [--days 365,1094]
# =============================================================================
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(sz, b=False):
    f = BOLD if b and os.path.exists(BOLD) else FONT
    return ImageFont.truetype(f, sz, index=1) if os.path.exists(f) else ImageFont.load_default()
COL = {
    '~': (110, 160, 205), '^': (150, 145, 140), '.': (214, 222, 170), 't': (226, 208, 168), 'f': (196, 168, 96),
    'h': (150, 92, 64), 'T': (46, 102, 52), 's': (122, 170, 88), 'x': (176, 138, 104), ' ': (250, 250, 248),
}
args = [a for a in sys.argv[1:]]
days = [365, 1094]
if '--days' in args:
    i = args.index('--days'); days = [int(x) for x in args[i + 1].split(',')]; del args[i:i + 2]
out, vil, title = args[0], args[1], args[2]
cols = []
for a in args[3:]:
    nm, f = a.split('=', 1)
    try: doc = json.load(open(f))
    except Exception: doc = None
    cols.append((nm, doc))
K = 3
def shot_of(doc, day):
    if not doc: return None
    best = None
    for s in doc.get('shots', []):
        if s['day'] == day: best = s
    return best
# 칸 크기 — 가장 큰 그림 기준
W = H = 0
for nm, doc in cols:
    for d in days:
        s = shot_of(doc, d)
        if s and vil in s.get('pic', {}):
            p = s['pic'][vil]; H = max(H, len(p['rows'])); W = max(W, max(len(r) for r in p['rows']))
if W == 0:
    print('그림 없음', vil); sys.exit(1)
PAD, TOP, LBL, LEFT = 14, 92, 74, 120
cw, ch = W * K, H * K
img = Image.new('RGB', (max(1040, LEFT + len(cols) * (cw + PAD) + PAD), TOP + len(days) * (ch + LBL + PAD) + 60), (255, 255, 255))
dr = ImageDraw.Draw(img)
dr.text((PAD, 14), title, fill=(20, 20, 20), font=font(26, True))
for ci, (nm, doc) in enumerate(cols):
    x0 = LEFT + PAD + ci * (cw + PAD)
    dr.text((x0, TOP - 30), nm, fill=(20, 20, 20), font=font(20, True))
    for di, d in enumerate(days):
        y0 = TOP + di * (ch + LBL + PAD)
        if ci == 0: dr.text((PAD, y0 + ch // 2 - 14), f'{d + 1}일째\n({(d + 1) / 365:.1f}년)', fill=(20, 20, 20), font=font(18, True))
        s = shot_of(doc, d)
        if not s or vil not in s.get('pic', {}):
            dr.rectangle([x0, y0, x0 + cw, y0 + ch], outline=(200, 200, 200)); dr.text((x0 + 10, y0 + 10), '판 없음', fill=(120, 120, 120), font=font(16))
            continue
        p = s['pic'][vil]
        for yy, row in enumerate(p['rows']):
            for xx, c in enumerate(row):
                col = COL.get(c, (255, 0, 255))
                if c == ' ': continue
                dr.rectangle([x0 + xx * K, y0 + yy * K, x0 + xx * K + K - 1, y0 + yy * K + K - 1], fill=col)
        S = s['v'].get(vil, {})
        txt = f"트인 땅 {100 * (S.get('open') or 0):.1f}% · 선 나무 칸 {S.get('tree', 0):,}(어린 {S.get('sap', 0):,})\n벤 자리 {S.get('cut', 0):,} · 밭 {S.get('farm', 0):,} · 인구 {S.get('pop', 0):,}"
        dr.text((x0, y0 + ch + 6), txt, fill=(30, 30, 30), font=font(15))
# 범례
ly = img.height - 44; lx = PAD
for c, nm in [('.', '트인 땅'), ('t', '영토'), ('f', '밭'), ('h', '집'), ('T', '큰 나무'), ('s', '어린나무'), ('x', '벤 자리'), ('~', '물'), ('^', '바위')]:
    dr.rectangle([lx, ly, lx + 18, ly + 18], fill=COL[c], outline=(80, 80, 80)); dr.text((lx + 24, ly - 2), nm, fill=(20, 20, 20), font=font(16)); lx += 110
img.save(out)
print('→', out, img.size)
