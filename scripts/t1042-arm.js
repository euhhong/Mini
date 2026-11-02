'use strict';
// (@regress 없음 — 러너 밖 · T1042 팔 · 제품 무변 — 팔 하나만 그 판의 세계를 바꾼다)
// === scripts/t1042-arm.js — T956 회부 2 "몸 층 세 길" 을 하나씩만 켠 판 — 서버 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: T1042_ARM=hold|body|rally NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1031-war-observe.js -r $PWD/scripts/t1042-observe.js -r $PWD/scripts/t1042-arm.js" \
//              node scripts/t577-server-run.js 800 1020        (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1042arm.json` — 팔이 선 수)
//   ★왜 [T1042 ② · T956 회부 2] 세 길 각각의 효과 크기를 띠로 내려면 그 길 **하나만** 켠 판이 있어야 한다. 제품에 손잡이가 없으니(새 손잡이 = 제품 변경)
//     판 자 아이 안에서 이미 있는 문(war-live 가 돌려준 `stepFight` · `buildGroup` · war-core `conscript` — villages 가 `state.warLive.*` · `state.war.*` 로 부른다)을 감싸
//     그 길만 켠다. 술어 · 걸음 · 풀기는 villages 가 하네스에 내보낸 같은 함수(`__p3Bind` — `_warBlockedCell` · `_warReleaseAdv` · `_warStandNear`)를 부른다(사본 0).
//     새 수 0 — 쓰는 수는 다 제품 수(`engR` = battle-core 탐지 반경 · `_warClearLine` 격자 순회 40m · 포진 거리 `WAR_DEF_STANDOFF` 45 · 긴급 12).
//   팔 셋(T956 보고 §5 회부 2 의 세 줄 그대로):
//     hold  — ① 지키는 쪽 대형 손: 첫 접촉까지 대형이 쥐어 사거리 안 적에게도 안 쏜다 ⇒ 켬: 전진(advance) 동안 지키는 쪽(holder) 산 몸 하나라도
//             제 탐지 반경(war-live `engR(type)` = battle-core 그 식 — 사수 사거리 + 2 · 근접 13) 안에 적 몸이 있으면 그 쪽 대형 손을 푼다
//             (war-live `setSideCtl(f, holder, false)` — 첫 접촉이 하는 그 문). 추격 없음(`hold` 어댑터)은 그대로.
//     body  — ② 공격 풀림 술어: 두 대형 **원점** 사이 곧은 걸음 줄 ⇒ 켬: 전진 대형이 행군로 투영점에 닿았으면(`s = sT`) 원점선 대신
//             **몸선**(맞선 가장 가까운 두 몸 사이 걸음 줄 — `_warClearLine` 같은 격자 순회 · 술어 `_warBlockedCell`)이 열렸을 때도 푼다(`_warReleaseAdv` 그대로)
//     rally — ③ 방어 포진점: 마을 중심에서 공격 쪽으로 곧게 45칸(긴급 12칸) — 행군로 · 장애물을 안 본다 ⇒ 켬: 같은 거리의 **행군로 위 점**
//             (행군로 `f.route`(공격 → 방어)를 방어 끝에서 거슬러 올라가 마을 중심에서 처음 그 거리에 닿는 점 · 막힌 칸이면 `_warStandNear`)에 포진한다
//             (villages 가 `state.warLive.buildGroup(units, form, rally, th, seed)` 에 넘긴 rally 칸을 그 점으로 — 그 뒤 `holdPt` 가 같은 칸을 읽는다)
//   ⚠팔은 세계를 바꾼다(그게 팔이다). 관찰기(t1031 · t1042)는 그대로 읽기만 한다.
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const ARM = process.env.T1042_ARM || '';
if (!/^(hold|body|rally)$/.test(ARM)) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1042arm.json' : '';
const ROOT = path.join(__dirname, '..');
const WLM = require(path.join(ROOT, 'server', 'war-live'));
const WCM = require(path.join(ROOT, 'sim', 'war-core'));
const rec = { arm: ARM, seed: +process.env.T577_SEED, fire: 0, look: 0, miss: 0, byWar: {}, errs: 0, err0: null };
function err(e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 800); }
let _vb = null;
function vb() {
  if (_vb) return _vb;
  try { const k = require.resolve(path.join(ROOT, 'server', 'villages.js')); const m = require.cache[k]; if (m && m.exports && typeof m.exports.__p3Bind === 'function') _vb = m.exports.__p3Bind({}); } catch (e) { _vb = null; }
  return _vb;
}
const fire = (w) => { rec.fire++; const id = w && w.id; if (id != null) rec.byWar[id] = (rec.byWar[id] || 0) + 1; };
//   villages `_warClearLine` 과 같은 격자 순회(40m 앞까지 · 서 있는 칸 빼고 · 끝 칸 넣고) — 술어는 villages `_warBlockedCell` 그대로(M_PER_CELL = 1)
function clearLine(B, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy); if (d < 1) return true;
  const tEnd = Math.min(d, 40) / d;
  let cx = Math.floor(x1), cy = Math.floor(y1);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? 1 / Math.abs(dx) : Infinity, tdy = dy !== 0 ? 1 / Math.abs(dy) : Infinity;
  let tx = dx !== 0 ? (sx > 0 ? (cx + 1) - x1 : x1 - cx) / Math.abs(dx) : Infinity;
  let ty = dy !== 0 ? (sy > 0 ? (cy + 1) - y1 : y1 - cy) / Math.abs(dy) : Infinity;
  for (;;) {
    if (tx < ty) { if (tx > tEnd) break; cx += sx; tx += tdx; } else { if (ty > tEnd) break; cy += sy; ty += tdy; }
    if (B._warBlockedCell(cx, cy)) return false;
  }
  return true;
}
// ── ① hold · ② body — 전진 걸음 앞(villages `_warTickOne` 이 `_warAdvanceMarch` · `_warHoldCtlSides` 뒤에 `stepFight` 를 부른다) ──
function armHold(WL, f) {
  const H = f.holder; if (!H) return;
  let any = false; for (const u of f.ctx.units) if (u.side === H && u.hp > 0 && u.ctl) { any = true; break; }
  if (!any) return;
  rec.look++;
  for (const u of f.ctx.units) {
    if (u.side !== H || u.hp <= 0) continue;
    const R = WL.engR(u.type), R2 = R * R;
    for (const e of f.ctx.units) { if (e.side === H || e.hp <= 0) continue; const dx = e.x - u.x, dy = e.y - u.y; if (dx * dx + dy * dy <= R2) { WL.setSideCtl(f, H, false); fire(f.w); return; } }
  }
}
function armBody(WL, f) {
  const A = f.adv; if (!A || A.released || A.s == null || A.sT == null || Math.abs(A.s - A.sT) > 1e-6) return;
  const B = vb(); if (!B) return;
  rec.look++;
  const side = A.side; let best = null, bd = Infinity;
  for (const a of f.ctx.units) { if (a.side !== side || a.hp <= 0) continue; for (const e of f.ctx.units) { if (e.side === side || e.hp <= 0) continue; const d = (a.x - e.x) ** 2 + (a.y - e.y) ** 2; if (d < bd) { bd = d; best = [a, e]; } } }
  if (!best) return;
  if (!clearLine(B, best[0].x, best[0].y, best[1].x, best[1].y)) { rec.miss++; return; }
  const body = B.state.warBodies && B.state.warBodies.get ? B.state.warBodies.get(f.w.id) : null; if (!body) return;
  const g = side === 'A' ? body.atkGroup : body.defGroup;
  B._warReleaseAdv(f, A, g); fire(f.w);
}
// ── ③ rally — 방어 소집(`state.war.conscript(def, …, { defense: true })`) 바로 뒤 그 마을의 방어 대형 짓기(`state.warLive.buildGroup`) ──
let _pend = null;
function routeRally(body, dc, so, PXM) {
  const f = body.fight;
  const R = (f && f.route && f.route.length >= 2) ? f.route : (body.pts || []).map((p) => ({ x: p.x / PXM, y: p.y / PXM }));   // villages `_warEnsureFight` 의 행군로 그 식(공격 → 방어 · m)
  if (!R || R.length < 2) return null;
  let prev = R[R.length - 1], dPrev = Math.hypot(prev.x - dc.cx, prev.y - dc.cy);
  if (dPrev >= so) return null;   // 행군로 끝이 이미 그 거리 밖(마을 중심에 안 닿는 길) — 종전 점
  for (let i = R.length - 2; i >= 0; i--) {
    const q = R[i], dq = Math.hypot(q.x - dc.cx, q.y - dc.cy);
    if (dq >= so) {   // prev(안) → q(밖) 선분 위 거리 so 인 점(이분 — 단조 아닐 수 있어 선분 위 처음 넘는 곳)
      let lo = 0, hi = 1;
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, x = prev.x + (q.x - prev.x) * m, y = prev.y + (q.y - prev.y) * m; if (Math.hypot(x - dc.cx, y - dc.cy) < so) lo = m; else hi = m; }
      return { cx: prev.x + (q.x - prev.x) * hi, cy: prev.y + (q.y - prev.y) * hi };
    }
    prev = q; dPrev = dq;
  }
  return null;
}
if (ARM === 'rally') {
  const cw = WCM.createWar;
  WCM.createWar = function () {
    const war = cw.apply(this, arguments);
    const cs = war.conscript;
    if (typeof cs === 'function') war.conscript = function (v, mode, op) { const r = cs.apply(this, arguments); try { if (op && op.defense && v) _pend = v; } catch (e) { err(e); } return r; };
    return war;
  };
}
const cwl = WLM.createWarLive;
WLM.createWarLive = function (opts) {
  const WL = cwl.apply(this, arguments);
  if (ARM === 'hold' || ARM === 'body') {
    const sf = WL.stepFight;
    WL.stepFight = function (f) {
      try { if (f && f.state === 'advance') { if (ARM === 'hold') armHold(WL, f); else armBody(WL, f); } } catch (e) { err(e); }
      return sf.apply(this, arguments);
    };
  }
  if (ARM === 'rally') {
    const bg = WL.buildGroup;
    WL.buildGroup = function (units, form, rally, heading, seed) {
      try {
        const v = _pend; _pend = null;
        const B = v ? vb() : null;
        if (B && rally && v) {
          let body = null;
          for (const b of B.state.warBodies.values()) if (b.w && b.w.def && (b.w.def === v || b.w.def.name === v.name) && b.defBuilt && !b.defGroup) { body = b; break; }
          const dc = { cx: v.ccx, cy: v.ccy };
          const d0 = Math.hypot(rally.cx - dc.cx, rally.cy - dc.cy);
          const so = d0 > (WL.WAR_DEF_STANDOFF + 12) / 2 ? WL.WAR_DEF_STANDOFF : 12;   // 종전 포진 거리(45 · 긴급 12) — 넘겨받은 점이 어느 쪽인가(T1019 막힌 칸 옮김은 몇 칸)
          if (body && Math.abs(d0 - so) <= 4) {   // 방어 소집의 포진점(공격 대형 짓기는 주둔 링 — 마을 중심에서 95칸 언저리)
            rec.look++;
            const p = routeRally(body, dc, so, WL.PX_PER_M);
            if (p) { const c = B._warStandNear(p.cx, p.cy) || p; rally.cx = c.cx; rally.cy = c.cy; fire(body.w); } else rec.miss++;
          }
        }
      } catch (e) { err(e); }
      return bg.apply(this, arguments);
    };
  }
  return WL;
};
process.on('exit', () => { if (OUT) try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 팔 기록 실패는 판을 안 건드린다 */ } });
