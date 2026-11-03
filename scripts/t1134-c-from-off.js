#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1134 c 를 손으로 박지 않고 끈 판에서 잰다 · 판정 0)
// === scripts/t1134-c-from-off.js — 인구 항 계수 c 의 세 값 = 끈 판 마을별 "좋은 것 ÷ 인구" 의 사분위 ===================
//   끈 판의 행복(`lastStats.happiness`) = 좋은 것 G(종전 식은 0 에서 G 를 더한다). 목표 식 h* = 0.5 + G − c·N 에서
//   한 마을이 중립(h* = 0.5)이 되는 c = G ÷ N. 판 평균(100날 뒤 · 사람이 있는 날)으로 마을마다 그 몫을 재고, 시드 셋을 모아 25 · 50 · 75% 를 낸다.
//   ⇒ c 25% = 마을 넷 중 셋이 중립 위에 서는 c · 50% = 절반 · 75% = 넷 중 하나만.
//   node scripts/t1134-c-from-off.js <끔 판 .gap.json 여럿> [--json out]
'use strict';
const fs = require('fs');
const A = process.argv.slice(2);
const files = A.filter((x) => /\.gap\.json$/.test(x));
const ratios = [], per = [];
for (const f of files) {
  const D = JSON.parse(fs.readFileSync(f, 'utf8'));
  const n = D.names.length, sg = new Array(n).fill(0), sn = new Array(n).fill(0), k = new Array(n).fill(0);
  for (const r of D.rows) {
    if (r[0] < 100) continue;
    for (let i = 0; i < n; i++) { const N = r[1][i], G = r[3][i]; if (N > 0 && G != null) { sg[i] += G; sn[i] += N; k[i]++; } }
  }
  for (let i = 0; i < n; i++) if (k[i] > 0) { const g = sg[i] / k[i], N = sn[i] / k[i]; ratios.push(g / N); per.push({ seed: D.seed, name: D.names[i], G: +g.toFixed(3), N: +N.toFixed(1), r: +(g / N).toFixed(5) }); }
}
ratios.sort((a, b) => a - b);
const q = (p) => ratios[Math.min(ratios.length - 1, Math.floor((ratios.length - 1) * p))];
const out = { n: ratios.length, files: files.length, q25: +q(0.25).toFixed(5), q50: +q(0.5).toFixed(5), q75: +q(0.75).toFixed(5), min: +ratios[0].toFixed(5), max: +ratios[ratios.length - 1].toFixed(5) };
console.log(JSON.stringify(out));
const j = A.indexOf('--json'); if (j >= 0) fs.writeFileSync(A[j + 1], JSON.stringify(Object.assign({}, out, { villages: per }), null, 1));
