#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(scripts/run-regress.sh · 표 없으면 안 돈다)
// === scripts/test-gap-ruler.js — 격차 자(T1101)의 셈을 가짜 판으로 잰다 =========================================
//
// ★세계를 안 세운다(1초 안). `gap-ruler-lib.js` 의 셈 그대로를 부른다(사본 0):
//   ① 지니 — 다 같으면 0 · 한 곳이 다 가지면 (n−1)/n · 손으로 셈한 값 · 빈 마을(0)도 든다 · 순서 무관.
//   ② 추이 — 빈 마을(살다 0)과 처음부터 0 인 마을을 가른다 · 해체 누계.
//   ③ 회복 — 떨어졌다 돌아온 날 · 안 돌아옴 · 안 떨어짐 · 끝 기울기 · 대조 차.
//   ④ 행복 바닥 — 0.5 밑 날만 · 사람이 없는 날은 안 센다 · 하위 · 상위 줄 세움.
//   ⑤ 훅 — 제품 무접촉(존 아이에서만 선다) · 흉년은 세계가 굴린 객체를 복사(숫자 베끼기 0).
'use strict';
const path = require('path');
const fs = require('fs');
const G = require('./gap-ruler-lib');
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (x !== undefined ? '  ' + JSON.stringify(x) : '')); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

console.log('① 지니');
ok(near(G.gini([5, 5, 5, 5]), 0), '①-1 다 같으면 0');
ok(near(G.gini([0, 0, 0, 12]), 3 / 4), '①-2 한 곳이 다 가지면 (n−1)/n = 0.75');
// 손셈: [1,2,3,4] → Σ(2i−n−1)x = (−3)(1)+(−1)(2)+(1)(3)+(3)(4) = 10 · n·Σx = 4·10 = 40 → 0.25
ok(near(G.gini([1, 2, 3, 4]), 0.25), '①-3 손셈 [1,2,3,4] = 0.25');
ok(near(G.gini([4, 1, 3, 2]), G.gini([1, 2, 3, 4])), '①-4 순서 무관');
ok(G.gini([1, 2, 3, 4, 0]) > G.gini([1, 2, 3, 4]), '①-5 빈 마을(0)이 하나 늘면 지니가 오른다(빼지 않는다)');
ok(G.gini([0, 0, 0]) === 0 && G.gini([7]) === 0, '①-6 가진 것이 없거나 한 곳뿐이면 0');

console.log('② 추이 · 빈 마을 · 해체');
const D2 = { names: ['가', '나', '다'], rows: [
  [1, [10, 0, 5], [100, 0, 50], [0.6, null, 0.4], [0, 0, 0]],
  [2, [10, 0, 0], [100, 0, 0], [0.6, null, null], [0, 0, 1]],
  [3, [10, 3, 0], [100, 9, 0], [0.6, 0.4, null], [0, 0, 0]],
] };
const S2 = G.series(D2);
ok(S2[0].empty === 0 && S2[1].empty === 1 && S2[2].empty === 1, '②-1 빈 마을 = 살다가 0(처음부터 0 인 "나"는 사람이 오기 전엔 안 센다)', S2.map((s) => s.empty));
ok(S2[1].dissolved === 1 && S2[2].dissolved === 1, '②-2 해체는 누계(표가 내려가도 한 번 선 마을은 남는다)');
ok(near(S2[0].giniPop, G.gini([10, 0, 5])) && S2[2].pop === 13, '②-3 그날 지니 · 총인구');

console.log('③ 충격 회복');
const days = [10, 11, 12, 13, 14, 15];
const r1 = G.recovery([20, 18, 15, 17, 20, 22], days, 10);
ok(r1.back === 14 && r1.backDays === 4 && r1.min === 15 && r1.minDay === 12 && r1.dipped, '③-1 떨어졌다 돌아온 첫날 · 걸린 날 · 바닥', r1);
const r2 = G.recovery([20, 18, 15, 14, 13, 12], days, 10);
ok(r2.back === null && r2.dipped && r2.tail === -8, '③-2 안 돌아옴 · 끝 기울기(−) = 계속 떨어진다', r2);
const r3 = G.recovery([20, 21, 22, 22, 23, 24], days, 10);
ok(r3.back === null && !r3.dipped, '③-3 안 떨어짐 — 회복 날이 아니다(돌아올 일이 없었다)', r3);
const r4 = G.recovery([20, 18, 15, 17, 20, 22], days, 10, { days, vals: [20, 21, 22, 23, 24, 25] });
ok(r4.ctlEnd === 25 && r4.gapEnd === -3, '③-4 대조(충격 없는 같은 마을) 끝 차', r4);
ok(G.recovery([1, 2], [1, 2], 9) === null, '③-5 충격 날이 자료에 없으면 null(지어내지 않는다)');

console.log('④ 행복 바닥');
const D4 = { names: ['큰', '작', '빈'], rows: [] };
for (let d = 1; d <= 10; d++) D4.rows.push([d, [50, 5, d <= 3 ? 2 : 0], [0, 0, 0], [0.7, d <= 6 ? 0.3 : 0.6, 0.2], [0, 0, 0]]);
const F = G.floorDays(D4, 1);
ok(F.bottom.names[0] === '빈' && F.bottom.low[0] === 3 && F.bottom.live[0] === 3, '④-1 사람이 없는 날은 안 센다(빈 마을은 산 3날 중 3날 바닥)', F.bottom);
ok(F.top.names[0] === '큰' && F.top.low[0] === 0, '④-2 위 줄 = 평균 인구가 가장 큰 마을 · 0.7 은 바닥이 아니다', F.top);
const F2 = G.floorDays(D4, 2);
ok(F2.bottom.names.join() === '빈,작' && F2.bottom.low[1] === 6 && F2.bottom.share === +(9 / 13).toFixed(3), '④-3 하위 2 = 빈 · 작(6날 바닥) · 비율 = 바닥 날 / 산 날', F2.bottom);
ok(G.HAPPY_MID === 0.5, '④-4 바닥 문턱 = econ 행복 중립점 0.5');

console.log('⑤ 요약 · 훅');
const D5 = { names: ['가', '나', '다'], rows: D2.rows, shock: { idx: 0, day: 1, until: 2, name: '흉년' } };
const S5 = G.summarize(D5, D2);
ok(S5 && S5.shock && S5.shock.name === '가' && S5.shock.pop.base === 10 && S5.shock.pop.ctlEnd === 10, '⑤-1 요약 — 충격 마을 · 기준 · 대조', S5 && S5.shock);
const hook = fs.readFileSync(path.join(__dirname, 'gap-ruler-hook.js'), 'utf8');
ok(/zone\\\.js\$/.test(hook) && /Object\.assign\(\{\}, y\)/.test(hook) && !/fertility:\s*0\.\d/.test(hook),
  '⑤-2 훅 — 존 아이에서만 서고 · 흉년은 세계가 굴린 객체를 복사(배수 숫자를 베끼지 않는다)');
const sim = ['sim/economy-sim.js', 'sim/economy-sim-v2.js', 'server/villages.js', 'server/zone.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
ok(sim.every((t) => !/gap-ruler/.test(t)), '⑤-3 제품 무접촉 — econ · 서버가 격차 자를 모른다');

console.log(`\n=== 격차 자 셈: 통과 ${pass} · 실패 ${fail} ===`);
process.exit(fail ? 1 : 0);
