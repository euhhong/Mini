#!/usr/bin/env node
// === scripts/t1090-battle-lab-diff.js — 전투실험실 07-10 원본 ↔ 지금 코어 인라인 판 · 같은 배치 · 같은 씨 결과 차(T1090 ③) ==========
//
//   두 랩을 헤드리스로(DOM 막대 · sim/_battle-core-verify.js 꼴) 같은 화면 값 · 같은 씨로 돌려 판 결과를 견준다.
//     원본 = lab/원본/전투실험실_0710.html(07-10 · 고치지 않음) · 지금 = lab/전투실험실.html(BATTLE-CORE 인라인 = sim/battle-core.js)
//   씨: 판마다 새 VM 문맥 · Math.random 을 시드 PRNG 로 갈아 끼운 뒤 지형을 바꾸고 deploy() — 두 랩이 같은 차례로 RNG 를 쓴다
//       (지형 뽑기 → 병사 놓기 → 판). 판은 0.05 초씩(랩 루프와 같은 잘게) · 결과가 날 때까지(코어 식: 120 초 넘으면 남은 수로).
//   "어느 변경 몫인가" — 지금 코어를 손잡이 · 글자 하나씩 7월로 되돌린 판을 같이 돌린다(메모리 안에서만 · 파일 무접촉):
//     V0 지금 그대로 · V1 + T995 끔(탄 없는 사수도 3.5m 에서 물러섬 = 7월) · V2 + 몸 0.5m 끔(SEP_CORE 0 = 7월 sep) · V3 + T1019 끔(막힌 칸 덫 = 7월에 없던 클램프의 종전 글자)
//     V4(마을 판만) + 집이 표적 찾기 · 쏘기 사선을 안 막음(= 07-10 의 `trees.length` 문)
//     평지에서 V2 가 원본과 판마다 같으면 7월 뒤 평지 변경은 그 둘이 전부다. 남는 차 = 지형 어댑터(T284 — 장애물이 코어 밖으로 · 몸 클램프 · 집 사선) 몫.
//   출력: 판 표(시나리오 × 판본 — A 승 · 평균 시간 · 평균 사상 · 원본과 완전히 같은 판 수) · --json 경로.
// 실행: node scripts/t1090-battle-lab-diff.js [--seeds 10] [--json /tmp/t1090/diff.json]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NSEED = +arg('--seeds', '10');
const JSON_OUT = arg('--json', '');
const ORIG = path.join(ROOT, 'lab', '원본', '전투실험실_0710.html');
const NOW = path.join(ROOT, 'lab', '전투실험실.html');
const scripts = (f) => [...fs.readFileSync(f, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const S_ORIG = scripts(ORIG), S_NOW = scripts(NOW);
if (S_NOW.length < 2 || !S_NOW[0].includes('BattleCore')) { console.log(`지금 판 첫 스크립트가 코어가 아니다(${S_NOW.length}개)`); process.exit(1); }   // ★[T1100] 코어 · (평형 · 원정 사기) · 랩
const __mr = (s) => { let a = (s * 2654435761) >>> 0 || 1; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// 판본: 지금 코어 글자를 메모리에서 7월로 되돌린다(하나씩 더해 가며)
const SEP = 'const SEP_CORE=0.5;';
if (!S_NOW[0].includes(SEP)) { console.log('코어에 SEP_CORE 줄이 없다 — 이 자가 낡았다'); process.exit(1); }
const VARIANTS = [
  { key: 'V0', name: '지금 코어', env: {}, core: S_NOW[0] },
  { key: 'V1', name: '+ T995 끔', env: { T995_BACK_AMMO: '0' }, core: S_NOW[0] },
  { key: 'V2', name: '+ 몸 0.5m 끔', env: { T995_BACK_AMMO: '0' }, core: S_NOW[0].replace(SEP, 'const SEP_CORE=0;') },
  { key: 'V3', name: '+ T1019 끔', env: { T995_BACK_AMMO: '0', T1019_UNTRAP: '0' }, core: S_NOW[0].replace(SEP, 'const SEP_CORE=0;') },
];
// V4(마을만): + 집이 표적 찾기 · 쏘기 사선을 막지 않음 = 7월(07-10 은 그 셋을 `trees.length` 로만 걸어 나무 없는 마을에선 안 막았다 · 화살 길은 집이 막았다)
//   남는 차 = 마을 자리 뽑기 RNG 차례(07-10 은 자리 뽑기와 병사 놓기를 번갈아 · 지금은 자리를 먼저 뽑고 코어가 놓는다).
const V4PATCH = [
  ['if(d<bd&&!(los&&ctx.world&&treeBlocks(ctx,u.x,u.y,e.x,e.y))){', 'if(d<bd){'],
  ['!(ctx.world&&treeBlocks(ctx,u.x,u.y,u.tgt.x,u.tgt.y))', 'true'],
  ['const los=ctx.world?!treeBlocks(ctx,u.x,u.y,e.x,e.y):true;', 'const los=true;'],
];
let V4CORE = VARIANTS[3].core;
for (const [a, b] of V4PATCH) { if (!V4CORE.includes(a)) { console.log('V4 자리 없음: ' + a); process.exit(1); } V4CORE = V4CORE.replace(a, b); }
const V4 = { key: 'V4', name: '+ 집 사선 7월', env: VARIANTS[3].env, core: V4CORE, only: 'village' };

const mkctx = () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => ({ width: 0 })), set: (t, p, v) => { t[p] = v; return true; } });
function run(srcs, env, vals, seed) {
  const els = {};
  const el = (id) => els[id] || (els[id] = { value: vals[id] != null ? String(vals[id]) : (id.endsWith('_form') ? 'line' : id === 'terrain' ? 'plain' : id === 'speed' ? '1' : id.endsWith('_q') ? '0.5' : '0'),
    textContent: '', innerHTML: '', style: {}, firstChild: { style: {} }, getContext: () => mkctx(), width: 760, height: 760, addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 760, height: 760 }) });
  const M = Object.create(Math); M.random = Math.random;
  const sb = { document: { getElementById: el, querySelectorAll: () => [] }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, performance: { now: () => 0 }, console, Math: M, process: { env } };
  sb.window = sb; sb.globalThis = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  vals = Object.assign({}, vals); const ter = vals.terrain || 'plain';
  els.terrain = null; vals.terrain = 'plain';               // 첫 deploy(스크립트 끝) = 평지 · 씨 전
  for (const s of srcs) vm.runInContext(s, sb);
  M.random = __mr(seed);                                    // ★씨 — 지형 뽑기 · 병사 놓기 · 판이 이 뒤로 같은 차례
  el('terrain').value = ter;
  vm.runInContext('deploy()', sb);
  const probe = srcs.length >= 2
    ? '(()=>{const B=window.BattleCore;let k=0;while(!B.result&&k++<8000){B.trackVel(0.05);B.stepBattle(0.05);if(B._defaultCtx.world&&!B.result)B.judge();}return {win:B.result&&B.result.win,t:+B.tick.toFixed(2),a:B.sides.A.dead,b:B.sides.B.dead,na:B.sides.A.start,nb:B.sides.B.start};})()'
    : '(()=>{let k=0;while(!result&&k++<8000){trackVel(0.05);stepBattle(0.05);}return {win:result&&result.win,t:+tick.toFixed(2),a:sides.A.dead,b:sides.B.dead,na:sides.A.start,nb:sides.B.start};})()';
  return vm.runInContext(probe, sb);
}

const BASE = { a_spear: 10, a_archer: 5, b_spear: 4, b_axe: 4, b_dagger: 4, b_archer: 3 };   // 07-10 화면 기본값
const SCEN = [
  { name: '기본(07-10 화면 값) · 평지', vals: BASE },
  { name: '궁수전 창6궁12 대칭 · 평지', vals: { a_spear: 6, a_archer: 12, b_spear: 6, b_archer: 12 } },
  { name: '투석10창6 ↔ 도끼8석검4 · 평지', vals: { a_slinger: 10, a_spear: 6, b_axe: 8, b_dagger: 4 } },
  { name: '방패벽 창16 ↔ 도끼10장창6 · 평지', vals: { a_spear: 16, a_form: 'wall', b_axe: 10, b_pike: 6 } },
  { name: '투석병만 10 ↔ 10(돌 다 쓴 뒤 백병) · 평지', vals: { a_slinger: 10, b_slinger: 10 } },
  { name: '민병30 ↔ 창8청동1 · 평지', vals: { a_militia: 30, b_spear: 8, b_champ: 1 } },
  { name: '대군 창40궁20 ↔ 도끼30석검20 · 평지', vals: { a_spear: 40, a_archer: 20, b_axe: 30, b_dagger: 20 } },
  { name: '기본 · 숲', vals: Object.assign({ terrain: 'forest' }, BASE) },
  { name: '기본 · 숲 가장자리', vals: Object.assign({ terrain: 'edge' }, BASE) },
  { name: '기본 · 마을(시가전)', vals: Object.assign({ terrain: 'village' }, BASE) },
];

const t0 = Date.now();
const out = [];
console.log(`\n=== T1090 전투실험실 07-10 원본 ↔ 지금 코어 · 같은 배치 · 씨 ${NSEED} 개 ===`);
for (const sc of SCEN) {
  const seeds = Array.from({ length: NSEED }, (_, i) => i + 1);
  const O = seeds.map((s) => run(S_ORIG, {}, sc.vals, s));
  const row = { scen: sc.name, orig: O, v: {} };
  const sum = (R) => { const n = R.length; return { aWin: R.filter((r) => r.win === 'A').length, bWin: R.filter((r) => r.win === 'B').length, t: +(R.reduce((x, r) => x + r.t, 0) / n).toFixed(1), a: +(R.reduce((x, r) => x + r.a, 0) / n).toFixed(1), b: +(R.reduce((x, r) => x + r.b, 0) / n).toFixed(1) }; };
  const same = (R) => R.filter((r, i) => r.win === O[i].win && r.t === O[i].t && r.a === O[i].a && r.b === O[i].b).length;
  const so = sum(O);
  console.log(`\n▸ ${sc.name}  (병력 A ${O[0].na} · B ${O[0].nb})`);
  console.log(`   원본 07-10      A승 ${so.aWin} · B승 ${so.bWin} · 시간 ${so.t}s · 사상 A ${so.a} · B ${so.b}`);
  for (const V of VARIANTS.concat(sc.vals.terrain === 'village' ? [V4] : [])) {
    const R = seeds.map((s) => run([V.core].concat(S_NOW.slice(1)), V.env, sc.vals, s));
    const s2 = sum(R), sm = same(R);
    row.v[V.key] = { name: V.name, sum: s2, same: sm, runs: R };
    console.log(`   ${V.key} ${V.name.padEnd(10)} A승 ${s2.aWin} · B승 ${s2.bWin} · 시간 ${s2.t}s · 사상 A ${s2.a} · B ${s2.b} · 원본과 같은 판 ${sm}/${NSEED}`);
  }
  row.sum = so; out.push(row);
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)}초)`);
if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1)); }
