#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1135 표 기계 · 판 JSON · 관찰기 JSON 만 읽는다 · 산수뿐 · 판정 0)
// === scripts/t1135-table.js — 땔감 평형 켬 판 표(판마다 3시드 합 · 창 w0 ~ w1 날) ===
//   node scripts/t1135-table.js <이름>=<run 디렉터리> … [--json <파일>] [--w0 366] [--w1 799] [--seeds 1020,7,42]
//     판 파일 = <run>/base-<시드>.json(t577 판 — 해체 날 `bdtDay` · 빈 날 `emptyDay`) · <run>/base-<시드>.t1055.json(마을 × 날) · <run>/base-<시드>.t1107.json(찍은 날 둘레 땅)
//   셈(T1107 표와 같은 정의 · `scripts/t1107-table.js`):
//     땔감 자급 = 창 안 땔감 덮음(`fcov`) 평균 ≥ 1 ∧ 창 안 목재 수입 0 · 덮음 평균(마을-시드) · 추위 = 땔감이 못 덮은 추위 `_coldStress × (1 − 덮음)` 평균(마을-날) · 추운 날(`_coldStress` > 0.5) 땔감 모자란 마을-날
//     굶어 죽음 = 첫해(0 ~ 364) · 창 끝까지 · 빈 마을 · 해체 = 창 끝 날까지(판이 더 길어도 w1 에서 자른다) · 인구 = 창 끝 날 합 · 삭정이 누계(`dead`)
//     둘레 땅 = 찍은 날 w1(없으면 그 앞 마지막) — 트인 땅 % = 1 − Σ선 나무 칸 ÷ Σ뭍 칸 · 선 나무 칸 · 어린 · 벌채로 빈 칸
'use strict';
const fs = require('fs');
const path = require('path');
const SEEDS = (process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : '1020,7,42').split(',').map(Number);   // [--seeds 1020] = 셋째 해 표(시드 1020 만 1095날)
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const W0 = +get('--w0', 366), W1 = +get('--w1', 799);
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const arms = argv.filter((x, i) => x.includes('=') && !(i > 0 && argv[i - 1].startsWith('--'))).map((x) => { const i = x.indexOf('='); return { n: x.slice(0, i), d: x.slice(i + 1) }; });
const out = {};
for (const A of arms) {
  const S = { seeds: 0, vs: 0, self: 0, imp: 0, fcov: [], cold: 0, coldN: 0, coldHi: 0, pop: 0, fam365: 0, famW: 0, empty: 0, dis: 0, dead: 0,
    land: 0, tree: 0, sap: 0, ringCut: 0, open0: null, shotDay: null, land0: 0, tree0: 0 };
  for (const sd of SEEDS) {
    const r = J(path.join(A.d, `base-${sd}.json`));
    if (r) { for (const d of r.emptyDay || []) if (d != null && d <= W1) S.empty++; for (const d of r.bdtDay || []) if (d != null && d <= W1) S.dis++; }
    const a = J(path.join(A.d, `base-${sd}.t1055.json`));
    if (a) {
      S.seeds++;
      const F = {}; a.fields.forEach((k, i) => { F[k] = i + 1; });
      for (const rows of Object.values(a.vil)) {
        let fs_ = 0, fn = 0, w0 = null, w1 = null, popEnd = 0, dead = 0;
        for (const x of rows) {
          const d = x[0];
          if (d > W1) break;
          if (x[F.fam] > 0) { S.famW += x[F.fam]; if (d < 365) S.fam365 += x[F.fam]; }
          if (d === W0 - 1) w0 = x[F.wimp];
          if (d >= W0) {
            if (x[F.pop] > 0 && x[F.fcov] != null) { fs_ += x[F.fcov]; fn++; }
            if (x[F.pop] > 0 && F.cold) { const c = x[F.cold] || 0, u = c * Math.max(0, 1 - (x[F.fcov] == null ? 1 : x[F.fcov])); S.cold += u; S.coldN++; if (c > 0.5 && x[F.fcov] < 1) S.coldHi++; }
            w1 = x[F.wimp]; popEnd = x[F.pop];
          }
          if (F.dead) dead = x[F.dead] || 0;
        }
        S.dead += dead;
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
      let l = null; for (const s of b.shots) if (s.day <= W1) l = s;
      const f = b.shots[0];
      if (l) { S.shotDay = l.day; for (const v of Object.values(l.v)) { S.land += v.land; S.tree += v.tree; S.sap += v.sap || 0; S.ringCut += v.ringCut; } }
      for (const v of Object.values(f.v)) { S.land0 += v.land; S.tree0 += v.tree; }
    }
  }
  S.fcovMean = S.fcov.length ? S.fcov.reduce((x, y) => x + y, 0) / S.fcov.length : null;
  S.coldMean = S.coldN ? S.cold / S.coldN : null;
  out[A.n] = S;
}
const P = (s) => console.log(s);
const pc = (x) => x == null ? '—' : (100 * x).toFixed(1) + '%';
const nf = (x) => x == null ? '—' : Math.round(x).toLocaleString('en-US');
P(`## 판마다(3시드 합 · 마을-시드 · 창 ${W0} ~ ${W1}날)`);
P('');
P('| 판 | 마을-시드 | **땔감 자급** | 땔감 수입 마을 | 땔감 덮음 평균 | 추위 = 추위 × (1 − 덮음) 평균(추운 날 모자란 마을-날) | 굶어 죽음 첫해 · 창 끝까지 | 빈 마을 | 해체 | 인구(창 끝) | 삭정이 누계(단) | 트인 땅(첫 찍음 → 창 끝 찍음) | 선 나무 칸(어린) | 벌채로 빈 칸 |');
P('|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|---|---:|');
for (const [n, S] of Object.entries(out)) {
  const o0 = S.land0 ? 1 - S.tree0 / S.land0 : null, o1 = S.land ? 1 - S.tree / S.land : null;
  P(`| ${n}${S.seeds < 3 ? ` (시드 ${S.seeds})` : ''} | ${S.vs} | **${S.self}** | ${S.imp} | ${S.fcovMean == null ? '—' : S.fcovMean.toFixed(3)} | ${S.coldMean == null ? '—' : S.coldMean.toFixed(3)} (${nf(S.coldHi)}) | ${nf(S.fam365)} · ${nf(S.famW)} | ${S.empty} | ${S.dis} | ${nf(S.pop)} | ${nf(S.dead)} | ${pc(o0)} → ${pc(o1)}(${S.shotDay}일) | ${nf(S.tree)} (${nf(S.sap)}) | ${nf(S.ringCut)} |`);
}
const JO = get('--json', null); if (JO) fs.writeFileSync(JO, JSON.stringify(out, null, 1));
