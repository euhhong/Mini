#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t1129-stride-fit — 보폭 배율 표(`assets-src/gait/stride_fit.json`)를 맞춘다.  [T1129 · ★재민 11-03 문 15 ⓑ "보폭을 맞춘다"]

    python3 scripts/t1129-stride-fit.py --bpy=<bpy 파이썬> --sheet                  # 2D 시트(몸 하나 'sheet') — 포즈표(`poses.json`)를 다시 짓고 잰다
    python3 scripts/t1129-stride-fit.py --bpy=<bpy 파이썬> --glb [--src=<_3d_in>]   # 3D(몸 둘 'M' · 'F') — 내보내기(`char_export_gltf.py`)를 다시 돌리고 잰다

★무엇을 맞추나(새 수 0 — 자가 정한다)
  게임 이동 속도 v(`server/zone.js` MOVE_SPEED · SPRINT_MULT)와 재생 주기 T(시트 판 수 ÷ fps)는 그대로 두고, 걷기·달리기 다리 마디의 땅 기준 시상각
  (자료 곡선 `gait_norms.json` — 시트: 넓적다리 · 정강이 / 3D: + 발)에 배율 s 를 곱해 **디딘 발 미끄러짐 = 0** 이 되게 한다.
  자 = `t723-foot-slide.py` (나)(디딘 발만 — 자료 디딤 구간) `stance.slipCycle` = v·T − L(s) · 몸 × 클립마다 따로(남 · 여 · 시트는 다리 길이가 다르다).
  ⓐ 첫 걸음 = T723 의 ⓑ 비(`b_scale` = v·T / L — 카드 15 ⓑ 의 ×1.10094 · ×1.11623 이 남 3D 의 이 값) ·
  ⓑ 그다음은 할선(L 은 s 를 거의 곧게 따라오지만 접지 계획 — T741 들림 · 공중 골반 — 이 조금 비튼다) ·
  멈춤 = 몸 × 클립 전부 |미끄러짐| < `TOL`(0.1 mm/주기 — 수치 허용 · 설계 수 아님) 또는 `NMAX` 번.
  표에는 s 만 적는다 — 표가 곧 굽는 입력이라(3D 잠금 `_입력` 지문 · 시트 포즈표) 잰 값을 표에 되쓰지 않는다(잰 값 = 이 스크립트 출력 · 보고).
  표는 몸마다 따로 쓴다 — `--sheet` 는 'sheet' 칸만 · `--glb` 는 'M' · 'F' 칸만 고친다(다른 칸은 그대로 옮긴다).
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import mocap_retarget as MR  # noqa: E402  — 표 자리(`STRIDE_PATH`) · 읽는 함수(`stride_scale`)의 정본

CLIPS = ("walk", "run")
TOL = 1e-4          # m/주기 — 수치 허용(설계 수 아님 · 게이트는 1 cm)
NMAX = 6
TMP = os.path.join(ROOT, "scripts", "char_renders")      # .gitignore(굽기 중간 산물 자리)
NOTE = ("[T1129 · ★재민 11-03 문 15 ⓑ] 보폭 배율 s — 걷기·달리기 다리 마디(넓적다리 · 정강이 · [3D] 발)의 땅 기준 시상각(`gait_norms.json` 자료 곡선) × s. "
        "이동 속도(게임 수치)·주기(판 수 · fps)는 그대로 · s = 디딘 발 미끄러짐(`t723-foot-slide.py` (나)) 0 이 되는 값(몸 × 클립마다). "
        "`scripts/t1129-stride-fit.py` 산물 — 손편집 금지(읽는 곳: `mocap_retarget.stride_scale` — 시트 포즈표 · 3D 내보내기).")


def load():
    if not os.path.exists(MR.STRIDE_PATH):
        return {}
    return json.load(open(MR.STRIDE_PATH, encoding="utf-8")).get("scale", {})


def save(scale):
    os.makedirs(os.path.dirname(MR.STRIDE_PATH), exist_ok=True)
    doc = {"_": NOTE, "scale": {b: {c: round(scale[b][c], 6) for c in sorted(scale[b])} for b in sorted(scale)}}
    with open(MR.STRIDE_PATH, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")


def run(cmd, log):
    with open(log, "w", encoding="utf-8") as f:
        r = subprocess.run(cmd, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT)
    if r.returncode:
        raise SystemExit(f"[stride] ★실패({r.returncode}): {' '.join(cmd)} — 기록 {log}")


def measure_sheet(bpy):
    run([sys.executable, os.path.join(HERE, "mocap_retarget.py")], os.path.join(TMP, "_t1129_mocap.log"))
    out = os.path.join(TMP, "_t1129_sheet.json")
    run([bpy, os.path.join(HERE, "t723-foot-slide.py"), "--sheet", "--out=" + out], os.path.join(TMP, "_t1129_sheet.log"))
    r = json.load(open(out, encoding="utf-8"))
    return {"sheet": {c: r["clips"][c] for c in CLIPS}}


def measure_glb(bpy, src):
    cmd = [bpy, os.path.join(HERE, "char_export_gltf.py")] + (["--src=" + src] if src else [])
    run(cmd, os.path.join(TMP, "_t1129_export.log"))
    glb = os.path.join(ROOT, "public", "assets", "char3d", "char_body.glb")
    res = {}
    for body in ("M", "F"):
        out = os.path.join(TMP, f"_t1129_glb_{body}.json")
        run([sys.executable, os.path.join(HERE, "t723-foot-slide.py"), "--glb=" + glb, "--body=" + body, "--out=" + out],
            os.path.join(TMP, f"_t1129_glb_{body}.log"))
        r = json.load(open(out, encoding="utf-8"))
        res[body] = {c: r["clips"][c] for c in CLIPS}
    return res


def main():
    args = sys.argv[1:]
    opt = lambda k: next((a.split("=", 1)[1] for a in args if a.startswith(f"--{k}=")), None)
    bpy = opt("bpy") or sys.executable
    os.makedirs(TMP, exist_ok=True)
    if "--sheet" in args:
        bodies, meas = ("sheet",), lambda: measure_sheet(bpy)
    elif "--glb" in args:
        bodies, meas = ("M", "F"), lambda: measure_glb(bpy, opt("src"))
    else:
        raise SystemExit("[stride] --sheet 또는 --glb")
    scale = load()
    for b in bodies:
        scale.setdefault(b, {})
        for c in CLIPS:
            scale[b].setdefault(c, 1.0)
    hist = {(b, c): [] for b in bodies for c in CLIPS}
    for it in range(NMAX + 1):
        save(scale)
        m = meas()
        done = True
        for b in bodies:
            for c in CLIPS:
                st = m[b][c]["stance"]
                s, slip = scale[b][c], st["slipCycle"]
                hist[(b, c)].append((s, slip))
                print(f"[stride] {it} · {b} {c}: s {s:.6f} → (나) 디딘 발 L {st['L']:.5f} m · v·T {st['b_L']:.5f} m · 미끄러짐 {100 * slip:+.3f} cm/주기 · b_scale ×{st['b_scale']}"
                      f" · (다) 땅에 세운 점 {100 * m[b][c]['grounded']['slipCycle']:+.3f} cm/주기", flush=True)
                if abs(slip) >= TOL:
                    done = False
        if done:
            print(f"[stride] 맞음 — {it}번 잼 · 표 {os.path.relpath(MR.STRIDE_PATH, ROOT)}: " +
                  json.dumps({b: scale[b] for b in bodies}, ensure_ascii=False), flush=True)
            return
        if it == NMAX:
            raise SystemExit(f"[stride] ★{NMAX}번 안에 못 맞췄다: {hist}")
        for b in bodies:
            for c in CLIPS:
                h = hist[(b, c)]
                s, slip = h[-1]
                if abs(slip) < TOL:
                    continue
                if len(h) == 1:
                    s_new = s * m[b][c]["stance"]["b_scale"]                       # ⓐ T723 의 ⓑ 비
                else:
                    (s0, f0), (s1, f1) = h[-2], h[-1]
                    s_new = s1 - f1 * (s1 - s0) / (f1 - f0) if f1 != f0 else s1 * m[b][c]["stance"]["b_scale"]   # ⓑ 할선
                scale[b][c] = round(s_new, 6)


if __name__ == "__main__":
    main()
