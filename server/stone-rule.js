// === server/stone-rule.js — ★★[T1146 2026-11-04 · ★재민 11-04 "돌 규칙은 네 말 따를게" · 족보 744] 돌 규칙 하나 ==========
//
// ★왜: 같은 돌을 두 규칙이 말했다 — 바위(T1126)는 한 타 = 돌 4 kg(hp 한 점 = 돌 하나 · 도구 배수만큼 점),
//   땅 · 광맥 칸(`mineOreCell`)은 한 타 ≈ 58 g(곡괭이 60타 = 원석 덩이 3.5 kg) — 약 70배 차.
//   그리고 선광(`trySortOre`)이 맥석을 폐석으로 버렸다 — 일반 땅을 파면 돌덩이를 지고 와 버리는 꼴.
// ⇒ 규칙 하나:
//   ① 한 타에 깎이는 kg = 도구 배수(`zone.js TOOL_EFFECTS.gatherStoneMult` 그대로) × 돌 종류의 한 타 kg(배수 1)
//      · 암반(땅 · 광맥 칸 — 금 없는 돌): 채굴 정본 셋에서 — 곡괭이 배수로 덩이당 타수(`MINE_SWINGS_PER`)를 쳐 덩이 kg(`CHUNK_KG`)
//        ⇒ 배수 1 한 타 = 덩이 kg ÷ 타수 ÷ 곡괭이 배수(★재민 "채굴 속도는 고정" — 땅 채굴 글자는 이 식 그 자체라 한 줄도 안 바뀐다)
//      · 바위(금 간 굴러다니는 덩이): 암반 한 타 × 금 간 돌 배수(`CRACK_X` — 아래 출처 · 같은 사람 · 같은 연장의 실험에서 한 타에 떨어진 kg 의 비)
//   ② 떨어진 돌 무게 = 돌(석괴) · 자갈 · 나머지 — 큰 것부터 내림으로 담고 자갈 한 알에 못 미치는 몫은 그 자리 부스러기(무게 보존 · `split`).
// ★순수 모듈(require 0) — 수는 출처의 수만 적는다 · 정본(덩이 kg · 타수 · 배수 · 돌 · 자갈 kg)은 부르는 쪽이 넘긴다(사본 0).
'use strict';

// ── 출처 — 금 없는 돌과 불로 금 간 돌을 같은 사람이 같은 연장으로 친 실험 ─────────────────────────────────────
//   Maqueda, Florsch & Téreygeol 2024, 「Archaeologia historica」 49 — 멜(Melle) 은광 실험 채굴(디지털 서고 digilib.phil.muni.cz AH2024-1-07):
//     연장 채굴(망치 + 정 · 한 판 약 10분): 규암 468타 → 10 kg · 셰일 521타 → 12 kg
//     불 지피기(장작 46 · 60 · 60 kg · 불 한 번 뒤 망치질): 1439 · 788 · 859타 → 62 · 69 · 68 kg
//   (쐐기는 정량 실험이 없다 — 보고/T1146 §출처 · 이 식에 안 넣었다)
const STRIKE_SRC = {
  tool: { strikes: [468, 521], kg: [10, 12] },
  fire: { strikes: [1439, 788, 859], kg: [62, 69, 68] },
};
const _sum = (a) => a.reduce((s, x) => s + x, 0);
// 한 타에 떨어진 kg — 판을 합쳐(타 수 가중)
const perStrikeKg = (s) => _sum(s.kg) / _sum(s.strikes);
// 금 간 돌 배수 — 불로 금 간 돌 한 타 kg ÷ 금 없는 돌 한 타 kg(같은 손 · 같은 연장 · 같은 빠르기로 친다고 본다)
const CRACK_X = perStrikeKg(STRIKE_SRC.fire) / perStrikeKg(STRIKE_SRC.tool);   // = (199/3086) ÷ (22/989) ≈ 2.899
// 돌 종류 → 암반 한 타 kg 에 곱하는 배수
const KINDS = { bedrock: 1, cracked: CRACK_X };

// 암반 한 타 kg(배수 1) — 채굴 정본 셋: 덩이 kg ÷ 덩이당 타수 ÷ 곡괭이 배수
function kIntact(chunkKg, swingsPer, pickMult) {
  return (chunkKg > 0 && swingsPer > 0 && pickMult > 0) ? chunkKg / swingsPer / pickMult : 0;
}
// 한 타에 깎이는 kg — 도구 배수 × 돌 종류 배수 × 암반 한 타 kg
function kgPerSwing(mult, kind, kBed) {
  return (mult > 0 ? mult : 0) * (KINDS[kind] || 0) * (kBed > 0 ? kBed : 0);
}
// 떨어진 kg → 돌 · 자갈 · 부스러기 kg(무게 보존 — 돌 kg × 돌 + 자갈 kg × 자갈 + 부스러기 = kg)
//   ⚠소수 끝 자리 — 4.000000001 이 돌 하나를 잃지 않게 백만분의 일 kg 에서 끊는다(나눗셈 앞 반올림).
function split(kg, stoneKg, pebbleKg) {
  const q = (x) => Math.round(x * 1e6) / 1e6;
  let r = q(kg > 0 ? kg : 0);
  const stone = stoneKg > 0 ? Math.floor(q(r / stoneKg)) : 0;
  r = q(r - stone * stoneKg);
  const pebble = pebbleKg > 0 ? Math.floor(q(r / pebbleKg)) : 0;
  r = q(r - pebble * pebbleKg);
  return { stone, pebble, crumbKg: r };
}

module.exports = { STRIKE_SRC, perStrikeKg, CRACK_X, KINDS, kIntact, kgPerSwing, split };
