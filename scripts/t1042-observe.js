'use strict';
// (@regress 없음 — 러너 밖 · T1042 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1042-observe.js — 교전 없는 철수 · 존 교전 시야 막힘 해부 — 서버 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1031-war-observe.js -r $PWD/scripts/t1042-observe.js" \
//              node scripts/t577-server-run.js 800 1020        (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1042.json` · `T1042_OUT` 로 바꿀 수 있다)
//            팔(`scripts/t1042-arm.js`)과 같이 걸 수 있다 — 팔은 세계를 바꾸고 이 관찰기는 읽기만 한다. 표: `scripts/t1042-table.js`
//   ★왜 [T1042 · T1031 회부 카드 감 2 · 3] T1031 은 교전 없는 철수(판 자 25% · 몸∞ 11% · 랩 0)의 마디를 "대형 안 풀림" · "방어 몸 없음"으로만 셌다.
//     재민에게 결함인지 의도인지 묻기 전에 **어디서 막히는지**를 칸 종류로 보인다.
//   뜨는 것(이미 있는 문 앞에서 읽기만 — 새 수 0 · 세계 값 무변):
//     ⓐ 교전 마디(war-live `orderAdvance` → 대치 | 정산) — 시작 때 방어 대형 몸 수 · 방어 소집 여부(`body.defBuilt`) · 공격 원점 ↔ 방어 마을 중심 거리 ·
//        경보 반경(villages `_warEnsureDefense` 그 식 — 읽기 전용 셈) · 방어 마을 가시 몸 하나하나가 그 순간 어디 있었나
//        (징발 중 — 어느 전쟁 어느 쪽 · 생활 행위 `_lifeAct` · 일감 `_lifeTask.k` · 선 칸 종류 · 마을 중심 거리)
//     ⓑ 대치 순간 막힘 셈(T956 막힘 셈 그대로 · 칸 종류만 잘게) — 원점선(풀림 술어: 두 대형 원점 사이 걸음 줄) · 몸선(맞선 두 몸) · 시야(두 몸) 의 첫 막힌 칸과 종류.
//        칸 종류: R:hall 큰집 · R:house 움집(의뢰 집 · 쉼터 같은 발자국) · R:granary 곳간(발자국 크기로 가른다 — villages `_vbFootprint`) ·
//                 T:ditch 환호(도랑 — `vil._ditch`) · T:rock 바위 · T:water 물(지형 막힘 중 환호 · 바위가 아닌 것) · W 나무 · ? 호스트가 아직 안 물은 칸 · . 열림
//        **호스트 메모만 읽는다**(`_warRectCells` · `_warTerrMemo` · `_warTreeMemo` · `_warWaterMemo` — 막힘 술어를 새로 안 부른다).
//        지형 막힘 칸(메모 1)의 환호 · 바위 · 물 가르기는 순수 함수(`server/terrain.js isRockCellLocal` — 지형 JSON)와 마을 칸(`vil._ditch`)만 읽는다.
//     ⓒ 시야 막힘(존 세계 어댑터 `losBlocked` 가 참을 낸 물음) — 같은 인자로 부르고 답을 그대로 돌려준 뒤, 참이면 그 물음의 첫 막힌 칸 종류를 메모로 가른다
//        (술어는 첫 막힌 칸에서 멈추니 그 칸까지는 메모에 있다) · 쏘는 몸이 방어 마을 영토 반경 안인지 · 전쟁마다 합
//     ⓓ 첫 접촉 — 두 무게중심 가운데의 방어 마을 중심 거리 · 영토 반경 · 환호 고리 반경 · 방어 마을 발자국(30칸 안) 수 · 그 칸 종류
//   ⚠읽기만 — 전쟁 칸 · 몸 칸 · 교전 칸 · econ 에 쓰지 않는다 · RNG 무접촉 · 막힘 술어 안 부름(메모만). 감싸개는 원 함수를 같은 인자로 부르고 돌려줌을 그대로 돌려준다.
//     증인: 같은 판을 이 관찰기 없이 돈 판과 판 JSON · dctl JSON · t1031 JSON 바이트 같음(보고 T1042 §0).
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T1042_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1042.json' : '');
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const WLM = require(path.join(ROOT, 'server', 'war-live'));
const TERR = require(path.join(ROOT, 'server', 'terrain'));
const ZONE_ID = process.env.ZONE_ID || 'hanbando';
const SZ = 32;   // villages 셀 px(같은 글자 — 관찰 좌표 환산만)
const rec = { ver: 1, seed: +process.env.T577_SEED, arm: process.env.T1042_ARM || null, cap: process.env.VILLAGE_NPC_CAP != null ? process.env.VILLAGE_NPC_CAP : null, wars: {}, errs: 0, err0: null, lastDay: null };
const r2 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 100) / 100;
function err(e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 800); }
let _vst = null;
function vstate() {
  if (_vst) return _vst;
  try { const k = require.resolve(path.join(ROOT, 'server', 'villages.js')); const m = require.cache[k]; if (m && m.exports && typeof m.exports.__p3Bind === 'function') _vst = m.exports.__p3Bind({}).state; } catch (e) { _vst = null; }
  return _vst;
}
function W(w) {
  const id = w && w.id; if (id == null) return null;
  let o = rec.wars[id];
  if (!o) o = rec.wars[id] = { id, atk: w.atk && w.atk.name, def: w.def && w.def.name, seg: [], los: {}, losN: 0, losIn: 0 };
  return o;
}
// ── 칸 종류(메모만) ──
let _rectsRef = null, _rectType = null, _ditch = null;
function refreshIdx(S) {
  if (S._warRects === _rectsRef && _rectType) return;
  _rectsRef = S._warRects; _rectType = new Map(); _ditch = new Map();
  for (const r of S._warRects || []) {
    const w = r[2] - r[0] + 1, h = r[3] - r[1] + 1;
    const t = (w === 8 && h === 8) ? 'hall' : (w === 6 && h === 4) ? 'house' : (w === 5 && h === 3) ? 'granary' : (w + 'x' + h);
    for (let x = r[0]; x <= r[2]; x++) for (let y = r[1]; y <= r[3]; y++) { const k = x * 65536 + y; if (!_rectType.has(k)) _rectType.set(k, t); }
  }
  for (const v of S.villages || []) for (const c of (v._ditch || [])) _ditch.set(c.cx * 65536 + c.cy, v.name);
}
function terrKind(ix, iy, k) {
  if (_ditch && _ditch.has(k)) return 'T:ditch';
  let rock = false; try { rock = !!TERR.isRockCellLocal(ZONE_ID, ix * SZ + SZ / 2, iy * SZ + SZ / 2); } catch (e) { rock = false; }
  return rock ? 'T:rock' : 'T:water';
}
function cellK(S, ix, iy) {
  const k = ix * 65536 + iy;
  if (S._warRectCells && S._warRectCells.has(k)) return 'R:' + ((_rectType && _rectType.get(k)) || '?');
  const t = S._warTerrMemo ? S._warTerrMemo.get(k) : undefined;
  if (t === 1) return terrKind(ix, iy, k);
  const w = S._warTreeMemo ? S._warTreeMemo.get(k) : undefined;
  if (w === 1) return 'W';
  if (t === undefined || w === undefined) return '?';
  return '.';
}
//   villages `_warClearLine` 과 같은 격자 순회(40m 앞까지 · 서 있는 칸 빼고 · 끝 칸 넣고) — 첫 막힌 칸 · 종류 셈(T956 lineK 그대로)
function lineK(S, x1, y1, x2, y2) {
  const MPC = 1, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy); if (d < 1) return { d: r2(d), first: null, n: 0, ks: {} };
  const tEnd = Math.min(d, 40) / d;
  let cx = Math.floor(x1 / MPC), cy = Math.floor(y1 / MPC);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? MPC / Math.abs(dx) : Infinity, tdy = dy !== 0 ? MPC / Math.abs(dy) : Infinity;
  let tx = dx !== 0 ? (sx > 0 ? (cx + 1) * MPC - x1 : x1 - cx * MPC) / Math.abs(dx) : Infinity;
  let ty = dy !== 0 ? (sy > 0 ? (cy + 1) * MPC - y1 : y1 - cy * MPC) / Math.abs(dy) : Infinity;
  let first = null, n = 0; const ks = {};
  for (let g = 0; g < 200; g++) {
    let tt;
    if (tx < ty) { if (tx > tEnd) break; tt = tx; cx += sx; tx += tdx; } else { if (ty > tEnd) break; tt = ty; cy += sy; ty += tdy; }
    n++; const k = cellK(S, cx, cy);
    if (k !== '.') { ks[k] = (ks[k] || 0) + 1; if (!first && k !== '?') first = { i: n, c: [cx, cy], k, at: r2(tt * d) }; }
  }
  return { d: r2(d), first, n, ks };
}
//   시야(villages `_warWorld().losBlocked` 그 표본 — 1.5m · 건물 · 바위(물 아닌 지형 막힘) · 나무) — 첫 막힌 칸 종류
function losFirst(S, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), n = Math.ceil(d / 1.5);
  for (let i = 1; i < n; i++) {
    const s = i / n, cx = Math.floor(x1 + dx * s), cy = Math.floor(y1 + dy * s), k = cx * 65536 + cy;
    if (S._warRectCells && S._warRectCells.has(k)) return 'R:' + ((_rectType && _rectType.get(k)) || '?');
    if (S._warTerrMemo && S._warTerrMemo.get(k) === 1 && S._warWaterMemo && S._warWaterMemo.get(k) === 0) return terrKind(cx, cy, k);
    if (S._warTreeMemo && S._warTreeMemo.get(k) === 1) return 'W';
  }
  return '?';
}
// ── 방어 마을 · 그 몸들 ──
function vilOf(S, v) { if (!v) return null; for (const x of S.villages || []) if (x === v || x.name === v.name) return x; return null; }
function terrR(v) { const e = v && v.econ; const c = (e && e.land && e.land.size) ? e.land.size * 25 : 2800; return Math.sqrt(c / Math.PI); }
function ditchR(v) { let m = 0; for (const c of (v && v._ditch) || []) { const d = Math.hypot(c.cx - v.ccx, c.cy - v.ccy); if (d > m) m = d; } return m || null; }
function musterOf(S, pid) {
  if (!S.warBodies) return null;
  for (const b of S.warBodies.values()) {
    if ((b.pids || []).indexOf(pid) >= 0) return { war: b.w && b.w.id, side: 'A' };
    if ((b.defPids || []).indexOf(pid) >= 0) return { war: b.w && b.w.id, side: 'B' };
  }
  return null;
}
function bodiesOf(S, v) {
  const P = S.deps && S.deps.players; const out = [];
  for (const pid of (v.npcPids || [])) {
    const p = P ? P.get(pid) : null;
    if (!p) { out.push({ pid, gone: 1 }); continue; }
    const ix = Math.floor(p.x / SZ), iy = Math.floor(p.y / SZ);
    out.push({ pid, mu: p._muster ? (p._muType || 1) : 0, mw: p._muster ? musterOf(S, pid) : null, hp: p.hp != null ? r2(p.hp) : null, act: p._lifeAct || null,
      task: p._lifeTask && p._lifeTask.k || null, job: p.simJob || null, cell: cellK(S, ix, iy), dV: r2(Math.hypot(p.x / SZ - v.ccx, p.y / SZ - v.ccy)) });
  }
  return out;
}
function defSnap(S, f) {
  const w = f.w, v = vilOf(S, w && w.def); const b = S.warBodies && S.warBodies.get ? S.warBodies.get(w.id) : null;
  const WL = S.warLive; let bN = 0; for (const u of f.ctx.units) if (u.side === 'B' && u.hp > 0) bN++;
  const ag = b && b.atkGroup; let ac = null;
  if (ag && ag.units && ag.units.length) { let x = 0, y = 0, n = 0; for (const u of ag.units) { if (u.dead) continue; x += u.x; y += u.y; n++; } ac = n ? { cx: x / n, cy: y / n } : { cx: ag.cmd.cx, cy: ag.cmd.cy }; }
  const dCmd = (ac && v) ? r2(Math.hypot(ac.cx - v.ccx, ac.cy - v.ccy)) : null;
  const hold = w._defMode === 'hold';
  const R = hold ? r2(Math.max(terrR(v) + 40, WL.WAR_ALERT_R * 0.5)) : WL.WAR_ALERT_R;   // villages `_warEnsureDefense` 경보 반경 식(읽기 전용 셈)
  return { bN, defBuilt: b ? !!b.defBuilt : null, dg: !!(b && b.defGroup), dm: w._defMode || null, op: w.op || null, dCmd, R, pop: v && v.econ && v.econ.npcs ? v.econ.npcs.length : null,
    nb: v ? (v.npcPids || []).length : null, bodies: v ? bodiesOf(S, v) : null };
}
// ── 교전 층 ──
const FS = new WeakMap();
const WRAPPED = new WeakSet();
function wrapLos(f) {
  const wd = f.ctx && f.ctx.world; if (!wd || WRAPPED.has(wd)) return; WRAPPED.add(wd);
  const fn = wd.losBlocked; if (typeof fn !== 'function') return;
  wd.losBlocked = function (x1, y1, x2, y2) {
    const v = fn.apply(this, arguments);
    if (v) {
      try {
        const S = vstate(); const o = W(f.w);
        if (S && o) { refreshIdx(S); const k = losFirst(S, x1, y1, x2, y2); o.los[k] = (o.los[k] || 0) + 1; o.losN++;
          const dv = f.w.def; if (dv && Math.hypot(x1 - (dv.ccx + 0.5), y1 - (dv.ccy + 0.5)) <= terrR(vilOf(S, dv) || dv)) o.losIn++; }
      } catch (e) { err(e); }
    }
    return v;
  };
}
function census(S, f) {
  refreshIdx(S);
  const out = {};
  const b = S.warBodies && S.warBodies.get ? S.warBodies.get(f.w.id) : null;
  const A = f.adv;
  if (A && b) {
    const g = A.side === 'A' ? b.atkGroup : b.defGroup, og = A.side === 'A' ? b.defGroup : b.atkGroup;
    if (g && g.cmd) {
      const gm = { x: g.cmd.cx, y: g.cmd.cy };
      const T = (og && og.units && og.units.length && og.cmd) ? { x: og.cmd.cx, y: og.cmd.cy, k: 'grp' } : (f.objective ? { x: f.objective.x, y: f.objective.y, k: 'obj' } : null);
      if (T) out.rel = Object.assign(lineK(S, gm.x, gm.y, T.x, T.y), { side: A.side, released: !!A.released, s: r2(A.s), sT: r2(A.sT), atProj: (A.s != null && A.sT != null) ? Math.abs(A.s - A.sT) < 1e-6 : null, T: T.k,
        from: cellK(S, Math.floor(gm.x), Math.floor(gm.y)), to: cellK(S, Math.floor(T.x), Math.floor(T.y)) });
    }
  }
  let best = null, bd = Infinity;
  for (const a of f.ctx.units) { if (a.side !== 'A' || a.hp <= 0) continue; for (const e of f.ctx.units) { if (e.side !== 'B' || e.hp <= 0) continue; const d = (a.x - e.x) ** 2 + (a.y - e.y) ** 2; if (d < bd) { bd = d; best = [a, e]; } } }
  if (best) {
    const [a, e] = best;
    out.pair = { d: r2(Math.sqrt(bd)), ta: a.type, te: e.type, ca: cellK(S, Math.floor(a.x), Math.floor(a.y)), ce: cellK(S, Math.floor(e.x), Math.floor(e.y)), line: lineK(S, a.x, a.y, e.x, e.y),
      los: (() => { const dx = e.x - a.x, dy = e.y - a.y, d = Math.hypot(dx, dy), n = Math.ceil(d / 1.5); for (let i = 1; i < n; i++) { const s = i / n, cx = Math.floor(a.x + dx * s), cy = Math.floor(a.y + dy * s), k = cx * 65536 + cy;
        if (S._warRectCells && S._warRectCells.has(k)) return 'R:' + (_rectType.get(k) || '?'); const t = S._warTerrMemo ? S._warTerrMemo.get(k) : undefined; const ww = S._warWaterMemo ? S._warWaterMemo.get(k) : undefined;
        if (t === 1 && ww === 0) return terrKind(cx, cy, k); if (S._warTreeMemo && S._warTreeMemo.get(k) === 1) return 'W'; } return '.'; })() };
  }
  return out;
}
function closeSeg(f, st, kind) {
  const g = st.seg; if (!g) return;
  g.end = kind; g.tEnd = r2(f.t);
  try { const S = vstate(); if (S) { g.cen = census(S, f); g.defEnd = defSnap(S, f); } } catch (e) { err(e); }
  st.seg = null;
}
const cwl = WLM.createWarLive;
WLM.createWarLive = function (opts) {
  const WL = cwl.apply(this, arguments);
  const dayOf = (opts && typeof opts.dayOf === 'function') ? opts.dayOf : () => -1;
  const sf = WL.stepFight, oa = WL.orderAdvance, se = WL.settle;
  const ST = (f) => { let st = FS.get(f); if (!st) { st = { seg: null }; FS.set(f, st); } return st; };
  WL.orderAdvance = function (f, side) {
    let st = null;
    try { st = ST(f); if (st.seg) closeSeg(f, st, 'reorder'); wrapLos(f); } catch (e) { err(e); }
    const r = oa.apply(this, arguments);
    try {
      const o = W(f.w), S = vstate();
      if (o && st && S) { st.seg = { day: dayOf() | 0, adv: side, holder: f.holder || null, t0: r2(f.t), c: 0, rel: null, def0: defSnap(S, f), first: null }; o.seg.push(st.seg); rec.lastDay = dayOf() | 0; }
    } catch (e) { err(e); }
    return r;
  };
  WL.stepFight = function (f) {
    try { wrapLos(f); } catch (e) { err(e); }
    const ev = sf.apply(this, arguments);
    try {
      const st = FS.get(f), g = st && st.seg;
      if (g) {
        if (ev.contact) {
          g.c++;
          if (!g.first) {
            const S = vstate(), ca = WL.centroid(f, 'A'), cb = WL.centroid(f, 'B');
            const mid = (ca && cb) ? { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 } : (ca || cb);
            const v = S ? vilOf(S, f.w.def) : null;
            if (S && mid && v) {
              refreshIdx(S);
              let own = 0; const cx = mid.x, cy = mid.y;
              for (const r of S._warRects || []) { const dx = Math.max(r[0] - cx, 0, cx - r[2] - 1), dy = Math.max(r[1] - cy, 0, cy - r[3] - 1); if (dx * dx + dy * dy <= 900 && Math.hypot((r[0] + r[2]) / 2 - v.ccx, (r[1] + r[3]) / 2 - v.ccy) <= terrR(v) + 10) own++; }
              g.first = { t: r2(f.t - g.t0), dVil: r2(Math.hypot(mid.x - (v.ccx + 0.5), mid.y - (v.ccy + 0.5))), rT: r2(terrR(v)), rD: r2(ditchR(v)), own30: own, cell: cellK(S, Math.floor(mid.x), Math.floor(mid.y)) };
            }
          }
        }
        if (g.rel == null && f.adv && f.adv.released) g.rel = r2(f.t - g.t0);
        if (ev.standoff) closeSeg(f, st, 'standoff');
      }
    } catch (e) { err(e); }
    return ev;
  };
  WL.settle = function (f, why, winner) {
    const r = se.apply(this, arguments);
    try { const st = FS.get(f); if (st && st.seg) closeSeg(f, st, 'settle:' + why); } catch (e) { err(e); }
    return r;
  };
  return WL;
};
process.on('exit', () => {
  try {
    for (const o of Object.values(rec.wars)) for (const g of o.seg) if (g.end == null) g.end = 'open';
    fs.writeFileSync(OUT, JSON.stringify(rec));
  } catch (e) { /* 관측 실패는 판을 안 건드린다 */ }
});
