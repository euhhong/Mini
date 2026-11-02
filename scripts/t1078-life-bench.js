// (@regress 없음 — 러너 밖 · T1078 일과 문 마이크로 벤치 · 읽기만)
// T1078 일과 문 한 번의 값(마이크로 벤치 · 목 세계 · 운영 함수 `_t1078Life` 그대로)
process.env.ENABLE_VILLAGES = '0'; process.env.T1078_BANDIT_ALL = '1';
const V = require(require('path').join(__dirname, '..', 'server', 'villages'));
let ph = 0.3;
const players = new Map(), npcs = new Set();
const H = V.__p3Bind({ ready: true, zoneId: 'b', deps: { players, npcs, broadcast: () => {}, worldPhase: () => ph, dayPhaseRatio: 0.7 }, villages: [], byDbId: new Map(), world: { day: 1 }, dayMs: 30000, bodyExits: new Map() });
const bodies = []; for (let i = 0; i < 30; i++) bodies.push({ pid: 'p' + i, x: 100 + i, y: 100, npcHomeX: 100, npcHomeY: 100, hp: 100, maxHp: 100, _bdtGid: 1, _t1078Fed: 1, inventory: {} });
const out = {};
for (const [name, p0] of [['낮(배회 — false)', 0.35], ['아침 창(식사)', 0.05], ['밤(취침)', 0.9]]) {
  ph = p0; const N = 2e6; let r = 0;
  for (let k = 0; k < 2e5; k++) r += H._t1078Life(bodies[k % 30], k) ? 1 : 0;   // 덥히기
  const t0 = process.hrtime.bigint(); for (let k = 0; k < N; k++) r += H._t1078Life(bodies[k % 30], k) ? 1 : 0; const t1 = process.hrtime.bigint();
  out[name] = { calls: N, nsPerCall: +(Number(t1 - t0) / N).toFixed(1), owned: r };
}
console.log(JSON.stringify(out, null, 1));
