#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1062 표 기계 · 읽기만 · 판정 0)
// === scripts/t1062-table.js — 목재 그림자 가격이 읽는 칸(`t1062-observe` 판) — 서버 띠 · 갈래 ↔ 랩 띠 ===
//   node scripts/t1062-table.js --srv <띠 뿌리> --lab <랩 뿌리> [--json <파일>] [--from 366] [--to 800]
//     서버 판 = <띠 뿌리>/run-<갈래>/<판>-<시드>.t1062.json · 랩 판 = <랩 뿌리>/t17-<갈래>-<시드>.t1062.json
//   셈(마을 × 날 · 그날 econ 틱 앞 · --from ~ --to · 인구 > 0 인 마을 날만):
//     w = 직업 고르기 가중치 `min(200, max(0.05, pW))`(econ `pickDeficitJob_rational` 의 그 클램프 글자) — 평균 · 중앙
//     곳간 목재 ÷ N · 크루 대기 목재 ÷ N(pend) · 집터 선 날 몫 · 목표 ÷ N · 대기 뺀 값 wr(같은 클램프) 평균 · 중앙
//     곳간 목재 ≥ 목표 날 몫(값이 바닥 쪽) · 대기 뺀 재고 ≥ 목표 날 몫
'use strict';
const fs = require('fs');
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRV = arg('--srv', null), LAB = arg('--lab', null), OUTJ = arg('--json', null);
const D0 = +arg('--from', 366), D1 = +arg('--to', 1e9);
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const clampW = (p) => Math.max(0.05, Math.min(200, p == null ? 1 : p));
function acc() { return { n: 0, w: [], wr: [], woodN: 0, pendN: 0, tgtN: 0, site: 0, over: 0, overR: 0, live: 0, bw: [], heldN: 0, under: 0, moved: 0, bin: {} }; }
const BIN = +arg('--bin', 100);   // 날별 표의 칸 폭(날)
//   ★T1046 자(같은 판에 `t1046-probe` 를 걸었으면) — 출생 배정이 나무꾼 안전망 줄 이후 문(차례 13~)에 닿은 날의 목재 값 `min(200, pW)`(보고 T1046 §1 `w(wood)` 그 칸 · 같은 클램프) 평균
function addBirth(A, o) {
  if (!o || !o.cols || !Array.isArray(o.wrapped) || o.wrapped.length !== 18) return;
  const F = {}; o.cols.forEach((k, i) => { F[k] = i; }); const idx = new Map(o.wrapped.map((l, i) => [l, i]));
  for (const rows of Object.values(o.v)) for (const x of rows) { if (x[F.day] < D0 || x[F.day] > D1 || !x[F.birth]) continue; const g = idx.get(x[F.line]); if (g != null && g >= 13 && x[F.pW] != null) A.bw.push(Math.min(200, x[F.pW])); }
}
function addFile(A, o) {
  if (!o || !o.cols) return;
  const F = {}; o.cols.forEach((k, i) => { F[k] = i; });
  for (const rows of Object.values(o.v)) for (const x of rows) {
    const d = x[F.day], N = x[F.N]; if (d < D0 || d > D1 || !(N > 0)) continue;
    A.n++; A.w.push(clampW(x[F.pW])); A.wr.push(clampW(x[F.pWr]));
    A.woodN += x[F.wood] / N; A.pendN += x[F.pend] / N; A.tgtN += x[F.tgt] / N;
    if (x[F.pend] > 0) A.site++; if (x[F.live]) A.live++;
    if (x[F.wood] >= x[F.tgt]) A.over++; if (x[F.wood] - x[F.pend] >= x[F.tgt]) A.overR++;
    const held = Math.min(x[F.wood], x[F.pend]);   // 곳간에 있지만 서 있는 집터가 아직 꺼낼 몫(곳간 ∧ 남은 집 목재)
    A.heldN += held / N; if (x[F.pend] > 0 && x[F.wood] < x[F.pend]) A.under++; if (clampW(x[F.pWr]) !== clampW(x[F.pW])) A.moved++;
    const b = Math.floor((d - 1) / BIN), B = A.bin[b] || (A.bin[b] = { n: 0, w: 0, woodN: 0, heldN: 0, wr: 0 });
    B.n++; B.w += clampW(x[F.pW]); B.wr += clampW(x[F.pWr]); B.woodN += x[F.wood] / N; B.heldN += held / N;
  }
}
function load(root, kind) {
  const R = {}; if (!root || !fs.existsSync(root)) return R;
  const get = (t) => R[t] || (R[t] = acc());
  if (kind === 'srv') { for (const dn of fs.readdirSync(root).filter((x) => x.startsWith('run-')).sort()) for (const fn of fs.readdirSync(path.join(root, dn)).filter((x) => /\.t1062\.json$/.test(x))) { addFile(get(dn.slice(4)), J(path.join(root, dn, fn))); addBirth(get(dn.slice(4)), J(path.join(root, dn, fn.replace(/\.t1062\.json$/, '.t1046.json')))); } }
  else { const re = /^t17-(.+)-(\d+)\.t1062\.json$/; for (const fn of fs.readdirSync(root).filter((x) => re.test(x)).sort()) { addFile(get(fn.match(re)[1]), J(path.join(root, fn))); addBirth(get(fn.match(re)[1]), J(path.join(root, fn.replace(/\.t1062\.json$/, '.t1046.json')))); } }
  return R;
}
const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const S = load(SRV, 'srv'), L = load(LAB, 'lab');
const runs = [...Object.entries(S).map(([t, a]) => [`서버 ${t}`, a]), ...Object.entries(L).map(([t, a]) => [`랩 ${t}`, a])].filter(([, a]) => a.n > 0);
const COL = [['마을 날', (a) => a.n, 0], ['w 평균', (a) => mean(a.w), 2], ['w 중앙', (a) => med(a.w), 3], ['곳간 목재 ÷ N', (a) => a.woodN / a.n, 3],
  ['크루 대기 ÷ N', (a) => a.pendN / a.n, 3], ['곳간 중 묶인 몫 ÷ N', (a) => a.heldN / a.n, 3], ['집터 선 날 중 곳간 < 남은 몫 %', (a) => a.site ? 100 * a.under / a.site : null, 1], ['대기 빼면 w 가 달라지는 날 %', (a) => 100 * a.moved / a.n, 1], ['집터 선 날 %', (a) => 100 * a.site / a.n, 1], ['목표 ÷ N', (a) => a.tgtN / a.n, 3],
  ['재고 ≥ 목표 %', (a) => 100 * a.over / a.n, 1], ['대기 뺀 w 평균', (a) => mean(a.wr), 2], ['대기 뺀 w 중앙', (a) => med(a.wr), 3], ['대기 뺀 재고 ≥ 목표 %', (a) => 100 * a.overR / a.n, 1], ['출생 안전망 줄 닿음 w 평균(T1046 자)', (a) => mean(a.bw), 1], ['그 출생 수', (a) => a.bw.length || null, 0]];
const fx = (x, d) => x == null ? '—' : d === 0 ? Number(x).toLocaleString('en-US') : x.toFixed(d);
const P = (s) => console.log(s);
P(`## 목재 그림자 가격이 읽는 칸(날 ${D0} ~ ${D1 >= 1e9 ? '끝' : D1} · 마을 × 날 · 틱 앞 · 3시드 합)`);
P('');
P(`| 판 | ${COL.map((c) => c[0]).join(' | ')} |`);
P(`|---|${COL.map(() => '---:').join('|')}|`);
const out = { from: D0, to: D1, cols: COL.map((c) => c[0]), runs: {} };
for (const [lbl, a] of runs) { const v = COL.map(([, f]) => f(a)); out.runs[lbl] = v; P(`| ${lbl} | ${v.map((x, i) => fx(x, COL[i][2])).join(' | ')} |`); }
const band = (pref) => COL.map((c, i) => { const xs = runs.filter(([n]) => n.startsWith(pref)).map(([, a]) => c[1](a)).filter((x) => x != null); return xs.length ? [Math.min(...xs), Math.max(...xs)] : null; });
const KN = process.env.T1062_KNOB_ARM || 'k';
const bands = { s: band('서버 s'), k: band('서버 ' + KN), lab: band('랩 ') };
for (const [nm, B] of [['서버 띠(s)', bands.s], [`서버 띠(${KN} — 손잡이 켬)`, bands.k], ['랩 띠', bands.lab]]) if (B.some((b) => b)) P(`| **${nm}** | ${B.map((b, i) => b ? `${fx(b[0], COL[i][2])} ~ ${fx(b[1], COL[i][2])}` : '—').join(' | ')} |`);
const ov = (A, B) => A.map((b, i) => b && B[i] ? (b[0] <= B[i][1] && B[i][0] <= b[1] ? '겹침' : '**안 겹침**') : '—').join(' | ');
if (bands.s.some((b) => b) && bands.lab.some((b) => b)) P(`| 겹침 s ↔ 랩 | ${ov(bands.s, bands.lab)} |`);
if (bands.k.some((b) => b) && bands.lab.some((b) => b)) P(`| 겹침 ${KN} ↔ 랩 | ${ov(bands.k, bands.lab)} |`);
out.bands = bands;
// 날별 표 — 칸(BIN 날)마다 띠(서버 s 판들 · 랩 판들 최소 ~ 최대)
{
  const keys = new Set(); for (const [, A] of runs) for (const k of Object.keys(A.bin)) keys.add(+k);
  const ks = [...keys].sort((x, y) => x - y);
  const bb = (pref, f) => (k) => { const xs = runs.filter(([n]) => n.startsWith(pref)).map(([, A]) => A.bin[k]).filter((B) => B && B.n).map(f); return xs.length ? [Math.min(...xs), Math.max(...xs)] : null; };
  const FS = [['w 평균', (B) => B.w / B.n, 1], ['곳간 목재 ÷ N', (B) => B.woodN / B.n, 3], ['곳간 중 묶인 몫 ÷ N', (B) => B.heldN / B.n, 3], ['대기 뺀 w 평균', (B) => B.wr / B.n, 1]];
  const rng = (r, d) => r ? `${fx(r[0], d)} ~ ${fx(r[1], d)}` : '—';
  P(''); P(`## 날별(${BIN}날 칸 · 서버 s 띠 ↔ 랩 띠 · 마을 날 평균)`); P('');
  P(`| 날 | ${FS.map(([n]) => `서버 ${n} | 랩 ${n}`).join(' | ')} |`);
  P(`|---|${FS.map(() => '---:|---:').join('|')}|`);
  out.bins = {};
  for (const k of ks) { const row = FS.map(([, f, d]) => [bb('서버 s', f)(k), bb('랩 ', f)(k), d]); out.bins[k] = row.map(([a, b]) => [a, b]);
    P(`| ${k * BIN + 1} ~ ${(k + 1) * BIN} | ${row.map(([a, b, d]) => `${rng(a, d)} | ${rng(b, d)}`).join(' | ')} |`); }
}
if (OUTJ) fs.writeFileSync(OUTJ, JSON.stringify(out, null, 1));
