// === sim/body-cols.js — 몸 열(타입 배열) 정본 · 몸 번호 = 열 칸 (T1145 · 2026-11-04 · µs 줄기 ②) ======================
//
// ★무엇 — 몸의 뜨거운 칸(이 판은 `x` · `y` 둘)을 몸 객체가 아니라 **열(`Float64Array`)이 정본으로** 든다. 몸 객체의 `x` · `y` 는
//   열 칸을 보는 **창**(제 것 접근자 속성)이다 — 읽기 481 · 483 · 쓰기 32 · 32 자리(T1145 전수)가 한 글자도 안 바뀐 채 열을 읽고 쓴다.
//   열을 직접 도는 커널(다음 카드 — 걸음 WASM · 공간 색인)은 몸 객체를 안 짚고 `X[s]` · `Y[s]` 를 읽는다.
// ★왜 접근자인데 느리지 않나(T738 과 다른 점) — T738 증인 판은 데이터 칸을 **그 자리에서** 접근자로 바꿨다(`defineProperty` 로 마지막 칸이
//   아닌 칸을 다시 짓기). V8 은 그 꼴을 **사전 모드로 내린다**("AccessorsOverwritingNonLast") — 몸 하나하나가 해시 객체가 되어
//   x · y 를 읽는 자리마다 사전 찾기였다(+11 %). 이 판은 ⓐ 리터럴에 x · y 를 **안 두고** ⓑ 리터럴 바로 뒤에 접근자를 **새 칸으로 덧붙인다**
//   ⓒ 접근자 함수는 **모든 몸이 같은 둘**(모듈 함수 · 몸마다 클로저 0) ⇒ 모든 몸이 같은 숨은 꼴(빠른 속성)이고 부른 자리마다 단형 · 인라인.
// ★몸 번호(칸) — 몸이 태어날 때 받는다(`alloc`) · 몸 칸 하나(`_colS` — 리터럴에 둔다 · 몸 필드 규약)에 적힌다.
//   번호 재사용: 몸이 세계(`alive(p)` 가 거짓)를 떠나면 **다음 번호를 줄 때** 한 번 훑어(`sweep`) 그 몸을 **되돌린다**(`retire`) —
//   열의 마지막 값을 몸의 데이터 칸으로 되적고 번호를 빈 목록에 넣는다. 그 뒤 떠난 몸을 누가 읽든 쓰든 제 값이다(열과 끊긴 보통 객체).
//   ⚠되돌리기 전에는 번호를 남에게 안 준다 ⇒ 떠난 몸이 아직 열을 보는 동안 그 칸을 다른 몸이 쓰는 일은 없다.
// ★값 — `Float64Array` 는 binary64 그대로다(−0 · NaN · ±∞ 보존 · 정수도 같은 수). **수가 아닌 값**을 쓰면(`undefined` · 문자열 …)
//   열이 못 든다 ⇒ 그 몸을 그 자리에서 되돌리고 값 그대로 데이터 칸에 쓴다(`bad` 셈 · 몸 하나만 보통 객체로) — 어떤 값이든 종전과 같은 답.
// ★랩 · 서버 같은 글자 — 이 파일은 `require` 0 · 전역 0 · 세계 수 0 이다. 서버는 `require`, 랩이 몸을 들 날엔 `sim/inline-path.js` 꼴로 이 글자를 인라인한다(사본 금지).
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BodyCols = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function create(opts) {
    const o = opts || {};
    const alive = o.alive;                                   // (몸) → 세계에 있나(번호를 되돌릴지)
    let cap = Math.max(16, o.cap | 0 || 1024);
    let X = new Float64Array(cap), Y = new Float64Array(cap);
    const own = [];                                          // 번호 → 몸(없으면 null)
    const free = [];                                         // 되돌린 번호(작은 것부터 다시 준다)
    let hi = 0;                                              // 지금까지 준 가장 큰 번호 + 1
    const st = { alloc: 0, reuse: 0, grow: 0, sweep: 0, retire: 0, bad: 0, live: 0 };
    // ── 창(모든 몸이 같은 함수 넷 · 몸마다 클로저 0) — `this` 는 몸 · 번호는 몸 칸 `_colS` 하나(이름이 글자에 박혀 단형 칸 읽기) ──
    const D = {
      x: { get: function () { return X[this._colS]; }, set: function (v) { if (typeof v === 'number') X[this._colS] = v; else _badSet(this, 'x', v); }, enumerable: true, configurable: true },
      y: { get: function () { return Y[this._colS]; }, set: function (v) { if (typeof v === 'number') Y[this._colS] = v; else _badSet(this, 'y', v); }, enumerable: true, configurable: true },
    };
    function _grow(need) {
      let n = cap; while (n < need) n *= 2;
      const X2 = new Float64Array(n), Y2 = new Float64Array(n); X2.set(X); Y2.set(Y); X = X2; Y = Y2; cap = n; st.grow++;
      _api.X = X; _api.Y = Y;
    }
    // 떠난 몸을 되돌린다 — 열의 마지막 값을 데이터 칸으로 · 번호는 빈 목록으로
    function retire(p) {
      const s = p._colS;
      if (!(s >= 0) || own[s] !== p) return false;
      const x = X[s], y = Y[s];
      Object.defineProperty(p, 'x', { value: x, writable: true, enumerable: true, configurable: true });
      Object.defineProperty(p, 'y', { value: y, writable: true, enumerable: true, configurable: true });
      p._colS = -1; own[s] = null; free.push(s); st.retire++; st.live--;
      return true;
    }
    function _badSet(p, k, v) { st.bad++; retire(p); p[k] = v; }
    function sweep() {
      st.sweep++;
      let n = 0;
      if (typeof alive === 'function') for (let s = 0; s < hi; s++) { const p = own[s]; if (p && !alive(p)) { retire(p); n++; } }
      if (n) free.sort((a, b) => b - a);                     // 작은 번호부터 꺼낸다(pop)
      return n;
    }
    // 번호 하나 — 빈 번호가 없으면(가끔) 떠난 몸을 한 번 훑고, 그래도 없으면 새 번호(열이 모자라면 두 배)
    let since = 0;                                           // 지난 훑기 뒤 새로 준 번호 수
    function alloc() {
      st.alloc++;
      if (!free.length && (hi >= cap || ++since >= 32)) { since = 0; sweep(); }   // 훑기는 드물게(새 번호 32 마다 · 열이 찰 때) — 태어남이 드문 세계에선 거의 안 돈다
      if (free.length) { st.reuse++; return free.pop(); }
      const s = hi++;
      if (s >= cap) _grow(s + 1);
      return s;
    }
    // 몸에 창을 단다 — 리터럴(x · y 없음 · 번호 칸 있음) 바로 뒤에서 부른다(새 칸 덧붙이기 = 빠른 속성 · 모든 몸 같은 꼴)
    function attach(p, x, y) {
      const s = p._colS;
      X[s] = x; Y[s] = y; own[s] = p; st.live++;
      Object.defineProperty(p, 'x', D.x);
      Object.defineProperty(p, 'y', D.y);
      return p;
    }
    const _api = { X, Y, alloc, attach, retire, sweep, own, st, cap: () => cap, hi: () => hi, free: () => free.slice(), desc: D };
    return _api;
  }
  return { create };
});
