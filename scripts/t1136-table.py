#!/usr/bin/env python3
# (@regress 없음 — 표 굽기 · 판정 0) T1136 — 바구니 교역 판 표: `계측/T1136_판/<팔>_<시드>.json`(t17 T17_JSON) + `_basket.json`(T17_BASKET 칸)을 모아 보고 §3-1 표를 낸다.
# 실행: python3 scripts/t1136-table.py [판 폴더=계측/T1136_판]
import json, sys, os
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '계측', 'T1136_판')
ARMS = [('off_w0', '끔 · T474 끔(지금)'), ('off_w1', '끔 · T474 켬'), ('on_w0', '켬 · T474 끔'), ('on_w1', '켬 · T474 켬'), ('on_w0e', '켬 · T474 끔 · 호위도 짐'), ('on_w1e', '켬 · T474 켬 · 호위도 짐')]
SEEDS = ['1020', '7', '42']
def ld(p):
    try:
        return json.load(open(p))
    except Exception:
        return None
rows = {}
for arm, _ in ARMS:
    for s in SEEDS:
        a = ld(f'{D}/{arm}_{s}.json'); b = ld(f'{D}/{arm}_{s}_basket.json')
        rows[(arm, s)] = (a, b)
def items_mean(h):
    n = sum(h.values()); return sum(int(k) * v for k, v in h.items()) / n if n else 0
def share_ge(h, k):
    n = sum(h.values()); return sum(v for kk, v in h.items() if int(kk) >= k) / n if n else 0
print('| 팔 | 시드 | 인구 | 빈 마을 | 굶어 죽음 | ㉮ 일/건 | ㉯ 일/건 | 다리 | 가는 짐 kg(평균·중앙) | 적재율 중앙 | 가는 품목(평균·2+) | 받아 온 짐 kg 평균 | 받아 온 품목 평균 | 남는 값 중앙 | 빈손 | 밤 도착 | 값 진동(교역 품목 · 식량) | 차익 남는 쌍 몫 · ln 중앙 · kg당 중앙 | 숯 · 통나무 kg(가는 길 / 받아 온) |')
print('|' + '---|' * 20)
for arm, nm in ARMS:
    for s in SEEDS:
        a, b = rows[(arm, s)]
        if not a or not b:
            print(f'| {nm} | {s} | (없음) |'); continue
        base = a['base']; e = a.get('eight') or {}
        live = a.get('live'); empty = a['villages'] - live
        legs = b['legs']; it = b['items']; ri = b['ret']['items']
        kgm = b['kg']['mean']; kgp = b['kg']['p50']; ld50 = b['load']['p50']
        fuel = b['fuel']
        ch = fuel['charcoal']; wd = fuel['wood']
        night = f"{b['arrive']['night']}/{b['arrive']['n']}"
        vol = b['vol']; arb = b['arb']
        print(f"| {nm} | {s} | {base['pop']} | {empty} | {b['famineDead']} | {e.get('densAll')} | {e.get('densValue')} | {legs} | {kgm:.1f} · {kgp:.1f} | {ld50:.2f} | {items_mean(it):.2f} · {share_ge(it,2):.0%} | {b['ret']['kg']['mean'] or 0:.1f} | {items_mean(ri):.2f} | {b['ret']['leftFrac']['p50'] if b['ret']['leftFrac']['p50'] is not None else '—'} | {b['bail']} | {night} | {vol['traded']} · {vol['food']} | {arb.get('posFrac')} · {arb.get('lnP50')} · {arb.get('kgP50')} | {ch['kg']:.0f}·{wd['kg']:.0f} / {ch['ret']:.0f}·{wd['ret']:.0f}(낱개) |")
# 팔별 3시드 합 · 평균
print()
print('| 팔 | 인구 합 | 빈 마을 합 | 굶어 죽음 합 | 다리 합 | 가는 짐 kg 평균 | 받아 온 짐 kg 평균 | 밤 도착 몫 |')
print('|---|---|---|---|---|---|---|---|')
for arm, nm in ARMS:
    P = E = F = L = 0; kg = []; rk = []; nn = nd = 0
    ok = True
    for s in SEEDS:
        a, b = rows[(arm, s)]
        if not a or not b: ok = False; continue
        P += a['base']['pop']; E += a['villages'] - a['live']; F += b['famineDead']; L += b['legs']
        kg.append(b['kg']['mean']); rk.append(b['ret']['kg']['mean'] or 0); nn += b['arrive']['night']; nd += b['arrive']['n']
    if not ok: print(f'| {nm} | (모자람) |'); continue
    print(f"| {nm} | {P} | {E} | {F} | {L} | {sum(kg)/len(kg):.1f} | {sum(rk)/len(rk):.1f} | {nn/nd if nd else 0:.0%} |")
