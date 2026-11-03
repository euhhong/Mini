#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1117 표 기계 · 판 JSON 만 읽는다 · 세계 안 만짐 · 판정 0)
// === scripts/t1117-table.js — 식량 빚(T1074) 끔 ↔ 옛 상수(`T1117_FD_EVID=0`) ↔ 고증 상수(켬 기본) 표 ===
//   node scripts/t1117-table.js <뿌리> [--json <파일>]
//     판 자: <뿌리>/old/run-<판>-<off|on>(끔 · 옛 상수) · <뿌리>/new/run-<판>-on(고증 상수) — 판 = on · raid1 · raid2 · raid3 · 시드 1020 · 7 · 42 · 800날
//            셈은 `scripts/t1074-table.js` 그대로(그 표 기계를 불러 JSON 을 읽는다 · 사본 0) — 띠 = 판 넷의 최소 ~ 최대
//     랩 t17: <뿌리>/lab/<off|old|new>/t17-<시드>.json(+ .t1074.json) · 800날
//     서버 기준선 자: <뿌리>/base/<off|old|new>/log.txt(`server-baseline-check.js` 출력 — 같음 · 다름 줄과 인구)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = process.argv[2];
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const SEEDS = [1020, 7, 42], BANDS = ['on', 'raid1', 'raid2', 'raid3'];
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const tbl = (root) => { const tmp = path.join(root, '_t1074.json'); execFileSync(process.execPath, [path.join(__dirname, 't1074-table.js'), root, '--json', tmp], { encoding: 'utf8', maxBuffer: 1 << 26 }); return J(tmp); };
const out = { judge: {}, lab: {}, base: {} };
const A = tbl(path.join(ROOT, 'old')), B = tbl(path.join(ROOT, 'new'));
const KEYS = ['fam365', 'fd365', 'famAll', 'fdAll', 'empty', 'dissolved', 'pop400', 'popEnd'];
for (const [arm, src, side] of [['off', A, 'off'], ['old', A, 'on'], ['new', B, 'on']]) {
  const rs = BANDS.map((b) => src && src.runs[`${b}-${side}`]).filter(Boolean);
  const o = { n: rs.length, base: rs[0] || null, band: {} };
  for (const k of KEYS) { const v = rs.map((r) => r[k]).filter((x) => x != null); o.band[k] = v.length ? [Math.min(...v), Math.max(...v)] : null; }
  o.pins = rs.map((r) => r.q2 ? r.q2.pins : null); o.wipes = rs.map((r) => r.q2 ? r.q2.wipes : null);
  out.judge[arm] = o;
}
for (const arm of ['off', 'old', 'new']) {
  const o = { seeds: 0, pop: [], dead: 0, empty: 0, fam365: 0, fd: 0 };
  for (const s of SEEDS) {
    const t = J(path.join(ROOT, 'lab', arm, `t17-${s}.json`)); if (!t) continue; o.seeds++;
    o.pop.push(t.base.pop); o.dead += t.base.dead || 0; o.empty += (t.vpop || []).filter((v) => v.pop === 0).length;
    const ob = J(path.join(ROOT, 'lab', arm, `t17-${s}.t1074.json`));
    if (ob) { const iD = ob.cols.indexOf('deathsToday'), iF = ob.cols.indexOf('fdDead'); let last = null; for (const [d, vs] of ob.rows) { if (d < 365) for (const x of vs) o.fam365 += x[iD]; last = vs; } if (last) o.fd += last.reduce((a, x) => a + x[iF], 0); }
  }
  out.lab[arm] = o;
}
for (const arm of ['off', 'old', 'new']) {
  const f = path.join(ROOT, 'base', arm, 'log.txt'); if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, 'utf8');
  out.base[arm] = { lines: txt.split('\n').filter((l) => /같음|다름|인구|PASS|FAIL/.test(l)).slice(-12) };
}
const f0 = (x) => (x == null ? '—' : Math.round(x).toLocaleString('en-US'));
const bd = (b) => (b ? (b[0] === b[1] ? f0(b[0]) : `${f0(b[0])} ~ ${f0(b[1])}`) : '—');
const NAME = { off: '끔(T1074 끔 = 지금 기본)', old: '옛 상수(T1074 켬 · `T1117_FD_EVID=0`)', new: '고증 상수(T1074 켬 · T1117 기본)' };
console.log('① 서버 판 자 800날 — 판 기본 값 · 띠(판 넷 = 기본 · raid:1 · 2 · 3) · 3시드 합');
console.log('| 갈래 | 첫해 굶어 죽음 | 그 가운데 빚 죽음 | 800날 굶어 죽음 | 빚 죽음(800날) | 빈 마을 | 해체 | 400날 인구 | 800날 인구 | 문 2 묶임 · 몰사(판 넷) |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [arm, o] of Object.entries(out.judge)) {
  const b = o.base || {}, c = (k) => `${f0(b[k])}(띠 ${bd(o.band[k])})`;
  console.log(`| ${NAME[arm]} | ${c('fam365')} | ${c('fd365')} | ${c('famAll')} | ${c('fdAll')} | ${c('empty')} | ${c('dissolved')} | ${c('pop400')} | ${c('popEnd')} | ${o.pins.join('·')} · ${o.wipes.join('·')} |`);
}
console.log('\n② 랩 t17 800날 · 3시드');
console.log('| 갈래 | 인구(1020 · 7 · 42 · 합) | 소멸 | 빈 마을 | 첫해 굶어 죽음 | 빚 죽음(800날) |');
console.log('|---|---|---|---|---|---|');
for (const [arm, o] of Object.entries(out.lab)) console.log(`| ${NAME[arm]} | ${o.pop.map(f0).join(' · ')} · ${f0(o.pop.reduce((a, x) => a + x, 0))} | ${o.dead} | ${o.empty} | ${f0(o.fam365)} | ${f0(o.fd)} |`);
console.log('\n③ 서버 기준선 자(`서버기준선_2026-11-03` · 400날 · 3시드) — 출력 끝 줄');
for (const [arm, o] of Object.entries(out.base)) { console.log(`  ${NAME[arm]}:`); for (const l of o.lines) console.log('    ' + l.trim()); }
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(out, null, 1));
