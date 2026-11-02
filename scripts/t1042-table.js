#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1042 표 기계 · 판정 0)
// === scripts/t1042-table.js — 관찰기(t1031 · t1042) · 팔 기록(t1042arm) · 판 JSON 을 읽어 ① ② ③ 표 ===
//   쓰는 법: node scripts/t1042-table.js --runs <판 자리,…> [--json out.json] [--md out.md] [--upto <날>(선포 날 ≤ 그날 전쟁만 — 끊긴 판 견주기)]
//     판 자리 = `t577-server-run.js` 의 `T577_DIR` 하나(판 하나 — `<판>-<시드>.json` · `.t1031.json` · `.t1042.json` · `.dctl.json` · 팔이면 `.t1042arm.json`)
//   ① 교전 없는 철수(T1031 `withdrawQuiet` 그 식 — 교전 훅이 받았고 몸 정산 없이 철수) 마디마다 — 풀림 · 원점선 첫 막힌 칸 종류 · 방어 몸이 그 순간 어디 있었나
//   ② 판마다 — 교전 없는 철수 몫(교전 훅 있는 전쟁 중) · 전쟁 길이(선포 → 끝 날) · 사상(몸 죽음 · econ 사상 · 포로)
//   ③ 몸 정산 전쟁 — 시야 막힘 칸 종류 · 첫 접촉 자리(방어 마을 중심 거리 · 영토 반경 · 환호 고리 반경 · 둘레 발자국)
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const RUNS = String(opt('runs', '')).split(',').filter(Boolean);
const JOUT = opt('json', ''), MOUT = opt('md', '');
const UPTO = opt('upto', '') ? +opt('upto', '') : null;   // 끊긴 판(1시간 상한)과 견줄 때 — 모든 판에서 선포 날 ≤ UPTO 인 전쟁만 센다
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const sum = (a) => a.filter((x) => x != null && Number.isFinite(x)).reduce((s, x) => s + x, 0);
const r1 = (x) => x == null ? null : Math.round(x * 10) / 10;
const r3 = (x) => x == null ? null : Math.round(x * 1000) / 1000;
const inc = (o, k, n) => { o[k] = (o[k] || 0) + (n == null ? 1 : n); };
// T1031 표 기계(`t1031-table.js endKind`)와 같은 끝 꼴 식
function endKind(o) {
  const s = o.set && o.set[0];
  if (s) return s.why;
  const L = (o.logs || []).join('\n');
  if (o.hook.length && o.hook.some((h) => h.took) && !(o.seg || []).length && o.end != null) return 'noArmy';
  if (/무저항 함락/.test(L)) return 'walkover-core';
  if (/무혈 항복/.test(L)) return 'surrender';
  if (/철수/.test(L)) return o.hook.length ? 'withdrawQuiet' : 'withdraw-noeng';
  if (o.end == null) return 'open';
  return 'none';
}
// 원점선 첫 막힌 칸 → 묶음(카드 말: 건물 발자국 · 나무 · 바위 · 물 · 울타리(환호))
const KGRP = (k) => !k ? '열림' : /^R:hall/.test(k) ? '건물:큰집' : /^R:house/.test(k) ? '건물:움집' : /^R:granary/.test(k) ? '건물:곳간' : /^R:/.test(k) ? '건물:기타'
  : k === 'W' ? '나무' : k === 'T:rock' ? '바위' : k === 'T:water' ? '물' : k === 'T:ditch' ? '환호(울타리)' : k === '?' ? '?' : k;
// 방어 몸 하나가 그 순간 어디 있었나
function bodyWhere(b, warId) {
  if (b.gone) return '몸 없음(가시 몸 칸만)';
  if (b.mu) { if (b.mw && b.mw.war === warId && b.mw.side === 'B') return '이 전쟁 방어 소집'; if (b.mw && b.mw.side === 'A') return '징발 — 다른 전쟁 공격'; if (b.mw && b.mw.side === 'B') return '징발 — 다른 전쟁 방어'; return '징발(전쟁 몸 밖)'; }
  if (b.hp != null && b.hp <= 0) return '죽음';
  if (/^R:house/.test(b.cell || '')) return '집(움집 안)';
  if (/^R:granary/.test(b.cell || '')) return '곳간(발자국 안)';
  if (/^R:hall/.test(b.cell || '')) return '큰집(발자국 안)';
  if (b.task) return '일감:' + b.task;
  if (b.act) return '일터:' + b.act;
  return '마을 안 걷는 중(행위 없음)';
}
function loadRun(dir) {
  const fl = fs.readdirSync(dir);
  const pick = (re) => { const f = fl.find((x) => re.test(x)); return f ? path.join(dir, f) : null; };
  const J = (f) => f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  const main = J(pick(/^[^.]+-\d+\.json$/)), o31 = J(pick(/\.t1031\.json$/)), o42 = J(pick(/\.t1042\.json$/)), arm = J(pick(/\.t1042arm\.json$/));
  return { dir, name: path.basename(dir), main, o31, o42, arm };
}
function runRow(R) {
  const O = R.o31, Q = R.o42 || { wars: {} };
  const wars = Object.values(O.wars).filter((o) => !o.den && (UPTO == null || o.born <= UPTO)).sort((a, b) => a.id - b.id);
  const kinds = {}; for (const o of wars) inc(kinds, endKind(o));
  const hooked = wars.filter((o) => o.hook.length > 0);
  const quiet = wars.filter((o) => endKind(o) === 'withdrawQuiet');
  const fought = wars.filter((o) => o.set && o.set[0] && (o.set[0].why === 'rout' || o.set[0].why === 'withdraw'));
  const ended = wars.filter((o) => o.end != null);
  const len = ended.map((o) => o.end - o.born);
  const engLen = ended.filter((o) => o.hook.length).map((o) => o.end - o.hook[0].day);
  const res = fought.map((o) => { const s = o.set[0]; const rr = (o.res || []).find((r) => r.path === 'body') || null; return { aD: s.dead.A, bD: s.dead.B, aS: s.start.A, bS: s.start.B, w: s.winner, atkCas: rr && rr.ret ? rr.ret.atkCas : null, defCas: rr && rr.ret ? rr.ret.defCas : null, cap: rr && rr.cap ? rr.cap.take : 0 }; });
  const segQ = quiet.flatMap((o) => (Q.wars[o.id] ? Q.wars[o.id].seg : []).map((g) => Object.assign({ war: o.id, atk: o.atk, def: o.def }, g)));
  const e = R.main && R.main.eight;
  return {
    name: R.name, seed: O.seed, cap: (O.knob && O.knob.VILLAGE_NPC_CAP) || '∞', arm: (R.arm && R.arm.arm) || (Q.arm) || null, skip: (O.knob && O.knob.DCTL_SKIP) || null, lastDay: O.lastDay, days: R.main ? R.main.days : null,
    errs: [O.errs, Q.errs, R.arm ? R.arm.errs : 0], armFire: R.arm ? { fire: R.arm.fire, look: R.arm.look, miss: R.arm.miss, wars: Object.keys(R.arm.byWar || {}).length } : null,
    wars: wars.length, hooked: hooked.length, quiet: quiet.length, quietShare: hooked.length ? quiet.length / hooked.length : null, kinds,
    fought: fought.length, rout: fought.filter((o) => o.set[0].why === 'rout').length, atkWin: res.length ? res.filter((x) => x.w === 'A').length / res.length : null,
    lenMed: med(len), lenMean: r1(mean(len)), lenMax: len.length ? Math.max(...len) : null, engLenMed: med(engLen), engLenMean: r1(mean(engLen)), engLenMax: engLen.length ? Math.max(...engLen) : null, open: wars.filter((o) => o.end == null).length,
    aD: sum(res.map((x) => x.aD)), bD: sum(res.map((x) => x.bD)), aS: sum(res.map((x) => x.aS)), bS: sum(res.map((x) => x.bS)), atkCas: sum(res.map((x) => x.atkCas)), defCas: sum(res.map((x) => x.defCas)), capt: sum(res.map((x) => x.cap)),
    walkover: wars.filter((o) => /walkover/.test(endKind(o))).length,
    pop: e ? e.pop : null, deadTot: R.main ? R.main.deadTot : null,
    segQ, fought31: fought.map((o) => o.id),
  };
}
// ① 마디 분류
function segClass(g) {
  const unrel = g.rel == null;
  const noDef = !g.def0 || !(g.def0.bN > 0);
  const c = g.cen || {};
  const first = c.rel && c.rel.first ? c.rel.first.k : null;
  return { unrel, noDef, relFirst: unrel ? (c.rel ? (first ? KGRP(first) : (c.rel.atProj ? '열림(투영점)' : '열림(행군 중)')) : '원점선 없음') : null, relAt: c.rel && c.rel.first ? c.rel.first.at : null, relD: c.rel ? c.rel.d : null, relT: c.rel ? c.rel.T : null,
    relKs: c.rel ? c.rel.ks : null, from: c.rel ? KGRP(c.rel.from === '.' ? null : c.rel.from) : null, to: c.rel ? KGRP(c.rel.to === '.' ? null : c.rel.to) : null,
    pairD: c.pair ? c.pair.d : null, pairLine: c.pair && c.pair.line ? KGRP(c.pair.line.first ? c.pair.line.first.k : null) : null, pairLos: c.pair ? KGRP(c.pair.los === '.' ? null : c.pair.los) : null, contacts: g.c };
}
function noDefWhy(g) {
  const d = g.def0 || {}, e = g.defEnd || d;
  const why = [];
  if (!(e.bN > 0)) {
    if (!e.defBuilt) why.push((e.dCmd != null && e.R != null && e.dCmd > e.R) ? '소집 전(공격이 경보 반경 밖)' : '소집 전');
    else if (!e.dg) why.push('소집했으나 대형 0(징발 풀 비었음)');
  } else why.push('마디 중 소집됨');
  const bw = (e.bodies || []).map((b) => bodyWhere(b, g.war));
  return { why: why.join(' · '), nb: e.nb, pop: e.pop, dCmd: e.dCmd, R: e.R, dm: e.dm, bodies: bw };
}
// 먼 몸이 선 칸이 큰집 발자국이면 어느 마을 큰집인가 — 지도 마을 자리(`server/hanbando-terrain.json` 원 좌표 ÷ 32 · 읽기만)에서
//   방어 마을 중심 ↔ 그 마을 중심 거리가 몸의 마을 중심 거리(`dV`)와 HALL_TOL 안인 마을(시딩이 중심을 몇 칸 옮길 수 있어 근사 — 보고에 적는다)
const FAR_M = 100, NEAR_M = 30, HALL_TOL = 6;
let VPOS = null;
try { VPOS = {}; for (const v of require(path.join(__dirname, '..', 'server', 'hanbando-terrain.json')).hanbando.villages) VPOS[v.name] = [v.x / 32, v.y / 32]; } catch (e) { VPOS = null; }
function hallAt(defName, dV, cell) {
  if (!VPOS || !VPOS[defName] || !/^R:hall/.test(cell || '')) return null;
  let best = null, bd = Infinity;
  for (const [n, p] of Object.entries(VPOS)) { if (n === defName) continue; const e = Math.abs(Math.hypot(p[0] - VPOS[defName][0], p[1] - VPOS[defName][1]) - dV); if (e < bd) { bd = e; best = n; } }
  return bd <= HALL_TOL ? best : null;
}
const runs = RUNS.map(loadRun).filter((R) => R.o31);
const rows = runs.map(runRow);
const out = { made: new Date().toISOString().slice(0, 10), runs: rows.map((r) => Object.assign({}, r, { segQ: undefined })), one: [], three: [] };
// ① — 판마다(팔 판 · 대조 판도 — 팔이 어느 꼴을 없앴나 보려고 · 판 이름에 팔이 있다)
for (const r of rows) {
  const segs = r.segQ.map((g) => Object.assign({ war: g.war, day: g.day, atk: g.atk, def: g.def, end: g.end }, segClass(g), { nd: noDefWhy(g) }));
  const T = { unrel: 0, noDef: 0, both: 0, neither: 0, relFirst: {}, relFrom: {}, relTo: {}, ndWhy: {}, ndBody: {}, pairLos: {}, pairLine: {}, relAt: [], relD: [], nPairD: [] };
  for (const s of segs) {
    if (s.unrel) { T.unrel++; inc(T.relFirst, s.relFirst); inc(T.relFrom, s.from); inc(T.relTo, s.to); T.relAt.push(s.relAt); T.relD.push(s.relD); }
    if (s.noDef) { T.noDef++; inc(T.ndWhy, s.nd.why); for (const b of s.nd.bodies) inc(T.ndBody, b); if (!s.nd.bodies.length) inc(T.ndBody, '가시 몸 0'); }
    if (s.unrel && s.noDef) T.both++; if (!s.unrel && !s.noDef) T.neither++;
    if (!s.unrel && !s.noDef) { inc(T.pairLos, s.pairLos); inc(T.pairLine, s.pairLine); T.nPairD.push(s.pairD); }
  }
  T.relAtMed = med(T.relAt); T.relDMed = med(T.relD); T.nPairDMed = med(T.nPairD); delete T.relAt; delete T.relD; delete T.nPairD;
  // ①' 가른 꼴(배타 · 위에서부터) — 마디 **시작 순간**(`def0` — 돌격 명령 때) 방어 몸 자리로 가른다(위 칸 `noDef` 는 시작 때 B 몸 0 · `bodies` 는 끝 때)
  const W31 = runs.find((x) => x.name === r.name).o31.wars;
  const C = {}, far = { atk: 0, other: 0, open: 0, prior: 0, n: 0, since: [] }, rows1 = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], g = r.segQ[i];
    const d0 = g.def0 || {}, bs = (d0.bodies || []).filter((b) => !b.gone);
    const farB = bs.filter((b) => b.dV != null && b.dV > FAR_M);
    const pairD = g.cen && g.cen.pair ? g.cen.pair.d : null;
    let k;
    if (s.unrel) k = '① 안 풀림(원점선 막힘)';
    else if (bs.length && farB.length === bs.length) k = '② 방어 몸 멀리(시작 때 제 마을 중심 ' + FAR_M + 'm 밖)';
    else if (!d0.defBuilt) k = '③ 방어 소집 전(공격 지휘점이 경보 반경 밖)';
    else if (pairD != null && pairD <= NEAR_M) k = '④ 두 몸 ' + NEAR_M + 'm 안인데 접촉 0';
    else k = '⑤ 그 밖(끝 때 두 몸 ' + NEAR_M + 'm 밖)';
    inc(C, k);
    const where = [];
    for (const b of farB) {
      far.n++;
      const hv = hallAt(s.def, b.dV, b.cell);
      if (hv && hv === s.atk) far.atk++; else if (hv) far.other++; else far.open++;
      const pw = hv ? Object.values(W31).filter((w) => w.atk === s.def && w.def === hv && w.born < s.day && w.end != null).sort((x, y) => y.end - x.end)[0] : null;
      const pr = !!pw; if (pr) { far.prior++; far.since.push(s.day - pw.end); }
      where.push({ dV: b.dV, cell: b.cell, hall: hv, priorAtk: pr, priorWar: pw ? pw.id : null, since: pw ? s.day - pw.end : null, mu: b.mu ? 1 : 0, job: b.job });
    }
    rows1.push({ war: s.war, day: s.day, atk: s.atk, def: s.def, k, pairD, dCmd: d0.dCmd, R: d0.R, dm: d0.dm, dur: g.tEnd != null && g.t0 != null ? r1(g.tEnd - g.t0) : null, rel: g.rel, far: where, near: bs.filter((b) => !(b.dV > FAR_M)).map((b) => ({ dV: b.dV, cell: b.cell, mu: b.mu ? 1 : 0 })) });
  }
  far.sinceMed = med(far.since); far.sinceMin = far.since.length ? Math.min(...far.since) : null; far.sinceMax = far.since.length ? Math.max(...far.since) : null;
  out.one.push({ name: r.name, seed: r.seed, cap: r.cap, quiet: r.quiet, hooked: r.hooked, segs: segs.length, T, cls: C, far, segs_: segs, rows1 });
}
// ③ — 팔 없는 판 · 몸 정산 전쟁
for (const R of runs) {
  const r = rows.find((x) => x.name === R.name); if (r.arm) continue;   // 대조 판(`raid:n`)은 넣는다 — 같은 세계 꼴의 띠
  const Q = R.o42 || { wars: {} };
  const L = {}; let losN = 0, losIn = 0, los31 = 0, losB31 = 0;
  const fc = [];
  for (const id of r.fought31) {
    const q = Q.wars[id], o = R.o31.wars[id]; if (!q) continue;
    for (const [k, n] of Object.entries(q.los || {})) inc(L, KGRP(k === '.' ? null : k), n);
    losN += q.losN || 0; losIn += q.losIn || 0;
    const s = o.set[0]; if (s && s.world) { los31 += s.world.los; losB31 += s.world.losB; }
    const g = (q.seg || []).find((x) => x.first);
    const w = s && s.world;
    if (g) fc.push({ war: id, atk: o.atk, def: o.def, dVil: g.first.dVil, rT: g.first.rT, rD: g.first.rD, own30: g.first.own30, cell: KGRP(g.first.cell === '.' ? null : g.first.cell),
      inT: g.first.dVil != null && g.first.rT != null ? g.first.dVil <= g.first.rT : null, inD: g.first.dVil != null && g.first.rD != null ? g.first.dVil <= g.first.rD : null,
      losShare: w && w.los ? w.losB / w.los : null, los: w ? w.los : null, losB: w ? w.losB : null, aS: s.start.A, bS: s.start.B,
      top: Object.entries(q.los || {}).sort((x, y) => y[1] - x[1]).map(([k]) => KGRP(k === '.' ? null : k))[0] || null });
  }
  const inT = fc.filter((x) => x.inT), outT = fc.filter((x) => x.inT === false);
  const share = (a) => { const l = sum(a.map((x) => x.los)), b = sum(a.map((x) => x.los * (x.losShare || 0))); return l ? b / l : null; };
  out.three.push({ name: r.name, seed: r.seed, cap: r.cap, fought: r.fought, losN, losIn, los31, losB31, losShare31: los31 ? losB31 / los31 : null, kinds: L,
    first: { n: fc.length, inT: inT.length, inD: fc.filter((x) => x.inD).length, dVilMed: med(fc.map((x) => x.dVil)), rTMed: med(fc.map((x) => x.rT)), rDMed: med(fc.map((x) => x.rD)), own30Med: med(fc.map((x) => x.own30)),
      own30Zero: fc.filter((x) => x.own30 === 0).length, losShareIn: share(inT), losShareOut: share(outT), cells: fc.reduce((o, x) => (inc(o, x.cell), o), {}) },
    perWar: { top: fc.filter((x) => x.losB > 0).reduce((o, x) => (inc(o, x.top), o), {}), shareMed: med(fc.map((x) => x.losShare)), maxWarB: fc.length ? Math.max(...fc.map((x) => x.losB || 0)) : null }, fc });
}
// ② 띠 — 같은 시드 · 같은 몸 상한의 팔 없는 판(기준 판 + 대조 판 `DCTL_SKIP`)의 [최소, 최대] ↔ 팔 판 값(판정 0 — 안 · 밖만 적는다)
const AX = [['quietShare', '교전 없는 철수 몫'], ['quiet', '교전 없는 철수 수'], ['hooked', '교전 훅 전쟁'], ['lenMean', '선포→끝 날 평균'], ['lenMax', '선포→끝 날 최대'], ['engLenMean', '첫 교전→끝 날 평균'],
  ['c2', '  그중 ② 방어 몸 멀리'], ['c4', '  그중 ④ 두 몸 30m 안 접촉 0'], ['c1', '  그중 ① 안 풀림'],
  ['aDw', '몸 죽음 공 / 정산 전쟁'], ['bDw', '몸 죽음 방 / 정산 전쟁'], ['atkCas', 'econ 사상 공'], ['defCas', 'econ 사상 방'], ['capt', '포로'], ['atkWin', '공승']];
for (const r of rows) { r.aDw = r.fought ? r.aD / r.fought : null; r.bDw = r.fought ? r.bD / r.fought : null; }
for (const r of rows) { const o = out.one.find((x) => x.name === r.name); const n = (p) => o ? o.rows1.filter((q) => q.k.startsWith(p)).length : null; r.c1 = n('①'); r.c2 = n('②'); r.c4 = n('④'); }
out.band = [];
for (const key of [...new Set(rows.map((r) => r.seed + '|' + r.cap))]) {
  const G = rows.filter((r) => r.seed + '|' + r.cap === key), B = G.filter((r) => !r.arm);
  if (!B.length) continue;
  const lim = {}; for (const [k] of AX) { const v = B.map((r) => r[k]).filter((x) => x != null); lim[k] = v.length ? [Math.min(...v), Math.max(...v)] : null; }
  const arms = G.filter((r) => r.arm).map((r) => ({ name: r.name, arm: r.arm, v: Object.fromEntries(AX.map(([k]) => [k, r[k]])),
    out: Object.fromEntries(AX.map(([k]) => [k, (r[k] == null || !lim[k]) ? null : (r[k] < lim[k][0] - 1e-9 ? 'below' : r[k] > lim[k][1] + 1e-9 ? 'above' : 'in')])) }));
  out.band.push({ seed: G[0].seed, cap: G[0].cap, baseRuns: B.map((r) => r.name), lim, arms });
}
out.runs = rows.map((r) => Object.assign({}, r, { segQ: undefined }));
// ── 글 ──
const pc = (x) => x == null ? '—' : Math.round(x * 100) + '%';
const kv = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
const md = [];
md.push('## ② 판마다(교전 없는 철수 몫 · 전쟁 길이 · 사상)\n');
md.push('| 판 | 시드 | 몸 | 팔 | 대조 | 날 | 전쟁 · 교전 훅 | 교전 없는 철수(몫) | 몸 정산 · 궤주 | 공승 | 무저항 | 선포→끝 날 중앙 · 평균 · 최대 | 첫 교전→끝 날 평균 · 최대 | 끝날 진행 | 몸 죽음 공 · 방(시작) | econ 사상 공 · 방 | 포로 | 인구 | 죽음 누계 | 팔 선 수(전쟁) |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) md.push(`| ${r.name} | ${r.seed} | ${r.cap} | ${r.arm || '—'} | ${r.skip || '—'} | ${r.lastDay} | ${r.wars} · ${r.hooked} | ${r.quiet} (${pc(r.quietShare)}) | ${r.fought} · ${r.rout} | ${pc(r.atkWin)} | ${r.walkover} | ${r.lenMed} · ${r.lenMean} · ${r.lenMax} | ${r.engLenMean} · ${r.engLenMax} | ${r.open} | ${r.aD} · ${r.bD} (${r.aS} · ${r.bS}) | ${r.atkCas} · ${r.defCas} | ${r.capt} | ${r.pop} | ${r.deadTot} | ${r.armFire ? r.armFire.fire + ' (' + r.armFire.wars + ')' : '—'} |`);
md.push('\n## ① 교전 없는 철수 마디(판마다 — 팔 판은 그 팔이 바꾼 세계)\n');
md.push('| 판 | 시드 | 몸 | 교전 없는 철수 전쟁 / 교전 훅 | 마디 | 안 풀림 | 방어 몸 없음 | 둘 다 | 둘 다 아님 | 안 풀림 — 원점선 첫 막힌 칸 | 원점선 첫 막힌 칸까지 m(중앙) · 원점 거리 m(중앙) | 공격 원점 칸 · 방어 원점 칸 | 방어 몸 없음 — 까닭 | 방어 마을 가시 몸이 그 순간 있던 곳 | 둘 다 아님 — 두 몸 시야 첫 막힌 칸 · 두 몸 거리 m 중앙 |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of out.one) md.push(`| ${x.name} | ${x.seed} | ${x.cap} | ${x.quiet} / ${x.hooked} | ${x.segs} | ${x.T.unrel} | ${x.T.noDef} | ${x.T.both} | ${x.T.neither} | ${kv(x.T.relFirst)} | ${x.T.relAtMed} · ${x.T.relDMed} | ${kv(x.T.relFrom)} / ${kv(x.T.relTo)} | ${kv(x.T.ndWhy)} | ${kv(x.T.ndBody)} | ${kv(x.T.pairLos)} · ${x.T.nPairDMed} |`);
md.push(`\n### ①' 가른 꼴(배타 · 마디 시작 순간 방어 몸 자리 · 먼 몸 = 제 마을 중심 ${FAR_M}m 밖)\n`);
md.push('| 판 | 시드 | 몸 | 마디 | 가른 꼴 | 먼 몸 수 — 지금 공격 마을 큰집 안 · 다른 마을 큰집 안 · 큰집 밖 | 그 큰집 마을을 앞서 이 마을이 쳤다(이 판 전쟁) · 그 전쟁 끝 → 이 마디 날 중앙 [최소 ~ 최대] |');
md.push('|---|---|---|---|---|---|---|');
for (const x of out.one) md.push(`| ${x.name} | ${x.seed} | ${x.cap} | ${x.segs} | ${kv(x.cls)} | ${x.far.n} — ${x.far.atk} · ${x.far.other} · ${x.far.open} | ${x.far.prior} / ${x.far.atk + x.far.other} · ${x.far.sinceMed} [${x.far.sinceMin} ~ ${x.far.sinceMax}] |`);
md.push('\n## ③ 몸 정산 전쟁 — 시야 막힘 칸 · 첫 접촉 자리(팔 없는 판 · 대조 판 포함)\n');
md.push('| 판 | 시드 | 몸 | 몸 정산 전쟁 | 시야 막힘 / 물음(t1031) | 막힘 칸 종류(t1042 — 첫 막힌 칸) | 쏘는 몸이 방어 영토 안 | 첫 접촉 전쟁 | 영토 반경 안 · 환호 고리 안 | 방어 마을 중심 거리 중앙(영토 반경 · 환호 반경 중앙) | 둘레 30칸 방어 마을 발자국 중앙 · 0 인 전쟁 | 첫 접촉 칸 | 시야 막힘 몫 — 영토 안 접촉 전쟁 · 밖 |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const x of out.three) md.push(`| ${x.name} | ${x.seed} | ${x.cap} | ${x.fought} | ${x.losB31} / ${x.los31} (${pc(x.losShare31)}) | ${kv(x.kinds)} | ${x.losN ? pc(x.losIn / x.losN) : '—'} | ${x.first.n} | ${x.first.inT} · ${x.first.inD} | ${x.first.dVilMed} (${x.first.rTMed} · ${x.first.rDMed}) | ${x.first.own30Med} · ${x.first.own30Zero} | ${kv(x.first.cells)} | ${pc(x.first.losShareIn)} · ${pc(x.first.losShareOut)} |`);
md.push('\n## ② 팔 ↔ 띠(같은 시드 · 같은 몸 상한의 팔 없는 판 [최소, 최대] · 기준 판 하나면 띠 폭 0 = 판 하나)\n');
const fv = (k, v) => v == null ? '—' : (k === 'quietShare' || k === 'atkWin') ? pc(v) : String(r3(v));
for (const b of out.band) {
  md.push(`\n시드 ${b.seed} · 몸 ${b.cap} · 띠 판: ${b.baseRuns.join(' · ')}${b.baseRuns.length < 2 ? ' (⚠판 하나 — 띠 아님)' : ''}\n`);
  if (!b.arms.length) continue;
  md.push('| 축 | 띠 | ' + b.arms.map((a) => a.arm).join(' | ') + ' |'); md.push('|---|---|' + b.arms.map(() => '---|').join(''));
  for (const [k, lab] of AX) md.push(`| ${lab} | ${b.lim[k] ? fv(k, b.lim[k][0]) + ' ~ ' + fv(k, b.lim[k][1]) : '—'} | ` + b.arms.map((a) => `${fv(k, a.v[k])}${a.out[k] && a.out[k] !== 'in' ? (a.out[k] === 'above' ? ' ▲밖' : ' ▼밖') : ''}`).join(' | ') + ' |');
}
md.push('\n### ③\' 전쟁마다(물음 수가 많은 전쟁 하나가 합을 쥐지 않게) — 막힘이 있는 전쟁의 1위 첫 막힌 칸 · 전쟁마다 막힘 몫 중앙 · 가장 큰 한 전쟁의 막힌 물음 / 판 합\n');
md.push('| 판 | 몸 | 몸 정산 전쟁 | 전쟁마다 1위 첫 막힌 칸(전쟁 수) | 전쟁마다 시야 막힘 몫 중앙 | 가장 큰 한 전쟁 막힘 / 판 막힘 |');
md.push('|---|---|---|---|---|---|');
for (const x of out.three) md.push(`| ${x.name} | ${x.cap} | ${x.fought} | ${kv(x.perWar.top)} | ${pc(x.perWar.shareMed)} | ${x.perWar.maxWarB} / ${x.losB31} (${pc(x.losB31 ? x.perWar.maxWarB / x.losB31 : null)}) |`);
const text = md.join('\n');
console.log(text);
if (MOUT) fs.writeFileSync(MOUT, text + '\n');
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(out));
