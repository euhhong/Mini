// === sim/army-morale.js — 원정 사기 평형 · 군량 빚 · 죽음 계단 · 하루 먹기 한 곳(T1076 · T1100 · T1122) ===
//   ★[T1100 2026-11-03] T1076 이 `sim/war-core.js` 닫힘 안에 둔 식(armyMoraleDay · armyMoraleLoss 의 셈)을 떼어 여기 하나로 —
//     war-core(서버 원정)와 전투실험실(lab/전투실험실.html 인라인)이 같은 식을 부른다(사본 0 · 셈 · 순서 · 값 그대로 = 바이트 같음).
//   식(★재민 11-02 문 2-b · T1076):
//     평형 = min(짐 비율 r, 1 − 빚 깊이 ÷ 14)       — r · 빚은 0~1 · 0~14 로 자른다 · 14 = T1074 굶주림 시계("14일")
//     하루 = Equilibrium.step(사기, 평형, 14, 1)      — 반감기 14날
//     계단 = Equilibrium.drop(사기, M_KABS × 죽은 수 ÷ 떠난 병력)   — battle-core 제 사상 계수
//   손잡이(`T1076_ARMY_MORALE`)는 부르는 쪽 몫이다 — 이 파일은 식만(켬 · 끔을 모른다).
//   Node(module.exports) / 브라우저(window.ArmyMorale) 둘 다 — Equilibrium · BattleCore 가 먼저 실려 있어야 한다(랩은 inline-battle 이 차례대로 굽는다).
;(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const Equilibrium = node ? require('./equilibrium.js') : root.Equilibrium;
  const BattleCore = node ? require('./battle-core.js') : root.BattleCore;
  const DEBT_DAYS = 14;   // ★재민 11-02(T1074 카드 "14일") — 빚 깊이의 자 · 사기 반감기
  // 그날 평형(0~1) — r = 먹고 남은 짐 ÷ 오늘 몫 · debt = 몸 평균 빚(하루치 단위)
  function target(r, debt) {
    const rr = Math.max(0, Math.min(1, +r || 0)), dd = Math.max(0, Math.min(1, (+debt || 0) / DEBT_DAYS));
    return Math.min(rr, 1 - dd);
  }
  // 하루 — 새 사기
  function day(mrl, r, debt) { return Equilibrium.step(mrl, target(r, debt), DEBT_DAYS, 1); }
  // 죽음 계단 — 새 사기
  function loss(mrl, dead, force) { return Equilibrium.drop(mrl, BattleCore.M_KABS * dead / force); }
  // ★[T1122 2026-11-03] 원정 하루 먹기 — 서버 `_warRationEat` 의 몸 고리를 한 곳에(서버 · 전투실험실 날 축이 같은 고리를 부른다 · 사본 0).
  //   몸마다: 짐 보기 → (앞 갈고리) → 먹기 → 셈(먹음 · 모자람 · 굶은 몸) → 빚(모자란 몫 ÷ 하루 몫 · debt 가 있을 때 · 쌓기만) →
  //           짐 쓰기 → 남은 식량등가 더하기 → (뒤 갈고리). 차례 · 셈은 T1076 서버 고리 그대로(바이트 같음).
  //   io = { view(p) → 짐, eat(짐, need) → 먹은 식량등가, write(p, 짐), fe(짐) → 식량등가, id(p) → 빚 열쇠, pre?(p, 짐) → 표, post?(p, 짐, 먹음, 표) }
  //   품목 · 부패 순서 · 몸 장부는 io 몫이다(서버 = 몸 짐 거울 · 부패 정본 순서 · T748 · T906 / 랩 = 식량 한 칸).
  function eatDay(bearers, need, io, debt) {
    let eaten = 0, left = 0, unfed = 0, hungry = 0;
    for (const p of bearers) {
      const bag = io.view(p);
      const tok = io.pre ? io.pre(p, bag) : null;
      const e = io.eat(bag, need);
      eaten += e; if (e < need) { unfed += need - e; hungry++; }
      if (debt && need > 0) { const sh = Math.max(0, need - e) / need; if (sh > 0) { const k = io.id(p); debt.set(k, (debt.get(k) || 0) + sh); } }
      io.write(p, bag); left += io.fe(bag);
      if (io.post) io.post(p, bag, e, tok);
    }
    return { eaten, left, unfed, hungry };
  }
  // 군량 충족도(0~1) — 먹고 남은 짐 ÷ 오늘 몫(살아 있는 짐꾼 × 몫)
  function rationOf(left, needNow) { return needNow > 0 ? Math.max(0, Math.min(1, left / needNow)) : 0; }
  // 몸 평균 빚(하루치 단위)
  function debtMean(debt, bearers, id) { let s = 0, n = 0; for (const p of bearers) { s += debt.get(id(p)) || 0; n++; } return n ? s / n : 0; }
  const ArmyMorale = { DEBT_DAYS, target, day, loss, eatDay, rationOf, debtMean };
  if (node) module.exports = ArmyMorale;
  if (root) root.ArmyMorale = ArmyMorale;
})(typeof window !== 'undefined' ? window : null);
