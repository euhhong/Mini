#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1060 표 기계 · 읽기만 · 판정 0)
// === scripts/t1060-hold-table.js — 판 자 띠의 재편 원점(`t1060-hold-probe`) · 긴급 소집(`t1044-scram-probe`) · 전쟁 끝(`t956-war-probe` 결단 글) 표 ===========
//
// 쓰는 법:  node scripts/t1060-hold-table.js <판 자 뿌리> [--json <out.json>] [--cases N] [--arms a,b,…]
//   뿌리 아래 `run-<갈래>[~raidN]/<판>-<시드>.{t1060,t1044,t956}.json` 을 읽는다(갈래 = 디렉터리 이름의 `run-` 뒤 · `~` 앞 · 판 = 갈래 판 + 대조 판).
//   ⇒ ① 재편 원점 — 갈래 × 대형 꼴(긴급 소집 · 응전 포진 · 출격 · 공격): 재편 수 · 원점 칸(막힌 칸 R · T · W) · 포진점에서 마중 상한(8칸) 밖 · 100칸 밖 —
//        재편 순간(첫 생존자 자리)과 대치 전이 끝(T1060 켬이면 포진점) 둘 · 그 뒤 첫 전진 명령 · 첫 접촉 순간 방어 몸(포진점 거리 가운데 · 13칸 안 몫)
//      ② 긴급 소집 — 갈래 × 꼴(S1 결단 그 자리 · S2 전진 중) × 소집 순간 가장 먼 몸 거리(포진점 100칸 안 · 밖): 소집 · 접촉 · 정산(방어 승 · 공격 승 · 그 밖) ·
//        **정산 없이 끝(= 맞붙음 없이 철수 — villages `withdrawQuiet`)** · 판 끝까지
//      ③ 전쟁 — 갈래마다(판마다 띠): 전쟁 · 끝난 전쟁 · 길이(가운데 · 평균 · 가장 긴 · 30날+) · 전투(공격 승 · 방어 승) · 사상(공 · 방) · 함락(무저항 · 무혈 항복) ·
//        철수 · **맞붙음 없이 철수**(끝 · 정산 0 · 철수 글) — 다 · 긴급 소집이 선 전쟁만 둘
//      ④ '성문 앞에서 덜 모인 수비' 사례 — 갈래마다 긴급 소집 첫 접촉 순간 포진점 13칸 안 몸 몫이 가장 낮은 N 줄
//   결단 글(t956 `days[].log` — 그날 두 마을 이름이 든 war-core 글)은 **그 전쟁 두 마을 짝이 정확히 맞는 글만** 센다(이름이 다른 이름의 앞머리인 마을 — 어촌1 · 어촌15 — 을 가른다).
const fs = require('fs');
const path = require('path');
const A = process.argv.slice(2);
const roots = (A[0] || '').split(',').filter(Boolean);
if (!roots.length) { console.error('쓰는 법: t1060-hold-table.js <뿌리>[,<뿌리>…] [--json out] [--cases N] [--arms a,b]'); process.exit(2); }
const opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const NC = +opt('--cases', 3), OUTJ = opt('--json', null), ARMS = opt('--arms', null);
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const runs = [];
for (const R of roots) for (const d of fs.readdirSync(R).sort()) {
  const m = /^run-([^~]+)(?:~(.+))?$/.exec(d); if (!m) continue;
  const D = path.join(R, d);
  for (const f of fs.readdirSync(D).sort()) {
    const s = /^(.+)-(\d+)\.t956\.json$/.exec(f); if (!s) continue;
    const b = path.join(D, `${s[1]}-${s[2]}`);
    runs.push({ arm: m[1], ctl: m[2] || 'base', run: d, root: R, seed: +s[2], w956: (rd(b + '.t956.json') || {}).wars || {}, t1044: rd(b + '.t1044.json'), t1060: rd(b + '.t1060.json'), J: rd(b + '.json') });
  }
}
const arms = ARMS ? ARMS.split(',') : [...new Set(runs.map((r) => r.arm))];
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const r1 = (x) => x == null ? '-' : (Math.round(x * 10) / 10).toLocaleString('en-US');
const pc = (a, b) => b ? `${a}/${b}(${Math.round(a * 100 / b)}%)` : `${a}/0`;
const band = (vals) => vals.length ? (Math.min(...vals) === Math.max(...vals) ? `${vals[0]}` : `${Math.min(...vals)} ~ ${Math.max(...vals)}`) : '-';
const BLK = (c) => c === 'R' || c === 'W' || (c && c[0] === 'T');
// ── 전쟁 한 줄 — 결단 글에서 그 짝만 ──
function warOf(id, o, lastDay) {
  const a = o.atk, d = o.def, f = o.first, e = o.end;
  const lines = new Set();
  for (const [day, x] of Object.entries(o.days || {})) { if (f != null && +day < f) continue; if (e != null && +day > e) continue; for (const l of (x.log || [])) lines.add(l); }
  let bat = 0, aw = 0, dw = 0, ca = 0, cd = 0, walk = 0, surr = 0, wd = 0, wdMiss = 0;
  for (const l of lines) {
    let m;
    if ((m = /^D\d+ 전투 (\S+) vs (\S+?)\[[^\]]*\] → (공격승|방어승) 사상 공(\d+)·방(\d+)/.exec(l)) && m[1] === a && m[2] === d) { bat++; if (m[3] === '공격승') aw++; else dw++; ca += +m[4]; cd += +m[5]; }
    else if ((m = /^D\d+ (\S+) 무저항 함락 → (\S+) —/.exec(l)) && m[1] === d && m[2] === a) walk++;
    else if ((m = /^D\d+ (\S+) 무혈 항복 → (\S+) —/.exec(l)) && m[1] === d && m[2] === a) surr++;
    else if ((m = /^D\d+ (\S+) → (\S+) 철수\(([^)]*)\)/.exec(l)) && m[1] === a && m[2] === d) { wd++; if (/돌격이 닿지 못했다/.test(m[3])) wdMiss++; }
  }
  const set = o.set || [];
  const len = (e != null ? e : lastDay) - f + 1;
  return { id, atk: a, def: d, first: f, end: e, len, bat, aw, dw, ca, cd, walk, surr, wd, wdMiss, set: set.length, quiet: e != null && set.length === 0 && wd > 0 ? 1 : 0 };
}
// 전쟁 끝 꼴 하나(겹치면 앞 것 — 함락 > 공격 승 > 방어 승 > 맞붙음 없이 철수 > 맞붙은 뒤 철수)
const outc = (w) => (w.walk ? '함락(무저항)' : w.surr ? '함락(무혈 항복)' : w.aw ? '공격 승' : w.dw ? '방어 승' : w.quiet ? '맞붙음 없이 철수' : w.wd ? '맞붙은 뒤 철수' : w.end == null ? '판 끝까지' : '그 밖');
const J = { arms: {}, cases: {} };
const L = [];
// ── ① 재편 원점 ──
L.push('## ① 재편 원점 — 갈래 × 대형 꼴(판 넷 × 시드 셋 합)', '');
L.push('| 갈래 · 꼴 | 재편 | 걷는 대형 | 재편 순간 원점: 막힌 칸(R · T · W) · 마중 상한 8칸 밖 · 100칸 밖 | 대치 전이 끝 원점: 막힌 칸 · 8칸 밖 · 100칸 밖 · 포진점(0칸) | 다음 전진 명령 순간: 원점 8칸 밖 · 몸 가운데(칸) | 그 뒤 첫 접촉: 몸 가운데(칸) · 13칸 안 몫 |');
L.push('|---|---:|---:|---|---|---|---|');
for (const a of arms) {
  const R = runs.filter((r) => r.arm === a); const ev = R.flatMap((r) => (r.t1060 && r.t1060.rg) || []);
  const JA = J.arms[a] = { regroup: {}, scram: {}, wars: {}, probeErr: R.reduce((s, r) => s + ((r.t1060 && r.t1060.errs) || 0) + ((r.t1044 && r.t1044.errs) || 0), 0), runs: R.length };
  for (const cls of ['scram', 'respond', 'sortie', 'atk']) {
    const E = ev.filter((e) => e.cls === cls); if (!E.length) continue;
    const blk0 = E.filter((e) => BLK(e.c0)), blk1 = E.filter((e) => BLK(e.c1));
    const f0 = E.filter((e) => e.d0 != null && e.d0 > 8).length, h0 = E.filter((e) => e.d0 != null && e.d0 > 100).length;
    const f1 = E.filter((e) => e.d1 != null && e.d1 > 8).length, h1 = E.filter((e) => e.d1 != null && e.d1 > 100).length, z1 = E.filter((e) => e.d1 === 0).length;
    const ks = (S) => { const c = {}; for (const e of S) c[e.c0] = (c[e.c0] || 0) + 1; return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · '); };
    const ks1 = (S) => { const c = {}; for (const e of S) c[e.c1] = (c[e.c1] || 0) + 1; return Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · '); };
    const adv = E.filter((e) => e.adv), ct = E.filter((e) => e.ct);
    const advFar = adv.filter((e) => e.adv.oD != null && e.adv.oD > 8).length;
    const advMed = q(adv.map((e) => e.adv.med).filter((x) => x != null), 0.5), ctMed = q(ct.map((e) => e.ct.med).filter((x) => x != null), 0.5);
    const ctIn = ct.reduce((s, e) => s + (e.ct.in13 || 0), 0), ctN = ct.reduce((s, e) => s + (e.ct.n || 0), 0);
    const walk = E.filter((e) => e.walk).length;
    L.push(`| ${a} · ${cls} | ${E.length} | ${walk} | ${blk0.length}${blk0.length ? `(${ks(blk0)})` : ''} · ${f0} · ${h0} | ${blk1.length}${blk1.length ? `(${ks1(blk1)})` : ''} · ${f1} · ${h1} · ${z1} | ${adv.length ? `${advFar}/${adv.length} · ${r1(advMed)}` : '-'} | ${ct.length ? `${r1(ctMed)} · ${pc(ctIn, ctN)}` : '-'} |`);
    JA.regroup[cls] = { n: E.length, walk, blk0: blk0.length, far0: f0, h0, blk1: blk1.length, far1: f1, h1, zero1: z1, adv: adv.length, advFar, advMed, ct: ct.length, ctMed, ctIn, ctN,
      perRun: R.map((r) => { const X = ((r.t1060 && r.t1060.rg) || []).filter((e) => e.cls === cls); return { run: r.run, seed: r.seed, n: X.length, blk0: X.filter((e) => BLK(e.c0)).length, blk1: X.filter((e) => BLK(e.c1)).length, far1: X.filter((e) => e.d1 != null && e.d1 > 8).length }; }) };
  }
}
L.push('', '(막힌 칸 = 호스트 메모 R 건물 발자국 · T 지형 · W 나무 — 메모에 없는 칸 `?` 은 막힌 칸에 안 센다 · 응전 포진 · 출격 · 공격 대형은 T1060 무변 — 끔 갈래와 견주면 세계 갈림만 보인다)', '');
// ── ② 긴급 소집 ──
L.push('## ② 긴급 소집 — 갈래 × 꼴 × 소집 순간 가장 먼 몸(포진점 100칸 안 · 밖)', '');
L.push('| 갈래 · 꼴 · 거리 | 소집 | 접촉 | 방어 승 · 공격 승 · 그 밖 정산 | **정산 없이 끝(맞붙음 없이 철수)** | 판 끝까지 | 첫 접촉 순간 포진점 13칸 안 몸 |');
L.push('|---|---:|---:|---|---:|---:|---:|');
const scramRows = {};
for (const a of arms) {
  const R = runs.filter((r) => r.arm === a);
  for (const cl of ['S1', 'S2']) for (const far of [false, true]) {
    const E = []; for (const r of R) for (const e of ((r.t1044 && r.t1044.ev) || [])) { if (!e.scram) continue; if ((e.fst === 'form' ? 'S1' : 'S2') !== cl) continue;
      const dmax = Math.max(...e.u.map((x) => x.d0)); if ((dmax > 100) !== far) continue; E.push(Object.assign({ _r: r }, e)); }
    if (!E.length) continue;
    let ct = 0, B = 0, Aw = 0, oth = 0, quiet = 0, open = 0, in13 = 0, nn = 0;
    for (const e of E) {
      if (e.c1) { ct++; in13 += e.c1.in13 || 0; nn += e.c1.n || 0; }
      if (e.end) { if (e.end.why === 'rout') (e.end.winner === 'B' ? B++ : Aw++); else oth++; }
      else { const W = e._r.w956[e.wid]; if (W && W.end != null) quiet++; else open++; }
    }
    const k = `${a} · ${cl} · ${far ? '100칸 밖' : '100칸 안'}`;
    scramRows[k] = { n: E.length, ct, B, A: Aw, oth, quiet, open, in13, nn };
    L.push(`| ${k} | ${E.length} | ${pc(ct, E.length)} | ${B} · ${Aw} · ${oth} | **${pc(quiet, E.length)}** | ${open} | ${pc(in13, nn)} |`);
  }
}
J.scramRows = scramRows;
L.push('');
// ── ③ 전쟁 ──
L.push('## ③ 전쟁 — 갈래마다(판 넷 × 시드 셋 합 · [판마다 띠])', '');
const H3 = '| 갈래 · 전쟁 | 전쟁 | 끝 | 길이 가운데 · 평균 · 가장 긴 · 30날+ | 전투(공격 승 · 방어 승) | 사상 공 · 방 | 함락(무저항 · 무혈 항복) | 철수(돌격 헛걸음 뒤) | **맞붙음 없이 철수** |';
L.push(H3, '|---|---:|---:|---|---|---|---|---|---:|');
for (const a of arms) {
  const R = runs.filter((r) => r.arm === a);
  for (const only of [false, true]) {
    const per = [];
    for (const r of R) {
      const last = r.J && r.J.days ? r.J.days : 800;
      const sw = new Set(((r.t1044 && r.t1044.ev) || []).filter((e) => e.scram).map((e) => String(e.wid)));
      const W = Object.entries(r.w956).filter(([id]) => !only || sw.has(id)).map(([id, o]) => warOf(id, o, last));
      per.push({ run: r.run, seed: r.seed, W });
    }
    const all = per.flatMap((p) => p.W);
    const S = (k) => all.reduce((s, w) => s + w[k], 0);
    const ends = all.filter((w) => w.end != null), lens = all.map((w) => w.len);
    const byRun = (k) => { const m = new Map(); for (const p of per) m.set(p.run, (m.get(p.run) || 0) + p.W.reduce((s, w) => s + (typeof k === 'function' ? k(w) : w[k]), 0)); return [...m.values()]; };
    const nm = `${a} · ${only ? '긴급 소집이 선 전쟁' : '다'}`;
    const row = { wars: all.length, ended: ends.length, lenMed: q(lens, 0.5), lenMean: lens.length ? lens.reduce((s, x) => s + x, 0) / lens.length : null, lenMax: lens.length ? Math.max(...lens) : null,
      long30: all.filter((w) => w.len >= 30).length, bat: S('bat'), aw: S('aw'), dw: S('dw'), ca: S('ca'), cd: S('cd'), walk: S('walk'), surr: S('surr'), wd: S('wd'), wdMiss: S('wdMiss'), quiet: S('quiet'),
      band: { wars: byRun(() => 1), dw: byRun('dw'), aw: byRun('aw'), cas: byRun((w) => w.ca + w.cd), fall: byRun((w) => w.walk + w.surr), quiet: byRun('quiet') },
      cls: all.reduce((m, w) => { const k = outc(w); m[k] = (m[k] || 0) + 1; return m; }, {}),
      clsRun: [...new Set(per.map((p) => p.run))].map((rn) => ({ run: rn, n: per.filter((p) => p.run === rn).reduce((s, p) => s + p.W.length, 0), cls: per.filter((p) => p.run === rn).flatMap((p) => p.W).reduce((m, w) => { const k = outc(w); m[k] = (m[k] || 0) + 1; return m; }, {}) })) };
    (J.arms[a].wars[only ? 'scram' : 'all'] = row);
    L.push(`| ${nm} | ${row.wars} [${band(row.band.wars)}] | ${row.ended} | ${r1(row.lenMed)} · ${r1(row.lenMean)} · ${row.lenMax} · ${row.long30} | ${row.bat}(${row.aw} [${band(row.band.aw)}] · ${row.dw} [${band(row.band.dw)}]) | ${row.ca} · ${row.cd} [${band(row.band.cas)}] | ${row.walk + row.surr}(${row.walk} · ${row.surr}) [${band(row.band.fall)}] | ${row.wd}(${row.wdMiss}) | **${pc(row.quiet, row.wars)}** [${band(row.band.quiet)}] |`);
  }
}
L.push('', '(길이 = 끝 날 − 첫 날 + 1 · 판 끝까지 산 전쟁은 판 끝까지 · 전투 · 사상 · 함락 · 철수 = 그 전쟁 짝의 war-core 결단 글 · 맞붙음 없이 철수 = 끝났고 정산(`settle`) 0 · 철수 글이 있는 전쟁 — villages `withdrawQuiet`)', '');
// ── ④ 사례 ──
L.push(`## ④ '성문 앞에서 덜 모인 수비' — 갈래마다 긴급 소집 첫 접촉 순간 포진점 13칸 안 몸 몫이 가장 낮은 ${NC} 줄`, '');
L.push('| 갈래 | 판 · 시드 · 전쟁 | 두 마을 | 날 | 꼴 | 소집 몸 · 가장 먼(포진점 칸) | 첫 접촉: 포진점 13칸 안 / 산 몸 · 가운데 · 가장 먼 | 끝 |');
L.push('|---|---|---|---:|---|---|---|---|');
for (const a of arms) {
  const R = runs.filter((r) => r.arm === a), C = [];
  for (const r of R) for (const e of ((r.t1044 && r.t1044.ev) || [])) { if (!e.scram || !e.c1 || !e.c1.n) continue; C.push(Object.assign({ _r: r }, e)); }
  C.sort((x, y) => (x.c1.in13 / x.c1.n) - (y.c1.in13 / y.c1.n) || (y.c1.med || 0) - (x.c1.med || 0) || x.day - y.day);
  J.cases[a] = [];
  for (const e of C.slice(0, NC)) {
    const W = e._r.w956[e.wid], wo = W ? warOf(String(e.wid), W, (e._r.J && e._r.J.days) || 800) : null;
    const endS = e.end ? `${e.end.why}${e.end.winner ? '(' + e.end.winner + ')' : ''} ${e.end.day}날` : (W && W.end != null ? `정산 없이 ${W.end}날` : '판 끝까지');
    const dmax = Math.max(...e.u.map((x) => x.d0));
    L.push(`| ${a} | ${e._r.run} · ${e._r.seed} · ${e.wid} | ${e.atk} → ${e.def} | ${e.day} | ${e.fst === 'form' ? 'S1' : 'S2'} | ${e.n} · ${r1(dmax)} | ${e.c1.in13}/${e.c1.n} · ${r1(e.c1.med)} · ${r1(e.c1.max)} | ${endS}${wo ? ` · 전투 ${wo.bat} · 사상 ${wo.ca}·${wo.cd}` : ''} |`);
    J.cases[a].push({ run: e._r.run, seed: e._r.seed, wid: e.wid, atk: e.atk, def: e.def, day: e.day, cls: e.fst === 'form' ? 'S1' : 'S2', n: e.n, dmax, c1: e.c1, end: e.end || null, wEnd: W ? W.end : null, war: wo });
  }
}
// ── ⑤ 같은 전쟁 둘 — `--pair x:y` 갈래끼리 같은 대조 판 · 같은 시드에서 econ 날 줄(dctl)이 처음 갈린 날까지 선 같은 전쟁(공격 · 방어 · 첫 날) ──
J.pairs = {};
A.forEach((x, i) => { if (x !== '--pair') return; const [pa, pb] = (A[i + 1] || '').split(':'); if (!pa || !pb) return;
  const P = { same: 0, scram: 0, trans: {}, rows: [] };
  for (const ra of runs.filter((r) => r.arm === pa)) {
    const rb = runs.find((r) => r.arm === pb && r.ctl === ra.ctl && r.seed === ra.seed); if (!rb) continue;
    const dA = rd(path.join(ra.root, ra.run, `base-${ra.seed}.dctl.json`)), dB = rd(path.join(rb.root, rb.run, `base-${rb.seed}.dctl.json`));
    let div = Infinity;
    if (dA && dB && dA.days && dB.days) { const mA = new Map(dA.days.map(([d, r]) => [d, JSON.stringify(r)])); for (const [d, r] of dB.days) { if (!mA.has(d)) continue; if (mA.get(d) !== JSON.stringify(r)) { div = d; break; } } }
    const last = (ra.J && ra.J.days) || 800;
    const key = (o) => `${o.atk}|${o.def}|${o.first}`;
    const WB = new Map(Object.entries(rb.w956).map(([id, o]) => [key(o), [id, o]]));
    const scA = new Map(), scB = new Map();
    for (const e of ((ra.t1044 && ra.t1044.ev) || [])) if (e.scram && !scA.has(String(e.wid))) scA.set(String(e.wid), e);
    for (const e of ((rb.t1044 && rb.t1044.ev) || [])) if (e.scram && !scB.has(String(e.wid))) scB.set(String(e.wid), e);
    for (const [id, o] of Object.entries(ra.w956)) {
      if (!(o.first <= div)) continue; const m = WB.get(key(o)); if (!m) continue;
      P.same++;
      const ea = scA.get(id), eb = scB.get(m[0]); if (!ea) continue;
      P.scram++;
      const wa = warOf(id, o, last), wb = warOf(m[0], m[1], last), ka = outc(wa), kb = outc(wb);
      P.trans[`${ka} → ${kb}`] = (P.trans[`${ka} → ${kb}`] || 0) + 1;
      P.rows.push({ run: ra.run.replace(/^run-[^~]+/, '') || '(갈래 판)', seed: ra.seed, wid: id, widB: m[0], atk: o.atk, def: o.def, first: o.first, div: div === Infinity ? null : div,
        cls: ea.fst === 'form' ? 'S1' : 'S2', dmax: Math.max(...ea.u.map((u) => u.d0)), a: { out: ka, c1: ea.c1 || null, len: wa.len, cas: [wa.ca, wa.cd] }, b: { out: kb, c1: eb ? eb.c1 || null : null, len: wb.len, cas: [wb.ca, wb.cd] } });
    }
  }
  J.pairs[`${pa}:${pb}`] = P;
  L.push(`## ⑤ 같은 전쟁 둘 — ${pa} ↔ ${pb}(같은 대조 판 · 같은 시드 · econ 날 줄이 처음 갈린 날까지 선 전쟁 · 공격 · 방어 · 첫 날이 같은 것)`, '');
  L.push(`같은 전쟁 ${P.same} · 그중 ${pa} 에서 긴급 소집이 선 전쟁 ${P.scram} — 끝 꼴 옮김(${pa} → ${pb}): ${Object.entries(P.trans).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '');
  L.push(`| 판 · 시드 · 전쟁 | 두 마을 · 첫 날 | 꼴 · 가장 먼 몸(포진점 칸) | ${pa}: 끝 · 첫 접촉(포진점 13칸 안 / 산 몸 · 가운데) · 사상 공·방 | ${pb}: 끝 · 첫 접촉 · 사상 공·방 |`);
  L.push('|---|---|---|---|---|');
  const pick = P.rows.filter((r) => r.a.out === '맞붙음 없이 철수' && r.b.c1).sort((x, y) => (y.dmax > 100) - (x.dmax > 100) || x.first - y.first);
  const c1s = (c) => c ? `${c.in13}/${c.n} · ${r1(c.med)}칸` : '접촉 0';
  for (const r of (pick.length ? pick : P.rows).slice(0, Math.max(NC, 6)))
    L.push(`| ${r.run} · ${r.seed} · ${r.wid} | ${r.atk} → ${r.def} · ${r.first} | ${r.cls} · ${r1(r.dmax)} | ${r.a.out} · ${c1s(r.a.c1)} · ${r.a.cas.join('·')} | ${r.b.out} · ${c1s(r.b.c1)} · ${r.b.cas.join('·')} |`);
  L.push('');
});
// ── ⑥ 맞붙음 없는 대치의 꼴 — 긴급 소집이 선 전쟁의 대치(그 교전 접촉 0 · t956 `so` 앞 걸음 표본) ──
//   꼴(앞 것부터): 풀림 0(공격 대형이 행군로 끝에서 안 풀렸다 — 두 원점 사이 곧은 줄이 막힘) · 사거리 안(맞선 두 몸 40m 안 — 궁수 사거리) ·
//   수비가 먼 길(수비 몸 포진점 50칸 밖) — 공격 몸이 성문 앞(포진점 13칸 안)에 섰다 · 공격 몸이 성문 밖(13칸 밖 — ⓑ 는 걸어 오는 몸을 쫓는 중 · ⓐ 는 포진점으로 가는 중) · 그 밖
L.push('## ⑥ 맞붙음 없는 대치의 꼴 — 긴급 소집이 선 전쟁 · 그 교전 접촉 0 인 대치(맞선 두 몸 = 대치 앞 걸음 표본 · 포진점 = 소집 줄)', '');
L.push('| 갈래 | 대치 | 풀림 0 | 사거리 안(40m) | 수비 먼 길 · 공격 성문 앞(13칸 안) | 수비 먼 길 · 공격 성문 밖 | 그 밖 | 수비 몸 포진점 거리 가운데(칸) | 공격 몸 포진점 거리 가운데(칸) |');
L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
J.so = {};
for (const a of arms) {
  const R = runs.filter((r) => r.arm === a), K = { n: 0, norel: 0, near: 0, gate: 0, chase: 0, other: 0 }, dB = [], dA = [], G = [];
  for (const r of R) {
    const sc = new Map(); for (const e of ((r.t1044 && r.t1044.ev) || [])) if (e.scram && !sc.has(String(e.wid))) sc.set(String(e.wid), e);
    for (const [id, o] of Object.entries(r.w956)) { const e = sc.get(id); if (!e || !e.hold) continue;
      for (const z of (o.so || [])) { if ((z.contacts | 0) > 0) continue; const bf = z.before || {}, p = (bf.cen || {}).pair || {}, ad = bf.adv || {};
        K.n++;
        const pa = p.a, pe = p.e, da = pa ? Math.hypot(pa.x - e.hold[0], pa.y - e.hold[1]) : null, db = pe ? Math.hypot(pe.x - e.hold[0], pe.y - e.hold[1]) : null;
        if (da != null) dA.push(da); if (db != null) dB.push(db);
        if (ad && ad.side === 'A' && ad.rel === false) K.norel++;
        else if (p.d != null && p.d <= 40) K.near++;
        else if (da != null && db != null && da <= 13 && db > 50) { K.gate++;
          const wo = warOf(id, o, (r.J && r.J.days) || 800);
          G.push({ run: r.run, seed: r.seed, wid: id, atk: o.atk, def: o.def, day: z.day, t: z.t, cls: e.fst === 'form' ? 'S1' : 'S2', dA: Math.round(da * 10) / 10, dB: Math.round(db * 10) / 10, gap: bf.gap, aTy: pa.ty, bTy: pe.ty, end: o.end, out: outc(wo), bat: wo.bat, cas: [wo.ca, wo.cd] }); }
        else if (da != null && db != null && da > 13 && db > 50) K.chase++;
        else K.other++; } }
  }
  J.so[a] = Object.assign({ dB: q(dB, 0.5), dA: q(dA, 0.5) }, K);
  G.sort((x, y) => y.dB - x.dB || x.day - y.day); (J.gate = J.gate || {})[a] = G;
  L.push(`| ${a} | ${K.n} | ${K.norel} | ${K.near} | ${K.gate} | ${K.chase} | ${K.other} | ${r1(q(dB, 0.5))} | ${r1(q(dA, 0.5))} |`);
}
L.push('', `성문 앞에서 기다린 대치(공격 몸 포진점 13칸 안 · 수비 몸 50칸 밖) — 갈래마다 수비 몸이 가장 먼 ${NC} 줄:`, '');
L.push('| 갈래 | 판 · 시드 · 전쟁 | 두 마을 | 날 · 대치 초 | 꼴 | 공격 몸(포진점 칸) | 수비 몸(포진점 칸) | 그 전쟁 끝 |');
L.push('|---|---|---|---|---|---|---|---|');
for (const a of arms) for (const g of ((J.gate || {})[a] || []).slice(0, NC))
  L.push(`| ${a} | ${g.run} · ${g.seed} · ${g.wid} | ${g.atk} → ${g.def} | ${g.day} · ${g.t} | ${g.cls} | ${g.aTy} ${g.dA} | ${g.bTy} ${g.dB} | ${g.out} ${g.end != null ? g.end + '날' : ''} · 전투 ${g.bat} · 사상 ${g.cas.join('·')} |`);
L.push('', `관찰기 오류(t1060 + t1044): ${arms.map((a) => `${a} ${J.arms[a].probeErr}`).join(' · ')} · 판 ${arms.map((a) => `${a} ${J.arms[a].runs}`).join(' · ')}`);
console.log(L.join('\n'));
if (OUTJ) fs.writeFileSync(OUTJ, JSON.stringify(J, null, 1));
