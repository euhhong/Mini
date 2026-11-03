#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1089 표 기계 · 읽기만 · 판정 0)
// === scripts/t1089-far-table.js — 판 자 띠의 "방어 몸 멀리"(`t1089-far-probe`) · 긴급 소집(`t1044-scram-probe`) · 전쟁 끝(`t956-war-probe` 결단 글) 표 ===========
//
// 쓰는 법:  node scripts/t1089-far-table.js <판 자 뿌리>[,<뿌리>…] [--json <out.json>] [--arms a,b,…] [--rows N]
//   뿌리 아래 `run-<갈래>[~raidN]/<판>-<시드>.{t1089,t1044,t956}.json` 을 읽는다(갈래 = 디렉터리 이름의 `run-` 뒤 · `~` 앞).
//   ⇒ ① 교전 없는 철수 전쟁(T1042 마디 — 교전 훅을 받았고 정산 0 · 철수 글 · 끝 꼴은 T1060 표 그 식)마다 방어 마을 몸이 그 전쟁 첫 소집 순간 어디 있었나(제 마을 중심 100칸 밖 = "멀리") ·
//        멀면 왜 — 마지막 풀림(war-core 결속 해제 순간)이 어느 편 · 어디였나 · 그 뒤 걸은 칸:
//          F1 원정 귀환 풀림 그 자리(공격 편으로 갔다 돌아오며 풀린 자리에서 13칸 안 — 그 자리 = 그 몸이 친 마을 중심 · 큰집 발자국 R 따로)
//          F2 원정 귀환 풀림 뒤 옮겨짐(13칸 넘게 걸었다 · 아직 멀다) · F3 방어 풀림 그 자리 · F4 방어 풀림 뒤 옮겨짐 · F5 풀림 이력 없음(일터 · 생활)
//        소집이 왜 못 닿나 — 소집 순간 포진점까지(`d0`) · 가장 가까이 온 거리(`mn`) · 소집 → 첫 대치(`so[0].t − t` · 교전 초) · 대치 순간 포진점 13칸 안 몸
//      ② 멀리 마디 줄(시드 · 전쟁 · 날 · 공→방 · 거리 · 칸 · 가까운 마을 · 마지막 풀림 · 걸은 칸 · 소집 거리 · 대치까지 초 · 꼴)
//      ③ 갈래 견줌 — 전쟁 · 교전 훅 전쟁 · 교전 없는 철수 · 그중 방어 몸 멀리 · 원정 귀환 풀림 자리(제 마을 중심까지 가운데 · 100칸 밖 몫 · 막힌 칸 R 몫) ·
//        하루 경계 "멀리" 몸-날(마을 몸이 제 마을 중심 100칸 밖에 선 날 수 — 묶인 몸 뺌) · 막힘 풀기(`t1089Late` — 관찰기 판 끝 `_warStat` 사진) · F3 · F4 사슬 뿌리(그 앞 원정 귀환 풀림)
//   결단 글(t956 `days[].log`)은 그 전쟁 두 마을 짝이 정확히 맞는 글만 센다(T1060 표 그 식 — 이름이 다른 이름의 앞머리인 마을을 가른다).
const fs = require('fs');
const path = require('path');
const A = process.argv.slice(2);
const roots = (A[0] || '').split(',').filter(Boolean);
if (!roots.length) { console.error('쓰는 법: t1089-far-table.js <뿌리>[,<뿌리>…] [--json out] [--arms a,b] [--rows N]'); process.exit(2); }
const opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const OUTJ = opt('--json', null), ARMS = opt('--arms', null), NROW = +opt('--rows', 60);
const FAR = 100, STAY = 13;   // 관찰 문턱(칸) — FAR = T1042 "방어 몸 멀리"(제 마을 중심 100 m 밖) · STAY = 근접 교전 거리(T1044 · T1060 표 "13칸 안") · 세계 수 아님
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const runs = [];
for (const R of roots) for (const d of fs.readdirSync(R).sort()) {
  const m = /^run-([^~]+)(?:~(.+))?$/.exec(d); if (!m) continue;
  const D = path.join(R, d);
  for (const f of fs.readdirSync(D).sort()) {
    const s = /^(.+)-(\d+)\.t1089\.json$/.exec(f); if (!s) continue;
    const b = path.join(D, `${s[1]}-${s[2]}`);
    runs.push({ arm: m[1], ctl: m[2] || 'base', run: d, seed: +s[2], P: rd(b + '.t1089.json'), w956: (rd(b + '.t956.json') || {}).wars || {}, t1044: rd(b + '.t1044.json'), J: rd(b + '.json') });
  }
}
const arms = ARMS ? ARMS.split(',') : [...new Set(runs.map((r) => r.arm))];
const r1 = (x) => x == null ? '-' : (Math.round(x * 10) / 10).toLocaleString('en-US');
const pc = (a, b) => b ? `${a}/${b}(${Math.round(a * 100 / b)}%)` : `${a}/0`;
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const band = (vals) => vals.length ? (Math.min(...vals) === Math.max(...vals) ? `${vals[0]}` : `${Math.min(...vals)} ~ ${Math.max(...vals)}`) : '-';
// ── 전쟁 한 줄 — 결단 글에서 그 짝만(T1060 표 `warOf` 그 식) ──
function warOf(id, o, lastDay) {
  const a = o.atk, d = o.def, f = o.first, e = o.end;
  const lines = new Set();
  for (const [day, x] of Object.entries(o.days || {})) { if (f != null && +day < f) continue; if (e != null && +day > e) continue; for (const l of (x.log || [])) lines.add(l); }
  let bat = 0, aw = 0, dw = 0, walk = 0, surr = 0, wd = 0;
  for (const l of lines) {
    let m;
    if ((m = /^D\d+ 전투 (\S+) vs (\S+?)\[[^\]]*\] → (공격승|방어승)/.exec(l)) && m[1] === a && m[2] === d) { bat++; if (m[3] === '공격승') aw++; else dw++; }
    else if ((m = /^D\d+ (\S+) 무저항 함락 → (\S+) —/.exec(l)) && m[1] === d && m[2] === a) walk++;
    else if ((m = /^D\d+ (\S+) 무혈 항복 → (\S+) —/.exec(l)) && m[1] === d && m[2] === a) surr++;
    else if ((m = /^D\d+ (\S+) → (\S+) 철수\(([^)]*)\)/.exec(l)) && m[1] === a && m[2] === d) wd++;
  }
  const set = o.set || [];
  return { id: +id, atk: a, def: d, first: f, end: e, len: (e != null ? e : lastDay) - f + 1, bat, aw, dw, walk, surr, wd, set: set.length, quiet: e != null && set.length === 0 && wd > 0 ? 1 : 0, hook: (o.hook || []).length };
}
const outc = (w) => (w.walk ? '함락(무저항)' : w.surr ? '함락(무혈 항복)' : w.aw ? '공격 승' : w.dw ? '방어 승' : w.quiet ? '맞붙음 없이 철수' : w.wd ? '맞붙은 뒤 철수' : w.end == null ? '판 끝까지' : '그 밖');
// ── 멀리 꼴 ──
function farClass(e) {
  const L = e.last;
  if (!L) return 'F5 풀림 이력 없음(일터 · 생활)';
  const stay = e.mv != null && e.mv <= STAY;
  if (L.side === 'A') return stay ? 'F1 원정 귀환 풀림 그 자리' : 'F2 원정 귀환 풀림 뒤 옮겨짐';
  if (L.side === 'B') return stay ? 'F3 방어 풀림 그 자리' : 'F4 방어 풀림 뒤 옮겨짐';
  return stay ? 'F6 풀림(전쟁 몸 밖) 그 자리' : 'F6 풀림(전쟁 몸 밖) 뒤 옮겨짐';
}
const J = { made: new Date().toISOString().slice(0, 10), FAR, STAY, arms: {}, rows: {} };
const L = [];
L.push(`# T1089 방어 몸 멀리 — 판 자 띠 표(${roots.join(' · ')})`, '');
L.push(`문턱: 멀리 = 방어 몸이 제 마을 중심 ${FAR}칸 밖(T1042 그 자) · 그 자리 = 마지막 풀림 자리에서 ${STAY}칸 안(관찰 문턱) · 교전 없는 철수 = 교전 훅을 받았고(t956 \`hook\`) 끝 · 정산 0 · 철수 글(T1042 마디 · 끝 꼴은 T1060 표 그 식)`, '');
const A1 = {};
for (const arm of arms) {
  const R = runs.filter((r) => r.arm === arm);
  if (!R.length) continue;
  const S = { runs: R.length, seeds: R.map((r) => r.seed), wars: 0, ended: 0, hooked: 0, quietAll: 0, quiet: 0, quietNoHook: 0, quietEn: 0, quietFar: 0, quietFarNoEn: 0, quietNoEn: 0, cls: {}, clsR: 0, clsEnemy: 0, chain: 0, segs: [],
    relA: [], relAR: 0, relAFar: 0, relB: [], farBodyDays: 0, farBodyDaysFree: 0, late: 0, errs: 0, outc: {}, soSec: [] };
  for (const r of R) {
    const P = r.P || { rel: [], en: [], far: [] };
    S.errs += (P.errs || 0) + (r.t1044 ? (r.t1044.errs || 0) : 0);
    const lastDay = Math.max(0, ...Object.values(r.w956).map((o) => Math.max(o.first || 0, o.end || 0)));
    const evBy = new Map(); for (const E of (r.t1044 ? r.t1044.ev : [])) { if (!evBy.has(E.wid)) evBy.set(E.wid, []); evBy.get(E.wid).push(E); }
    const enBy = new Map(); for (const e of (P.en || [])) { if (!enBy.has(e.wid)) enBy.set(e.wid, []); enBy.get(e.wid).push(e); }
    const farBy = new Map(); for (const f of (P.far || [])) { const k = f.vil + '|' + f.d; if (!farBy.has(k)) farBy.set(k, []); farBy.get(k).push(f); }
    const relBy = new Map(); for (const x of (P.rel || [])) { if (x.dead) continue; if (!relBy.has(x.pid)) relBy.set(x.pid, []); relBy.get(x.pid).push(x); }
    const relAt = (pid, d) => (relBy.get(pid) || []).filter((x) => x.d === d).pop() || null;   // 그 몸의 그날 풀림(마지막 것)
    const relBefore = (pid, d) => (relBy.get(pid) || []).filter((x) => x.d < d).pop() || null;   // 그날 앞 마지막 풀림
    for (const [id, o] of Object.entries(r.w956)) {
      if (o.den) continue;
      const w = warOf(id, o, lastDay);
      S.wars++; if (w.end != null) S.ended++; if (w.hook) S.hooked++;
      const oc = outc(w); S.outc[oc] = (S.outc[oc] || 0) + 1;
      if (!w.quiet) continue;
      S.quietAll++;
      if (!w.hook) { S.quietNoHook++; continue; }   // 교전 훅 없이 철수(방어 '버티기 — 소집 안 함' 등) — T1042 마디 밖
      S.quiet++;   // = T1042 "교전 없는 철수"(교전 훅을 받았고 몸 정산 없이 철수)
      for (const x of (o.so || [])) if (x.sec != null) S.soSec.push(x.sec);
      const ens = (enBy.get(w.id) || []).slice().sort((a, b) => a.d - b.d || (a.t || 0) - (b.t || 0));
      const evs = (evBy.get(w.id) || []).slice().sort((a, b) => a.day - b.day || (a.t || 0) - (b.t || 0));
      if (!ens.length) {   // 소집이 없었다 — 하루 경계 "멀리" 줄(교전 훅 첫날)로 몸 자리 · 그 몸의 마지막 풀림
        S.quietNoEn++;
        const d1 = o.hook[0].day;
        const fr = (farBy.get(w.def + '|' + d1) || []);
        if (fr.length) {
          const f = fr[0], R0 = f.rel != null ? relAt(f.pid, f.rel) : null;
          const e = { d: d1, home: f.home, cell: f.cell, mv: f.mv, last: R0 ? { d: R0.d, wid: R0.wid, side: R0.side, enemy: R0.enemy, prog: R0.prog, near: R0.near } : null, near: R0 ? R0.near : null };
          S.quietFarNoEn++;
          S.segs.push({ seed: r.seed, war: w.id, day: d1, atk: w.atk, def: w.def, en: 0, mus: f.mus, home: f.home, cell: f.cell, near: null, last: e.last, mv: f.mv, ago: e.last ? d1 - e.last.d : null, cls: (f.mus ? '(소집 없음 · 묶인 몸) ' : '(소집 없음) ') + farClass(e) });
        }
        continue;
      }
      S.quietEn++;
      const e = ens[0];   // 그 전쟁 첫 소집(몸 하나 — 판 자 몸 상한 1)
      if (!(e.home > FAR)) continue;
      S.quietFar++;
      const cls = farClass(e);
      S.cls[cls] = (S.cls[cls] || 0) + 1;
      if (e.cell === 'R') S.clsR++;
      const atEnemy = e.last && e.last.side === 'A' && e.near && e.last.enemy && e.near.v === e.last.enemy && e.near.d <= STAY;   // 원정 귀환 풀림 — 그 몸이 친 마을 중심 13칸 안
      if (atEnemy) S.clsEnemy++;
      let pre = null;   // 방어 풀림이면 그 앞 풀림을 거슬러(방어 풀림이 이어지면 더 앞으로) 첫 원정 귀환 풀림 — 사슬 뿌리
      if (e.last && e.last.side !== 'A') { let d = e.last.d, n = 0, P0 = null; while (n++ < 20) { P0 = relBefore(e.pid, d); if (!P0 || P0.side === 'A') break; d = P0.d; }
        if (P0) { pre = { d: P0.d, wid: P0.wid, side: P0.side, enemy: P0.enemy, home: P0.home, near: P0.near, hops: n }; if (P0.side === 'A' && P0.home > FAR) S.chain++; } }
      const E = evs[0] || null, u = E && E.u && E.u[0] ? E.u[0] : null, so = E && E.so && E.so[0] ? E.so[0] : null;
      S.segs.push({ seed: r.seed, war: w.id, day: e.d, atk: w.atk, def: w.def, en: 1, home: e.home, cell: e.cell, near: e.near, last: e.last, pre, mv: e.mv, ago: e.last ? e.d - e.last.d : null, cls, atEnemy: atEnemy ? 1 : 0,
        scram: e.scram, d0: u ? u.d0 : e.hold, mn: u ? u.mn : null, toSo: so && E ? Math.round((so.t - E.t) * 10) / 10 : null, so13: so ? so.in13 : null, nSo: E ? (E.so || []).length : null });
    }
    for (const x of (P.rel || [])) {
      if (x.dead) continue;
      if (x.side === 'A') { S.relA.push(x.home); if (x.cell === 'R') S.relAR++; if (x.home > FAR) S.relAFar++; }
      else if (x.side === 'B') S.relB.push(x.home);
    }
    for (const f of (P.far || [])) { S.farBodyDays++; if (!f.mus) S.farBodyDaysFree++; }
    if (P.stat) { S.lateKnown = 1; S.late += P.stat.t1089Late || 0; }   // 관찰기 판 끝 사진(켬 갈래 관찰기부터 — 끔 갈래 판은 '-')
  }
  A1[arm] = S;
  J.arms[arm] = Object.assign({}, S, { segs: undefined, relA: { n: S.relA.length, med: q(S.relA, 0.5), p90: q(S.relA, 0.9) }, relB: { n: S.relB.length, med: q(S.relB, 0.5), p90: q(S.relB, 0.9) } });
  J.rows[arm] = S.segs;
}
// ① ③ 갈래 표
const AR = arms.filter((a) => A1[a]);
L.push('## ① ③ 갈래 견줌', '');
L.push('| 갈래 | 판(시드) | 전쟁(끝) | 교전 훅 전쟁 | 교전 없는 철수(훅 있음 · T1042 마디) | 그중 소집 섬 | **그중 방어 몸 멀리(소집 순간)** | 소집 없이 · 몸 멀리 | 원정 귀환 풀림 자리 → 제 마을 중심(가운데 · 90%) | 그중 100칸 밖 | 그중 막힌 칸 R | 방어 풀림 자리(가운데) | 마을 몸 "멀리" 몸-날(묶인 몸 뺌) | 막힘 풀기 | 관찰 오류 |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const a of AR) {
  const S = A1[a];
  L.push(`| ${a} | ${S.runs}(${S.seeds.join('·')}) | ${S.wars}(${S.ended}) | ${S.hooked} | ${pc(S.quiet, S.hooked)} | ${S.quietEn} | **${pc(S.quietFar, S.quiet)}** | ${S.quietFarNoEn} | ${r1(q(S.relA, 0.5))} · ${r1(q(S.relA, 0.9))} (${S.relA.length}) | ${pc(S.relAFar, S.relA.length)} | ${pc(S.relAR, S.relA.length)} | ${r1(q(S.relB, 0.5))} (${S.relB.length}) | ${S.farBodyDaysFree.toLocaleString('en-US')} | ${S.lateKnown ? S.late : '-'} | ${S.errs} |`);
}
L.push('', `교전 훅 없이 철수(방어 '버티기 — 소집 안 함' 등 · T1042 마디 밖): ${AR.map((a) => `${a} ${A1[a].quietNoHook}`).join(' · ')} · 대치 문턱(war-live \`standoffSec\` — t956 대치 기록 \`sec\` · 교전 없는 철수 전쟁): ${AR.map((a) => `${a} ${band(A1[a].soSec.map((x) => Math.round(x * 10) / 10))}초`).join(' · ')}`);
L.push('', '전쟁 끝 꼴(갈래마다 — 함락 > 공격 승 > 방어 승 > 맞붙음 없이 철수 > 맞붙은 뒤 철수 · 맞붙음 없이 철수는 훅 없는 것 포함):', '');
const OC = ['함락(무저항)', '함락(무혈 항복)', '공격 승', '방어 승', '맞붙음 없이 철수', '맞붙은 뒤 철수', '판 끝까지', '그 밖'];
L.push('| 갈래 | ' + OC.join(' | ') + ' |', '|---|' + OC.map(() => '---').join('|') + '|');
for (const a of AR) L.push(`| ${a} | ` + OC.map((k) => A1[a].outc[k] || 0).join(' | ') + ' |');
L.push('', '## ① 멀리 꼴(소집 순간 방어 몸이 제 마을 중심 100칸 밖 · 교전 없는 철수)', '');
const CL = [...new Set(AR.flatMap((a) => Object.keys(A1[a].cls)))].sort();
L.push('| 갈래 | 멀리 | ' + CL.join(' | ') + ' | F1 중 그 자리 = 그 몸이 친 마을 중심 13칸 안 | 큰집 · 집 발자국(R) 안 | F3 · F4 중 사슬 뿌리 = 원정 귀환 풀림(100칸 밖) |', '|---|---|' + CL.map(() => '---').join('|') + '|---|---|---|');
for (const a of AR) { const S = A1[a]; L.push(`| ${a} | ${S.quietFar} | ` + CL.map((k) => S.cls[k] || 0).join(' | ') + ` | ${S.clsEnemy} | ${S.clsR} | ${S.chain} |`); }
L.push('', '소집이 왜 못 닿나(소집이 선 멀리 마디):', '');
L.push('| 갈래 | 마디 | 소집 순간 포진점까지(칸 · 범위) | 가장 가까이 온 거리(가운데) | 소집 → 첫 대치(교전 초 · 범위) | 첫 대치 순간 포진점 13칸 안 몸 |', '|---|---|---|---|---|---|');
for (const a of AR) {
  const sg = A1[a].segs.filter((s) => s.en);
  const d0 = sg.map((s) => s.d0).filter((x) => x != null), mn = sg.map((s) => s.mn).filter((x) => x != null), ts = sg.map((s) => s.toSo).filter((x) => x != null);
  L.push(`| ${a} | ${sg.length} | ${band(d0.map((x) => Math.round(x)))} | ${r1(q(mn, 0.5))} | ${band(ts)} | ${sg.reduce((s, x) => s + (x.so13 || 0), 0)} |`);
}
L.push('', '## ② 멀리 마디 줄', '');
for (const a of AR) {
  const sg = A1[a].segs; if (!sg.length) { L.push(`- ${a}: 0`); continue; }
  L.push(`### ${a} — ${sg.length}`, '', '| 시드 | 전쟁 | 날 | 공 → 방 | 몸 → 제 마을 중심 | 칸 | 가장 가까운 마을(칸) | 마지막 풀림(날 · 전쟁 · 편 · 상대 · 귀환 진척) | 그 뒤 걸은 칸 | 지난 날 | 소집 → 포진점 | 가장 가까이 | 대치까지 초 | 꼴 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of sg.slice(0, NROW)) {
    const Ls = s.last ? `D${s.last.d} · W${s.last.wid} · ${s.last.side || '-'} · ${s.last.enemy || '-'} · ${s.last.prog == null ? '-' : s.last.prog}` : '-';
    const nr = s.near || (s.last && s.last.near) || null, pre = s.pre ? ` ← 사슬 뿌리(풀림 ${s.pre.hops}번 앞) D${s.pre.d} · W${s.pre.wid} · ${s.pre.side || '-'} · ${s.pre.enemy || '-'} · 집 ${r1(s.pre.home)}칸` : '';
    L.push(`| ${s.seed} | ${s.war} | ${s.day} | ${s.atk} → ${s.def} | ${r1(s.home)} | ${s.cell || '-'} | ${nr ? `${nr.v}(${r1(nr.d)})` : '-'} | ${Ls} | ${r1(s.mv)} | ${s.ago == null ? '-' : s.ago} | ${s.en ? r1(s.d0) : '(소집 없음)'} | ${r1(s.mn)} | ${s.toSo == null ? '-' : s.toSo} | ${s.cls}${pre} |`);
  }
  L.push('');
}
const md = L.join('\n');
process.stdout.write(md + '\n');
if (OUTJ) fs.writeFileSync(OUTJ, JSON.stringify(J, null, 1));
