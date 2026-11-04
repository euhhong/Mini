#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(표 없으면 안 돈다)
// === scripts/test-t1149-winter.js — 겨울 골짜기 손잡이 `T1149_WINTER` [T1149 · ★재민 11-04] ===
//   잰다: ① 손잡이 갈래(끔 기본 · `=1` 셋 다 · `=k,birth,buy` 갈래만)
//         ② 달력 셈 — 다음 봄 첫날까지 남은 날 · 다가오는 겨울에 남은 날(달력 정본에서 유도)
//         ③ birth — 출생에 곳간 문: 곳간이 다가오는 겨울을 N + 1 명 먹일 만큼이 아니면 출생이 막힌다(넉넉하면 안 막힌다)
//         ④ k — 식량 흐름 K · 땔감 K 가 일자리 만충 가정이 아니라 지금 그 일을 하는 사람으로 선다
//         ⑤ buy — 가을 · 겨울엔 주식 목표가 겨울을 안다(값이 오른다) · 제 겨울 몫을 넘는 식량만 판다
//         ⑥ 끔 = 무동작(표지 칸이 안 선다 · 값 · 후보 그대로)
//         ⑦ 식량 수출 문턱 그대로(여름 37일치 = 안 판다 — 갈래가 문턱 사슬을 안 끊는다)
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (x != null ? `  ${x}` : '')); };

if (process.env.T1149_CHILD) {
  const E = require(path.join(__dirname, '..', 'sim', 'economy-sim'));
  const V2 = require(path.join(__dirname, '..', 'sim', 'economy-sim-v2'));
  const out = { knob: E.T1149, lean: [0, 275, 300, 364].map((d) => E.t1149LeanDays(d)), wd: [0, 100, 200, 275, 300].map((d) => E.t1149WinterDays(d)) };
  const mkV = (food) => {
    const v = E.createVillage({ name: '겨울마을', initialPop: 20, fertility: 1.2, arable: 1, game: 0.5, wood: 1, stone: 0.5, ore: 0.1 });
    v.housing = 400; v._mapBeds = 400;
    for (const k of Object.keys(v.storage)) if (['food', 'fish', 'meat', 'cooked_food', 'wheat', 'rice', 'barley', 'fruit', 'vegetable', 'mushroom'].includes(k)) v.storage[k] = 0;
    v.storage.food = food;
    return v;
  };
  // ③ 여름날(100 ~ 119) 스무 날 — 곳간 40일치(겨울 90일치에 모자람) · 200일치
  const run = (daysFood, d0, n) => { const v = mkV(20 * daysFood); let gate1 = 0; const n0 = v.npcs.length;
    try { for (let d = d0; d < d0 + n; d++) { v._world = { day: d }; E.tickVillage(v, d); if (v._t1149Gate === 1) gate1++; } } catch (e) { return { err: String(e && e.message || e) }; }
    return { n0, n: v.npcs.length, gate: v._t1149Gate, gate1, k: v._kDbg, lj: (v.counts && v.counts.lumberjack) || 0 }; };
  out.poor = run(40, 100, 20); out.rich = run(200, 100, 20);
  // ④ k — 같은 마을 다섯 날 · K 셋(끔 = 일자리 만충 가정 · 켬 = 지금 그 일을 하는 사람)
  out.kRun = run(60, 100, 5);
  // ⑤ buy — 가을날(200) 주식 값 · 판매 후보(곳간 43일치 · 겨울 90일치에 모자람)
  { const v = mkV(20 * 43); v._world = { day: 200 }; out.price = V2.computeShadowPrices(v).food; const c = V2._t1136Probe.exportCands({ v }, v.npcs.length); out.cand = c.map((x) => x.res); out.tfe = E.totalFoodEquivalent(v); }
  { const v = mkV(20 * 43); v._world = { day: 100 }; out.priceSummer = V2.computeShadowPrices(v).food; out.candSummer = V2._t1136Probe.exportCands({ v }, v.npcs.length).map((x) => x.res); }
  // ⑦ 끔 · 여름 · 곳간 37일치(식량 문턱 42일치 밑 · 그 밖 문턱 24일치 위) — 식량은 후보가 아니다(식량이 `else` 갈래로 떨어지면 선다)
  { const v = mkV(20 * 37); v._world = { day: 100 }; out.cand37 = V2._t1136Probe.exportCands({ v }, v.npcs.length).map((x) => x.res); }
  console.log(JSON.stringify(out));
  process.exit(0);
}

const go = (env) => JSON.parse(execFileSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { T1149_CHILD: '1' }, env), encoding: 'utf8', maxBuffer: 1 << 25 }).trim().split('\n').pop());
console.log('\n=== T1149 겨울 골짜기 하네스 ===\n');
const off = go({ T1149_WINTER: '' }), all = go({ T1149_WINTER: '1' }), birth = go({ T1149_WINTER: 'birth' }), k = go({ T1149_WINTER: 'k' }), buy = go({ T1149_WINTER: 'buy' });
ok(Object.keys(off.knob).length === 0 && all.knob.k && all.knob.birth && all.knob.buy && birth.knob.birth && !birth.knob.k && !birth.knob.buy, '① 끔 기본 · `=1` 셋 다 · `=birth` 그 갈래만', JSON.stringify([off.knob, all.knob, birth.knob]));
ok(JSON.stringify(off.lean) === JSON.stringify([365, 90, 65, 1]), '② 다음 봄 첫날까지 — 0날(3월 1일) 365 · 275날(12월 1일) 90 · 300날 65 · 364날 1(달력 정본)', JSON.stringify(off.lean));
ok(JSON.stringify(off.wd) === JSON.stringify([90, 90, 90, 90, 65]), '② 다가오는 겨울에 남은 날 — 겨울 앞이면 그 겨울 길이(90) · 겨울 안이면 남은 날', JSON.stringify(off.wd));
ok(!birth.poor.err && !birth.rich.err, '전제 — 마을 하루가 선다', birth.poor.err || birth.rich.err || '');
ok(off.poor.n > off.poor.n0, '★③ 전제 — 끔이면 곳간 40일치로도 여름 스무 날에 사람이 는다(아래가 자명 통과가 아니다)', `${off.poor.n0} → ${off.poor.n}`);
ok(birth.poor.gate1 === 20 && birth.poor.n <= birth.poor.n0, '★③ 켬 — 곳간이 겨울(90일치)을 못 먹이면 출생이 막힌다(스무 날 다 표지 `_t1149Gate`)', `${birth.poor.n0} → ${birth.poor.n} · 막힌 날 ${birth.poor.gate1}`);
ok(birth.rich.gate1 === 0 && birth.rich.n > birth.rich.n0, '③ 켬 — 곳간이 넉넉하면(200일치) 출생이 열린다', `${birth.rich.n0} → ${birth.rich.n}`);
ok(off.poor.gate === undefined && off.rich.gate === undefined, '⑥ 끔 — 표지 칸이 안 선다');
ok(!k.kRun.err && k.kRun.k && off.kRun.k && k.kRun.k.prod < off.kRun.k.prod && k.kRun.k.fuel < off.kRun.k.fuel && k.kRun.k.slot === off.kRun.k.slot, '★④ k — 식량 흐름 K · 땔감 K 가 지금 일하는 사람으로 준다(자리 K 는 그대로 · 끔 = 일자리 만충 가정)',
  `식량 ${off.kRun.k && off.kRun.k.prod} → ${k.kRun.k && k.kRun.k.prod} · 땔감 ${off.kRun.k && off.kRun.k.fuel} → ${k.kRun.k && k.kRun.k.fuel} · 자리 ${off.kRun.k && off.kRun.k.slot}`);
ok(buy.price > off.price && near(buy.priceSummer, off.priceSummer), '★⑤ buy — 가을엔 주식 값이 오른다(목표가 겨울 90일치) · 여름엔 그대로', `가을 ${off.price} → ${buy.price} · 여름 ${off.priceSummer} → ${buy.priceSummer}`);
ok(off.cand.includes('food') && !buy.cand.includes('food') && buy.candSummer.includes('food'), '★⑤ buy — 가을에 제 겨울 몫(90일치)에 모자라면 식량을 안 판다 · 여름엔 판다(43일치 > 42일치 문턱)', JSON.stringify([off.cand.includes('food'), buy.cand.includes('food'), buy.candSummer.includes('food')]));
ok(!off.cand37.includes('food') && !buy.cand37.includes('food'), '⑦ 식량 수출 문턱(42일치)이 그대로 — 여름 37일치면 안 판다(끔 · buy 둘 다 · T1149 갈래가 if/else 사슬을 안 끊는다)', JSON.stringify([off.cand37.includes('food'), buy.cand37.includes('food')]));
function near(a, b) { return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)); }
console.log(`\n=== ${pass + fail}건 중 PASS ${pass} · FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
