'use strict';
// (@regress 없음 — 러너 밖 · T1060 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1060-hold-probe.js — 대치 재편 원점 관찰기(서버 판 자 `t577-server-run.js` 곁 프리로드) =======================
//
// ★왜 [T1044 회부 2 → T1060] 대치 전이(villages `_warToStandoff`)의 재편(war-live `regroup` — 첫 생존자 자리 = 원점)이 걸어 오던
//   긴급 소집 대형의 길 중간을 원점으로 삼아 그 대형이 길 중간에 선다 · T1019 정보 1(재편 원점이 막힌 칸 안 몸에서 선다)과 같은 뿌리.
//   이 관찰기는 `regroup` 이 불릴 때마다 한 줄을 남기고, 그 대형을 그 전쟁의 다음 순간 둘까지 따라간다:
//   ① 누구 — 그날 · 전쟁 · 편(A 공격 · B 방어) · 대형 꼴(`scram` 긴급 소집 · `respond` 응전 포진 · `sortie` 출격 · `atk` 공격) · 몸 걸음 칸(`_t790Walk`) ·
//      산 몸 수 · 접촉 수 · 맞붙음 있었나(`engagedOnce`)
//   ② 재편 원점(regroup 이 돌려준 순간 = 첫 생존자 자리) — 칸 종류 · 포진점(`holdPt`)까지(셀)
//   ③ 그 대치 전이 끝의 원점(같은 걸음 — villages 가 곧이어 부르는 대치 방송의 `aliveCounts` 순간 · T1060 켬이면 포진점) — 칸 종류 · 포진점까지
//   ④ 그 뒤 — 그 전쟁의 다음 전진 명령(`orderAdvance` — 이튿날 돌격 등) 순간 · 그 뒤 첫 접촉(`stepFight` 접촉 수가 는 걸음) 순간:
//      방어 대형 원점 · 산 몸의 포진점 거리(가운데 · 가장 먼 · 13칸 안 수) · 지휘 몸 칸 종류 / 정산(`settle`)이 먼저 오면 그 순간
//   칸 종류(t956 관찰기와 같은 이름): R = 건물 발자국(`_warRectCells`) · T = 지형(`_warTerrMemo` 1 — Tw 물 · Tr 바위 · 도랑) · W = 나무(`_warTreeMemo` 1) · . = 열림 · ? = 메모에 없음
//   ⚠읽기만 — 전쟁 칸 · 몸 칸 · 교전 칸에 쓰지 않는다 · RNG 무접촉 · **호스트 메모만 읽는다**(술어를 새로 안 부른다 — 메모에 없는 칸은 '?').
//     감싸는 것은 `createWarLive` 가 돌려준 문 다섯(`regroup` · `aliveCounts` · `orderAdvance` · `stepFight` · `settle`)뿐 — 받은 값을 그대로 돌려준다.
//     (war-live 안에서 부르는 문은 감싸지 않는다 — villages 가 부른 것만 본다.)
//
// 쓰는 법:  NODE_OPTIONS="… -r $PWD/scripts/t1060-hold-probe.js" node scripts/t577-server-run.js 800 1020,7,42
//           (`T577_SEED` 가 있는 아이 서버만 잰다 · 판 JSON 곁 `<판>-<시드>.t1060.json` · `T1060_OUT` 로 바꿀 수 있다)
//   ⇒ { seed, rg: [ { day, wid, atk, def, side, cls, walk, n, k, eo, t, o0, c0, d0, o1, c1, d1, adv, ct, end } ], errs }
//     표 기계: `scripts/t1060-hold-table.js <판 자 뿌리>`
const path = require('path');
const fs = require('fs');
if (!process.env.T577_SEED) return;
const OUT = process.env.T1060_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1060.json' : '');
const ROOT = path.join(__dirname, '..');
const WLM = require(path.join(ROOT, 'server', 'war-live'));
const rec = { ver: 1, seed: +process.env.T577_SEED, rg: [], errs: 0, err0: null };
const r2 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 100) / 100;
function err(e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 600); }
let _vst = null;
function vstate() {
  if (_vst) return _vst;
  try { const k = require.resolve(path.join(ROOT, 'server', 'villages.js')); const m = require.cache[k]; if (m && m.exports && typeof m.exports.__p3Bind === 'function') _vst = m.exports.__p3Bind({}).state; } catch (e) { _vst = null; }
  return _vst;
}
function cellK(S, x, y) {   // 셀 좌표(실수) → 칸 종류 — 호스트 메모만(t956 관찰기 `cellK` 와 같은 이름 · 같은 열쇠)
  if (!S || x == null || y == null) return '?';
  const ix = Math.floor(x), iy = Math.floor(y), k = ix * 65536 + iy;
  if (S._warRectCells && S._warRectCells.has(k)) return 'R';
  const t = S._warTerrMemo ? S._warTerrMemo.get(k) : undefined;
  if (t === 1) { const w = S._warWaterMemo ? S._warWaterMemo.get(k) : undefined; return w === 1 ? 'Tw' : (w === 0 ? 'Tr' : 'T'); }
  const w = S._warTreeMemo ? S._warTreeMemo.get(k) : undefined;
  if (w === 1) return 'W';
  if (t === undefined || w === undefined) return '?';
  return '.';
}
const pt = (p) => p ? [r2(p.cx), r2(p.cy)] : null;
const dist = (p, h) => (p && h) ? r2(Math.hypot(p.cx - h.cx, p.cy - h.cy)) : null;
function med(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return r2(s[Math.floor(s.length / 2)]); }
function bodyOf(S, g) {   // 그 대형의 전쟁 몸 · 편
  if (!S || !S.warBodies || !g) return null;
  for (const b of S.warBodies.values()) { if (b.defGroup === g) return { b, side: 'B' }; if (b.atkGroup === g) return { b, side: 'A' }; }
  return null;
}
function look(S, g) {   // 방어 대형 지금 — 원점 · 산 몸의 포진점 거리 · 지휘 몸 칸
  const h = g.holdPt || null, ds = [];
  for (const u of g.units || []) { if (u.dead) continue; if (h) ds.push(Math.hypot(u.x - h.cx, u.y - h.cy)); }
  const c = g.commander && !g.commander.dead ? g.commander : null;
  return { o: pt(g.cmd), oD: dist(g.cmd, h), oC: cellK(S, g.cmd && g.cmd.cx, g.cmd && g.cmd.cy), n: ds.length, med: med(ds), max: ds.length ? r2(Math.max(...ds)) : null,
    in13: ds.filter((d) => d <= 13).length, cmdC: c ? cellK(S, c.x, c.y) : null };
}
const PEND = [];    // 대치 전이 끝 원점(③)을 기다리는 줄 — { E, g }
const NEXT = [];    // 다음 전진 · 첫 접촉(④)을 기다리는 방어 줄 — { E, g, f, k }
function closePend(S) { while (PEND.length) { const { E, g } = PEND.shift(); try { E.o1 = pt(g.cmd); E.c1 = cellK(S, g.cmd && g.cmd.cx, g.cmd && g.cmd.cy); E.d1 = dist(g.cmd, g.holdPt); } catch (e) { err(e); } } }
const cwl = WLM.createWarLive;
WLM.createWarLive = function (opts) {
  const WL = cwl.apply(this, arguments);
  const dayOf = (opts && typeof opts.dayOf === 'function') ? opts.dayOf : () => -1;
  const rg = WL.regroup, ac = WL.aliveCounts, oa = WL.orderAdvance, sf = WL.stepFight, se = WL.settle;
  WL.regroup = function (g) {
    const S = vstate();
    try { closePend(S); } catch (e) { err(e); }
    const r = rg.apply(this, arguments);
    try {
      const bo = bodyOf(S, g);
      if (bo && g && g.units) {
        const b = bo.b, w = b.w, f = b.fight;
        const cls = bo.side === 'A' ? 'atk' : (g._scram ? 'scram' : (w && w._sortie ? 'sortie' : 'respond'));
        const E = { day: dayOf() | 0, wid: w.id, atk: w.atk && w.atk.name, def: w.def && w.def.name, side: bo.side, cls, walk: g._t790Walk > 0 ? 1 : 0,
          n: g.units.length, k: f ? (f.contacts | 0) : null, eo: f && f.engagedOnce ? 1 : 0, t: f ? r2(f.t) : null,
          o0: pt(g.cmd), c0: cellK(S, g.cmd && g.cmd.cx, g.cmd && g.cmd.cy), d0: dist(g.cmd, g.holdPt), o1: null, c1: null, d1: null, adv: null, ct: null, end: null };
        rec.rg.push(E); PEND.push({ E, g });
        if (bo.side === 'B' && f) {   // 같은 전쟁의 앞 줄은 여기서 닫는다(새 대치가 왔다)
          for (let i = NEXT.length - 1; i >= 0; i--) if (NEXT[i].f === f) NEXT.splice(i, 1);
          NEXT.push({ E, g, f, k: null });
        }
      }
    } catch (e) { err(e); }
    return r;
  };
  WL.aliveCounts = function (f) {
    try { if (PEND.length) closePend(vstate()); } catch (e) { err(e); }
    return ac.apply(this, arguments);
  };
  WL.orderAdvance = function (f, side) {
    const S = vstate();
    try {
      if (PEND.length) closePend(S);
      for (const x of NEXT) if (x.f === f && !x.E.adv) { x.E.adv = Object.assign({ day: dayOf() | 0, t: r2(f.t), side }, look(S, x.g)); x.k = f.contacts | 0; }
    } catch (e) { err(e); }
    return oa.apply(this, arguments);
  };
  WL.stepFight = function (f) {
    const ev = sf.apply(this, arguments);
    try {
      if (NEXT.length) {
        let S = null;
        for (let i = NEXT.length - 1; i >= 0; i--) { const x = NEXT[i]; if (x.f !== f || x.k == null) continue;
          if ((f.contacts | 0) > x.k) { S = S || vstate(); x.E.ct = Object.assign({ day: dayOf() | 0, t: r2(f.t) }, look(S, x.g)); NEXT.splice(i, 1); } }
      }
    } catch (e) { err(e); }
    return ev;
  };
  WL.settle = function (f, why, winner) {
    try {
      const S = vstate();
      if (PEND.length) closePend(S);
      for (let i = NEXT.length - 1; i >= 0; i--) { const x = NEXT[i]; if (x.f !== f) continue; x.E.end = Object.assign({ day: dayOf() | 0, t: r2(f.t), why, winner: winner || null }, look(S, x.g)); NEXT.splice(i, 1); }
    } catch (e) { err(e); }
    return se.apply(this, arguments);
  };
  return WL;
};
process.on('exit', () => {
  if (!OUT) return;
  try { closePend(vstate()); } catch (e) { err(e); }
  try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 판 끝 — 쓸 곳이 없으면 그만 */ }
});
