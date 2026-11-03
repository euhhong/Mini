#!/usr/bin/env python3
# === scripts/webp_twins.py — 배포 png 옆에 **같은 화소 무손실 webp 쌍둥이**를 쓴다 [T1131 2026-11-04] ===
#
# ★왜(T1123 §3 표 · PM 11-03 판정 "바꾼다"): 게임 그림 558장(나무 · 자연물 · 건물 · 다리 · 밭 · 지면 · 아이콘)을
#   무손실 webp 로 다시 누르면 27.0 → 15.5 MB 이고 **잠금 자 화소가 558/558 같다**. 보이는 것 0 변 · 무게만 준다.
# ★설정은 하나다 — PIL `WEBP lossless=True quality=100 method=6`(T1123 `scripts/t1123-webp-table.js` 와 같은 줄 · 새 수 0).
#   `.convert('RGBA')` 를 먼저 한다: 잠금 자(`scripts/asset-lock.js` `pixelHashOf`)는 RGBA 를 재므로 RGB · 팔레트 png 도 같은 값이 된다.
#   ⚠T303: 완전투명 아래 RGB 는 인코더가 고쳐 쓴다 — 잠금 자는 그 자리를 0 으로 보고 재므로 같다(보이는 화소만 잰다).
# ★png 는 안 지운다 — 한 판 동안 둘 다 둔다(되돌림 = central 손잡이 `T1131_WEBP=0` → 종전 png 주소 · 해시 없음).
# ★쌍둥이가 낡으면(png 만 새로 굽고 이걸 안 돌리면) `node scripts/asset-lock.js --write` 가 **멈춘다**(같은 어간 두 파일의 화소가 다르다 →
#   표를 안 쓰고 이름을 댄다). 그러면 이걸 그 무리에 다시 돌리고 표를 쓴다.
#
# 쓰임:
#   python3 scripts/webp_twins.py <png 또는 디렉터리> ...      디렉터리면 그 안 *.png 전부(아래로는 안 내려간다)
#   from webp_twins import twin                                PIL 있는 파이썬(nature-postprocess 등)
#   import webp_twins; webp_twins.run([...])                   Blender 번들 파이썬(PIL 이 없을 수 있다 — render_common 규약) → 시스템 python3 로 넘긴다
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENC = 'PIL WEBP lossless=True quality=100 method=6'   # T1123 t1123-webp-table.js 와 같은 설정


def twin_path(png):
    return os.path.splitext(png)[0] + '.webp'


def twin(png):
    """png 한 장 → 옆에 같은 어간 `.webp`(무손실). 쓴 경로를 돌려준다."""
    from PIL import Image
    dst = twin_path(png)
    with Image.open(png) as im:
        im.convert('RGBA').save(dst, 'WEBP', lossless=True, quality=100, method=6)
    return dst


def _expand(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            out += [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.lower().endswith('.png')]
        elif p.lower().endswith('.png') and os.path.isfile(p):
            out.append(p)
    return out


def run(paths):
    """Blender 안에서 부른다 — PIL 이 있으면 제자리, 없으면 시스템 python3(`WEBP_PY` 로 바꿀 수 있다)로 넘긴다.
    ★실패는 삼키지 않는다 — 쌍둥이를 못 쓰면 굽기가 멈춰야 낡은 webp 가 배포에 남지 않는다."""
    paths = [p for p in paths if p]
    if not paths:
        return
    try:
        import PIL  # noqa: F401
        main(paths)
        return
    except ImportError:
        pass
    py = os.environ.get('WEBP_PY') or shutil.which('python3')
    if not py:
        raise SystemExit('[webp] ★python3 를 못 찾았다 — 쌍둥이 webp 를 못 쓴다(WEBP_PY 로 PIL 있는 파이썬을 댄다)')
    subprocess.run([py, os.path.join(HERE, 'webp_twins.py')] + list(paths), check=True)


def main(paths):
    files = _expand(paths)
    a = b = 0
    for f in files:
        d = twin(f)
        a += os.path.getsize(f)
        b += os.path.getsize(d)
    print(f'[webp] 쌍둥이 {len(files)}장 · png {a / 1e6:.2f} MB → webp {b / 1e6:.2f} MB ({ENC})')
    return files


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('쓰임: python3 scripts/webp_twins.py <png 또는 디렉터리> ...')
    main(sys.argv[1:])
