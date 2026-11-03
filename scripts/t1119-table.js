'use strict';
// (@regress 없음 — 러너 밖 · T1119 표 기계 · 읽기만)
// === scripts/t1119-table.js — 도적 실체화 손잡이 셋 · 판 넷(끔 · 1078 · 1078+1079 · 셋 다) 표 ===
//   node scripts/t1119-table.js --arm off=<dir> --arm a1=<dir> --arm a2=<dir> --arm a3=<dir> [--json <out.json>] [--seeds 1020,7,42]
//   ⓐ 판마다 줄 = `t1104-table.js`(→ `t1079-table.js` → `t1078-table.js`)를 그 폴더 하나로 부른 값 그대로(같은 자 · 사본 0 — `--off` 칸만 읽는다)
//   ⓑ 비용 줄 = 관찰기 `t1119-cost-observe` 의 `<판>-<시드>.t1119.json`(게임 틱 평균 · p99 · 몸 수).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const A = process.argv.slice(2);
const arms = [];
for (let i = 0; i < A.length; i++) if (A[i] === '--arm') { const [k, d] = A[i + 1].split('='); arms.push([k, d]); }
const opt = (k) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const SEEDS = String(opt('--seeds') || '1020,7,42').split(',');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const NAMES = { off: '끔', a1: 'T1078', a2: 'T1078+T1079', a3: '셋 다' };
const R = {};
for (const [k, d] of arms) {
  const tj = path.join(os.tmpdir(), `t1119-${process.pid}-${k}.json`);
  execFileSync(process.execPath, [path.join(__dirname, 't1104-table.js'), '--off', d, '--on', '', '--json', tj], { encoding: 'utf8' });
  const a = (rd(tj) || { R: { off: {} } }).R.off, b = (rd(tj.replace(/\.json$/, '.t1079.json')) || { R: { off: {} } }).R.off, c = (rd(tj.replace(/\.json$/, '.t1079.t1078.json')) || { R: { off: {} } }).R.off;
  for (const f of [tj, tj.replace(/\.json$/, '.t1079.json'), tj.replace(/\.json$/, '.t1079.t1078.json')]) { try { fs.unlinkSync(f); } catch (e) {} }
  R[k] = {};
  for (const s of SEEDS) {
    const o = Object.assign({}, c[s] || {}, Object.fromEntries(Object.entries(b[s] || {}).map(([x, v]) => ['c79_' + x, v])), Object.fromEntries(Object.entries(a[s] || {}).map(([x, v]) => ['w04_' + x, v])));
    const f = fs.existsSync(d) ? fs.readdirSync(d).find((x) => new RegExp(`-${s}\\.t1119\\.json$`).test(x)) : null;
    const t = f ? rd(path.join(d, f)) : null;
    if (t) Object.assign(o, { tickN: t.tick.n, tickMean: t.tick.mean, tickP50: t.tick.p50, tickP99: t.tick.p99, tickMax: t.tick.max, bodyMean: t.bodyMean, bodyMax: t.body.max, bodyEnd: t.body.end, downMean: t.downMean, vilMean: t.vilMean,
      usPerBody: t.bodyMean ? +((t.tick.mean / t.bodyMean) * 1000).toFixed(3) : null, cap: t.knob.VILLAGE_NPC_CAP, costErrs: t.errs.length });
    R[k][s] = o;
  }
}
//   끔 대비 몸 하나 몫(셈만 — 새 수 0): (이 판 틱 평균 − 끔 틱 평균) ÷ (이 판 몸 평균 − 끔 몸 평균) · µs
if (R.off) for (const [k] of arms) for (const s of SEEDS) { const o = R[k][s], z = R.off[s]; if (k === 'off' || !o || !z || o.tickMean == null || z.tickMean == null) continue;
  const db = o.bodyMean - z.bodyMean; o.dUsPerBody = db ? +(((o.tickMean - z.tickMean) / db) * 1000).toFixed(3) : null; o.dBody = +db.toFixed(2); o.dTick = +(o.tickMean - z.tickMean).toFixed(4); }
const ROWS = [
  ['판 날', 'days', 'x'], ['판 끝 인구', 'pop', 's'], ['해체(도적화 곳)', 'dissolved', 's'], ['빈 마을', 'empty', 's'], ['도적 전환 사람(conv)', 'conv', 's'], ['절망 이탈(exo)', 'exo', 's'],
  ['단 최대(peak · 도적 층)', 'peak', 'x'], ['단 수 최대(관찰기)', 'maxGangs', 'x'], ['소굴 재결성(denForm)', 'denForm', 's'], ['해산(disband)', 'disband', 's'],
  ['단 사람 평균', 'meanPersons', 'x'], ['단 몸 최대', 'maxBodies', 'x'],
  ['습격 조우(diverge-ctl)', 'raids', 's'], ['약탈 누계(loot)', 'loot', 's'], ['약탈 양(lootAmt)', 'lootAmt', 's'], ['행상 피살', 'tradersKilled', 's'],
  ['토벌 교전', 'sup', 's'], ['토벌 사살', 'supKill', 's'], ['토벌 원정 전사', 'supExpDead', 's'],
  ['굶주림 −1(starve)', 'starve', 's'],
  ['야영 터 세움(pitch)', 'c79_pitch', 's'], ['옛 더미 이음(adopt) = 더미 줍기', 'c79_adopt', 's'], ['흩어진 단이 남긴 더미(left)', 'c79_left', 's'], ['더미 식량 최대', 'c79_foodMax', 'x'],
  ['길목으로 나감(T1104 out)', 'w04_out', 's'], ['못 닿아 안 나감(T1104 far)', 'w04_far', 's'], ['길목 만남(T1104 met)', 'w04_met', 's'], ['원정 떠남(T1104 supGo)', 'w04_supGo', 's'], ['원정 더미 실음(T1104 supLoad)', 'w04_supLoad', 's'],
  ['도적 하루 ms 평균', 'dayMsMean', 'x'], ['도적 하루 ms 최대', 'dayMax', 'x'],
  ['게임 틱 수', 'tickN', 's'], ['게임 틱 ms 평균', 'tickMean', 'x'], ['게임 틱 ms p50', 'tickP50', 'x'], ['게임 틱 ms p99', 'tickP99', 'x'], ['게임 틱 ms 최대', 'tickMax', 'x'],
  ['NPC 몸 평균(하루 끝)', 'bodyMean', 'x'], ['NPC 몸 최대', 'bodyMax', 'x'], ['NPC 몸 끝 날', 'bodyEnd', 's'], ['누운 몸 평균', 'downMean', 'x'],
  ['틱 평균 ÷ 몸 평균(µs/몸)', 'usPerBody', 'x'],
  ['끔 대비 틱 평균 차(ms)', 'dTick', 'x'], ['끔 대비 몸 평균 차', 'dBody', 'x'], ['끔 대비 차 ÷ 몸 차(µs/몸)', 'dUsPerBody', 'x'],
  ['관찰기 오류(t1078 · t1119)', 'errs', 's'],
];
const ks = arms.map(([k]) => k);
const fmt = (v) => (v == null ? '—' : (typeof v === 'number' ? String(+v.toFixed(3)) : String(v)));
const lines = [];
lines.push('| 셈 | ' + ks.map((k) => SEEDS.map((s) => `${NAMES[k] || k} ${s}`).join(' | ') + (SEEDS.length > 1 ? ` | ${NAMES[k] || k} 합` : '')).join(' | ') + ' |');
lines.push('|---|' + ks.map(() => SEEDS.map(() => '---:').join('|') + (SEEDS.length > 1 ? '|---:' : '')).join('|') + '|');
for (const [label, key, how] of ROWS) {
  if (!ks.some((k) => SEEDS.some((s) => R[k][s] && R[k][s][key] != null))) continue;
  const cells = ks.map((k) => {
    const vs = SEEDS.map((s) => (R[k][s] ? R[k][s][key] : null));
    let tot = '—';
    if (how === 's' && vs.some((v) => typeof v === 'number')) tot = fmt(vs.reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0));
    return vs.map(fmt).join(' | ') + (SEEDS.length > 1 ? ' | ' + tot : '');
  });
  lines.push(`| ${label} | ${cells.join(' | ')} |`);
}
console.log(lines.join('\n'));
const J = opt('--json');
if (J) fs.writeFileSync(J, JSON.stringify({ arms: Object.fromEntries(arms), seeds: SEEDS, R }, null, 1));
