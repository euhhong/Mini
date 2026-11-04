#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1143 표 기계 · 관찰기 판 JSON 만 읽는다 · 세계 안 만짐 · 판정 0)
// === scripts/t1143-table.js — NPC 마을 해체 없음(T1143): 해체 · 빈 마을 · 겨울 골짜기 · 굶어 죽음 ===
//   node scripts/t1143-table.js <갈래>=<판 자리>,… [--json <파일>]
//     판 자리: `t577-server-run.js` 판(`base-<시드>.json` 판 자 줄 · `base-<시드>.t1141.json`(T1141 관찰기) · `base-<시드>.t1074.json`)
//   셈(3시드 합 · 새 수 0):
//     해체 = 판 자 줄 `dissolved` · 빈 마을 = 한 번이라도 사람이 있었고 끝 날 0 · 한 번이라도 빈 마을 = 인구가 0 이 된 날이 있었다
//     같은 꼴 = 비옥도 < 0.5 · 나무 · 사냥감 · 돌 · 광석 모두 < 1.0(T1141 · 카드 "특산 없음")
//     겨울 골짜기 깊이 = 해(3월 ~ 이듬해 2월 · 정본 달력 `server/calendar.js`)마다 겨울 최저 인구 ÷ 그 해 가을 최고 인구(같은 꼴 마을 · 마을-해마다 · 가을 최고 0 은 뺀다)
//     굶어 죽음 = t1074 관찰기 그날 죽음(첫해 = 날 < 365)
const fs = require('fs');
const path = require('path');
const Cal = require(path.join(__dirname, '..', 'server', 'calendar'));
const SEEDS = [1020, 7, 42];
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const f0 = (x) => (x == null ? '—' : Math.round(x).toLocaleString('en-US'));
const same = (L) => L && L.fertility < 0.5 && L.wood < 1 && L.game < 1 && L.stone < 1 && L.ore < 1;
const args = process.argv.slice(2).filter((a) => a.includes('=') && !a.startsWith('--'));
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const out = { arms: {} };
const cycleOf = (day) => { const d = Cal.dateOf(day); return d.month >= 3 ? d.year : d.year - 1; };
for (const a of args) {
  const [arm, dir] = a.split('=');
  const R = { seeds: 0, dissolved: 0, empty: 0, everEmpty: 0, emptyList: [], y1: 0, later: 0, popEnd: 0, valleys: [], perV: {} };
  for (const s of SEEDS) {
    const o = J(path.join(dir, `base-${s}.t1141.json`)), t = J(path.join(dir, `base-${s}.t1074.json`)), b = J(path.join(dir, `base-${s}.json`));
    if (!o || !t) continue; R.seeds++;
    const C = Object.fromEntries(o.cols.map((c, i) => [c, i])), n = o.names.length;
    if (b && b.dissolved != null) R.dissolved += +b.dissolved;
    const had = new Array(n).fill(false), ever0 = new Array(n).fill(false);
    const cyc = o.names.map(() => ({}));
    for (const [day, row] of o.rows) {
      const se = Cal.seasonOf(day), k = cycleOf(day);
      row.forEach((x, i) => {
        if (!x) return; const p = x[C.pop];
        if (p > 0) had[i] = true; else if (had[i]) ever0[i] = true;
        const c = cyc[i][k] || (cyc[i][k] = { aMax: null, wMin: null });
        if (se === 'autumn') c.aMax = c.aMax == null ? p : Math.max(c.aMax, p);
        if (se === 'winter') c.wMin = c.wMin == null ? p : Math.min(c.wMin, p);
      });
    }
    const last = o.rows[o.rows.length - 1][1];
    last.forEach((x, i) => {
      R.popEnd += x[C.pop];
      if (had[i] && x[C.pop] === 0) { R.empty++; R.emptyList.push(`${s}:${o.names[i]}`); }
      if (ever0[i]) R.everEmpty++;
      R.perV[`${s}:${o.names[i]}`] = { pop: x[C.pop], same: same(o.land[i]) ? 1 : 0, dead: x[C.dead] };
      if (same(o.land[i])) for (const [k, c] of Object.entries(cyc[i])) if (c.aMax > 0 && c.wMin != null) R.valleys.push({ seed: s, v: o.names[i], cycle: +k, aMax: c.aMax, wMin: c.wMin, depth: c.wMin / c.aMax });
    });
    const iD = t.cols.indexOf('deathsToday');
    for (const [day, vs] of t.rows) for (const x of vs) { if (!x) continue; if (day < 365) R.y1 += x[iD]; else R.later += x[iD]; }
  }
  const ds = R.valleys.map((v) => v.depth).sort((x, y) => x - y);
  R.valley = ds.length ? { n: ds.length, min: ds[0], median: ds[Math.floor(ds.length / 2)], mean: ds.reduce((x, y) => x + y, 0) / ds.length, below50: ds.filter((d) => d < 0.5).length } : null;
  out.arms[arm] = R;
}
console.log('| 갈래 | 시드 | 해체 | 빈 마을(끝) | 한 번이라도 빈 마을 | 첫해 굶어 죽음 | 365날 뒤 굶어 죽음 | 끝 인구 | 같은 꼴 겨울 골짜기 깊이(겨울 최저 ÷ 가을 최고 · 마을-해 · 최저 · 가운데 · 평균 · 0.5 밑) |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---|');
for (const [arm, R] of Object.entries(out.arms)) {
  const V = R.valley;
  console.log(`| ${arm} | ${R.seeds} | ${R.dissolved} | ${R.empty}${R.emptyList.length ? ' (' + R.emptyList.join(' · ') + ')' : ''} | ${R.everEmpty} | ${f0(R.y1)} | ${f0(R.later)} | ${f0(R.popEnd)} | ${V ? `${V.n} · ${V.min.toFixed(2)} · ${V.median.toFixed(2)} · ${V.mean.toFixed(2)} · ${V.below50}` : '—'} |`);
}
for (const [arm, R] of Object.entries(out.arms)) {
  const worst = R.valleys.slice().sort((x, y) => x.depth - y.depth).slice(0, 5);
  if (worst.length) console.log(`\n${arm} 골짜기 깊은 차례 5: ` + worst.map((v) => `${v.seed} ${v.v} ${v.cycle}해 ${v.aMax} → ${v.wMin}(${v.depth.toFixed(2)})`).join(' / '));
}
if (JOUT) { for (const R of Object.values(out.arms)) delete R.perV; fs.writeFileSync(JOUT, JSON.stringify(out, null, 1)); }
