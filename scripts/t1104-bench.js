'use strict';
// (@regress 없음 — 러너 밖 · T1104 비용 자 · 읽기만)
// === scripts/t1104-bench.js — 걸음 몸 하나의 틱 몫 · 도적 하루 몫(목 세계 `test-bandit-walk` 아이 판을 끔 · 켬으로 K번) ===
//   node scripts/t1104-bench.js [K=5] [--json out.json]
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const K = parseInt(process.argv[2], 10) || 5, J = process.argv.indexOf('--json') >= 0 ? process.argv[process.argv.indexOf('--json') + 1] : null;
function sub(name, on) {
  const env = Object.assign({}, process.env, { T1104_SUB: name, BANDIT_MINDAY: '1', T1078_BANDIT_ALL: '1', T1079_BANDIT_CAMP: '1' });
  delete env.T1104_BANDIT_WALK; if (on) env.T1104_BANDIT_WALK = '1';
  const o = execFileSync(process.execPath, [path.join(__dirname, 'test-bandit-walk.js')], { env, encoding: 'utf8', maxBuffer: 64 << 20 });
  return JSON.parse(o.split('\n').find((l) => l.startsWith('T1104SUB ')).slice(9)).A.perf;
}
const out = {};
for (const name of ['raid', 'sup']) for (const on of [false, true]) {
  const ps = []; for (let k = 0; k < K; k++) ps.push(sub(name, on));
  const med = (f) => { const a = ps.map(f).sort((x, y) => x - y); return a[a.length >> 1]; };
  out[name + (on ? '-on' : '-off')] = { tickMs: +med((p) => p.tickMs).toFixed(3), dayMsMean: +med((p) => p.dayMs / p.days).toFixed(4), walkTicks: ps[0].walkTicks };
}
for (const name of ['raid', 'sup']) { const a = out[name + '-off'], b = out[name + '-on']; out[name + '-perBodyTickUs'] = b.walkTicks ? +(((b.tickMs - a.tickMs) / b.walkTicks) * 1000).toFixed(3) : null; out[name + '-dayMsDelta'] = +(b.dayMsMean - a.dayMsMean).toFixed(4); }
console.log(JSON.stringify(out, null, 1));
if (J) fs.writeFileSync(J, JSON.stringify(out, null, 1));
