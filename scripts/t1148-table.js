#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1148 표 기계 · 관찰기 JSON 만 읽는다 · 산수뿐 · 판정 0)
// === scripts/t1148-table.js — 땔감 직업 판 덧표(판마다 3시드 · 창 w0 ~ w1) — 기본 열은 `t1135-table.js` 가 낸다 ===
//   node scripts/t1148-table.js <이름>=<run 디렉터리> … [--w0 366] [--w1 799] [--seeds 1020,7,42] [--json <파일>]
//   셈(마을-날 = 창 안 · 인구 > 0 인 날):
//     나무꾼 0 마을-날 % · 갈래별(광산 · 어촌 · 임업 · 농촌) 땔감 덮음(마을-시드 평균) · 창 끝 인구 합
//     곳간 식량 며칠치(식량 환산 `tfe` ÷ 인구) 분포 — 중앙 · 15 밑 · 15 ~ 30 · 30 ~ 60 · 60 위 몫 · 겨울(추위 > 0 인 날)만 중앙 · 그 밖 중앙
//     숯 재고(창 끝 합 `char`) · 통나무 교역량 = 창 안 목재 수입 합(`wimp` 차) · 수출 합(`wexp` 차)
//     추위 빚 > 0 마을-날 % · 땔감 며칠치 중앙(켬 판만 · `cdebt` · `cdays`)
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const W0 = +get('--w0', 366), W1 = +get('--w1', 799);
const SEEDS = String(get('--seeds', '1020,7,42')).split(',').map(Number);
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const arms = argv.filter((x, i) => x.includes('=') && !(i > 0 && argv[i - 1].startsWith('--'))).map((x) => { const i = x.indexOf('='); return { n: x.slice(0, i), d: x.slice(i + 1) }; });
const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const KINDS = ['임업', '농촌', '광산', '어촌'];
const out = {};
for (const A of arms) {
  const S = { seeds: 0, n: 0, lj0: 0, kind: {}, popKind: {}, fd: [], fdW: [], fdS: [], char: 0, imp: 0, exp: 0, debt: 0, debtN: 0, cdays: [] };
  for (const k of KINDS) { S.kind[k] = []; S.popKind[k] = 0; }
  for (const sd of SEEDS) {
    const a = J(path.join(A.d, `base-${sd}.t1055.json`)); if (!a) continue;
    S.seeds++;
    const F = {}; a.fields.forEach((k, i) => { F[k] = i + 1; });
    for (const [nm, rows] of Object.entries(a.vil)) {
      const kind = nm.replace(/\d+$/, '');
      let fs_ = 0, fn = 0, i0 = null, i1 = null, e0 = null, e1 = null, popEnd = 0, chEnd = 0;
      for (const x of rows) {
        const d = x[0]; if (d > W1) break;
        if (d === W0 - 1) { i0 = x[F.wimp]; e0 = x[F.wexp]; }
        if (d < W0) continue;
        i1 = x[F.wimp]; e1 = x[F.wexp]; popEnd = x[F.pop]; chEnd = F.char ? (x[F.char] || 0) : 0;
        if (!(x[F.pop] > 0)) continue;
        S.n++;
        if (F.lj && !(x[F.lj] > 0)) S.lj0++;
        if (x[F.fcov] != null) { fs_ += x[F.fcov]; fn++; }
        const fdays = (x[F.tfe] || 0) / x[F.pop];
        S.fd.push(fdays);
        if (F.cold && (x[F.cold] || 0) > 0) S.fdW.push(fdays); else S.fdS.push(fdays);
        if (F.cdebt && x[F.cdebt] != null) { S.debtN++; if (x[F.cdebt] > 0) S.debt++; S.cdays.push(x[F.cdays]); }
      }
      if (fn && S.kind[kind]) S.kind[kind].push(fs_ / fn);
      if (S.popKind[kind] != null) S.popKind[kind] += popEnd || 0;
      S.char += chEnd; S.imp += (i1 || 0) - (i0 || 0); S.exp += (e1 || 0) - (e0 || 0);
    }
  }
  const fdA = S.fd;
  S.fdMed = med(fdA); S.fdWMed = med(S.fdW); S.fdSMed = med(S.fdS);
  S.fdBins = [fdA.filter((x) => x < 15).length, fdA.filter((x) => x >= 15 && x < 30).length, fdA.filter((x) => x >= 30 && x < 60).length, fdA.filter((x) => x >= 60).length].map((c) => fdA.length ? c / fdA.length : null);
  S.kindMean = {}; for (const k of KINDS) S.kindMean[k] = S.kind[k].length ? S.kind[k].reduce((x, y) => x + y, 0) / S.kind[k].length : null;
  S.cdaysMed = med(S.cdays);
  delete S.fd; delete S.fdW; delete S.fdS; delete S.cdays; delete S.kind;
  out[A.n] = S;
}
const P = (s) => console.log(s);
const pc = (x) => x == null ? '—' : (100 * x).toFixed(1) + '%';
const f2 = (x) => x == null ? '—' : x.toFixed(2);
const nf = (x) => x == null ? '—' : Math.round(x).toLocaleString('en-US');
P(`## 덧표(시드 ${SEEDS.join(' · ')} · 창 ${W0} ~ ${W1}날)`);
P('');
P('| 판 | 나무꾼 0 마을-날 | 덮음 임업 · 농촌 · 광산 · 어촌 | 창 끝 인구 임업 · 농촌 · 광산 · 어촌 | 식량 며칠치 중앙(겨울 · 그 밖) | 며칠치 < 15 · 15 ~ 30 · 30 ~ 60 · ≥ 60 | 숯 재고(끝) | 통나무 수입 · 수출(창 합) | 추위 빚 > 0 마을-날 · 땔감 며칠치 중앙 |');
P('|---|---:|---|---|---|---|---:|---|---|');
for (const [n, S] of Object.entries(out)) {
  P(`| ${n}${S.seeds < SEEDS.length ? ` (시드 ${S.seeds})` : ''} | ${pc(S.n ? S.lj0 / S.n : null)} | ${KINDS.map((k) => f2(S.kindMean[k])).join(' · ')} | ${KINDS.map((k) => nf(S.popKind[k])).join(' · ')} | ${f2(S.fdMed)} (${f2(S.fdWMed)} · ${f2(S.fdSMed)}) | ${S.fdBins.map(pc).join(' · ')} | ${nf(S.char)} | ${nf(S.imp)} · ${nf(S.exp)} | ${S.debtN ? pc(S.debt / S.debtN) : '—'} · ${S.cdaysMed == null ? '—' : f2(Math.min(S.cdaysMed, 9999))} |`);
}
const JO = get('--json', null); if (JO) fs.writeFileSync(JO, JSON.stringify(out, null, 1));
