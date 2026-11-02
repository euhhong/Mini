'use strict';
// (@regress 없음 — 러너 밖 · T1041 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1041-time-observe.js — 판 자 하루마다 벽시계 · CPU 가 어디로 가나(몸∞ 전쟁 팔 시간 해부) ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1041-time-observe.js" VILLAGE_NPC_CAP=Infinity node scripts/t577-server-run.js 800 1020
//            (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1041.json` · `T1041_OUT` 로 바꿀 수 있다)
//   ★왜 [T1041] 몸∞ 판 800날이 3,811 ~ 4,055초(T1031)다. 그 벽시계가 어느 날(전쟁 날 · 평시 날)에 · 어느 층에 가나.
//   뜨는 것(이미 있는 문 앞에서 읽기만 — 세계 값 무변 · RNG 무접촉 · 타이머 0):
//     ⓐ 날 줄 — 장부 하루(`events.createLedger` 의 `scanDay` — econ 하루마다 한 번)에 [날 · 앞 날부터 벽시계 ms · 프로세스 CPU 사용자/시스템 ms ·
//        진행 전쟁 수 · 국면별 수 · 가시 몸 수(마을 `npcPids` 합) · 전쟁 마을 가시 몸 수 · 힙 MB]
//     ⓑ 층 셈 — 존 틱의 큰 문 셋을 같은 인자로 부르고 돌려줌을 그대로 돌려주며 **벽시계만** 잰다(`process.hrtime.bigint`):
//        `SimVillages.onGameTick`(마을 층 전체 — 존 `zone.js` 가 모듈 이름으로 부른다) · `Bandits.onGameTick`(도적) · 장부 `scanDay`. 나머지(몸 이동 · 소켓 · 저장) = 날 벽시계 − 셋.
//        (함수 단위는 `--cpu-prof` 몫 — 이 관찰기는 날 단위 · 층 단위만)
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T1041_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1041.json' : '');
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const Ev = require(path.join(ROOT, 'server', 'events'));
const COLS = ['d', 'wallMs', 'cpuUserMs', 'cpuSysMs', 'wars', 'phases', 'bodies', 'warBodies', 'heapMB', 'tVil', 'tBandit', 'tScan'];
const rec = { ver: 1, cols: COLS, seed: +(process.env.T577_SEED || 0), knob: Object.fromEntries(['VILLAGE_NPC_CAP', 'VILLAGE_DAY_MS', 'DCTL_SKIP', 'T400_BUILD_ACT', 'VILLAGE_CARAVAN_MAX', 'T1041_WAR_BODY'].map((k) => [k, process.env[k] != null ? process.env[k] : null])),
  rows: [], t0: Date.now(), errs: [] };
const err = (w, e) => { if (rec.errs.length < 40) rec.errs.push(w + ': ' + String(e && e.message || e)); };
const acc = { tVil: 0n, tBandit: 0n, tScan: 0n };
const timed = (key, f) => function () { const a = process.hrtime.bigint(); try { return f.apply(this, arguments); } finally { acc[key] += process.hrtime.bigint() - a; } };
let VL = null, B = null, lastWall = null, lastCpu = null, hooked = false;
function hook() {
  VL = require(path.join(ROOT, 'server', 'villages'));
  B = require(path.join(ROOT, 'server', 'bandits'));
  // 마을 층 · 도적 하루 — 모듈 내보냄을 감싼다(존이 이 이름으로 부를 때만 잡힌다 · 못 잡으면 0 으로 남는다 = 표에 그대로)
  if (typeof VL.onGameTick === 'function' && !VL.onGameTick.__t1041) { VL.onGameTick = timed('tVil', VL.onGameTick); VL.onGameTick.__t1041 = 1; }
  if (typeof B.onGameTick === 'function' && !B.onGameTick.__t1041) { B.onGameTick = timed('tBandit', B.onGameTick); B.onGameTick.__t1041 = 1; }
}
try { hook(); hooked = true; } catch (e) { err('hook', e); }
function snap(world, day) {
  const now = process.hrtime.bigint(), cpu = process.cpuUsage();
  const wallMs = lastWall == null ? 0 : Number(now - lastWall) / 1e6;
  const cu = lastCpu == null ? 0 : (cpu.user - lastCpu.user) / 1000, cs = lastCpu == null ? 0 : (cpu.system - lastCpu.system) / 1000;
  lastWall = now; lastCpu = cpu;
  const wars = (world && world._warWars) || [];
  const live = wars.filter((w) => w && !w.ended && !w.over && w.phase !== 'ended' && w.phase !== 'done');
  const ph = {}; for (const w of live) { const k = String(w.phase || w.op || '?'); ph[k] = (ph[k] || 0) + 1; }
  let bodies = 0, warBodies = 0;
  try {
    const h = VL.banditHost(); const inWar = new Set();
    for (const w of live) { if (w.atk && w.atk.name) inWar.add(w.atk.name); if (w.def && w.def.name) inWar.add(w.def.name); }
    for (const v of (h && h.villages) || []) { const n = (v.npcPids && v.npcPids.length) || 0; bodies += n; if (inWar.has(v.name)) warBodies += n; }
  } catch (e) { err('bodies', e); }
  const ms = (k) => { const x = Number(acc[k]) / 1e6; acc[k] = 0n; return Math.round(x); };
  rec.rows.push([day, Math.round(wallMs), Math.round(cu), Math.round(cs), live.length, ph, bodies, warBodies, Math.round(process.memoryUsage().heapUsed / 1048576), ms('tVil'), ms('tBandit'), ms('tScan')]);
  rec.lastDay = day;
}
const mkL = Ev.createLedger;
Ev.createLedger = function () {
  const L = mkL.apply(this, arguments);
  const sd = L.scanDay;
  if (typeof sd === 'function') L.scanDay = function (world, day) {
    try { snap(world, day | 0); } catch (e) { err('snap', e); }
    const a = process.hrtime.bigint();
    try { return sd.apply(this, arguments); } finally { acc.tScan += process.hrtime.bigint() - a; }
  };
  return L;
};
function save() { try { rec.wallTotalSec = Math.round((Date.now() - rec.t0) / 1000); fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) {} }
process.on('exit', save);   // t1049 · t1022 관찰기와 같은 자리(신호 처리기는 안 단다 — 존의 끝맺음 무변)
