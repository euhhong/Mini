'use strict';
// (@regress 없음 — 러너 밖 · T1039 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1039-observe.js — 도적 전환 몸 · 몸 없이 사라진 몸의 문 — 서버 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1039-observe.js" [T1039_BANDIT_BODY=walk|spawn] [DCTL_SKIP=raid:n] node scripts/t577-server-run.js 800 1020
//            (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1039.json` · 표는 `scripts/t1039-table.js`)
//   뜨는 것(이미 있는 문 앞에서 읽기만 — 새 수 0):
//     ⓐ 단마다 몸 — 존 틱마다(`villages.onGameTick` 뒤) 단(선 단 · 길 위 단)마다 단 몸(`bandits.t1039().bodies`) + 그 은거지로 걷는 `bandit` 몸(`villages.t1039Exits`)
//        − 단 사람(`g.n`) 의 넘침 = "한 사람 몸 둘" 셈(T1039 하네스와 같은 식) · 마을마다 명부 몸(나감 표 없는 몸) − econ 사람의 넘침.
//     ⓑ 몸 없이 사라진 몸(T1022 회부 3) — 존 `players` 지도의 `delete` 를 감싸 부른 자리(호출 스택의 제품 함수 이름 셋)를 pid 마다 적는다.
//        마을 명부에서 빠진 몸이 그 틱에 `players` 에도 없으면 = 몸 없이 사라짐 → 그 pid 를 지운 문 · 그 마을 해체 표 · 해체 뒤 날.
//        (T1022 관찰기 `vanish` 와 같은 정의 — 해체 마을만이 아니라 모든 마을을 센다 · 해체 마을 몫은 따로.)
//     ⓒ 길 위 단 — 떠난 날 · 닿은 날(판 끝까지 못 닿은 단 수) · 날마다 길 위 단 수.
//   ⚠값을 안 바꾼다: 감싸개는 원 함수를 같은 인자로 부르고 그 돌려줌을 그대로 돌려준다.
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1039.json' : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const Ev = require(path.join(ROOT, 'server', 'events'));
const rec = {
  ver: 1,
  knob: Object.fromEntries(['T1039_BANDIT_BODY', 'T1039_VANISH', 'DCTL_SKIP', 'VILLAGE_NPC_CAP', 'VILLAGE_DAY_MS', 'BANDIT_FIXTURE', 'BANDIT_MINDAY'].map((k) => [k, process.env[k] != null ? process.env[k] : null])),
  arm: null, lastDay: null, ticks: 0,
  two: { excessMax: 0, excessTicks: 0, excessDays: 0, vilExcessMax: 0, vilExcessTicks: 0, firstDay: null, rows: [] },
  vanish: { all: 0, dis: 0, byDoor: {}, byDoorDis: {}, rows: [] },
  road: { depart: [], arrive: [], perDay: {} },
  dis: {}, errs: [],
};
const err = (where, e) => { if (rec.errs.length < 40) rec.errs.push(where + ': ' + String(e && e.message || e)); };
let B = null, VL = null, P = null;
const _hold = { stack: '' };
const SKIPFN = new Set(['delete', 'value', 'Map.delete', 'P.delete', '<anonymous>']);
function caller() {
  const L = Error.stackTraceLimit; Error.stackTraceLimit = 12; Error.captureStackTrace(_hold, caller); Error.stackTraceLimit = L;
  const out = [];
  for (const ln of String(_hold.stack).split('\n').slice(1)) {
    const m = /at (?:Object\.|Array\.|Map\.|Timeout\.|Immediate\.)?([A-Za-z_$][\w$.]*)/.exec(ln);
    const f = /\(?([^\/\\()]+\.js):(\d+)/.exec(ln);
    if (!m || SKIPFN.has(m[1])) continue;
    out.push(m[1] + (f ? '@' + f[1] + ':' + f[2] : ''));
    if (out.length >= 3) break;
  }
  return out.join(' < ');
}
const delBy = new Map();   // pid → { by, day }
const deadAt = new Map();  // 명부 pid → 쓰러진 첫 틱 { ms, day }
let curDay = 0;
const roster = new Map();  // dbId → Set(pid) (지난 틱)
function hostDay() { try { const h = VL.banditHost(); return h && h.world ? h.world.day | 0 : curDay; } catch (e) { return curDay; } }
function tick() {
  const host = VL.banditHost(); if (!host || !host.players) return;
  rec.ticks++;
  const nowMs = Date.now();
  const day = host.world.day | 0; curDay = day;
  // ⓑ 몸 없이 사라짐
  for (const v of host.villages) {
    const now = new Set(v.npcPids || []);
    for (const pid of now) { const p = P.get(pid); if (p && !(p.hp > 0) && !deadAt.has(pid)) deadAt.set(pid, { ms: nowMs, day }); }   // 명부 몸이 쓰러진 첫 틱(출정 몸도 명부에 남는다)
    const prev = roster.get(v.dbId);
    if (prev) for (const pid of prev) {
      if (now.has(pid) || P.has(pid)) continue;
      const d = delBy.get(pid) || { by: '(players 에서 안 지움)', day };
      const da = deadAt.get(pid); deadAt.delete(pid);
      const isDis = !!(v.econ && v.econ._banditized);
      rec.vanish.all++;
      const door = d.by.split(' < ')[0].replace(/@.*/, '');
      rec.vanish.byDoor[door] = (rec.vanish.byDoor[door] || 0) + 1;
      const life = d.hp == null ? '?' : (d.hp > 0 ? 'alive' : 'dead'); rec.vanish.byLife = rec.vanish.byLife || {}; rec.vanish.byLife[door + '|' + life + (d.mu ? '|muster' : '')] = (rec.vanish.byLife[door + '|' + life + (d.mu ? '|muster' : '')] || 0) + 1;
      if (isDis) { rec.vanish.dis++; rec.vanish.byDoorDis[door] = (rec.vanish.byDoorDis[door] || 0) + 1; }
      if (rec.vanish.rows.length < 400 && (isDis || rec.vanish.rows.length < 200)) {
        const dd = rec.dis[v.name];
        rec.vanish.rows.push({ day, v: v.name, pid, dis: isDis ? 1 : 0, sinceDis: dd != null ? day - dd : null, by: d.by, delDay: d.day, lieMs: da ? nowMs - da.ms : null, lieDays: da ? day - da.day : null, hp: d.hp, muster: d.mu, simWar: d.war, down: d.down, captive: d.cap, pop: v.econ ? v.econ.npcs.length : null });
      }
    }
    roster.set(v.dbId, now);
    if (v.econ && v.econ._banditized && rec.dis[v.name] == null) rec.dis[v.name] = day;
  }
  // ⓐ 단마다 몸
  const t = B.t1039 ? B.t1039() : null; if (!t) return;
  if (rec.arm == null) rec.arm = t.arm;
  const gangs = B.gangs(), road = t.road;
  if (!gangs.length && !road.length) return;
  const ex = (VL.t1039Exits && VL.t1039Exits()) || new Map();
  const bm = new Map(t.bodies);
  const pools = [...gangs.map((g) => ({ id: g.id, n: g.n, camp: g.camp, home: g.home })), ...road.map((r) => ({ id: r.id, n: r.n, camp: r.camp, home: r.home, road: 1 }))];
  let excess = 0, walk2 = 0;
  for (const g of pools) {
    const cx = g.camp.cx * 32 + 16, cy = g.camp.cy * 32 + 16;
    const bg = (bm.get(g.id) || []).filter((pid) => P.has(pid)).length;
    let bw = 0;
    for (const [pid, r] of ex) if (r.k === 'bandit' && P.has(pid) && r.pts && r.pts.length && Math.hypot(r.pts[r.pts.length - 1].x - cx, r.pts[r.pts.length - 1].y - cy) < 1) bw++;
    const x = Math.max(0, bg + bw - g.n);
    //   넘침 둘로 가른다: 단 몸만으로 넘침(`lag` — 단 사람이 줄었는데 단 몸은 그날 끝 `syncBodies` 까지 선다) · 그 위에 은거지로 걷는 몸이 더한 넘침(`walk2` = 한 사람 몸 둘)
    const lag = Math.max(0, bg - g.n), w2 = x - lag;
    if (lag > 0) { rec.two.lagTicks = (rec.two.lagTicks || 0) + 1; if ((rec.two.lagMax || 0) < lag) rec.two.lagMax = lag; }
    if (w2 > 0) { walk2 += w2; if ((rec.two.w2rows || (rec.two.w2rows = [])).length < 60 && !rec.two.w2rows.some((q) => q.id === g.id)) rec.two.w2rows.push({ day, id: g.id, home: g.home, n: g.n, gangBodies: bg, walking: bw, road: g.road || 0 }); }
    if (x > 0) { excess += x; if (rec.two.rows.length < 60 && !rec.two.rows.some((q) => q.id === g.id)) rec.two.rows.push({ day, id: g.id, home: g.home, n: g.n, gangBodies: bg, walking: bw, road: g.road || 0 }); }
  }
  if (walk2 > (rec.two.w2Max || 0)) rec.two.w2Max = walk2;
  if (walk2 > 0) { rec.two.w2Ticks = (rec.two.w2Ticks || 0) + 1; if (rec.two._d2 !== day) { rec.two._d2 = day; rec.two.w2Days = (rec.two.w2Days || 0) + 1; } }
  if (excess > rec.two.excessMax) rec.two.excessMax = excess;
  if (excess > 0) { rec.two.excessTicks++; if (rec.two.firstDay == null) rec.two.firstDay = day; if (rec.two._d !== day) { rec.two._d = day; rec.two.excessDays++; } }
}
function dayAfter() {   // 도적 하루 뒤 — 길 위 단 들고남
  try {
    const t = B.t1039(); const day = hostDay();
    const ids = new Set(t.road.map((r) => r.id));
    for (const r of t.road) if (!rec.road._seen || !rec.road._seen.has(r.id)) { rec.road.depart.push({ id: r.id, n: r.n, home: r.home, d0: r.d0, eta: r.eta, lenCells: Math.round(r.len / 32), bodies: r.pids.length }); }
    if (rec.road._seen) for (const id of rec.road._seen) if (!ids.has(id)) { const g = B.gangs().find((x) => x.id === id); rec.road.arrive.push({ id, day, formed: !!g, n: g ? g.n : null, bodies: g ? ((new Map(t.bodies).get(id)) || []).length : null }); }
    rec.road._seen = ids;
    if (t.road.length) rec.road.perDay[day] = t.road.length;
  } catch (e) { err('day', e); }
}
let hooked = false;
function hook() {
  hooked = true;
  B = require(path.join(ROOT, 'server', 'bandits'));
  VL = require(path.join(ROOT, 'server', 'villages'));
  const on986 = (() => { try { return !!B.t986().on; } catch (e) { return true; } })();
  const name = on986 ? 'dayTick' : 'onGameTick';
  const f0 = B[name];
  B[name] = function () { const r = f0.apply(this, arguments); try { dayAfter(); } catch (e) { err('after', e); } return r; };
  const g0 = VL.onGameTick;
  VL.onGameTick = function () {
    const r = g0.apply(this, arguments);
    try {
      if (!P) { const h = VL.banditHost(); if (h && h.players) { P = h.players; const d0 = P.delete; P.delete = function (k) { if (Map.prototype.has.call(this, k)) { const q = Map.prototype.get.call(this, k); delBy.set(k, { by: caller(), day: curDay, hp: q ? q.hp : null, mu: q && q._muster ? 1 : 0, war: q && q.simWar ? 1 : 0, down: q && q.isDown ? 1 : 0, cap: q && q.simCaptive ? 1 : 0 }); } return d0.call(this, k); }; } }
      if (P) tick();
    } catch (e) { err('tick', e); }
    return r;
  };
}
const mk = Ev.createLedger;
Ev.createLedger = function () {
  const L = mk.apply(this, arguments);
  try { if (!hooked) hook(); } catch (e) { err('hook', e); }
  const sd = L.scanDay;
  L.scanDay = function (world, day) { try { rec.lastDay = day | 0; } catch (e) {} return sd.apply(this, arguments); };
  return L;
};
process.on('exit', () => {
  try {
    delete rec.road._seen; delete rec.two._d; delete rec.two._d2; rec.two.w2Max = rec.two.w2Max || 0; rec.two.w2Days = rec.two.w2Days || 0; rec.two.lagMax = rec.two.lagMax || 0;
    try { rec.t1039Stat = VL.t1039Stat(); if (rec.t1039Stat) delete rec.t1039Stat.rows; } catch (e) {}
    try { rec.bodyExit = VL.bodyExitStats(); } catch (e) {}
    try { const t = B.t1039(); rec.roadEnd = t.road.map((r) => ({ id: r.id, n: r.n, home: r.home, d0: r.d0, eta: r.eta })); rec.arm = t.arm; } catch (e) {}
    try { const st = B.stats(); rec.bstats = { conv: st.conv, loot: st.loot, gangs: st.gangs, members: st.members, peak: st.peak, disband: st.disband, t1039Depart: st.t1039Depart || 0, t1039Arrive: st.t1039Arrive || 0 }; } catch (e) {}
    fs.writeFileSync(OUT, JSON.stringify(rec));
  } catch (e) { try { fs.writeFileSync(OUT, JSON.stringify(Object.assign(rec, { exitErr: String(e && e.stack) }))); } catch (e2) {} }
});
