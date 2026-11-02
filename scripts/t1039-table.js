#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1039 표 기계 · 판 JSON 만 읽는다)
// === scripts/t1039-table.js — 도적 전환 몸 갈래 셋(종전 · walk · spawn) × 판 넷(main · raid:1~3 — T837 띠) × 3시드 ===
//   쓰는 법: node scripts/t1039-table.js --runs <dir> [--json <out.json>]
//            (<dir>/<갈래>-<판>-<시드>/base-<시드>.json · .dctl.json · .t1039.json · .t1022.json — 판 자 `t577-server-run.js` + 프리로드 diverge-ctl · t1022-observe · t1039-observe)
//   셈(판정 0 — 띠 = 판 넷 최소 ~ 최대):
//     도적화 곳 수(판 JSON `dissolved`) · 습격 조우(diverge-ctl `seen.raid`) · 약탈 누계(도적 `loot`) · 판 끝 인구(`eight.pop`) · 날 400 인구 · 빈 마을 ·
//     walk 길 위 단(떠남 · 닿음 · 판 끝 길 위) · 한 사람 몸 둘(T1039 관찰기 넘침 최대 · 그런 날) · 몸 없이 사라진 몸(모든 마을 · 해체 마을 · 문).
const fs = require('fs');
const path = require('path');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const RUNS = arg('--runs'); const JOUT = arg('--json');
if (!RUNS) { console.error('--runs <dir>'); process.exit(2); }
const ARMS = ['old', 'walk', 'spawn'], CTL = ['main', 'raid1', 'raid2', 'raid3'], SEEDS = [1020, 7, 42];
const load = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const sec = {};
try { for (const ln of fs.readFileSync(path.join(RUNS, 'done.txt'), 'utf8').split('\n')) { const m = /^(\w+):(\w+):(\d+) rc=(\d+) sec=(\d+)/.exec(ln); if (m) sec[`${m[1]}-${m[2]}-${m[3]}`] = { rc: +m[4], sec: +m[5] }; } } catch (e) {}
function one(arm, ctl, seed) {
  const dir = path.join(RUNS, `${arm}-${ctl}-${seed}`);
  const run = load(path.join(dir, `base-${seed}.json`)); if (!run) return null;
  const dc = load(path.join(dir, `base-${seed}.dctl.json`)), ob = load(path.join(dir, `base-${seed}.t1039.json`)), o22 = load(path.join(dir, `base-${seed}.t1022.json`));
  const r400 = (run.rows || []).find((r) => r[0] === 400);
  const v22 = o22 ? o22.dis.reduce((a, d) => a + d.bodies.filter((b) => b.end === 'vanish').length, 0) : null;
  return {
    arm, ctl, seed, days: run.days, dissolved: run.dissolved, empty: run.empty, pop: run.eight && run.eight.pop, pop400: r400 ? r400[1].reduce((a, x) => a + x, 0) : null,
    raid: dc ? dc.seen.raid : null, loot: run.bandit ? run.bandit.loot : null, conv: run.bandit ? run.bandit.conv : null,
    road: ob ? { depart: ob.road.depart.length, arrive: ob.road.arrive.filter((x) => x.formed).length, end: (ob.roadEnd || []).length, wait: ob.road.arrive.filter((x) => x.formed).map((x) => { const d = ob.road.depart.find((q) => q.id === x.id); return d ? x.day - d.d0 : null; }),
      eta: ob.road.depart.map((q) => (q.eta != null ? q.eta - q.d0 : null)), bodies: ob.road.depart.map((q) => q.bodies) } : null,
    two: ob ? { max: ob.two.excessMax, days: ob.two.excessDays, rows: ob.two.rows.length, w2Max: ob.two.w2Max != null ? ob.two.w2Max : null, w2Days: ob.two.w2Days != null ? ob.two.w2Days : null, lagMax: ob.two.lagMax != null ? ob.two.lagMax : null,
      w2rows: ob.two.w2rows || (ob.two.w2Max == null ? ob.two.rows.filter((q) => q.walking > 0) : []) } : null,
    vanish: ob ? { all: ob.vanish.all, dis: ob.vanish.dis, rowsN: ob.vanish.rows.length, allRows: ob.vanish.rows, rows: ob.vanish.rows.filter((r) => r.dis) } : null,
    vanish22: v22, walked22: o22 ? o22.dis.reduce((a, d) => a + d.bodies.filter((b) => b.kind === 'walk').length, 0) : null, stat: ob ? ob.t1039Stat : null, errs: [...((ob && ob.errs) || []), ...((o22 && o22.errs) || [])].length, arm0: ob ? ob.arm : null,
    sec: sec[`${arm}-${ctl}-${seed}`] || null,
  };
}
const R = {};
for (const a of ARMS) { R[a] = {}; for (const c of CTL) { R[a][c] = {}; for (const s of SEEDS) R[a][c][s] = one(a, c, s); } }
const fmt = (x) => (x == null ? '—' : (typeof x === 'number' ? (Math.abs(x) >= 1000 ? x.toLocaleString('en-US') : String(Math.round(x * 1000) / 1000)) : String(x)));
const band = (xs) => { const a = xs.filter((x) => x != null); if (!a.length) return '—'; const lo = Math.min(...a), hi = Math.max(...a); return lo === hi ? fmt(lo) : `${fmt(lo)} ~ ${fmt(hi)}`; };
const runs = (a) => CTL.map((c) => SEEDS.map((s) => R[a][c][s])).flat().filter(Boolean);
const have = (a) => CTL.map((c) => SEEDS.map((s) => (R[a][c][s] ? 1 : 0)).join('')).join(' · ');
const sumOver = (a, c, f) => { const xs = SEEDS.map((s) => R[a][c][s]); return xs.every(Boolean) ? xs.reduce((q, o) => q + f(o), 0) : null; };
console.log(`\n=== T1039 — 도적 전환 몸 갈래 셋 · 800날 판 자 · 띠(T837 판 넷) · 판 = ${RUNS} ===`);
for (const a of ARMS) console.log(`  ${a}: 판 있음 ${have(a)}(main · raid1 · raid2 · raid3 × 1020 7 42)`);
const rowsOut = [];
function row(label, f, sum) {
  const cells = ARMS.map((a) => {
    const per = SEEDS.map((s) => band(CTL.map((c) => (R[a][c][s] ? f(R[a][c][s]) : null))));
    const tot = sum ? band(CTL.map((c) => sumOver(a, c, f))) : '';
    return { per, tot };
  });
  rowsOut.push({ label, cells });
  console.log(`| ${label} | ${cells.map((c) => `${c.per.join(' / ')}${sum ? ` · **${c.tot}**` : ''}`).join(' | ')} |`);
}
console.log('\n| 셈(시드 1020 / 7 / 42 · **3시드 합 띠**) | 종전 | walk | spawn |');
console.log('|---|---|---|---|');
row('도적화(해체) 곳 수', (o) => o.dissolved, true);
row('습격 조우(diverge-ctl)', (o) => o.raid, true);
row('약탈 누계(도적 loot)', (o) => o.loot, true);
row('도적 전환 사람(conv)', (o) => o.conv, true);
row('판 끝 인구', (o) => o.pop, true);
row('날 400 인구', (o) => o.pop400, true);
row('빈 마을(판 끝)', (o) => o.empty, true);
row('walk 떠난 단', (o) => (o.road ? o.road.depart : null), true);
row('walk 닿아 선 단', (o) => (o.road ? o.road.arrive : null), true);
row('walk 판 끝 길 위 단', (o) => (o.road ? o.road.end : null), true);
row('단 몸 + 걷는 몸 > 단 사람 — 넘침 최대(가름 전)', (o) => (o.two ? o.two.max : null), false);
row('그런 날(가름 전)', (o) => (o.two ? o.two.days : null), true);
row('★한 사람 몸 둘(걷는 몸 몫) — 넘침 최대', (o) => (o.two ? o.two.w2Max : null), false);
row('★한 사람 몸 둘 — 그런 날', (o) => (o.two ? o.two.w2Days : null), true);
row('단 몸 > 단 사람(그날 끝 syncBodies 까지 · 몸 늦음) — 넘침 최대', (o) => (o.two ? o.two.lagMax : null), false);
row('몸 없이 사라진 몸 — 모든 마을', (o) => (o.vanish ? o.vanish.all : null), true);
row('몸 없이 사라진 몸 — 해체 마을', (o) => (o.vanish ? o.vanish.dis : null), true);
row('(T1022 관찰기 vanish — 해체 마을)', (o) => o.vanish22, true);
row('해체 마을 명부에서 걸어 나간 몸(T1022 관찰기)', (o) => o.walked22, true);
// walk 길 위 날
const W = runs('walk');
const etas = W.flatMap((o) => (o.road ? o.road.eta : [])).filter((x) => x != null), waits = W.flatMap((o) => (o.road ? o.road.wait : [])).filter((x) => x != null);
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
console.log(`\n* walk 길 위 날(장부 닿는 날 − 떠난 날 · 12판 모든 단): ${etas.length}단 · 중앙 ${fmt(med(etas))} · 최소 ${fmt(Math.min(...etas))} · 최대 ${fmt(Math.max(...etas))} · 닿아 선 단 ${waits.length}(걸린 날 ${waits.join(', ') || '—'})`);
console.log(`* walk 떠난 몸(단마다): ${W.flatMap((o) => (o.road ? o.road.bodies : [])).join(', ') || '—'}`);
// 문
const doorOf = (by) => { const fr = String(by || '').split(' < ').map((x) => x.replace(/@.*/, '')).filter((x) => x && x !== 'P.delete'); return fr.slice(0, 2).join(' ← ') || '(players 에서 안 지움)'; };
const doors = {}, doorsDis = {}, life = {};
let rowsAll = 0, vAll = 0;
for (const a of ARMS) for (const o of runs(a)) if (o.vanish) {
  vAll += o.vanish.all; rowsAll += o.vanish.allRows.length;
  for (const r of o.vanish.allRows) { const k = doorOf(r.by); doors[k] = (doors[k] || 0) + 1; if (r.dis) doorsDis[k] = (doorsDis[k] || 0) + 1; const L = `${r.hp > 0 ? '산 몸' : '쓰러진 몸(hp 0)'}${r.muster ? ' · 출정' : ''}${r.captive ? ' · 포로' : ''}`; life[L] = (life[L] || 0) + 1; }
}
const lies = ARMS.flatMap((a) => runs(a)).flatMap((o) => (o.vanish ? o.vanish.allRows : [])).filter((r) => r.lieMs != null);
if (lies.length) { const ms = lies.map((r) => r.lieMs).sort((x, y) => x - y), dd = lies.map((r) => r.lieDays).sort((x, y) => x - y);
  console.log(`* 쓰러진 뒤 거둘 때까지(명부 몸이 hp 0 이 된 첫 틱 → 사라진 틱 · 관찰기 v2 판 ${lies.length}몸): 벽시계 중앙 ${ms[ms.length >> 1]}ms · 최소 ${ms[0]} · 최대 ${ms[ms.length - 1]} · econ 날 중앙 ${dd[dd.length >> 1]} · 최대 ${dd[dd.length - 1]}`); }
console.log(`\n* 사라짐 줄 ${rowsAll} / 사라짐 ${vAll}(줄은 판마다 해체 마을 전부 + 그 밖 200 까지) · 몸 상태(지운 그 순간): ${Object.entries(life).map(([k, v]) => k + ' ' + v).join(' · ')}`);
console.log('\n| 몸 없이 사라진 몸의 문(36판 합 · 첫 제품 함수) | 모든 마을 | 해체 마을 |');
console.log('|---|---:|---:|');
for (const k of Object.keys(doors).sort((x, y) => doors[y] - doors[x])) console.log(`| \`${k}\` | ${doors[k]} | ${doorsDis[k] || 0} |`);
console.log('\n* 해체 마을 사라짐 줄(판 · 날 · 마을 · 해체 뒤 날 · 문 스택):');
for (const a of ARMS) for (const o of runs(a)) for (const r of (o.vanish ? o.vanish.rows : [])) console.log(`  - ${o.arm}-${o.ctl}-${o.seed} D${r.day} ${r.v} 해체 +${r.sinceDis}날 · hp ${r.hp} · 출정 ${r.muster} · 문 ${doorOf(r.by)}`);
console.log('\n* 한 사람 몸 둘(걷는 몸 몫) 줄(판 · 날 · 단 · 고향 · 단 사람 · 단 몸 · 걷는 몸):');
for (const a of ARMS) for (const o of runs(a)) for (const q of (o.two ? o.two.w2rows : [])) console.log(`  - ${o.arm}-${o.ctl}-${o.seed} D${q.day} 단#${q.id} ${q.home} · ${q.n}명 · 단 몸 ${q.gangBodies} · 걷는 몸 ${q.walking}${q.road ? ' · 길 위' : ''}`);
const secs = ARMS.flatMap((a) => runs(a)).map((o) => o.sec).filter(Boolean);
console.log(`\n* 판 시간: ${secs.length}판 · ${band(secs.map((x) => x.sec))}초 · 1시간 넘은 판 ${secs.filter((x) => x.sec >= 3600).length} · rc≠0 ${secs.filter((x) => x.rc !== 0).length} · 관찰기 오류 ${ARMS.flatMap((a) => runs(a)).reduce((q, o) => q + o.errs, 0)}`);
console.log(`* 판 끝 날: ${band(ARMS.flatMap((a) => runs(a)).map((o) => o.days))} · 관찰기 갈래 표 = 판 갈래 ${ARMS.every((a) => runs(a).every((o) => o.arm0 === a)) ? '모두 같음' : '다른 판 있음'}`);
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify({ made: '2026-11-02', runs: R, rows: rowsOut, doors, doorsDis, life }, null, 0));
