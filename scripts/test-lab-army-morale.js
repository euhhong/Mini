#!/usr/bin/env node
// @regress
// === scripts/test-lab-army-morale.js — 전투실험실 원정 사기 · 군량 빚(T1100 · T1076 식) — 배선 · 끔 바이트 ===
//   재는 것:
//     ① 배선 — lab/전투실험실.html 의 BATTLE-CORE · ARMY-MORALE 블록이 정본(sim/battle-core.js · equilibrium.js · army-morale.js)과 바이트 같다
//        (`inline-battle.js` 를 임시 사본에 다시 돌려 차 0 · 레포 파일 무접촉).
//     ② 끔 바이트 — 손잡이 끔(기본) 판 ↔ 켬 + 기본값(짐 1 · 빚 0 · 행군 0) 판이 같은 씨에서 판 결과 · 사상 · 시간 · 병사 상태까지 같다.
//        끔 판에는 편 칸 armyMrl 이 아예 없다.
//     ③ 켬 — 짐 0.2 · 빚 6 · 행군 14날 편의 사기 = 1 → 평형 0.2 쪽 반감기 14날 = 0.6 · 편 칸에 실린다 ·
//        같은 씨 끔 판과 결과가 갈린다(자명 통과 금지 — 갈리는 판이 있어야 한다).
//     ④ 같은 식 — 랩 ArmyMorale.day 를 날마다 부른 값 = war-core armyMoraleDay(T1076 켬) 값(같은 입력 · 40날 × 60판).
//     ⑤ 계단 — 판 끝 사기 = 판 전 사기 − M_KABS × 그 편 사상 ÷ 떠난 병력(사상 0 이면 그대로).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const LAB = path.join(ROOT, 'lab', '전투실험실.html');
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (d !== undefined && d !== '' ? `  ${d}` : '')); };

console.log('\n① 배선 — 인라인 블록 = 정본');
{
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 't1100-')), '전투실험실.html');
  fs.copyFileSync(LAB, tmp);
  execFileSync(process.execPath, [path.join(ROOT, 'sim', 'inline-battle.js'), tmp], { stdio: 'ignore' });
  ok(fs.readFileSync(tmp).equals(fs.readFileSync(LAB)), '전투실험실 BATTLE-CORE · ARMY-MORALE 블록 — 다시 구워도 차 0');
  const H = fs.readFileSync(LAB, 'utf8');
  ok(H.includes(fs.readFileSync(path.join(ROOT, 'sim', 'army-morale.js'), 'utf8')) && H.includes(fs.readFileSync(path.join(ROOT, 'sim', 'equilibrium.js'), 'utf8')), '랩에 equilibrium.js · army-morale.js 글자 그대로');
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
}

const SRCS = [...fs.readFileSync(LAB, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const __mr = (s) => { let a = (s * 2654435761) >>> 0 || 1; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const mkctx = () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => ({ width: 0 })), set: (t, p, v) => { t[p] = v; return true; } });
const DEF = { a_spear: 10, a_archer: 5, b_spear: 4, b_axe: 4, b_dagger: 4, b_archer: 3, a_r: 1, b_r: 1, a_debt: 0, b_debt: 0, a_days: 0, b_days: 0, a_q: 0.5, b_q: 0.5 };
function run(vals, seed) {
  const els = {};
  const el = (id) => els[id] || (els[id] = { value: vals[id] != null ? String(vals[id]) : (id.endsWith('_form') ? 'line' : id === 'terrain' ? 'plain' : id === 'speed' ? '1' : '0'),
    checked: !!vals[id], textContent: '', innerHTML: '', style: {}, firstChild: { style: {} }, getContext: () => mkctx(), width: 600, height: 150, addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 760, height: 760 }) });
  const M = Object.create(Math); M.random = Math.random;
  const sb = { document: { getElementById: el, querySelectorAll: () => [] }, requestAnimationFrame: () => 0, performance: { now: () => 0 }, console, Math: M, process: { env: {} } };
  sb.window = sb; sb.globalThis = sb; sb.addEventListener = () => {};
  vm.createContext(sb);
  for (const s of SRCS) vm.runInContext(s, sb);
  M.random = __mr(seed);
  vm.runInContext('deploy()', sb);
  return vm.runInContext(`(()=>{const B=window.BattleCore; const am={A:B.sides.A.armyMrl,B:B.sides.B.armyMrl,hasA:'armyMrl' in B.sides.A,hasB:'armyMrl' in B.sides.B};
    for(let k=0;k<8000&&!B.result;k++)advance(0.05);
    return {win:B.result&&B.result.win,t:B.tick,a:B.sides.A.dead,b:B.sides.B.dead,na:B.sides.A.start,nb:B.sides.B.start,am,
      st:JSON.stringify(B.units.map(u=>[u.x,u.y,u.hp,u.mrl,u.routing])),T:T1076.on?{A:T1076.A,B:T1076.B}:null};})()`, sb);
}

console.log('\n② 끔 바이트 — 끔 ↔ 켬 + 기본값(짐 1 · 빚 0 · 행군 0)');
{
  const SC = [DEF, Object.assign({}, DEF, { a_spear: 6, a_archer: 12, b_spear: 6, b_archer: 12 }), Object.assign({}, DEF, { a_militia: 30, a_spear: 0, a_archer: 0, b_spear: 8, b_champ: 1, b_axe: 0, b_dagger: 0, b_archer: 0 })];
  let same = 0, n = 0, noSlot = 0;
  for (const v of SC) for (let s = 1; s <= 5; s++) {
    const off = run(v, s), on = run(Object.assign({ t1076: true }, v), s); n++;
    if (off.win === on.win && off.t === on.t && off.a === on.a && off.b === on.b && off.st === on.st) same++;
    if (!off.am.hasA && !off.am.hasB) noSlot++;
  }
  ok(same === n, `같은 판 ${same}/${n}(결과 · 시간 · 사상 · 병사 자리 · 체력 · 사기 · 궤주)`);
  ok(noSlot === n, `끔 판에 편 칸 armyMrl 없음 ${noSlot}/${n}`);
}

console.log('\n③ 켬 — 굶은 편');
{
  const V = Object.assign({}, DEF, { t1076: true, b_r: 0.2, b_debt: 6, b_days: 14 });
  let diff = 0, amB = null, eqB = null;
  for (let s = 1; s <= 8; s++) {
    const on = run(V, s), off = run(DEF, s);
    amB = on.am.B; eqB = on.T && on.T.B && on.T.B.eq;
    if (on.win !== off.win || on.a !== off.a || on.b !== off.b || on.t !== off.t) diff++;
  }
  ok(Math.abs(eqB - 0.2) < 1e-12, `평형 = min(짐 0.2, 1 − 6 ÷ 14) = 0.2`, eqB);
  ok(Math.abs(amB - 0.6) < 1e-9, `14날(반감기 하나) 뒤 사기 1 → 0.6 · 편 칸에 실림`, amB);
  ok(diff > 0, `같은 씨 끔 판과 결과가 갈린 판 ${diff}/8(자명 통과 금지)`);
}

console.log('\n④ 같은 식 — 랩 ArmyMorale ↔ war-core armyMoraleDay(T1076 켬)');
{
  process.env.T1076_ARMY_MORALE = '1';
  const WC = require(path.join(ROOT, 'sim', 'war-core.js'));
  const inst = WC.createWar({ villages: [], world: { day: 400, _warWars: [], _warTributes: [], _warSeq: 1 }, seed: 1, log: null });
  const sb = { console, process: { env: {} } }; sb.window = sb; vm.createContext(sb);
  for (const s of SRCS.slice(0, 3)) vm.runInContext(s, sb);   // 코어 · 평형 · 원정 사기(랩 인라인 그대로)
  const AM = sb.ArmyMorale;
  let z = 1100, same = 0, n = 0; const rnd = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return z / 0x7fffffff; };
  for (let t = 0; t < 60; t++) { const w = { _mrl: 1, _mrlForce: 20, force: 20 }; let m = 1;
    for (let d = 0; d < 40; d++) { const r = rnd() * 1.2 - 0.1, debt = rnd() * 18; inst.armyMoraleDay(w, r, debt); m = AM.day(m, r, debt); n++; if (m === w._mrl) same++; } }
  ok(same === n, `같은 값 ${same}/${n}`);
  ok(AM.DEBT_DAYS === inst.T1076_DEBT_DAYS && inst.T1076_DEBT_DAYS === 14, '빚 자 14날 한 곳(sim/army-morale.js)');
}

console.log('\n⑤ 전사자 계단');
{
  const V = Object.assign({}, DEF, { t1076: true, b_r: 0.2, b_debt: 6, b_days: 14, a_days: 5 });
  let good = 0, n = 0, KABS = null;
  for (let s = 1; s <= 6; s++) { const r = run(V, s);
    const sb = { console }; sb.window = sb; vm.createContext(sb); vm.runInContext(SRCS[0], sb); KABS = sb.BattleCore.M_KABS;
    for (const S of ['A', 'B']) { const t = r.T[S], dead = S === 'A' ? r.a : r.b, start = S === 'A' ? r.na : r.nb; n++;
      const want = dead > 0 ? Math.max(0, t.mrl - KABS * dead / start) : t.mrl; if (Math.abs(t.after - want) < 1e-12) good++; } }
  ok(good === n, `판 끝 사기 = 판 전 − M_KABS(${KABS}) × 사상 ÷ 병력 ${good}/${n}`);
}

console.log(`\n=== ${pass + fail}건 중 PASS ${pass} · FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
