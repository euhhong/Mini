#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1107 표 기계 · 관찰기 JSON 만 읽는다 · 산수뿐 · 판정 0)
// === scripts/t1107-table.js — 판마다(3시드 합): 땔감 자급 마을 · 땔감 수입 마을 · 인구 · 벌채로 빈 칸 · 트인 땅 · 밭 칸 대 나무 칸 ===
//   node scripts/t1107-table.js <이름>=<run 디렉터리> … [--json <파일>] [--w0 366] [--w1 799]
//     판 파일 = <run>/base-<시드>.t1055.json(마을 × 날 — 인구 · 땔감 덮음 `fcov` · 목재 수입 누계 `wimp` · 굶어 죽음 `fam`) ·
//              <run>/base-<시드>.t1107.json(찍은 날 — 둘레 땅 칸)
//   셈(마을-시드마다 · 창 = w0 ~ w1 날):
//     땔감 자급 = 창 안 땔감 덮음 평균 ≥ 1 이고 창 안 목재 수입 0 · 땔감 수입 마을 = 창 안 목재 수입 > 0 · 덮음 평균(마을-시드 평균)
//     인구 = 창 끝 날 합 · 굶어 죽음 = 첫해(0 ~ 364) · 전부
//     둘레 땅(마지막 찍은 날 ↔ 처음 찍은 날): 트인 땅 % = 1 − Σ선 나무 칸 ÷ Σ뭍 칸 · 마을 중앙 · 벌채로 빈 칸(영토 밖 · 원판엔 나무 · 지금 0) · 밭 칸 · 선 나무 칸
'use strict';
const fs = require('fs');
const path = require('path');
const SEEDS = [1020, 7, 42];
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const W0 = +get('--w0', 366), W1 = +get('--w1', 799);
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const arms = argv.filter((x, i) => x.includes('=') && !(i > 0 && argv[i - 1].startsWith('--'))).map((x) => { const i = x.indexOf('='); return { n: x.slice(0, i), d: x.slice(i + 1) }; });
const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const out = {};
for (const A of arms) {
  const S = { vs: 0, self: 0, imp: 0, fcov: [], pop: 0, fam365: 0, famAll: 0, seeds: 0,
    first: { land: 0, tree: 0, farm: 0, cut: 0, ringCut: 0, open: [] }, last: { land: 0, tree: 0, farm: 0, cut: 0, ringCut: 0, sap: 0, open: [] }, firstDay: null, lastDay: null };
  for (const sd of SEEDS) {
    const a = J(path.join(A.d, `base-${sd}.t1055.json`));
    if (a) {
      S.seeds++;
      const F = {}; a.fields.forEach((k, i) => { F[k] = i + 1; });
      for (const rows of Object.values(a.vil)) {
        let fs_ = 0, fn = 0, w0 = null, w1 = null, popEnd = 0;
        for (const x of rows) {
          const d = x[0];
          if (x[F.fam] > 0) { S.famAll += x[F.fam]; if (d < 365) S.fam365 += x[F.fam]; }
          if (d === W0 - 1) w0 = x[F.wimp];
          if (d >= W0 && d <= W1) { if (x[F.pop] > 0 && x[F.fcov] != null) { fs_ += x[F.fcov]; fn++; } w1 = x[F.wimp]; popEnd = x[F.pop]; }
        }
        if (!fn) continue;
        S.vs++;
        const m = fs_ / fn, imp = (w1 || 0) - (w0 || 0);
        S.fcov.push(m); S.pop += popEnd || 0;
        if (imp > 0) S.imp++;
        if (m >= 1 && !(imp > 0)) S.self++;
      }
    }
    const b = J(path.join(A.d, `base-${sd}.t1107.json`));
    if (b && b.shots && b.shots.length) {
      const f = b.shots[0], l = b.shots[b.shots.length - 1];
      S.firstDay = f.day; S.lastDay = l.day;
      for (const [sh, T] of [[f, S.first], [l, S.last]]) for (const v of Object.values(sh.v)) {
        T.land += v.land; T.tree += v.tree; T.farm += v.farm; T.cut += v.cut; T.ringCut += v.ringCut; if (T.sap != null) T.sap += v.sap || 0;
        if (v.open != null) T.open.push(v.open);
      }
    }
  }
  S.fcovMean = S.fcov.length ? S.fcov.reduce((x, y) => x + y, 0) / S.fcov.length : null;
  out[A.n] = S;
}
const P = (s) => console.log(s);
const pc = (x) => x == null ? '—' : (100 * x).toFixed(1) + '%';
const nf = (x) => x == null ? '—' : Math.round(x).toLocaleString('en-US');
P(`## 판마다(3시드 합 · 마을-시드 · 창 ${W0} ~ ${W1}날)`);
P('');
P('| 판 | 마을-시드 | **땔감 자급** | 땔감 수입 마을 | 땔감 덮음 평균 | 인구(창 끝) | 굶어 죽음 첫해 · 전부 | 트인 땅(첫 찍음 → 끝) | 트인 땅 마을 중앙(끝) | 벌채로 빈 칸(영토 밖 · 끝) | 선 나무 칸(끝 · 어린) | 밭 칸(끝) | 밭 ÷ 나무 칸 |');
P('|---|---:|---:|---:|---:|---:|---|---|---:|---:|---|---:|---:|');
for (const [n, S] of Object.entries(out)) {
  const o0 = S.first.land ? 1 - S.first.tree / S.first.land : null, o1 = S.last.land ? 1 - S.last.tree / S.last.land : null;
  P(`| ${n}${S.seeds < 3 ? ` (시드 ${S.seeds})` : ''} | ${S.vs} | **${S.self}** | ${S.imp} | ${S.fcovMean == null ? '—' : S.fcovMean.toFixed(3)} | ${nf(S.pop)} | ${nf(S.fam365)} · ${nf(S.famAll)} | ${pc(o0)} → ${pc(o1)} | ${pc(med(S.last.open))} | ${nf(S.last.ringCut)} | ${nf(S.last.tree)} · ${nf(S.last.sap)} | ${nf(S.last.farm)} | ${S.last.tree ? (S.last.farm / S.last.tree).toFixed(3) : '—'} |`);
}
const JO = get('--json', null); if (JO) fs.writeFileSync(JO, JSON.stringify(out, null, 1));
