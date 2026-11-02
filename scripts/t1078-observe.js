'use strict';
// (@regress 없음 — 러너 밖 · T1078 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1078-observe.js — 도적 단원 = 몸 · 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1078-observe.js" [T1078_BANDIT_ALL=1] node scripts/t577-server-run.js 800 1020
//            (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1078.json` · 표는 `scripts/t1078-table.js`)
//   뜨는 것(이미 있는 문 앞에서 읽기만 — 새 수 0):
//     ⓐ 도적 하루 뒤마다 — 단(선 단 · 길 위 단)의 사람 `g.n` · 은거지 몸(`bandits.t1039().bodies`) · 그 단으로 걷는 몸(`villages.t1039Exits` 의 `bandit` · `desert` 걸음 중 그 은거지로 가는 것)
//        ⇒ 몸 합 · 사람 합 · 넘침(몸 > 사람) · 모자람(사람 > 몸 — 몸 없는 사람) 날마다.
//     ⓑ 토벌 — 도적 로그 줄(`토벌⚔ … → k명 사살 … · 원정 e명 전사`)을 콘솔에서 읽어 센다(로그 링 500 줄 상한 밖까지).
//     ⓒ 비용 — 도적 하루(`dayTick` · `onGameTick`) 벽시계 ms · 몸 일과 문(`villages.t1078Life` — 있으면) 부른 수 · ms · 존 틱(`villages.onGameTick`) 수 · 프로세스 CPU(끝에 `process.cpuUsage`).
//   ⚠값을 안 바꾼다: 감싸개는 원 함수를 같은 인자로 부르고 그 돌려줌을 그대로 돌려준다.
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1078.json' : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const Ev = require(path.join(ROOT, 'server', 'events'));
const rec = {
  ver: 1,
  knob: Object.fromEntries(['T1078_BANDIT_ALL', 'T1039_BANDIT_BODY', 'VILLAGE_NPC_CAP', 'VILLAGE_DAY_MS'].map((k) => [k, process.env[k] != null ? process.env[k] : null])),
  days: 0, lastDay: null,
  body: { maxBodies: 0, maxPersons: 0, sumBodies: 0, sumPersons: 0, sumGangs: 0, maxGangs: 0, overDays: 0, overMax: 0, shortDays: 0, shortMax: 0, maxWalkers: 0, rows: [] },
  sup: { n: 0, kill: 0, expDead: 0, rows: [] },
  perf: { dayN: 0, dayMs: 0, dayMax: 0, lifeN: 0, lifeMs: 0, ticks: 0, tickMs: 0, cpuMs: null, wallMs: null, t0: Date.now() },
  errs: [],
};
const err = (where, e) => { if (rec.errs.length < 40) rec.errs.push(where + ': ' + String(e && e.message || e)); };
let B = null, VL = null;
const hr = () => { const t = process.hrtime(); return t[0] * 1e3 + t[1] / 1e6; };
// ⓑ 토벌 줄
const cl0 = console.log;
console.log = function () {
  try {
    const s = arguments[0];
    if (typeof s === 'string' && s.indexOf('토벌⚔') >= 0) {
      const m = /D(\d+) 토벌⚔: (.*?) 원정대\((\d+)명\) vs 도적단#(\d+) → (\d+)명 사살(?: · 원정 (\d+)명 전사)?\((\d+)명 잔존\)/.exec(s);
      if (m) { rec.sup.n++; rec.sup.kill += +m[5]; rec.sup.expDead += +(m[6] || 0); if (rec.sup.rows.length < 80) rec.sup.rows.push({ day: +m[1], vil: m[2], force: +m[3], gid: +m[4], kill: +m[5], expDead: +(m[6] || 0), left: +m[7] }); }
    }
  } catch (e) { err('log', e); }
  return cl0.apply(this, arguments);
};
function dayAfter() {
  try {
    const t = B.t1039(); const host = VL.banditHost(); if (!host || !host.players) return;
    const P = host.players, day = host.world.day | 0;
    rec.days++; rec.lastDay = day;
    const ex = (VL.t1039Exits && VL.t1039Exits()) || new Map();
    const bm = new Map(t.bodies);
    const pools = [...B.gangs().map((g) => ({ id: g.id, n: g.n, camp: g.camp })), ...t.road.map((r) => ({ id: r.id, n: r.n, camp: r.camp, road: 1 }))];
    let bodies = 0, persons = 0, walkers = 0, over = 0, short = 0;
    for (const g of pools) {
      const cx = g.camp.cx * 32 + 16, cy = g.camp.cy * 32 + 16;
      const bg = (bm.get(g.id) || []).filter((pid) => P.has(pid) && !(P.get(pid).isDown)).length;
      let bw = 0;
      for (const [pid, r] of ex) if ((r.k === 'bandit' || r.k === 'desert') && r.cat !== 'died' && P.has(pid) && r.pts && r.pts.length && Math.hypot(r.pts[r.pts.length - 1].x - cx, r.pts[r.pts.length - 1].y - cy) < 1) bw++;
      bodies += bg + bw; persons += g.n; walkers += bw;
      over += Math.max(0, bg + bw - g.n); short += Math.max(0, g.n - bg - bw);
    }
    const b = rec.body;
    b.maxBodies = Math.max(b.maxBodies, bodies); b.maxPersons = Math.max(b.maxPersons, persons); b.sumBodies += bodies; b.sumPersons += persons;
    b.sumGangs += pools.length; b.maxGangs = Math.max(b.maxGangs, pools.length); b.maxWalkers = Math.max(b.maxWalkers, walkers);
    if (over > 0) { b.overDays++; b.overMax = Math.max(b.overMax, over); }
    if (short > 0) { b.shortDays++; b.shortMax = Math.max(b.shortMax, short); }
    if (pools.length && b.rows.length < 400 && (day % 25 === 0)) b.rows.push({ day, gangs: pools.length, persons, bodies, walkers, over, short });
  } catch (e) { err('day', e); }
}
let hooked = false;
function hook() {
  hooked = true;
  B = require(path.join(ROOT, 'server', 'bandits'));
  VL = require(path.join(ROOT, 'server', 'villages'));
  for (const name of ['dayTick', 'onGameTick']) {
    const f0 = B[name];
    B[name] = function () {
      const d0 = B.t986 ? B.t986().lastDay : null;
      const t0 = hr(); const r = f0.apply(this, arguments); const dt = hr() - t0;
      try { const d1 = B.t986 ? B.t986().lastDay : null; if (d1 !== d0) { rec.perf.dayN++; rec.perf.dayMs += dt; if (dt > rec.perf.dayMax) rec.perf.dayMax = dt; dayAfter(); } } catch (e) { err('after', e); }
      return r;
    };
  }
  if (typeof VL.t1078Life === 'function') {
    const l0 = VL.t1078Life;
    VL.t1078Life = function () { const t0 = hr(); const r = l0.apply(this, arguments); rec.perf.lifeN++; rec.perf.lifeMs += hr() - t0; return r; };
  }
  const g0 = VL.onGameTick;
  VL.onGameTick = function () { const t0 = hr(); const r = g0.apply(this, arguments); rec.perf.ticks++; rec.perf.tickMs += hr() - t0; return r; };
}
const mk = Ev.createLedger;
Ev.createLedger = function () {
  const L = mk.apply(this, arguments);
  try { if (!hooked) hook(); } catch (e) { err('hook', e); }
  return L;
};
process.on('exit', () => {
  try {
    const cu = process.cpuUsage(); rec.perf.cpuMs = Math.round((cu.user + cu.system) / 1000); rec.perf.wallMs = Date.now() - rec.perf.t0;
    for (const k of ['dayMs', 'dayMax', 'lifeMs', 'tickMs']) rec.perf[k] = +rec.perf[k].toFixed(2);
    try { const st = B.stats(); rec.bstats = Object.assign({}, st, { log: undefined }); } catch (e) {}
    try { rec.t1078 = B.t1078 ? B.t1078() : null; } catch (e) {}
    try { rec.bodyExit = VL.bodyExitStats(); } catch (e) {}
    try { rec.t1039Stat = VL.t1039Stat(); if (rec.t1039Stat) delete rec.t1039Stat.rows; } catch (e) {}
    fs.writeFileSync(OUT, JSON.stringify(rec));
  } catch (e) { try { fs.writeFileSync(OUT, JSON.stringify(Object.assign(rec, { exitErr: String(e && e.stack) }))); } catch (e2) {} }
});
