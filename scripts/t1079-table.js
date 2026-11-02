'use strict';
// (@regress 없음 — 러너 밖 · T1079 표 기계 · 읽기만)
// === scripts/t1079-table.js — 판 자 끔 ↔ 켬(`T1079_BANDIT_CAMP`) 표 ===
//   node scripts/t1079-table.js --off <dir> --on <dir> [--json <out.json>]
//   ⓐ 도적 · 몸 · 비용 줄 = `t1078-table.js` 를 그대로 부른다(같은 자 · 사본 0) · ⓑ 시설 · 무기 짐 셈 줄 = 관찰기 `t1079-observe` 의 `<판>-<시드>.t1079.json`.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const DIRS = { off: arg('--off'), on: arg('--on') };
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const J = arg('--json');
const tj = J ? J.replace(/\.json$/, '') + '.t1078.json' : null;
const t78 = execFileSync(process.execPath, [path.join(__dirname, 't1078-table.js'), '--off', DIRS.off || '', '--on', DIRS.on || ''].concat(tj ? ['--json', tj] : []), { encoding: 'utf8' });
function load(dir) {
  const out = {};
  if (!dir || !fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.*)-(\d+)\.t1079\.json$/.exec(f); if (!m) continue;
    const t = rd(path.join(dir, f)); if (!t) continue;
    const st = (t.t1079 && t.t1079.stat) || {}, piles = (t.t1079 && t.t1079.piles) || [], end = t.arms.end || {};
    out[m[2]] = {
      days: t.days, armsIn: end.inn, armsLive: end.live, armsLeft: end.left, armsCarry: end.carry, armsVil: end.vil, armsLost: end.lost, lostMax: t.arms.lostMax, lostDays: t.arms.lostDays, firstLost: t.arms.firstLost,
      goneN: t.arms.gone.length, goneArms: +t.arms.gone.reduce((a, g) => a + g.arms, 0).toFixed(6),
      pitch: st.pitch || 0, adopt: st.adopt || 0, left: st.left || 0, pilesEnd: piles.length, leftEnd: piles.filter((p) => p.gid == null).length, foodMax: +t.camp.foodMax.toFixed(1), kgMax: +t.camp.kgMax.toFixed(1),
      join: st.join || 0, joinN: st.joinN || 0, out: st.out || 0, home: st.home || 0, homeBody: st.homeBody || 0, noRec: st.noRec || 0, hand: st.hand || 0, vilArms: st.vilArms || 0, unload: st.unload || 0, lost: st.lost || 0,
      scrumCalls: t.scrum.calls, scrumArmed: t.scrum.armed, scrumMen: t.scrum.men, dayMax: t.perf.dayMax, dayMsMean: t.perf.dayN ? +(t.perf.dayMs / t.perf.dayN).toFixed(3) : null, errs: t.errs.length,
    };
  }
  return out;
}
const R = { off: load(DIRS.off), on: load(DIRS.on) };
const SEEDS = ['1020', '7', '42'];
const rows = [
  ['무기 짐 들어옴(장물 실물 · T521)', 'armsIn'], ['무기 짐 — 선 단', 'armsLive'], ['무기 짐 — 흩어진 더미', 'armsLeft'], ['무기 짐 — 몸 짐', 'armsCarry'], ['무기 짐 — 마을 곳간으로', 'armsVil'],
  ['**무기 짐 소멸(끝 날)**', 'armsLost'], ['무기 짐 소멸 최대', 'lostMax'], ['소멸이 선 날 수', 'lostDays'], ['소멸 첫 날', 'firstLost'], ['짐을 쥔 채 사라진 단', 'goneN'], ['그 단들의 무기 짐', 'goneArms'],
  ['야영 터 세움(pitch)', 'pitch'], ['옛 더미 이음(adopt)', 'adopt'], ['흩어진 단이 남긴 더미(left)', 'left'], ['판 끝 더미', 'pilesEnd'], ['판 끝 흩어진 더미', 'leftEnd'], ['더미 식량 최대', 'foodMax'], ['더미 무게 kg 최대', 'kgMax'],
  ['해산 — 다른 단 합류(번)', 'join'], ['해산 — 합류한 사람', 'joinN'], ['해산 — 마을로 걸음(사람)', 'out'], ['마을에 닿아 주민', 'home'], ['그중 몸이 주민', 'homeBody'], ['사람 기록 없이 닿음(몸 거둠)', 'noRec'],
  ['제 무기 몸 짐에(자루)', 'hand'], ['몸 짐 → 마을 곳간(자루)', 'vilArms'], ['몸 짐 → 합류 단 더미(자루)', 'unload'], ['갈 곳 없이 지운 몸', 'lost'],
  ['econ 약탈 실전투 무기 읽음(부름)', 'scrumCalls'], ['그때 든 무기 합', 'scrumArmed'], ['그때 단 사람 합', 'scrumMen'],
  ['도적 하루 ms 평균(관찰기 둘째 감싸개)', 'dayMsMean'], ['도적 하루 ms 최대', 'dayMax'], ['관찰기 오류', 'errs'],
];
const lines = [];
lines.push('| 셈 | ' + SEEDS.map((s) => `${s} 끔 | ${s} 켬`).join(' | ') + ' | 3시드 합 끔 | 3시드 합 켬 |');
lines.push('|---|' + SEEDS.map(() => '---:|---:').join('|') + '|---:|---:|');
const sum = (arm, k) => { let a = 0, any = false; for (const s of SEEDS) { const v = R[arm][s] && R[arm][s][k]; if (typeof v === 'number') { a += v; any = true; } } return any ? +a.toFixed(3) : '—'; };
for (const [label, k] of rows) {
  const cells = SEEDS.map((s) => [R.off[s] ? R.off[s][k] : '—', R.on[s] ? R.on[s][k] : '—'].map((v) => (v == null ? '—' : v)).join(' | '));
  const summable = !/평균|최대|첫 날|ms/.test(label);
  lines.push(`| ${label} | ${cells.join(' | ')} | ${summable ? sum('off', k) : '—'} | ${summable ? sum('on', k) : '—'} |`);
}
console.log(t78.trim() + '\n\n' + lines.join('\n'));
if (J) fs.writeFileSync(J, JSON.stringify({ dirs: DIRS, R }, null, 1));
