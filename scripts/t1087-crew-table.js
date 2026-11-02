#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1087 표 기계 · `t1055-observe` 판 JSON 만 읽는다 · 산수뿐 · 판정 0)
// === scripts/t1087-crew-table.js — 집 크루가 몇인가: 가시 몸 수 · 크루 수(마을 × 날) — 판 자 몸 상한 갈래마다 ===
//   node scripts/t1087-crew-table.js <이름>=<run 디렉터리> … [<이름>=lab:<랩 디렉터리>:<접두>] [--from 1] [--to 89]
//     서버 판 = <run>/base-<시드>.t1055.json · 랩 판 = <랩 디렉터리>/<접두>-<시드>.t1055.json(3시드 1020 · 7 · 42)
//   칸(마을 × 날 · 인구 > 0):
//     가시 몸 수(`bodies` — 서버 `npcPids`) 최소 · 중앙 · 최대 · 1 인 날 몫
//     크루가 일한 날(`crew` > 0) — 그날 크루 수 분포(1 · 2 · 그 밖) · 평균
//     크루 > 0 인 날 중 크루 < min(2 · 인구)… 가 아니라 **크루 = 몸 수인 날**(몸이 크루를 묶은 날) 몫 · 몸 ≥ 크루 상한 날 몫
//   크루 상한(LIFE_CREW)은 서버 정본(`villages.js` · `__labProbe._t400Probe.LIFE_CREW`)에서 읽는다 — 사본 0.
'use strict';
const fs = require('fs');
const path = require('path');
const SEEDS = [1020, 7, 42];
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const D0 = +get('--from', 1), D1 = +get('--to', 89);
const CREW = require(path.join(__dirname, '..', 'server', 'villages')).__labProbe._t400Probe.LIFE_CREW;
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const arms = argv.filter((x, i) => x.includes('=') && !(i > 0 && argv[i - 1].startsWith('--'))).map((x) => { const [n, d] = x.split('=');
  if (d.startsWith('lab:')) { const [, dir, pre] = d.split(':'); return { n, files: SEEDS.map((s) => path.join(dir, `${pre}-${s}.t1055.json`)) }; }
  return { n, files: SEEDS.map((s) => path.join(d, `base-${s}.t1055.json`)) }; });
const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';
const P = (s) => console.log(s);
P(`## 집 크루 · 가시 몸(날 ${D0} ~ ${D1} · 마을 × 날 · 3시드 합 · 크루 상한 LIFE_CREW = ${CREW})`);
P('');
P('| 판 | 마을 날 | 가시 몸 최소 · 중앙 · 최대 | 몸 1 인 날 | 크루 일한 날 | 그날 크루 1 | 그날 크루 2 | 크루 평균 | 크루 = 몸 수(몸이 묶음) | 몸 ≥ 크루 상한 |');
P('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
const out = { crewCap: CREW, from: D0, to: D1, arms: {} };
for (const A of arms) {
  const S = { n: 0, bodies: [], b1: 0, cd: 0, c1: 0, c2: 0, cOther: 0, csum: 0, bound: 0, full: 0, missing: 0 };
  for (const f of A.files) {
    const o = J(f); if (!o) { S.missing++; continue; }
    const F = {}; o.fields.forEach((k, i) => { F[k] = i + 1; });
    for (const rows of Object.values(o.vil)) for (const x of rows) {
      const d = x[0]; if (d < D0 || d > D1 || !(x[F.pop] > 0)) continue;
      S.n++;
      const b = x[F.bodies], c = x[F.crew];
      if (b != null) { S.bodies.push(b); if (b === 1) S.b1++; if (b >= CREW) S.full++; }
      if (c > 0) { S.cd++; S.csum += c; if (c === 1) S.c1++; else if (c === 2) S.c2++; else S.cOther++; if (b != null && c === b) S.bound++; }
    }
  }
  const hasB = S.bodies.length > 0;
  out.arms[A.n] = S;
  P(`| ${A.n}${S.missing ? ` (판 없음 ${S.missing})` : ''} | ${S.n.toLocaleString('en-US')} | ${hasB ? `${Math.min(...S.bodies)} · ${med(S.bodies)} · ${Math.max(...S.bodies)}` : '— (랩 · 몸 없음)'} | ${hasB ? pc(S.b1, S.n) : '—'} | ${S.cd.toLocaleString('en-US')} | ${pc(S.c1, S.cd)} | ${pc(S.c2, S.cd)} | ${S.cd ? (S.csum / S.cd).toFixed(3) : '—'} | ${hasB ? pc(S.bound, S.cd) : '—'} | ${hasB ? pc(S.full, S.bodies.length) : '—'} |`);
}
const JO = get('--json', null); if (JO) fs.writeFileSync(JO, JSON.stringify(out, null, 1));
