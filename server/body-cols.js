// === server/body-cols.js — 몸의 뜨거운 칸 열(x · y) 정본 (T1145 · 2026-11-04) ==========================================
//
// ★손잡이 `T1145_XY_COLS` — `'1'` 켬 · `'verify'` 켬 + 틱마다 견줌 · 그 밖(없음 포함) 끔.
//   끔이면 이 모듈은 아무것도 안 만든다(`ON` 거짓 — 부르는 자리가 전부 `ON` 뒤에 있다 = 종전 글자 · 종전 값).
// ★무엇 — 주민 몸(존 `spawnNpc` 가 낳은 몸)의 x · y 를 `Float64Array` 열 둘에 둔다. **열이 정본**이다:
//   ⓐ 몸 번호 = 칸(`p._t1145S`) — 낳을 때 받고(`alloc`) · 몸이 `players` 에서 빠질 때 돌려준다(`release` · 그 칸은 다음에 낳는 몸이 다시 쓴다 — 나중에 돌려준 칸 먼저).
//   ⓑ 쓰기는 길 하나 — `w(p, x, y)` · `wx` · `wy` 가 열에 쓰고 몸의 x · y 칸(거울)에 같은 수를 쓴다.
//      거울은 아직 열로 안 옮긴 읽기 자리(서버 15 파일 · T1145 §1 전수) 몫이다 — 그 자리들이 다 옮겨 가면 거울을 걷는다(후속 카드).
//   ⓒ 걸음 문의 뜨거운 읽기(걸음 커널 모으기 · 서 있는 몸 거름 · 따라가기 · 막힘 · 몸 밀기)는 열을 읽는다(존 `zone.js` · `T1145` 표).
//   ⚠접근자 꼴이 아니다 — T738 접근자 꼴(몸 칸을 제자리에서 접근자로 = 사전 모드 · 다형)은 +11 % 손해였다. 몸 칸은 데이터 칸 그대로다.
// ★값 같음 — Float64Array 는 binary64 그대로(−0 · NaN 보존). 몸 x · y 가 수가 아닌 값이면 열은 NaN 이 된다 —
//   `verify` 가 틱마다 전원 `Object.is(몸.x, 열[칸])` 으로 그것까지 센다(거울 · 열이 갈리면 `bad`).
// ★사본 0 — 랩 · 서버 · 하네스가 이 한 글자를 `require` 한다(존 의존 0 · 몸 객체와 수만 안다).
'use strict';
const MODE = (typeof process !== 'undefined' && process.env && process.env.T1145_XY_COLS || '').trim();
const ON = MODE === '1' || MODE === 'verify', VERIFY = MODE === 'verify';
const C = { X: new Float64Array(0), Y: new Float64Array(0), n: 0 };   // 열 둘 · 쓴 칸 수(높은 물) — 키울 때 `C.X` · `C.Y` 가 새 배열로 바뀐다(읽는 쪽은 늘 `C.X[s]`)
const own = [];    // 칸 → 몸(빈 칸 = undefined)
const free = [];   // 돌려받은 칸(나중에 돌려준 칸 먼저 — 정해진 차례)
const stat = { alloc: 0, reuse: 0, release: 0, live: 0, ticks: 0, checks: 0, bad: 0, stale: 0, noSlot: 0, ex: [] };
function _grow(need) {
  let cap = C.X.length || need;
  while (cap < need) cap *= 2;
  const X = new Float64Array(cap), Y = new Float64Array(cap);
  X.set(C.X); Y.set(C.Y); C.X = X; C.Y = Y;
}
// 몸이 칸을 받는다 — 칸에 몸의 지금 x · y 를 쓴다(그때부터 열이 정본)
function alloc(p) {
  let s;
  if (free.length) { s = free.pop(); stat.reuse++; }
  else { s = C.n++; if (s >= C.X.length) _grow(s + 1); }
  own[s] = p; C.X[s] = p.x; C.Y[s] = p.y; p._t1145S = s;
  stat.alloc++; stat.live++;
  return s;
}
// 몸이 칸을 돌려준다 — 몸의 x · y 칸(거울)이 그 몸의 마지막 값을 든다 · 몸 칸 번호 −1(그 뒤 쓰기는 몸 칸에만)
function release(p) {
  const s = p._t1145S;
  if (!(s >= 0)) return;
  if (own[s] === p) { own[s] = undefined; free.push(s); stat.release++; stat.live--; }
  p._t1145S = -1;
}
// 쓰기 길 하나 — 열(정본) · 거울
function w(p, x, y) { const s = p._t1145S; if (s >= 0) { C.X[s] = x; C.Y[s] = y; } p.x = x; p.y = y; }
function wx(p, x) { const s = p._t1145S; if (s >= 0) C.X[s] = x; p.x = x; }
function wy(p, y) { const s = p._t1145S; if (s >= 0) C.Y[s] = y; p.y = y; }
// `players` 지도의 넣기 · 빼기에 칸을 묶는다(켬일 때만 존이 부른다) — 빼면 돌려주고 · 돌려준 몸을 다시 넣으면 다시 받는다
function bindMap(M) {
  const mget = Map.prototype.get, mset = Map.prototype.set, mdel = Map.prototype.delete, mclr = Map.prototype.clear;
  M.delete = function (k) { const p = mget.call(this, k); if (p !== undefined && p !== null && p._t1145S >= 0) release(p); return mdel.call(this, k); };
  M.set = function (k, v) {
    const o = mget.call(this, k);
    if (o !== undefined && o !== null && o !== v && o._t1145S >= 0) release(o);
    if (v !== undefined && v !== null && v._t1145S === -1) alloc(v);
    return mset.call(this, k, v);
  };
  M.clear = function () { for (const p of this.values()) if (p && p._t1145S >= 0) release(p); return mclr.call(this); };
  return M;
}
// `verify` — 쓴 칸 전부: 거울 = 열(비트) · 칸의 몸이 아직 지도에 있나 · 지도의 주민 몸이 칸을 가졌나
function check(M) {
  stat.ticks++;
  for (let s = 0; s < C.n; s++) {
    const p = own[s]; if (p === undefined) continue;
    stat.checks++;
    if (!Object.is(p.x, C.X[s]) || !Object.is(p.y, C.Y[s])) { stat.bad++; if (stat.ex.length < 8) stat.ex.push({ pid: p.pid, s, obj: [p.x, p.y], col: [C.X[s], C.Y[s]] }); }
    if (M && M.get(p.pid) !== p) stat.stale++;
  }
  if (M) for (const p of M.values()) if (p && p.isNpc && !(p._t1145S >= 0)) stat.noSlot++;
}
function perf(reset) {
  const o = { mode: MODE, n: C.n, cap: C.X.length, live: stat.live, alloc: stat.alloc, reuse: stat.reuse, release: stat.release, free: free.length,
    ticks: stat.ticks, checks: stat.checks, bad: stat.bad, stale: stat.stale, noSlot: stat.noSlot, ex: stat.ex.slice() };
  if (reset) { stat.ticks = 0; stat.checks = 0; stat.bad = 0; stat.stale = 0; stat.noSlot = 0; stat.ex.length = 0; }
  return o;
}
module.exports = { ON, VERIFY, MODE, C, own, alloc, release, w, wx, wy, bindMap, check, perf };
