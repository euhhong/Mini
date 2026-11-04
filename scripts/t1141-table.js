#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1141 표 기계 · 관찰기 판 JSON 만 읽는다 · 세계 안 만짐 · 판정 0)
// === scripts/t1141-table.js — 마을 소멸 진단: 같은 꼴 마을 · 굶는 날 생곡 수출 · 해체 마을 줄 · 위험 마을 전수 ===
//   node scripts/t1141-table.js <뿌리> <판 이름,…> [--risk <판 이름>] [--td <판 이름>] [--cf <기본>,<반사실>] [--json <파일>]
//     <뿌리>/<판>/base-<시드>.t1141.json — 관찰기(T1141 · 서버 판 자 곁 · 마을 × 날 [인구 · 곳간 식량 환산 tfe · 해체 곳간 fe(food+fish+meat+cooked_food) ·
//       food · rice · wheat · barley · 누계 수출 rice · wheat · barley · food · 누계 식량 수입 · 죽음 누계 · 농부 · 행복 · 도적 층 순감 날 · 피크 · 해체 표 · K · 징발])
//   셈(카드 T1141 — 새 수 0 · 문턱은 정본 글자):
//     같은 꼴 = 비옥도 < 0.5 · 나무 · 사냥감 · 돌 · 광석 모두 < 1.0(카드 "특산 없음") · 생곡 = rice · wheat · barley(econ `RAW_GRAINS`)
//     굶는 날 = 곳간 식량 환산 < 인구 × 1(하루치 · econ 하루 몫 `DAILY_FOOD_CONSUMPTION` = 1) · 곳간 바닥 = fe < 인구 × 3(`bandits.js` BDT_DIS_FOOD)
//     해체 = 해체 표(`_banditized`)가 선 날 · 빔 = 인구 0 이 된 날
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2], RUNS = String(process.argv[3] || '').split(',').filter(Boolean);
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const RISK = arg('--risk'), TDRUN = arg('--td'), CF = arg('--cf'), JOUT = arg('--json');   // --cf <판 기본>,<반사실 판>: 기본 판에서 해체된 마을이 반사실 판에서 어떻게 됐나   // --td <판>: 교역로 걸음 날 표를 그 판에서(같은 트리 · 같은 시드 = 같은 길 — 관찰기 둘째 판부터 적음)
const SEEDS = [1020, 7, 42];
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const f0 = (x) => (x == null ? '—' : Math.round(x).toLocaleString('en-US'));
const same = (L) => L && L.fertility < 0.5 && L.wood < 1 && L.game < 1 && L.stone < 1 && L.ore < 1;
const out = { runs: {}, risk: null };

function perRun(run) {
  const R = { seeds: 0, villages: 0, dissolved: [], emptied: [], collapse: 0, deaths: 0, grainX: 0, grainXStarve: 0, grainXFloor: 0, sameN: 0, sameDis: 0, timelines: [] };
  for (const s of SEEDS) {
    const o = J(path.join(ROOT, run, `base-${s}.t1141.json`)); if (!o || !o.rows || !o.rows.length) continue;
    R.seeds++; const C = Object.fromEntries(o.cols.map((c, i) => [c, i])); const n = o.names.length; R.villages += n;
    const prev = new Array(n).fill(null), first = o.names.map(() => ({ starve: null, floor: null, dis: null, empty: null, peak: 0, grainBefore: 0, impBefore: 0, starveDays: 0, grainAtDis: null, feAtDis: null, tfeAtDis: null, popAtDis: null }));
    for (let i = 0; i < n; i++) if (same(o.land[i])) R.sameN++;
    for (const [day, row] of o.rows) {
      for (let i = 0; i < n; i++) {
        const x = row[i]; if (!x) continue;
        const pop = x[C.pop], g = x[C.xRice] + x[C.xWheat] + x[C.xBarley], F = first[i];
        if (pop > F.peak) F.peak = pop;
        const p = prev[i];
        const dG = p ? Math.max(0, g - p.g) : 0;
        R.grainX += dG;
        const starving = pop > 0 && x[C.tfe] < pop, floor = pop > 0 && x[C.fe] < pop * 3;
        if (starving) { R.grainXStarve += dG; F.starveDays++; if (F.starve == null) F.starve = day; }
        if (floor) { R.grainXFloor += dG; if (F.floor == null) F.floor = day; }
        if (F.dis == null) { F.grainBefore += dG; F.impBefore = x[C.imp]; }
        if (x[C.bz] && F.dis == null) { F.dis = day; F.grainAtDis = x[C.rice] + x[C.wheat] + x[C.barley]; F.feAtDis = x[C.fe]; F.tfeAtDis = x[C.tfe]; F.popAtDis = pop; }
        if (pop === 0 && F.empty == null && F.peak > 0) F.empty = day;
        prev[i] = { g };
      }
    }
    const last = o.rows[o.rows.length - 1][1];
    for (let i = 0; i < n; i++) {
      const F = first[i], L = o.land[i];
      R.deaths += last[i] ? last[i][C.dead] : 0;
      if (F.dis != null) { R.dissolved.push(`${s}:${o.names[i]}@${F.dis}`); if (same(L)) R.sameDis++; }
      if (F.empty != null) R.emptied.push(`${s}:${o.names[i]}@${F.empty}`);
      if (F.dis != null || F.empty != null) R.timelines.push({ seed: s, v: o.names[i], fert: L.fertility, same: same(L) ? 1 : 0, firstStarve: F.starve, firstFloor: F.floor, dis: F.dis, empty: F.empty, peak: F.peak, popAtDis: F.popAtDis,
        grainExportBeforeDis: Math.round(F.grainBefore), foodImpBeforeDis: Math.round(F.impBefore), grainStockAtDis: F.grainAtDis == null ? null : Math.round(F.grainAtDis * 10) / 10, feAtDis: F.feAtDis, tfeAtDis: F.tfeAtDis, starveDays: F.starveDays });
    }
    for (const e of (o.ev || [])) if (e[2] === 'POP_COLLAPSE') R.collapse++;
  }
  return R;
}
for (const r of RUNS) out.runs[r] = perRun(r);

console.log('① 판마다(3시드 합 · 800날) — 해체 · 빔 · 같은 꼴 마을 · 생곡 수출');
console.log('| 판 | 시드 | 해체 | 빈 마을 | 인구 붕괴 사건 | 같은 꼴 마을(해체) | 생곡 수출 합 | 굶는 날(tfe < 인구) 생곡 수출 | 곳간 바닥(fe < 인구 × 3) 날 생곡 수출 |');
console.log('|---|---:|---:|---:|---:|---|---:|---|---|');
for (const [k, R] of Object.entries(out.runs)) {
  const pc = (a) => (R.grainX > 0 ? `${f0(a)}(${(100 * a / R.grainX).toFixed(1)}%)` : f0(a));
  console.log(`| ${k} | ${R.seeds} | ${R.dissolved.length} | ${R.emptied.length} | ${R.collapse} | ${R.sameN}(${R.sameDis}) | ${f0(R.grainX)} | ${pc(R.grainXStarve)} | ${pc(R.grainXFloor)} |`);
}
console.log('\n② 해체 · 빈 마을 줄(판마다)');
for (const [k, R] of Object.entries(out.runs)) {
  if (!R.timelines.length) { console.log(`  ${k}: 없음`); continue; }
  console.log(`  ${k}:`);
  for (const t of R.timelines) console.log(`    시드 ${t.seed} ${t.v}(비옥도 ${t.fert}${t.same ? ' · 같은 꼴' : ''}) 첫 굶는 날 ${t.firstStarve ?? '—'} · 첫 곳간 바닥 ${t.firstFloor ?? '—'} · 해체 ${t.dis ?? '—'}(인구 ${t.popAtDis ?? '—'} / 피크 ${t.peak} · fe ${t.feAtDis ?? '—'} · tfe ${t.tfeAtDis ?? '—'} · 곳간 생곡 ${t.grainStockAtDis ?? '—'}) · 빔 ${t.empty ?? '—'} · 해체 앞 생곡 수출 ${t.grainExportBeforeDis} · 식량 수입 ${t.foodImpBeforeDis} · 굶는 날 ${t.starveDays}`);
}
if (RISK) {
  const rows = [];
  for (const s of SEEDS) {
    const o = J(path.join(ROOT, RISK, `base-${s}.t1141.json`)); if (!o) continue;
    if (!Array.isArray(o.td) && TDRUN) { const t = J(path.join(ROOT, TDRUN, `base-${s}.t1141.json`)); if (t && Array.isArray(t.td) && t.names.join() === o.names.join()) o.td = t.td; }
    const C = Object.fromEntries(o.cols.map((c, i) => [c, i])), n = o.names.length;
    const acc = o.names.map(() => ({ popDays: 0, starve: 0, gx: 0, imp: 0, dis: null }));
    let prevG = new Array(n).fill(0);
    for (const [day, row] of o.rows) for (let i = 0; i < n; i++) { const x = row[i]; if (!x) continue; const A = acc[i]; A.popDays += x[C.pop]; if (x[C.pop] > 0 && x[C.tfe] < x[C.pop]) A.starve++; const g = x[C.xRice] + x[C.xWheat] + x[C.xBarley]; A.gx = g; A.imp = x[C.imp]; if (x[C.bz] && A.dis == null) A.dis = day; }
    const last = o.rows[o.rows.length - 1][1];
    for (let i = 0; i < n; i++) {
      const L = o.land[i], td = Array.isArray(o.td) ? o.td[i] : null;
      const near = td ? td.filter((d, j) => j !== i && d != null && d <= 4).length : null;
      const fin = td ? td.filter((d, j) => j !== i && d != null) : [];
      rows.push({ seed: s, v: o.names[i], fert: L.fertility, water: L.water, wood: L.wood, game: L.game, stone: L.stone, ore: L.ore, same: same(L) ? 1 : 0,
        near4: near, nearest: fin.length ? Math.min(...fin) : null, noRoute: td ? td.filter((d, j) => j !== i && d == null).length : null,
        impShare: acc[i].popDays > 0 ? Math.round(1000 * acc[i].imp / acc[i].popDays) / 1000 : null, starveDays: acc[i].starve, grainX: Math.round(acc[i].gx), imp: Math.round(acc[i].imp), popEnd: last[i] ? last[i][C.pop] : 0, dis: acc[i].dis });
    }
  }
  out.risk = rows;
  console.log(`\n③ 위험 마을 전수(${RISK} · 3시드 · 같은 꼴 먼저 · 굶는 날 많은 차례 · 앞 30)`);
  console.log('| 시드 | 마을 | 비옥도 · 물 · 나무 · 사냥 · 돌 · 광석 | 같은 꼴 | 4일 안 이웃 · 가장 가까운 날 · 길 없음 | 수입 의존(누계 수입 ÷ 사람-날) | 굶는 날 | 생곡 수출 | 식량 수입 | 끝 인구 | 해체 날 |');
  console.log('|---:|---|---|---|---|---:|---:|---:|---:|---:|---|');
  for (const r of rows.slice().sort((a, b) => b.same - a.same || b.starveDays - a.starveDays).slice(0, 30))
    console.log(`| ${r.seed} | ${r.v} | ${r.fert} · ${r.water} · ${r.wood} · ${r.game} · ${r.stone} · ${r.ore} | ${r.same ? '예' : ''} | ${r.near4 ?? '—'} · ${r.nearest ?? '—'} · ${r.noRoute ?? '—'} | ${r.impShare ?? '—'} | ${r.starveDays} | ${f0(r.grainX)} | ${f0(r.imp)} | ${r.popEnd} | ${r.dis ?? ''} |`);
}
if (CF) {
  const [bRun, cRun] = CF.split(','); const rows = [];
  for (const s of SEEDS) {
    const b = J(path.join(ROOT, bRun, `base-${s}.t1141.json`)), c = J(path.join(ROOT, cRun, `base-${s}.t1141.json`)); if (!b || !c) continue;
    const C = Object.fromEntries(b.cols.map((k, i) => [k, i]));
    b.names.forEach((nm, i) => {
      let dis = null, gate = null;
      for (const [d, row] of b.rows) if (row[i][C.bz]) { dis = d; break; } else gate = row[i];
      if (dis == null) return;
      let minP = Infinity, minD = null; for (const [d, row] of c.rows) if (d >= 365 && row[i][C.pop] < minP) { minP = row[i][C.pop]; minD = d; }
      const cEnd = c.rows[c.rows.length - 1][1][i];
      rows.push({ seed: s, v: nm, dis, gatePop: gate && gate[C.pop], gateFall: gate && gate[C.bFall], gatePeak: gate && gate[C.bPeak], gateFe: gate && gate[C.fe], cfMin: minP, cfMinDay: minD, cfEnd: cEnd[C.pop], cfBz: cEnd[C.bz] });
    });
  }
  out.cf = { base: bRun, cf: cRun, rows };
  console.log(`\n④ 해체 문 반사실(${bRun} 에서 해체된 마을 → ${cRun})`);
  console.log('| 시드 | 마을 | 해체 날 | 해체 앞날 인구 · 순감 날(문턱 5) · 피크 · 곳간 fe(문턱 인구 × 3) | 반사실 365날 뒤 최저 인구(날) | 반사실 800날 인구 |');
  console.log('|---:|---|---:|---|---|---:|');
  for (const r of rows) console.log(`| ${r.seed} | ${r.v} | ${r.dis} | ${r.gatePop} · ${r.gateFall} · ${r.gatePeak} · ${r.gateFe} | ${r.cfMin}(${r.cfMinDay}) | ${r.cfEnd} |`);
  console.log(`  합: 해체 ${rows.length} · 반사실 800날 살아 있음 ${rows.filter((r) => r.cfEnd > 0).length} · 인구 합 ${rows.reduce((a, r) => a + r.cfEnd, 0)}`);
}
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(out, null, 1));
