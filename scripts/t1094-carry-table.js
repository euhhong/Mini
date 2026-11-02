#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1094 표 기계 · 읽기만 · 판정 0)
// === scripts/t1094-carry-table.js — 원정 짐 표(관찰기 `t1094-carry-probe` · 원정마다 실은 kg · 남긴 kg) ===========
//
// 쓰는 법:  node scripts/t1094-carry-table.js <갈래이름=판자리>[,<갈래이름=판자리>…] [--json out.json] [--rows N]
//   판자리 = 관찰기 출력 `<판>-<시드>.t1094.json` 이 든 디렉터리(서버 기준선 판이면 판 임시 자리 · t577 판이면 `T577_DIR`).
//   ⇒ ① 갈래 견줌 — 원정 · 몸(가운데 · 가장 많은) · 몸 짐 kg(원정 가운데의 가운데 · 가장 무거운 몸) · 상한(`carry.js CAP_KG`) 넘는 몸으로 떠난 원정 · 그 몸 수 ·
//        군량 — 몸에 실은 kg 합 · 집에 남긴 kg · 식량등가 · 덜어 낸 몸 / 무기 — 반출 · 몸에 실은 자루 · kg · 집에 남긴 자루
//      ② 원정마다 줄(갈래마다 앞 N 줄 · 남긴 것이 있는 원정 먼저)
const fs = require('fs');
const path = require('path');
const A = process.argv.slice(2);
const specs = (A[0] || '').split(',').filter(Boolean).map((x) => { const i = x.indexOf('='); return i > 0 ? { arm: x.slice(0, i), dir: x.slice(i + 1) } : { arm: path.basename(x), dir: x }; });
if (!specs.length) { console.error('쓰는 법: t1094-carry-table.js <갈래=판자리>[,…] [--json out] [--rows N]'); process.exit(2); }
const opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const OUTJ = opt('--json', null), NROW = +opt('--rows', 12);
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const r1 = (x) => x == null ? '-' : (Math.round(x * 10) / 10).toLocaleString('en-US');
const sum = (a) => a.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
const J = { made: new Date().toISOString().slice(0, 10), arms: {} };
const L = ['# T1094 원정 짐 — 원정마다 실은 kg · 남긴 kg', ''];
const rows = {};
for (const S of specs) {
  const files = fs.existsSync(S.dir) ? fs.readdirSync(S.dir).filter((f) => /\.t1094\.json$/.test(f)).sort() : [];
  const ex = [], seeds = []; let cap = null, errs = 0;
  for (const f of files) { const P = rd(path.join(S.dir, f)); if (!P) continue; seeds.push(P.seed); cap = P.cap; errs += P.errs || 0; for (const e of (P.ex || [])) ex.push(Object.assign({ seed: P.seed }, e)); }
  const T = (e) => e.t1094 || {};
  const a = { seeds, cap, errs, ex: ex.length, nMed: q(ex.map((e) => e.n), 0.5), nMax: ex.length ? Math.max(...ex.map((e) => e.n)) : null, forceMed: q(ex.map((e) => e.force), 0.5),
    kgMed: q(ex.map((e) => e.kg && e.kg[1]), 0.5), kgMax: ex.length ? Math.max(...ex.map((e) => (e.kg ? e.kg[2] : 0))) : null, overEx: ex.filter((e) => e.over > 0).length, overBodies: sum(ex.map((e) => e.over || 0)),
    packKg: sum(ex.map((e) => e.pack ? e.pack.kg : 0)), leftKg: sum(ex.map((e) => T(e).leftKg || 0)), leftFE: sum(ex.map((e) => T(e).leftFE || 0)), trim: sum(ex.map((e) => T(e).trim || 0)), trimEx: ex.filter((e) => (T(e).trim || 0) > 0).length,
    armsEx: ex.filter((e) => e.arms).length, armsOut: sum(ex.map((e) => e.arms ? e.arms.out : 0)), armsOn: sum(ex.map((e) => e.arms && e.arms.onBodies != null ? e.arms.onBodies : 0)), armsOnEx: ex.filter((e) => e.arms && e.arms.onBodies != null).length,
    armsKg: sum(ex.map((e) => e.arms && e.arms.kg != null ? e.arms.kg : 0)), armsLeft: sum(ex.map((e) => T(e).armsLeft || 0)), armsLeftEx: ex.filter((e) => (T(e).armsLeft || 0) > 0).length };
  J.arms[S.arm] = a; rows[S.arm] = ex;
}
L.push(`상한 = \`carry.js CAP_KG\` ${Object.values(J.arms).map((a) => a.cap).find((x) => x != null)}kg · 몸 짐 = 몸 인벤 전부(\`weights.js\`) · 잼 자리 = 몸이 서고 짐을 실은 뒤 첫 하루 경계(먹기 전)`, '');
L.push('## ① 갈래 견줌', '');
L.push('| 갈래 | 시드 | 원정 | 몸(가운데 · 가장 많은) | 병력(가운데) | 몸 짐 kg(원정 가운데의 가운데 · 가장 무거운 몸) | **상한 넘는 몸으로 떠난 원정 · 그 몸** | 군량 — 몸에 실은 kg · **집에 남긴 kg · 식량등가** · 덜어 낸 몸(원정) | 무기 — 반출 · 몸에 실은 자루(원정) · kg · **집에 남긴 자루(원정)** | 관찰 오류 |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const S of specs) {
  const a = J.arms[S.arm];
  L.push(`| ${S.arm} | ${a.seeds.join('·')} | ${a.ex} | ${r1(a.nMed)} · ${a.nMax == null ? '-' : a.nMax} | ${r1(a.forceMed)} | ${r1(a.kgMed)} · ${r1(a.kgMax)} | **${a.overEx} · ${a.overBodies}** | ${r1(a.packKg)} · **${r1(a.leftKg)} · ${r1(a.leftFE)}** · ${a.trim}(${a.trimEx}) | ${r1(a.armsOut)} · ${r1(a.armsOn)}(${a.armsOnEx}) · ${r1(a.armsKg)} · **${r1(a.armsLeft)}(${a.armsLeftEx})** | ${a.errs} |`);
}
L.push('', '## ② 원정마다 줄(갈래마다 — 남긴 것이 있는 원정 먼저 · 그다음 몸 짐이 무거운 원정)', '');
for (const S of specs) {
  const ex = rows[S.arm].slice().sort((x, y) => (((y.t1094 || {}).leftKg || 0) + ((y.t1094 || {}).armsLeft || 0) > 0) - ((((x.t1094 || {}).leftKg || 0) + ((x.t1094 || {}).armsLeft || 0)) > 0) || ((y.kg ? y.kg[2] : 0) - (x.kg ? x.kg[2] : 0)) || (x.seed - y.seed) || (x.d - y.d));
  L.push(`### ${S.arm} — 원정 ${ex.length}`, '', '| 시드 | 전쟁 · 날 | 공 → 방 | 병력 · 몸 | 몸 짐 kg(가장 가벼운 · 가운데 · 가장 무거운) · 상한 넘는 몸 | 군량 몸 kg · 남긴 kg | 무기 반출 · 몸 자루 · 남긴 자루 |', '|---|---|---|---|---|---|---|');
  for (const e of ex.slice(0, NROW)) {
    const t = e.t1094 || {};
    L.push(`| ${e.seed} | W${e.wid} · D${e.d} | ${e.atk} → ${e.def} | ${e.force} · ${e.n} | ${e.kg ? e.kg.map(r1).join(' · ') : '-'} · ${e.over} | ${e.pack ? r1(e.pack.kg) : '-'} · ${r1(t.leftKg || 0)} | ${e.arms ? `${e.arms.out} · ${e.arms.onBodies == null ? '(장부만)' : r1(e.arms.onBodies)} · ${r1(t.armsLeft || 0)}` : '(장부 없음)'} |`);
  }
  L.push('');
}
process.stdout.write(L.join('\n') + '\n');
if (OUTJ) fs.writeFileSync(OUTJ, JSON.stringify(J, null, 1));
