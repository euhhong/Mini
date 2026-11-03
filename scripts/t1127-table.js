#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1127 표 기계 · 관찰기 판 JSON 만 읽는다 · 세계 안 만짐 · 판정 0)
// === scripts/t1127-table.js — 식량 빚 켬 기본 · 보호막 걷기(T1127): 켬 ↔ 끔(`=0`) 셈 · 첫 90날 마을 표 ===
//   node scripts/t1127-table.js --srv <켬 판 자리>,<끔 판 자리> --lab <켬>,<끔> --j90 <켬>,<끔> [--json <파일>]
//     --srv : 서버 기준선 자(`server-baseline-check.js` · 그 판 자리 `sbc-<시드>.json` + `sbc-<시드>.t1074.json`(관찰기 `t1074-observe`))
//     --lab : 랩 t17 800날 `t17-<시드>.json` + `t17-<시드>.t1074.json`
//     --j90 : 서버 판 자(운영 꼴) 120날 `base-<시드>.t1074.json` + `base-<시드>.t1141.json`(T1141 관찰기 — 수입 · 사건 · 곳간 환산)
//     --judge : 서버 판 자(운영 꼴) 800날 `base-<시드>.t1074.json` + `base-<시드>.json`(판 자 줄 — 해체 수)
//   셈: 첫해 굶어 죽음 = 날 < 365 그날 죽음 합 · 2 ~ 3년째 = 날 ≥ 365 · 빈 마을 = 끝 날 인구 0(한 번이라도 사람이 있었다) ·
//       해체 = 서버 판 JSON `dissolved` · 빚 14일 넘은 마을 = 한 번이라도 `starving`(빚 > `FD_DEATH_DAYS` 14 인 사람 수) > 0
//   첫 90날 표: 90날 안 빚 최대(사람 빚 최대)가 큰 마을 — 까닭 칸은 그 마을의 수(첫날 → 90날 인구 · 곳간 환산 · 90날 안 식량 수입 · 그 마을 캐러밴이 습격당한 수)
//     갈래 글(새 수 0 — 셋 중 먼저 맞는 것): 습격 ≥ 1 → "습격" · 90날 수입 0 → "교역 없음" · 인구가 늘고 곳간 환산이 줄었다 → "인구가 곳간보다 빨리 큼" · 그 밖 "곳간이 줄었다"
const fs = require('fs');
const path = require('path');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SEEDS = [1020, 7, 42];
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const f0 = (x) => (x == null ? '—' : Math.round(x).toLocaleString('en-US'));
const out = { srv: {}, lab: {}, j90: {} };

function deb(o) {   // t1074 관찰기 판 하나 → 셈
  const C = o.cols, iP = C.indexOf('pop'), iD = C.indexOf('deathsToday'), iS = C.indexOf('starving');
  const r = { y1: 0, y23: 0, empty: 0, starveV: 0, firstCross: [], popEnd: 0 };
  const had = new Array(o.names.length).fill(false), cross = new Array(o.names.length).fill(null);
  let last = null;
  for (const [day, vs] of o.rows) {
    vs.forEach((x, i) => { if (!x) return; if (day < 365) r.y1 += x[iD]; else r.y23 += x[iD]; if (x[iP] > 0) had[i] = true; if (x[iS] > 0 && cross[i] == null) cross[i] = day; });
    last = vs;
  }
  last.forEach((x, i) => { r.popEnd += x[iP]; if (had[i] && x[iP] === 0) r.empty++; });
  cross.forEach((d, i) => { if (d != null) { r.starveV++; r.firstCross.push([o.names[i], d]); } });
  r.firstCross.sort((a, b) => a[1] - b[1]);
  return r;
}
function side(kind, dir, file, jsonFile) {
  const r = { per: {}, sum: { y1: 0, y23: 0, empty: 0, starveV: 0, popEnd: 0, dissolved: 0 }, days: null };
  for (const s of SEEDS) {
    const o = J(path.join(dir, file(s))); if (!o) continue;
    const d = deb(o); r.days = o.rows.length;
    const j = jsonFile ? J(path.join(dir, jsonFile(s))) : null;
    d.dissolved = j && j.dissolved != null ? +j.dissolved : (kind === 'lab' ? 0 : null);
    r.per[s] = d; for (const k of Object.keys(r.sum)) r.sum[k] += d[k] || 0;
  }
  return r;
}
const srv = arg('--srv'), lab = arg('--lab'), j90 = arg('--j90'), judge = arg('--judge');
if (judge) { const [a, b] = judge.split(','); out.judge = { on: side('srv', a, (s) => `base-${s}.t1074.json`, (s) => `base-${s}.json`), off: side('srv', b, (s) => `base-${s}.t1074.json`, (s) => `base-${s}.json`) }; }
if (srv) { const [a, b] = srv.split(','); out.srv.on = side('srv', a, (s) => `sbc-${s}.t1074.json`, (s) => `sbc-${s}.json`); out.srv.off = side('srv', b, (s) => `sbc-${s}.t1074.json`, (s) => `sbc-${s}.json`); }
if (lab) { const [a, b] = lab.split(','); out.lab.on = side('lab', a, (s) => `t17-${s}.t1074.json`); out.lab.off = side('lab', b, (s) => `t17-${s}.t1074.json`); }
const NAME = { on: '켬(T1127 기본 — 식량 빚 · 보호막 걷음)', off: '끔(`T1074_FOOD_DEBT=0 T858_NO_SHIELD=0` = 종전)' };
for (const [k, lbl] of [['judge', '서버 판 자 운영 꼴(800날 · 3시드 · 캐러밴 · 집 행위 · 도적)'], ['srv', '서버 기준선 자(400날 · 3시드)'], ['lab', '랩 t17(800날 · 3시드)']]) {
  if (!out[k] || !out[k].on) continue;
  console.log(`\n${lbl}`);
  console.log('| 갈래 | 끝 인구(1020 · 7 · 42 · 합) | 첫해 굶어 죽음 | 365날 뒤 굶어 죽음 | 빈 마을 | 해체 | 빚 14일 넘은 마을(시드 합) | 가장 이른 빚 14일(시드 · 마을 · 날) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---|');
  for (const a of ['on', 'off']) {
    const r = out[k][a]; if (!r) continue;
    const pops = SEEDS.map((s) => (r.per[s] ? f0(r.per[s].popEnd) : '—')).join(' · ');
    const early = SEEDS.flatMap((s) => (r.per[s] ? r.per[s].firstCross.slice(0, 2).map(([n, d]) => `${s} ${n} ${d}`) : [])).join(' / ') || '—';
    console.log(`| ${NAME[a]} | ${pops} · ${f0(r.sum.popEnd)} | ${f0(r.sum.y1)} | ${f0(r.sum.y23)} | ${r.sum.empty} | ${r.sum.dissolved == null ? '—' : r.sum.dissolved} | ${r.sum.starveV} | ${early} |`);
  }
}
if (j90) {
  const [a, b] = j90.split(',');
  for (const [arm, dir] of [['on', a], ['off', b]]) {
    const rows = [];
    for (const s of SEEDS) {
      const t = J(path.join(dir, `base-${s}.t1074.json`)), o = J(path.join(dir, `base-${s}.t1141.json`)); if (!t || !o) continue;
      const C = t.cols, iM = C.indexOf('debtMax'), iS = C.indexOf('starving'), iP = C.indexOf('pop');
      const OC = Object.fromEntries(o.cols.map((c, i) => [c, i]));
      const raid = {}; for (const e of (o.ev || [])) if (e[2] === 'CARAVAN_RAIDED' && e[0] < 90) raid[e[1]] = (raid[e[1]] || 0) + 1;
      const o0 = o.rows.find((r) => r[0] >= 1) || o.rows[0], o90 = o.rows.filter((r) => r[0] < 90).pop();
      t.names.forEach((nm, i) => {
        let mx = 0, mxd = null, st = 0;
        for (const [d, vs] of t.rows) { if (d >= 90) break; const x = vs[i]; if (!x) continue; if (x[iM] > mx) { mx = x[iM]; mxd = d; } if (x[iS] > st) st = x[iS]; }
        const oi = o.names.indexOf(nm); if (oi < 0 || !(mx > 0)) return;
        const p0 = o0[1][oi][OC.pop], p90 = o90[1][oi][OC.pop], t0 = o0[1][oi][OC.tfe], t90 = o90[1][oi][OC.tfe], imp = o90[1][oi][OC.imp] - o0[1][oi][OC.imp], rd = raid[oi] || 0;
        const why = rd >= 1 ? '습격' : !(imp > 0) ? '교역 없음' : (p90 > p0 && t90 < t0) ? '인구가 곳간보다 빨리 큼' : '곳간이 줄었다';
        rows.push({ seed: s, v: nm, debtMax90: +mx.toFixed(2), day: mxd, starving90: st, pop0: p0, pop90: p90, tfe0: Math.round(t0), tfe90: Math.round(t90), imp90: Math.round(imp), raids90: rd, why });
      });
    }
    rows.sort((x, y) => y.debtMax90 - x.debtMax90);
    out.j90[arm] = rows;
  }
  console.log('\n첫 90날 — 빚이 가장 큰 마을(서버 판 자 운영 꼴 · 3시드 · 켬 · 앞 15) — 빚 14일을 넘은 마을: 켬 ' + out.j90.on.filter((r) => r.starving90 > 0).length + ' · 끔 ' + (out.j90.off ? out.j90.off.filter((r) => r.starving90 > 0).length : '—'));
  console.log('| 시드 | 마을 | 90날 안 사람 빚 최대(날) | 빚 > 14 사람 | 인구 첫날 → 90날 | 곳간 환산 첫날 → 90날 | 90날 안 식량 수입 | 습격당한 캐러밴 | 까닭(갈래 글) |');
  console.log('|---:|---|---|---:|---|---|---:|---:|---|');
  for (const r of out.j90.on.slice(0, 15)) console.log(`| ${r.seed} | ${r.v} | ${r.debtMax90}(${r.day}) | ${r.starving90} | ${r.pop0} → ${r.pop90} | ${f0(r.tfe0)} → ${f0(r.tfe90)} | ${f0(r.imp90)} | ${r.raids90} | ${r.why} |`);
}
const jo = arg('--json'); if (jo) fs.writeFileSync(jo, JSON.stringify(out, null, 1));
