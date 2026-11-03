#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1091 표 기계 · `scripts/t1091-observe.js` 가 적은 판만 읽는다 · 세계 안 만짐 · 판정 0)
// === scripts/t1091-table.js — 징발 중 하루 감소 상한(명부 N ↔ 집 N) · 로지스틱 항(명부 N ↔ 집 N) 표 ===
//   node scripts/t1091-table.js <뿌리> [--json <파일>]
//     <뿌리>/run-<판>/base-<시드>.t1091.json · 판 = on · on~raid1 · on~raid2 · on~raid3(T837 띠 · `DCTL_SKIP=raid:n`)
//   셈(징발자가 있던 마을-날 · 명부 N = 틱 머리 `v.npcs.length` · 집 N = 명부 N − 징발):
//     상한 = N × POP_MAX_DELTA_PCT(관찰기가 정본 글에서 읽은 값) · 쓴 dP = dP 를 명부 상한으로 자른 값 · 집 상한 dP = 집 상한으로 자른 값
//     "집 상한이 묶는 날" = dP < −집 상한(그날 명부 상한이 집 상한보다 더 깎게 둔 날) · 더 깎인 몫 = 쓴 dP − 집 상한 dP(≤ 0)
//     로지스틱(명부) = 관찰기 줄 `logi`(econ `_dpDebug`) · 로지스틱(집) = 같은 식에 집 N(같은 K · r · θ)
//     "명부라 음수" = 로지스틱(명부) < 0 ≤ 로지스틱(집)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const SEEDS = [1020, 7, 42], RUNS = ['on', 'on~raid1', 'on~raid2', 'on~raid3'];
const out = { runs: {}, consts: null };
const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');
const f2 = (x) => (Math.round(x * 100) / 100).toLocaleString('en-US');
for (const run of RUNS) {
  const R = { files: 0, okBad: 0, errs: 0, noDraftVD: 0, noDraftDeaths: 0, draftVD: 0, draftDeaths: 0,
    deathVD: 0, deathVDcapR: 0, deathVDcapH: 0, deathsOnCapH: 0, bindH: 0, bindR: 0, extra: 0, extraOnDeath: 0, maxRatio: 0,
    statGap: 0, statGapDeath: 0, ok2: 0, ok2Bad: 0, ok2Ex: [], logiNeg: 0, logiNegRosterOnly: 0, logiGap: 0, logiGapDeath: 0, logiNegDeathVD: 0, logiRosterOnlyDeathVD: 0, ex: [] };
  for (const s of SEEDS) {
    const f = path.join(ROOT, 'run-' + run, `base-${s}.t1091.json`);
    if (!fs.existsSync(f)) continue;
    const o = JSON.parse(fs.readFileSync(f, 'utf8')); R.files++;
    out.consts = o.consts; const P = o.consts.POP_MAX_DELTA_PCT, r = o.consts.POP_GROWTH_RATE, th = o.consts.LOGISTIC_THETA;
    const ix = Object.fromEntries(o.cols.map((c, i) => [c, i]));
    R.okBad += o.okBad; R.errs += o.errs; R.noDraftVD += o.noDraft.villageDays; R.noDraftDeaths += o.noDraft.deaths; R.draftVD += o.draft.villageDays; R.draftDeaths += o.draft.deaths;
    for (const [name, rows] of Object.entries(o.v)) for (const x of rows) {
      const n = x[ix.n], dr = x[ix.drafted], h = n - dr, dP = x[ix.dP], K = x[ix.K], lg = x[ix.logi], dd = x[ix.deaths];
      if (dP == null || K == null) continue;
      const capR = n * P, capH = h * P;
      const used = Math.max(-capR, Math.min(capR, dP)), usedH = Math.max(-capH, Math.min(capH, dP)), ex = Math.min(0, used - usedH);
      const lgH = r * h * (1 - Math.pow(h / Math.max(1, K), th));
      {   // 재셈 — 관찰기 `ok` 는 K 반올림(소수 한 자리)을 안 봤다. 여기선 K ± 0.05 · logi ± 0.0005 안에 명부 N 재셈이 드는지 본다(드는 N 이 명부 N 인가)
        const lgN = (kk) => r * n * (1 - Math.pow(n / Math.max(1, kk), th));
        const lo = Math.min(lgN(K - 0.05), lgN(K + 0.05)) - 0.0006, hi = Math.max(lgN(K - 0.05), lgN(K + 0.05)) + 0.0006;
        if (lg >= lo && lg <= hi) R.ok2++; else { R.ok2Bad++; if (R.ok2Bad <= 3) R.ok2Ex.push([s, name, x[ix.day], n, K, lg, +lgN(K).toFixed(4)]); }
      }
      if (h > 0 && n / h > R.maxRatio) R.maxRatio = n / h;
      if (dP < -capH) { R.bindH++; R.extra += ex; }
      if (dP < -capR) R.bindR++;
      if (lg < 0) R.logiNeg++;
      if (lg < 0 && lgH >= 0) R.logiNegRosterOnly++;
      R.logiGap += Math.min(0, lg - lgH);
      { const st = (x[ix.health] || 0) + (x[ix.happy] || 0) + (x[ix.prestige] || 0); const g = st * (1 - h / n); R.statGap += g; if (dd > 0) R.statGapDeath += g; }   // 건강 · 행복 · 위신 항(× N) — 명부 − 집(= 항 × 징발 ÷ 명부)
      if (dd > 0) {
        R.deathVD++;
        if (dP < -capR) R.deathVDcapR++;
        if (dP < -capH) { R.deathVDcapH++; R.deathsOnCapH += dd; R.extraOnDeath += ex; }
        R.logiGapDeath += Math.min(0, lg - lgH);
        if (lg < 0) R.logiNegDeathVD++;
        if (lg < 0 && lgH >= 0) R.logiRosterOnlyDeathVD++;
        R.ex.push({ seed: s, v: name, day: x[ix.day], n, drafted: dr, home: h, capR: +capR.toFixed(2), capH: +capH.toFixed(2), dP, used: +used.toFixed(3), usedH: +usedH.toFixed(3), deaths: dd, K, logi: lg, logiH: +lgH.toFixed(3), hunger: x[ix.hunger], health: x[ix.health], happy: x[ix.happy] });
      }
    }
  }
  R.ex.sort((a, b) => (a.used - a.usedH) - (b.used - b.usedH) || b.deaths - a.deaths);
  out.runs[run] = R;
}
console.log(`상수(정본 글): POP_MAX_DELTA_PCT ${out.consts && out.consts.POP_MAX_DELTA_PCT} · r ${out.consts && out.consts.POP_GROWTH_RATE} · θ ${out.consts && out.consts.LOGISTIC_THETA}`);
for (const [k, R] of Object.entries(out.runs)) console.log(`판 ${k}: 관찰 파일 ${R.files}/3 · 로지스틱 재셈(명부 N · K 반올림 폭 안) 맞음 ${R.ok2}/${R.ok2 + R.ok2Bad}${R.ok2Bad ? ' 어긋남 ' + JSON.stringify(R.ok2Ex) : ''} · 관찰 오류 ${R.errs}`);
console.log('\n① 하루 감소 상한 — 징발 중 마을-날(3시드 합 · 800날)');
console.log('| 판 | 징발 마을-날 | 그중 죽음 마을-날 · 죽음 | 집 상한이 묶는 날(dP < −집 상한) | 그중 죽음 마을-날 · 그날 죽음 | 명부 상한이 묶은 날(죽음 날) | 명부 상한이 더 깎게 둔 몫 Σ(모든 날 · 죽음 날) | 명부 N ÷ 집 N 최대 | 징발 없는 날 죽음 |');
console.log('|---|---:|---|---:|---|---:|---|---:|---:|');
for (const [k, R] of Object.entries(out.runs)) console.log(`| ${k} | ${R.draftVD.toLocaleString('en-US')} | ${R.deathVD} · ${R.draftDeaths} | ${R.bindH} | ${R.deathVDcapH} · ${R.deathsOnCapH} | ${R.bindR}(${R.deathVDcapR}) | ${f2(R.extra)} · ${f2(R.extraOnDeath)} | ${f2(R.maxRatio)} | ${R.noDraftDeaths.toLocaleString('en-US')} |`);
console.log('\n② 로지스틱 항 — 징발 중 마을-날');
console.log('| 판 | 로지스틱 < 0 인 날 | 그중 집 N 이면 ≥ 0(명부라 음수) | 죽음 날 중 로지스틱 < 0 · 명부라 음수 | 로지스틱(명부) − 로지스틱(집) 음수 몫 Σ(모든 날 · 죽음 날) | (곁) 건강 · 행복 · 위신 항 명부 − 집 Σ(모든 날 · 죽음 날) |');
console.log('|---|---:|---:|---|---|---|');
for (const [k, R] of Object.entries(out.runs)) console.log(`| ${k} | ${R.logiNeg} | ${R.logiNegRosterOnly} | ${R.logiNegDeathVD} · ${R.logiRosterOnlyDeathVD} | ${f2(R.logiGap)} · ${f2(R.logiGapDeath)} | ${f2(R.statGap)} · ${f2(R.statGapDeath)} |`);
console.log('\n징발 중 죽음 마을-날(판마다 명부 상한이 더 깎게 둔 몫이 큰 차례 · 앞 8)');
for (const [k, R] of Object.entries(out.runs)) {
  console.log(`  ${k}:`);
  for (const e of R.ex.slice(0, 8)) console.log(`    시드 ${e.seed} ${e.v} ${e.day}날 명부 ${e.n} · 징발 ${e.drafted} · 집 ${e.home} · 상한 ${e.capR} ↔ ${e.capH} · dP ${e.dP} → 쓴 ${e.used} ↔ 집 상한 ${e.usedH} · 죽음 ${e.deaths} · K ${e.K} · 로지스틱 ${e.logi} ↔ ${e.logiH} · 굶주림 ${e.hunger}`);
}
for (const R of Object.values(out.runs)) R.exTop = R.ex.slice(0, 20), R.exN = R.ex.length;
if (JOUT) { for (const R of Object.values(out.runs)) delete R.ex; fs.writeFileSync(JOUT, JSON.stringify(out, null, 1)); }
