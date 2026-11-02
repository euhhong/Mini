'use strict';
// (@regress 없음 — 러너 밖 · T1078 표 기계 · 읽기만)
// === scripts/t1078-table.js — 판 자 끔 ↔ 켬(`T1078_BANDIT_ALL`) 표 — 판 JSON(`t577-server-hook`) · `.dctl.json`(습격 조우) · `.t1078.json`(관찰기) ===
//   node scripts/t1078-table.js --off <dir> --on <dir> [--json <out.json>]
const fs = require('fs');
const path = require('path');
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const DIRS = { off: arg('--off'), on: arg('--on') };
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function load(dir) {
  const out = {};
  if (!dir || !fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)-(\d+)\.json$/.exec(f); if (!m) continue;
    const base = path.join(dir, f.replace(/\.json$/, ''));
    const o = rd(path.join(dir, f)), c = rd(base + '.dctl.json'), t = rd(base + '.t1078.json');
    if (!o) continue;
    const raids = c && c.raids ? Object.values(c.raids).reduce((a, b) => a + b, 0) : null;
    const b = (t && t.bstats) || {}, bo = t ? t.body : {}, pf = t ? t.perf : {};
    const dead = (b.t1078 && b.t1078.dead) || {};
    out[m[2]] = {
      days: o.days, pop: o.eight.pop, dissolved: o.dissolved, empty: o.empty, deadTot: o.deadTot, tradersKilled: o.tradersKilled,
      conv: b.conv, exo: b.exo, raids, loot: b.loot, lootAmt: b.lootAmt != null ? +b.lootAmt.toFixed(1) : null,
      sup: t ? t.sup.n : null, supKill: t ? t.sup.kill : null, supExpDead: t ? t.sup.expDead : null, supDeadStat: b.supDead,
      starve: b.starve, disband: b.disband, denForm: b.denForm, denClear: b.denClear, peak: b.peak,
      t1039Depart: b.t1039Depart || 0, t1039Arrive: b.t1039Arrive || 0,
      maxBodies: bo.maxBodies, meanBodies: t && t.days ? +(bo.sumBodies / t.days).toFixed(2) : null, maxPersons: bo.maxPersons, meanPersons: t && t.days ? +(bo.sumPersons / t.days).toFixed(2) : null,
      maxGangs: bo.maxGangs, overDays: bo.overDays, overMax: bo.overMax, shortDays: bo.shortDays, shortMax: bo.shortMax, maxWalkers: bo.maxWalkers,
      deadSup: dead.sup || 0, deadStarve: dead.starve || 0, deadOther: dead.other || 0, deadHit: Object.entries(dead).filter(([k]) => !['sup', 'starve', 'other'].includes(k)).reduce((a, [, v]) => a + v, 0),
      out: (b.t1078 && b.t1078.out) || 0, join: (b.t1078 && b.t1078.join) || 0,
      dayN: pf.dayN, dayMsMean: pf.dayN ? +(pf.dayMs / pf.dayN).toFixed(3) : null, dayMax: pf.dayMax, dayMsTot: pf.dayMs,
      lifeN: pf.lifeN, lifeMs: pf.lifeMs, ticks: pf.ticks, tickMs: pf.tickMs, cpuMs: pf.cpuMs, wallMs: pf.wallMs,
      dayShareCpu: pf.cpuMs ? +(100 * pf.dayMs / pf.cpuMs).toFixed(4) : null,
      errs: t ? t.errs.length : null,
    };
  }
  return out;
}
const R = { off: load(DIRS.off), on: load(DIRS.on) };
const SEEDS = ['1020', '7', '42'];
const rows = [
  ['판 날', 'days'], ['판 끝 인구', 'pop'], ['해체(도적화 곳)', 'dissolved'], ['빈 마을', 'empty'], ['도적 전환 사람(conv)', 'conv'], ['절망 이탈(exo)', 'exo'],
  ['습격 조우(diverge-ctl)', 'raids'], ['약탈 누계(loot)', 'loot'], ['약탈 양(lootAmt)', 'lootAmt'], ['행상 피살', 'tradersKilled'],
  ['토벌 교전', 'sup'], ['토벌 사살', 'supKill'], ['토벌 원정 전사', 'supExpDead'], ['굶주림 −1(starve)', 'starve'], ['해산(disband)', 'disband'],
  ['소굴 재결성', 'denForm'], ['소굴 철거', 'denClear'], ['단 최대(peak)', 'peak'], ['walk 떠난 단', 't1039Depart'], ['walk 닿아 선 단', 't1039Arrive'],
  ['단 사람 최대(하루 끝)', 'maxPersons'], ['단 사람 평균', 'meanPersons'], ['단 몸 최대(은거지 + 걷는 몸)', 'maxBodies'], ['단 몸 평균', 'meanBodies'], ['단 수 최대', 'maxGangs'],
  ['몸 > 사람 날(넘침)', 'overDays'], ['넘침 최대', 'overMax'], ['사람 > 몸 날(몸 없는 사람)', 'shortDays'], ['모자람 최대', 'shortMax'], ['걷는 몸 최대', 'maxWalkers'],
  ['쓰러진 몸 — 토벌', 'deadSup'], ['쓰러진 몸 — 굶음', 'deadStarve'], ['쓰러진 몸 — 그 밖(맞춤)', 'deadOther'], ['쓰러진 몸 — 맞아 죽음(사람 · 짐승)', 'deadHit'],
  ['해산 몸 걸어 나감', 'out'], ['걸어 든 몸(이탈)', 'join'],
  ['도적 하루 수', 'dayN'], ['도적 하루 ms 평균', 'dayMsMean'], ['도적 하루 ms 최대', 'dayMax'], ['도적 하루 ms 합', 'dayMsTot'], ['일과 문 부른 수', 'lifeN'], ['일과 문 ms 합', 'lifeMs'],
  ['존 틱 수(villages)', 'ticks'], ['프로세스 CPU ms', 'cpuMs'], ['도적 하루 / CPU %', 'dayShareCpu'], ['관찰기 오류', 'errs'],
];
const lines = [];
lines.push('| 셈 | ' + SEEDS.map((s) => `${s} 끔 | ${s} 켬`).join(' | ') + ' | 3시드 합 끔 | 3시드 합 켬 |');
lines.push('|---|' + SEEDS.map(() => '---:|---:').join('|') + '|---:|---:|');
const sum = (arm, k) => { let a = 0, any = false; for (const s of SEEDS) { const v = R[arm][s] && R[arm][s][k]; if (typeof v === 'number') { a += v; any = true; } } return any ? +a.toFixed(3) : '—'; };
for (const [label, k] of rows) {
  const cells = SEEDS.map((s) => [R.off[s] ? R.off[s][k] : '—', R.on[s] ? R.on[s][k] : '—'].map((v) => (v == null ? '—' : v)).join(' | '));
  const summable = !/평균|최대|%|날$/.test(label) || /^(도적 하루 ms 합|일과 문)/.test(label);
  lines.push(`| ${label} | ${cells.join(' | ')} | ${summable ? sum('off', k) : '—'} | ${summable ? sum('on', k) : '—'} |`);
}
console.log(lines.join('\n'));
const J = arg('--json');
if (J) fs.writeFileSync(J, JSON.stringify({ dirs: DIRS, R }, null, 1));
