'use strict';
// (@regress 없음 — 러너 밖 · T1089 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1089-far-probe.js — 방어 몸이 멀리 있다 관찰기(서버 판 자 `t577-server-run.js` 곁 프리로드) =======================
//
// ★왜 [T1042 회부 → T1089] 교전 없는 철수 마디 중 "방어 몸 멀리"(마을에 하나뿐인 가시 몸이 제 마을 중심 100칸 밖) 25 — 그 몸이 왜 거기 있나 · 소집이 왜 못 닿나.
//   이 관찰기는 몸마다 이력을 남긴다:
//   ① 묶임(war-core `warDraftBind` — 징발 · 소집) · 풀림(`warDraftReleasePid` — 귀환 끝 · 교전 끝의 방어 몸 · 전사) 순간: 그날 · 전쟁 · 편(그 몸이 든 전쟁 몸의 `pids` = 공격 · `defPids` = 방어) ·
//      몸 자리 · 제 마을 중심까지(칸) · 칸 종류 · 가장 가까운 마을(중심 · 칸) · 그 전쟁 몸의 국면(행군 · 교전 · 귀환) · 귀환 장부 진척(`prog / len`) · 지휘 장부 자리
//   ② 하루 경계(war-core `daily` 앞): 마을 몸마다 제 마을 중심까지 — 100칸 밖이면 한 줄(그날 · 몸 · 거리 · 칸 · 묶임 여부 · 마지막 풀림부터 걸은 칸)
//   ③ 방어 소집(war-live `enlist` B): 그 몸의 거리 · 칸 · 마지막 풀림 이력(그날 · 전쟁 · 상대 마을 · 풀린 자리 · 그 뒤 걸은 칸 · 지난 날)
//   칸 종류(t956 · t1060 관찰기와 같은 이름): R 건물 발자국 · T 지형 · W 나무 · . 열림 · ? 메모 없음 — **호스트 메모만 읽는다**(술어를 새로 안 부른다).
//   ⚠읽기만 — 감싸는 것은 모듈이 내보낸 문(`createWar` 가 돌려준 `warDraftBind` · `warDraftReleasePid` · `daily` · `createWarLive` 가 돌려준 `enlist`)뿐 — 받은 값을 그대로 돌려준다 · RNG 무접촉.
//
// 쓰는 법:  NODE_OPTIONS="… -r $PWD/scripts/t1089-far-probe.js" node scripts/t577-server-run.js 800 1020,7,42
//   ⇒ `<판>-<시드>.t1089.json` { seed, rel: [...], bind: [...], far: [...], en: [...], stat: {villages `_warStat` 판 끝 사진}, errs }  · 표 기계 `scripts/t1089-far-table.js`
const path = require('path');
const fs = require('fs');
if (!process.env.T577_SEED) return;
const OUT = process.env.T1089_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1089.json' : '');
const ROOT = path.join(__dirname, '..');
const WCM = require(path.join(ROOT, 'sim', 'war-core'));
const WLM = require(path.join(ROOT, 'server', 'war-live'));
const SZ = 32;
const FAR = 100;   // 관찰 문턱(칸) — T1042 "방어 몸 멀리"(제 마을 중심 100 m 밖)와 같은 자 · 세계 수 아님
const rec = { ver: 1, seed: +process.env.T577_SEED, rel: [], bind: [], far: [], en: [], errs: 0, err0: null };
const r2 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 100) / 100;
function err(e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 600); }
let _vst = null;
function vstate() {
  if (_vst) return _vst;
  try { const k = require.resolve(path.join(ROOT, 'server', 'villages.js')); const m = require.cache[k]; if (m && m.exports && typeof m.exports.__p3Bind === 'function') _vst = m.exports.__p3Bind({}).state; } catch (e) { _vst = null; }
  return _vst;
}
function cellK(S, cx, cy) {
  if (!S || cx == null || cy == null) return '?';
  const ix = Math.floor(cx), iy = Math.floor(cy), k = ix * 65536 + iy;
  if (S._warRectCells && S._warRectCells.has(k)) return 'R';
  const t = S._warTerrMemo ? S._warTerrMemo.get(k) : undefined;
  if (t === 1) { const w = S._warWaterMemo ? S._warWaterMemo.get(k) : undefined; return w === 1 ? 'Tw' : (w === 0 ? 'Tr' : 'T'); }
  const w = S._warTreeMemo ? S._warTreeMemo.get(k) : undefined;
  if (w === 1) return 'W';
  if (t === undefined || w === undefined) return '?';
  return '.';
}
const day = () => { const S = vstate(); return S && S.world ? (S.world.day | 0) : -1; };
function near(S, cx, cy) {   // 가장 가까운 마을 중심(이름 · 칸)
  let best = null, bd = Infinity;
  for (const v of (S && S.villages) || []) { if (v.ccx == null) continue; const d = Math.hypot(v.ccx - cx, v.ccy - cy); if (d < bd) { bd = d; best = v; } }
  return best ? { v: best.name, d: r2(bd) } : null;
}
function where(S, p, vil) {   // 몸 자리 · 제 마을 중심까지 · 칸 · 가장 가까운 마을
  const cx = p.x / SZ, cy = p.y / SZ;
  return { x: r2(cx), y: r2(cy), home: vil ? r2(Math.hypot(cx - vil.ccx, cy - vil.ccy)) : null, cell: cellK(S, cx, cy), near: near(S, cx, cy) };
}
function bodyOf(S, pid) {   // 그 몸이 든 전쟁 몸 · 편
  if (!S || !S.warBodies) return null;
  for (const b of S.warBodies.values()) {
    if (b.pids && b.pids.indexOf(pid) >= 0) return { b, side: 'A' };
    if (b.defPids && b.defPids.indexOf(pid) >= 0) return { b, side: 'B' };
  }
  return null;
}
const LAST = new Map();   // pid → 마지막 풀림 { day, wid, side, enemy, x, y, home, cell, near, ph, prog }
const cw = WCM.createWar;
WCM.createWar = function (opts) {
  const W = cw.apply(this, arguments);
  const db = W.warDraftBind, dr = W.warDraftReleasePid, dl = W.daily;
  W.warDraftBind = function (vil, pid, job, warId) {
    try {
      const S = vstate(), p = S && S.deps && S.deps.players ? S.deps.players.get(pid) : null;
      if (p && rec.bind.length < 20000) rec.bind.push(Object.assign({ d: day(), pid, vil: vil && vil.name, wid: warId != null ? warId : null, job: job || null }, where(S, p, vil)));
    } catch (e) { err(e); }
    return db.apply(this, arguments);
  };
  W.warDraftReleasePid = function (vil, pid) {
    try {
      const S = vstate(), p = S && S.deps && S.deps.players ? S.deps.players.get(pid) : null;
      if (p) {
        const bo = bodyOf(S, pid), b = bo && bo.b, w = b && b.w;
        const R = Object.assign({ d: day(), pid, vil: vil && vil.name, dead: (p.hp != null && p.hp <= 0) ? 1 : 0,
          wid: w ? w.id : null, side: bo ? bo.side : null, enemy: w ? (bo.side === 'A' ? (w.def && w.def.name) : (w.atk && w.atk.name)) : null,
          ph: b ? (b.phase || null) : null, wph: w ? w.phase : null, prog: (b && b.len) ? r2(b.prog / b.len) : null,
          led: b && b.cmd ? [r2(b.cmd.cx), r2(b.cmd.cy)] : null, end: b && b.ended ? b.ended.why : null }, where(S, p, vil));
        if (rec.rel.length < 20000) rec.rel.push(R);
        if (!R.dead) LAST.set(pid, R);
      }
    } catch (e) { err(e); }
    return dr.apply(this, arguments);
  };
  W.daily = function (d) {
    try {
      const S = vstate(), players = S && S.deps && S.deps.players;
      if (players) for (const v of S.villages || []) for (const pid of v.npcPids || []) {
        const p = players.get(pid); if (!p) continue;
        const h = Math.hypot(p.x / SZ - v.ccx, p.y / SZ - v.ccy); if (h <= FAR) continue;
        const L = LAST.get(pid);
        if (rec.far.length < 200000) rec.far.push({ d: d | 0, pid, vil: v.name, home: r2(h), cell: cellK(S, p.x / SZ, p.y / SZ), mus: p._muster ? 1 : 0,
          rel: L ? L.d : null, mv: L ? r2(Math.hypot(p.x / SZ - L.x, p.y / SZ - L.y)) : null });
      }
    } catch (e) { err(e); }
    return dl.apply(this, arguments);
  };
  return W;
};
const cwl = WLM.createWarLive;
WLM.createWarLive = function () {
  const WL = cwl.apply(this, arguments);
  const en = WL.enlist;
  WL.enlist = function (f, side, gu, p) {
    const bu = en.apply(this, arguments);
    try {
      if (side === 'B' && f && f.w && gu && gu.pid != null) {
        const S = vstate(), pl = S && S.deps && S.deps.players ? S.deps.players.get(gu.pid) : null, vil = f.w.def;
        if (pl && rec.en.length < 20000) {
          const b = S.warBodies ? S.warBodies.get(f.w.id) : null, dg = b ? b.defGroup : null, L = LAST.get(gu.pid);
          rec.en.push(Object.assign({ d: day(), wid: f.w.id, atk: f.w.atk && f.w.atk.name, def: vil && vil.name, pid: gu.pid, fst: f.state, scram: dg && dg._scram ? 1 : 0, t: r2(f.t),
            hold: dg && dg.holdPt ? r2(Math.hypot(pl.x / SZ - dg.holdPt.cx, pl.y / SZ - dg.holdPt.cy)) : null,
            last: L ? { d: L.d, wid: L.wid, side: L.side, enemy: L.enemy, ph: L.ph, prog: L.prog, home: L.home, cell: L.cell, near: L.near, end: L.end } : null,
            mv: L ? r2(Math.hypot(pl.x / SZ - L.x, pl.y / SZ - L.y)) : null }, where(S, pl, vil)));
        }
      }
    } catch (e) { err(e); }
    return bu;
  };
  return WL;
};
process.on('exit', () => {
  if (!OUT) return;
  try { const S = vstate(); if (S && S._warStat) rec.stat = Object.assign({}, S._warStat); } catch (e) { err(e); }   // 전쟁 셈(읽기만 — 막힘 풀기 `t1089Late` · 철수 · 맞붙음 없이 철수 …)
  try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 판 끝 */ }
});
