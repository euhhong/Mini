'use strict';
// (@regress 없음 — 러너 밖 · T1104 표 기계 · 읽기만)
// === scripts/t1104-table.js — 판 자 끔 ↔ 켬(`T1104_BANDIT_WALK`) 표 ===
//   node scripts/t1104-table.js --off <dir> --on <dir> [--json <out.json>]
//   ⓐ 도적 · 몸 · 비용 · 시설 줄 = `t1079-table.js`(→ `t1078-table.js`)를 그대로 부른다(같은 자 · 사본 0) · ⓑ 걸음 줄 = 관찰기 `t1104-observe` 의 `<판>-<시드>.t1104.json`.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const DIRS = { off: arg('--off'), on: arg('--on') };
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const J = arg('--json');
const tj = J ? J.replace(/\.json$/, '') + '.t1079.json' : null;
const t79 = execFileSync(process.execPath, [path.join(__dirname, 't1079-table.js'), '--off', DIRS.off || '', '--on', DIRS.on || ''].concat(tj ? ['--json', tj] : []), { encoding: 'utf8' });
function load(dir) {
  const out = {};
  if (!dir || !fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)-(\d+)\.t1104\.json$/.exec(f); if (!m) continue;
    const t = rd(path.join(dir, f)); if (!t) continue;
    const st = t.stat || {};
    out[m[2]] = Object.assign({ days: t.days, gCamp: t.gangDays.camp || 0, gOut: t.gangDays.out || 0, gBack: t.gangDays.back || 0, supMax: t.supMax, errs: t.errs.length }, st);
  }
  return out;
}
const R = { off: load(DIRS.off), on: load(DIRS.on) };
const SEEDS = ['1020', '7', '42'];
const rows = [
  ['단-날 은거지', 'gCamp'], ['단-날 길목으로 · 길목에', 'gOut'], ['단-날 돌아옴', 'gBack'],
  ['길목으로 나감(out)', 'out'], ['못 닿아 안 나감(far — 판단 수)', 'far'], ['길목에서 만남 = 약탈 판(met)', 'met'], ['놓치고 돌아옴(miss)', 'miss'], ['은거지에 닿음(home)', 'home'],
  ['더미에 내린 식량', 'food'], ['더미에 내린 무기 짐', 'arms'], ['더미가 차 몸 짐에 남음(번)', 'keep'], ['몸 없이 장부 노획(번)', 'ledger'], ['해산에 장부 노획 → 더미(번)', 'drop'], ['다시 뜸에 접은 걸음', 'boot'],
  ['원정 떠남(supGo)', 'supGo'], ['원정 몸', 'supBodies'], ['단을 기다림', 'supWait'], ['은거지 교전', 'supFight'], ['원정 몸 쓰러짐', 'supFell'], ['이겨 더미에 닿음', 'supWon'], ['더미를 실음', 'supLoad'], ['집에 닿음', 'supHome'], ['곳간에 내림', 'supStore'], ['빈 은거지', 'supEmpty'],
  ['걷는 원정 최대', 'supMax'], ['관찰기 오류', 'errs'],
];
const lines = [];
lines.push('| 셈 | ' + SEEDS.map((s) => `${s} 끔 | ${s} 켬`).join(' | ') + ' | 3시드 합 끔 | 3시드 합 켬 |');
lines.push('|---|' + SEEDS.map(() => '---:|---:').join('|') + '|---:|---:|');
const sum = (arm, k) => { let a = 0, any = false; for (const s of SEEDS) { const v = R[arm][s] && R[arm][s][k]; if (typeof v === 'number') { a += v; any = true; } } return any ? +a.toFixed(3) : '—'; };
for (const [label, k] of rows) {
  const v = (arm, s) => { const o = R[arm][s]; if (!o) return '—'; const x = o[k]; return x == null ? '—' : (typeof x === 'number' ? +x.toFixed(3) : x); };
  lines.push(`| ${label} | ${SEEDS.map((s) => v('off', s) + ' | ' + v('on', s)).join(' | ')} | ${/최대/.test(label) ? '—' : sum('off', k)} | ${/최대/.test(label) ? '—' : sum('on', k)} |`);
}
console.log(t79.trim() + '\n\n' + lines.join('\n'));
if (J) fs.writeFileSync(J, JSON.stringify({ dirs: DIRS, R }, null, 1));
