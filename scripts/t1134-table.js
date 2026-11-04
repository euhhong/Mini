#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1134 판 표 · 판정 0)
// === scripts/t1134-table.js — 끈 판 · c 세 값 판을 격차 자 대조 판 자료로 나란히 ======================================
//   node scripts/t1134-table.js <뿌리>   (뿌리/c/<판>/base/gap-base-<시드>.gap.json · 판 = off · c25 · c50 · c75)
//   칸: 끝 총인구 · 빈 마을(끝) · 해체(누계) · 죽음 누계(`_deadTot`) · h 중앙(끝 날) · h < 0.5 마을 · 이탈(`_emigTot` 합) · 출정 거부 ·
//       마을 크기 분포(끝 인구 25 · 50 · 75% · 최대) · 부 ↔ 크기(마을 판 평균 '좋은 것' 과 끝 인구의 순위 상관 · 끈 판은 행복 = 좋은 것)
//   "켬 조건" 칸 = 인구 · 빈 마을 · 해체가 끈 판보다 같거나 적은가(카드 게이트 3 · 인구는 '같거나 많다'가 아니라 카드 글자 그대로 셋 다 '같거나 적다' 로 적고 따로 표기).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const CFG = ['off', 'c25', 'c50', 'c75'], SEEDS = ['1020', '7', '42'];
const load = (c, s) => { const f = path.join(ROOT, 'c', c, 'base', `gap-base-${s}.gap.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const rank = (a) => { const ix = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); ix.forEach(([, i], k) => { r[i] = k; }); return r; };
const spear = (a, b) => { const ra = rank(a), rb = rank(b), n = a.length, ma = (n - 1) / 2; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (ra[i] - ma) * (rb[i] - ma); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - ma) ** 2; } return sab / Math.sqrt(saa * sbb); };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))]; };
function row(D) {
  const L = D.rows[D.rows.length - 1], n = D.names.length;
  const pop = L[1].reduce((x, y) => x + y, 0);
  const hs = L[3].filter((x, i) => x != null && L[1][i] > 0);
  const ever = new Array(n).fill(false), bdt = new Set();
  for (const r of D.rows) { r[1].forEach((p, i) => { if (p > 0) ever[i] = true; }); r[4].forEach((b, i) => { if (b) bdt.add(i); }); }
  const empty = L[1].filter((p, i) => p === 0 && ever[i]).length;
  // 부 = 판 평균 좋은 것(100날 뒤 · 사람 있는 날) — 켬 판은 6째 칸 · 끈 판은 행복 칸
  const sg = new Array(n).fill(0), k = new Array(n).fill(0);
  for (const r of D.rows) { if (r[0] < 100) continue; for (let i = 0; i < n; i++) { const g = (r[5] && r[5][i] != null) ? r[5][i] : r[3][i]; if (r[1][i] > 0 && g != null) { sg[i] += g; k[i]++; } } }
  const ix = [...Array(n).keys()].filter((i) => k[i] > 0);
  const rho = spear(ix.map((i) => sg[i] / k[i]), ix.map((i) => L[1][i]));
  const live = L[1].filter((p) => p > 0);
  return { pop, empty, diss: bdt.size, dead: D.end ? D.end.dead.reduce((x, y) => x + y, 0) : null, hMed: hs.length ? +q(hs, 0.5).toFixed(3) : null,
    low: hs.filter((x) => x < 0.5).length, emig: D.end ? D.end.emig.reduce((x, y) => x + y, 0) : null, refuse: D.end ? D.end.refuseMuster : null,
    size: [q(live, 0.25), q(live, 0.5), q(live, 0.75), Math.max(...live)], rho: +rho.toFixed(3) };
}
const R = {};
for (const c of CFG) for (const s of SEEDS) { const D = load(c, s); if (D) (R[c] = R[c] || {})[s] = row(D); }
console.log('| 판 | 시드 | 끝 총인구 | 빈 마을 | 해체 | 죽음 누계 | h 중앙 | h < 0.5 마을 | 이탈 | 출정 거부 | 마을 크기 25 · 50 · 75% · 최대 | 부 ↔ 크기 순위 상관 |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|');
for (const c of CFG) for (const s of SEEDS) { const r = R[c] && R[c][s]; if (!r) continue;
  console.log(`| ${c} | ${s} | ${r.pop} | ${r.empty} | ${r.diss} | ${r.dead} | ${r.hMed} | ${r.low} | ${r.emig} | ${r.refuse} | ${r.size.join(' · ')} | ${r.rho} |`); }
console.log('\n| 판 | 합 총인구 | 합 빈 마을 | 합 해체 | 합 죽음 | 합 이탈 | 합 거부 | 켬 조건(빈 마을 · 해체가 끈 판보다 같거나 적다 · 시드마다) | 인구(끈 판 대비 · 시드마다) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---|---|');
const sum = (c, k) => SEEDS.reduce((a, s) => a + ((R[c] && R[c][s] && R[c][s][k]) || 0), 0);
for (const c of CFG) { if (!R[c]) continue;
  const cond = c === 'off' ? '—' : SEEDS.map((s) => (R[c][s] && R.off[s] ? ((R[c][s].empty <= R.off[s].empty && R[c][s].diss <= R.off[s].diss) ? '예' : '아니오') : '—')).join(' · ');
  const pp = c === 'off' ? '—' : SEEDS.map((s) => (R[c][s] && R.off[s] ? `${R[c][s].pop - R.off[s].pop >= 0 ? '+' : ''}${R[c][s].pop - R.off[s].pop}` : '—')).join(' · ');
  console.log(`| ${c} | ${sum(c, 'pop')} | ${sum(c, 'empty')} | ${sum(c, 'diss')} | ${sum(c, 'dead')} | ${sum(c, 'emig')} | ${sum(c, 'refuse')} | ${cond} | ${pp} |`); }
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(R, null, 1));
