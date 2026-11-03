#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1138 표 기계 · 제품 무변)
// === scripts/t1138-an.js — `scripts/t1138-probe.js` 판 JSON 끔 ↔ 켬 표 ==========
//   node scripts/t1138-an.js <끔 견줌.json> <켬 견줌.json> [<끔 틱.json> <켬 틱.json>] [--json out.json]   (견줌 판 자리에 '-' = 건너뜀)
//   견줌 판(T1138_CMP 켬): 칸 A* · 기다림 줄 — 꼴 · 길이 비 · 도착 · 못 가던 몸
//   틱 판(T1138_CMP=0): 부팅(존 모듈 평가)부터 4분 · SIGHUP(관측자 + 10초 — T756 이 센 창)부터 4분 — 틱 본문 최대 · 1초 타이머 늦음 최대
'use strict';
const fs = require('fs');
const args = process.argv.slice(2).filter((a, i, A) => a !== '--json' && A[i - 1] !== '--json');
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const r3 = (v) => (v == null ? null : +(+v).toFixed(3));
const W4 = 240000;
function cmp(f) {
  const D = rd(f), rows = D.rows || [], hup = D.hupAt || 0;
  const by = (k) => rows.filter((r) => r.kind === k);
  const A = rows.filter((r) => r.kind === 'astar' || r.kind === 'astar2'), Wt = by('wait');
  const cat = (L) => { const o = { both: 0, aOnly: 0, gOnly: 0, none: 0, gUnknown: 0 }; for (const r of L) o[r.cat] = (o[r.cat] || 0) + 1; return o; };
  const both = rows.filter((r) => r.cat === 'both' && r.la > 0);
  const ratio = both.map((r) => r.lg / r.la), dpx = both.map((r) => r.lg - r.la);
  const arrA = rows.filter((r) => r.end === 'arrived' && r.la > 0 && r.dt > 0);
  const v = q(arrA.map((r) => r.la / (r.dt / 1000)), 0.5);   // px/s — 그 판 몸이 그 길을 실제로 걸은 빠르기 p50
  const est = both.map((r) => (r.lg - r.la) / (v || 64) + (r.kind === 'wait' ? (r.got != null ? r.got / 1000 : (r.dt || 0) / 1000) : 0));
  const stuck = rows.filter((r) => r.cat === 'gOnly').map((r) => ({ kind: r.kind, at: +(r.at / 1000).toFixed(0), job: r.job, act: r.act, direct: r.direct, lg: r.lg, end: r.end, dt: r.dt, rem: r.rem, got: r.got }));
  const ends = (L) => { const o = {}; for (const r of L) o[r.end] = (o[r.end] || 0) + 1; return o; };
  const jobs = {}; for (const r of rows) { const k = (r.job || '?') + '/' + (r.act || '?'); jobs[k] = (jobs[k] || 0) + 1; }
  const got = Wt.map((r) => r.got).filter((x) => x != null);
  return {
    arm: D.arm, rows: rows.length, hupS: +(hup / 1000).toFixed(0),
    astar: A.length, astar4: A.filter((r) => r.at <= W4).length, astarHup4: A.filter((r) => r.at >= hup && r.at <= hup + W4).length, astarAfterHup: A.filter((r) => r.at >= hup).length,
    wait: Wt.length, wait4: Wt.filter((r) => r.at <= W4).length, waitAfter4: Wt.filter((r) => r.at > W4).length,
    catAstar: cat(A), catWait: cat(Wt),
    aMsP50: q(A.map((r) => r.aMs), 0.5), aMsMax: A.length ? Math.max(...A.map((r) => r.aMs)) : null,
    ratio: { n: ratio.length, p10: r3(q(ratio, 0.1)), p50: r3(q(ratio, 0.5)), p90: r3(q(ratio, 0.9)), max: r3(ratio.length ? Math.max(...ratio) : null), same1px: dpx.filter((d) => Math.abs(d) <= 1).length },
    dpx: { min: dpx.length ? +Math.min(...dpx).toFixed(0) : null, p50: q(dpx, 0.5) == null ? null : +q(dpx, 0.5).toFixed(0), max: dpx.length ? +Math.max(...dpx).toFixed(0) : null },
    speedP50: v == null ? null : +v.toFixed(1),
    estArrS: { p10: r3(q(est, 0.1)), p50: r3(q(est, 0.5)), p90: r3(q(est, 0.9)), min: r3(est.length ? Math.min(...est) : null), max: r3(est.length ? Math.max(...est) : null), sum: r3(est.reduce((a, b) => a + b, 0)) },
    endsAstar: ends(A), endsWait: ends(Wt),
    arrivedDtP50: q(rows.filter((r) => r.end === 'arrived').map((r) => r.dt), 0.5),
    gotMs: { n: got.length, of: Wt.length, p50: q(got, 0.5), p90: q(got, 0.9), max: got.length ? Math.max(...got) : null },
    stuck, jobs: Object.entries(jobs).sort((a, b) => b[1] - a[1]).slice(0, 10),
    t1138: D.t1138 || null, gates: D.gates ? { recs: D.gates.recs, built: D.gates.built, rebuilt: D.gates.rebuilt, evicted: D.gates.evicted, queries: D.gates.queries, unknown: D.gates.unknown, found: D.gates.found } : null,
  };
}
function ticks(f) {
  const D = rd(f), T = D.ticks || [], hup = (D.hupAt || 0) / 1000;
  const win = (a, b) => { const L = T.filter((x) => x[0] > a && x[0] <= b); return { maxMs: L.length ? Math.max(...L.map((x) => x[1])) : null, p99s: q(L.map((x) => x[1]), 0.99), lateMax: L.length ? Math.max(...L.map((x) => x[3])) : null, ticks: L.reduce((s, x) => s + x[2], 0), secs: L.length,
    over30s: L.filter((x) => x[1] > 30).length }; };
  const first = T.find((x) => x[2] > 0);
  return { arm: D.arm, hupS: +hup.toFixed(0), firstTickS: first ? first[0] : null, boot4: win(0, 240), hup4: win(hup, hup + 240), after: win(hup + 240, 1e9), t1138: D.t1138 || null };
}
const out = {};
if (args[0] && args[0] !== '-') out.off = cmp(args[0]);
if (args[1] && args[1] !== '-') out.on = cmp(args[1]);
if (args[2]) out.tOff = ticks(args[2]);
if (args[3]) out.tOn = ticks(args[3]);
console.log(JSON.stringify(out, null, 1));
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(out, null, 1));
