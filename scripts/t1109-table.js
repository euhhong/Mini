#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1109 표 기계 · 판 JSON 만 읽는다 · 세계 안 만짐 · 판정 0)
// === scripts/t1109-table.js — 문 1-b(보호막) 표를 T1074 식량 빚 켬 세계에서 다시 센다(T1037 1-b 꼴) ===
//   node scripts/t1109-table.js <판 뿌리> [--json <파일>]
//     <뿌리>/run-b-A · run-b-C/base-<시드>.{t934,t1074}.json + base-<시드>.json — 서버 400날 · 보호막 켬(A) · 끔(C · `T858_NO_SHIELD=1`) · 둘 다 `T1074_FOOD_DEBT=1`
//     <뿌리>/lab/<on|off>-<시드>.{t934,t1074}.json — 랩 t17 400날 · 켬 · 끔 · 둘 다 `T1074_FOOD_DEBT=1`
//   셈(3시드 합):
//     첫해(날 < 365) 굶어 죽음 — t934 `deaths`(그날 `_deadTot` 차 · lib-day-deaths 정본) 합 · 그중 빚 죽음(t1074 `fdDead` 364날 누계)
//     보호막이 막은 빚 죽음 — t1074 `fdShield` 364날 누계(켬 판에서만 0 이 아니다)
//     보호막 선 마을 켬 ↔ 끔 — `scripts/t972-recount.js shield` 그대로(켬 판 첫해 `shieldAte > 0` 인 마을 · 사본 0)
//     400날 빈 마을(인구 0) · 해체(서버 판 JSON `dissolved` · 랩은 t1074 `dissolved` 표지 끝날 수) · 400날 인구
//   <뿌리>/fd0/ 아래 같은 꼴이 있으면(같은 main · `T1074_FOOD_DEBT` 끔 대조) 같은 표를 하나 더 낸다 — 빚 판과 같은 세계에서 견주려고(T1037 수는 옛 세계)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = process.argv[2];
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const SEEDS = [1020, 7, 42];
const J = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const node = (args) => execFileSync(process.execPath, args, { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 1 << 26 });
const sum = (a) => a.reduce((x, y) => x + y, 0);

function one(base) {   // base = <디렉터리>/base-<시드> 또는 <디렉터리>/<on|off>-<시드> 의 앞부분
  const T = J(base + '.t934.json'), F = J(base + '.t1074.json'); if (!T || !F) return null;
  const ci = T.cols.indexOf('deaths');
  let fam = 0; for (const [d, row] of T.rows) { if (d >= 365) break; for (const x of row) if (x) fam += x[ci]; }
  const iP = F.cols.indexOf('pop'), iF = F.cols.indexOf('fdDead'), iS = F.cols.indexOf('fdShield'), iX = F.cols.indexOf('dissolved');
  let at364 = null, last = null;
  for (const [d, vs] of F.rows) { if (d <= 364) at364 = vs; last = [d, vs]; }
  const B = J(base + '.json');
  return {
    fam365: fam,
    fd365: at364 ? sum(at364.map((x) => x[iF] || 0)) : 0,
    fdShield365: at364 ? sum(at364.map((x) => x[iS] || 0)) : 0,
    lastDay: last ? last[0] : 0,
    pop: last ? sum(last[1].map((x) => x[iP] || 0)) : 0,
    empty: last ? last[1].filter((x) => (x[iP] || 0) === 0).length : 0,
    dissolved: B && B.dissolved != null ? (+B.dissolved || 0) : (last ? last[1].filter((x) => x[iX]).length : 0),
    villages: F.names ? F.names.length : 0,
  };
}
function arm(dirOf) {   // dirOf(시드) → base 앞부분
  const per = SEEDS.map((s) => one(dirOf(s)));
  if (per.some((x) => !x)) return null;
  const r = { seeds: per.length, per };
  for (const k of ['fam365', 'fd365', 'fdShield365', 'pop', 'empty', 'dissolved', 'villages']) r[k] = sum(per.map((x) => x[k]));
  r.lastDay = Math.min(...per.map((x) => x.lastDay));
  return r;
}
function table(ROOT, title) {
const out = {};
for (const [where, A, C, tA, tC] of [
  ['server', (s) => path.join(ROOT, 'run-b-A', `base-${s}`), (s) => path.join(ROOT, 'run-b-C', `base-${s}`), path.join(ROOT, 'run-b-A', 'base-%s'), path.join(ROOT, 'run-b-C', 'base-%s')],
  ['lab', (s) => path.join(ROOT, 'lab', `on-${s}`), (s) => path.join(ROOT, 'lab', `off-${s}`), path.join(ROOT, 'lab', 'on-%s'), path.join(ROOT, 'lab', 'off-%s')],
]) {
  const on = arm(A), off = arm(C); if (!on || !off) continue;
  const shield = JSON.parse(node([path.join(__dirname, 't972-recount.js'), 'shield', tA, tC, '.t934.json']));
  out[where] = { on, off, shield };
}
const f0 = (x) => Math.round(x).toLocaleString('en-US');
console.log(`\n### ${title}\n`);
console.log('| 셈(3시드 합) | 서버 보호막 켬 | 서버 끔 | 랩 보호막 켬 | 랩 끔 |');
console.log('|---|---:|---:|---:|---:|');
const S = out.server, L = out.lab, c = (o, k) => (o ? f0(o[k]) : '—');
const row = (name, k) => console.log(`| ${name} | ${c(S && S.on, k)} | ${c(S && S.off, k)} | ${c(L && L.on, k)} | ${c(L && L.off, k)} |`);
row('첫해 굶어 죽음', 'fam365');
row('그중 빚 죽음(14일 넘김)', 'fd365');
row('보호막이 막은 빚 죽음', 'fdShield365');
row('400날 빈 마을', 'empty');
row('400날 해체', 'dissolved');
row('400날 인구', 'pop');
row('마을 수', 'villages');
for (const [w, o] of Object.entries(out)) {
  const t = o.shield;
  console.log(`\n${w === 'server' ? '서버' : '랩'} 보호막 선 마을(켬 판 첫해 shieldAte > 0) ${t.shielded} · 켬 ${f0(t.onSh)} ↔ 끔 ${f0(t.offSh)} = ${t.ratio}배 · 안 선 마을 켬 ${f0(t.onRest)} ↔ 끔 ${f0(t.offRest)}`);
  console.log(`  시드별 첫해 죽음 켬 ${o.on.per.map((x) => x.fam365).join(' · ')} ↔ 끔 ${o.off.per.map((x) => x.fam365).join(' · ')} · 마지막 날 ${o.on.lastDay} · ${o.off.lastDay}`);
}
return out;
}
const out = { food: table(ROOT, 'T1074 켬(식량 빚)') };
if (fs.existsSync(path.join(ROOT, 'fd0'))) out.fd0 = table(path.join(ROOT, 'fd0'), 'T1074 끔(대조 · 같은 main)');
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(out, null, 1));
