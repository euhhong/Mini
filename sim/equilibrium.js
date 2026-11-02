// === sim/equilibrium.js — 평형 회귀 한 곳(★재민 11-02 "현재가 높으면 기본 변화량이 마이너스, 낮으면 플러스") ===
//   T1076(원정 사기)이 처음 쓰고, T1075(마을 행복 평형)가 같은 함수를 쓴다 — 사본 0.
//   값 x(0~1)는 그날 조건이 정한 평형 x* 쪽으로 하루마다 반감기 h(날)의 비율로 다가간다:
//     x ← x + (x* − x) · (1 − ½^(dt/h))      — 반감기 h 날이면 차이가 h 날 뒤 절반(평형이 그대로일 때)
//   사건(죽음 등)은 계단이다: x ← max(바닥, x − 깎을 양). 깎을 양은 부르는 쪽이 물리 칸으로 정한다(죽은 몫 × 그 층의 계수).
//
//   인터페이스(T1075 가 읽을 것):
//     Equilibrium.step(x, target, halfLife, dt = 1) → 새 x(0~1 로 자름) · halfLife ≤ 0 이면 그날 바로 평형(x = target).
//     Equilibrium.drop(x, amount, floor = 0)      → 새 x(바닥 밑으로 안 간다 · amount ≤ 0 이면 무변).
//     Equilibrium.keep(halfLife, dt = 1)           → 그날 남는 차이 몫 ½^(dt/h)(표 · 하네스용).
//   새 수 0 — 반감기 · 평형 · 깎을 양은 다 부르는 쪽이 준다(T1076: 반감기 = T1074 빚 시계 14날 · 평형 = 짐 · 빚 · 계단 = battle-core 제 사상 계수).
//   Node(module.exports) / 브라우저(window.Equilibrium) 둘 다(battle-core 패턴 — 번들 · 랩에 실을 때도 이 파일 그대로).
(function (root) {
  'use strict';
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function keep(halfLife, dt) { const d = dt == null ? 1 : +dt; return halfLife > 0 ? Math.pow(0.5, d / halfLife) : 0; }
  function step(x, target, halfLife, dt) {
    const t = clamp01(+target), c = clamp01(+x);
    return clamp01(t + (c - t) * keep(halfLife, dt));
  }
  function drop(x, amount, floor) {
    const f = floor == null ? 0 : +floor, a = +amount;
    if (!(a > 0)) return clamp01(+x);
    return Math.max(f, clamp01(+x) - a);
  }
  const Equilibrium = { step, drop, keep };
  if (typeof module !== 'undefined' && module.exports) module.exports = Equilibrium;
  if (root) root.Equilibrium = Equilibrium;
})(typeof window !== 'undefined' ? window : null);
