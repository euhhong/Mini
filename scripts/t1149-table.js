#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1149 표 기계 · 판 JSON 만 읽는다 · 판정 0)
// === scripts/t1149-table.js — 겨울 골짜기 표(T1141 자 · 서버 판 자 3시드 × 800날) ===
//   node scripts/t1149-table.js <뿌리> <판,…> [--json <파일>] [--attr <판>]
//     <뿌리>/run-<판>/base-<시드>.t1149.json (+ 같은 자리 .t1141.json — 걸음 날 행렬 `td`)
//   셈(3시드 합 · 날 = econ 날 · 철 = 달력 정본 `server/calendar.js` — 가을 9 ~ 11월 · 겨울 12 ~ 2월):
//     겨울 골짜기 깊이 — 마을마다 해마다 (그 겨울 최저 인구 ÷ 바로 앞 가을 최고 인구) · 평균 · 최저 · 0.9 밑 마을-해 수 · 같은 꼴 마을(T1141 — 비옥도 < 0.5 · 나무 · 사냥감 · 돌 · 광석 < 1)
//     굶어 죽음(누계 `_deadTot` · 첫해 · 800날) · 침상 막힘(N ≥ 침상 · 그날 출생이 막힌 마을 몫 · 마을-날) · N/K(가운데 · 10 · 90%) ·
//     곳간 며칠치(곳간 식량 환산 ÷ 인구 · 가을 · 겨울 가운데) · 인구(400 · 800날) · 빈 마을(800날 인구 0) · 출생 누계
//   --attr <판>: 귀속(겨울 앞 수입 끊김) — 같은 꼴 마을의 40날 창마다 [오는 식량 캐러밴(마을-날 평균) · 누계 식량 수입 증가 ·
//     4일 안 이웃 가운데 곳간 며칠치 > 42(v2 식량 수출 문턱 `target × 1.4` = 하루 생존량 × 30 × 1.4) 몫 · 이웃 식량 값 가운데 · 제 식량 값]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
const RUNS = (process.argv[3] || 'off').split(',');
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const ai = process.argv.indexOf('--attr'), ATTR = ai > 0 ? process.argv[ai + 1] : null;
const SEEDS = [1020, 7, 42];
const C = require(path.join(__dirname, '..', 'server', 'calendar.js'));
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const season = (d) => C.seasonOf(d);
const sameKind = (L) => L && L.fertility < 0.5 && L.wood < 1 && L.game < 1 && L.stone < 1 && L.ore < 1;
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r3 = (x) => (x == null ? null : +(+x).toFixed(3));
function yearOf(d) { const t = C.dateOf(d); return t.month >= 3 ? t.year : t.year - 1; }   // 해 = 3월 ~ 이듬해 2월(가을 · 그 뒤 겨울이 한 해)

function one(run) {
  const out = { run, seeds: 0, depth: [], depthSame: [], under09: 0, under09Same: 0, villYears: 0, dead365: 0, dead800: 0, born: 0, bedDays: 0, villDays: 0,
    nk: [], daysAut: [], daysWin: [], pop400: 0, pop800: 0, empty: 0, gate: 0 };
  for (const s of SEEDS) {
    const t = J(path.join(ROOT, 'run-' + run, `base-${s}.t1149.json`)); if (!t) continue;
    out.seeds++;
    const ix = Object.fromEntries(t.cols.map((c, i) => [c, i]));
    const nV = t.names.length, Y = Array.from({ length: nV }, () => ({}));
    let last = null;
    for (const [d, vs] of t.rows) {
      const se = season(d), y = yearOf(d);
      vs.forEach((x, k) => {
        const N = x[ix.pop]; if (!(N > 0)) return;
        out.villDays++;
        if (x[ix.hcap] != null && N >= x[ix.hcap]) out.bedDays++;
        if (x[ix.K] > 0) out.nk.push(N / x[ix.K]);
        const dd = x[ix.tfe] / N;
        if (se === 'autumn') out.daysAut.push(dd); else if (se === 'winter') out.daysWin.push(dd);
        const YY = Y[k][y] || (Y[k][y] = { aMax: 0, wMin: Infinity });
        if (se === 'autumn') YY.aMax = Math.max(YY.aMax, N);
        if (se === 'winter') YY.wMin = Math.min(YY.wMin, N);
      });
      if (se === 'winter') vs.forEach((x, k) => { const YY = Y[k][yearOf(d)]; if (YY && !(x[ix.pop] > 0)) YY.wMin = 0; });
      if (d === 364) out.dead365 += vs.reduce((a, x) => a + (x[ix.dead] || 0), 0);
      if (d === 400) out.pop400 += vs.reduce((a, x) => a + x[ix.pop], 0);
      last = vs;
    }
    out.dead800 += last.reduce((a, x) => a + (x[ix.dead] || 0), 0);
    out.born += last.reduce((a, x) => a + (x[ix.born] || 0), 0);
    out.pop800 += last.reduce((a, x) => a + x[ix.pop], 0);
    out.empty += last.filter((x) => !(x[ix.pop] > 0)).length;
    for (let k = 0; k < nV; k++) for (const YY of Object.values(Y[k])) {
      if (!(YY.aMax > 0) || !isFinite(YY.wMin)) continue;
      const dep = YY.wMin / YY.aMax;
      out.villYears++; out.depth.push(dep); if (dep < 0.9) out.under09++;
      if (sameKind(t.land[k])) { out.depthSame.push(dep); if (dep < 0.9) out.under09Same++; }
    }
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return { run: out.run, seeds: out.seeds, depthMean: r3(mean(out.depth)), depthMin: r3(out.depth.length ? Math.min(...out.depth) : null), under09: out.under09, villYears: out.villYears,
    depthSameMean: r3(mean(out.depthSame)), depthSameMin: r3(out.depthSame.length ? Math.min(...out.depthSame) : null), under09Same: out.under09Same, sameYears: out.depthSame.length,
    dead365: out.dead365, dead800: out.dead800, born: out.born, bedShare: r3(out.villDays ? out.bedDays / out.villDays : 0),
    nkMed: r3(q(out.nk, 0.5)), nkP10: r3(q(out.nk, 0.1)), nkP90: r3(q(out.nk, 0.9)), daysAut: r3(q(out.daysAut, 0.5)), daysWin: r3(q(out.daysWin, 0.5)),
    daysWinP10: r3(q(out.daysWin, 0.1)), pop400: out.pop400, pop800: out.pop800, empty: out.empty };
}
const res = RUNS.map(one).filter((r) => r.seeds);
console.log('| 판 | 시드 | 겨울 골짜기(평균 · 최저 · 0.9 밑 마을-해) | 같은 꼴(평균 · 최저 · 0.9 밑) | 굶어 죽음(첫해 · 800날) | 출생 | 침상 막힘(마을-날 몫) | N/K(10 · 50 · 90%) | 곳간 며칠치(가을 · 겨울 · 겨울 10%) | 인구 400 · 800 | 빈 마을 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of res) console.log(`| ${r.run} | ${r.seeds} | ${r.depthMean} · ${r.depthMin} · ${r.under09}/${r.villYears} | ${r.depthSameMean} · ${r.depthSameMin} · ${r.under09Same}/${r.sameYears} | ${r.dead365} · ${r.dead800} | ${r.born} | ${r.bedShare} | ${r.nkP10} · ${r.nkMed} · ${r.nkP90} | ${r.daysAut} · ${r.daysWin} · ${r.daysWinP10} | ${r.pop400} · ${r.pop800} | ${r.empty} |`);

let attr = null;
if (ATTR) {
  attr = { run: ATTR, win: [] };
  const W = 40, acc = new Map();
  for (const s of SEEDS) {
    const t = J(path.join(ROOT, 'run-' + ATTR, `base-${s}.t1149.json`)), t41 = J(path.join(ROOT, 'run-' + ATTR, `base-${s}.t1141.json`));
    if (!t) continue;
    const ix = Object.fromEntries(t.cols.map((c, i) => [c, i]));
    const nV = t.names.length, same = t.land.map(sameKind);
    const td = t41 && Array.isArray(t41.td) ? t41.td : null;
    const nb = Array.from({ length: nV }, (_, a) => (td ? td[a].map((x, b) => (b !== a && x != null && x <= 4 ? b : -1)).filter((b) => b >= 0) : []));
    let prevImp = null;
    for (const [d, vs] of t.rows) {
      const w = Math.floor(d / W) * W;
      const A = acc.get(w) || { n: 0, carIn: 0, imp: 0, nbOk: 0, nbN: 0, pNb: [], pOwn: [], days: [] };
      for (let k = 0; k < nV; k++) {
        if (!same[k] || !(vs[k][ix.pop] > 0)) continue;
        A.n++; A.carIn += vs[k][ix.carIn] || 0;
        if (prevImp) A.imp += Math.max(0, (vs[k][ix.imp] || 0) - (prevImp[k] || 0));
        A.days.push(vs[k][ix.tfe] / vs[k][ix.pop]);
        if (vs[k][ix.pFood] != null) A.pOwn.push(vs[k][ix.pFood]);
        for (const b of nb[k]) { const x = vs[b]; if (!(x[ix.pop] > 0)) continue; A.nbN++; if (x[ix.tfe] / x[ix.pop] > 42) A.nbOk++; if (x[ix.pFood] != null) A.pNb.push(x[ix.pFood]); }
      }
      acc.set(w, A);
      prevImp = vs.map((x) => x[ix.imp] || 0);
    }
  }
  console.log(`\n### 귀속 — 같은 꼴 마을(판 ${ATTR} · 40날 창 · 3시드)\n`);
  console.log('| 날 | 철 | 오는 식량 캐러밴(마을-날 평균) | 식량 수입(마을-날 평균) | 제 곳간 며칠치(가운데) | 4일 안 이웃 중 곳간 > 42일치 몫 | 이웃 식량 값(가운데) | 제 식량 값(가운데) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const [w, A] of [...acc.entries()].sort((a, b) => a[0] - b[0])) {
    const row = { day: w, season: season(w + 20), carIn: r3(A.n ? A.carIn / A.n : 0), imp: r3(A.n ? A.imp / A.n : 0), days: r3(q(A.days, 0.5)), nbOk: r3(A.nbN ? A.nbOk / A.nbN : 0), pNb: r3(q(A.pNb, 0.5)), pOwn: r3(q(A.pOwn, 0.5)) };
    attr.win.push(row);
    console.log(`| ${w}–${w + W - 1} | ${row.season} | ${row.carIn} | ${row.imp} | ${row.days} | ${row.nbOk} | ${row.pNb} | ${row.pOwn} |`);
  }
}
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify({ runs: res, attr }, null, 1));
