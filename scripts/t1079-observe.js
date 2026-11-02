'use strict';
// (@regress 없음 — 러너 밖 · T1079 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1079-observe.js — 은거지 시설 · 짐 더미 · 무기 짐 셈 · 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1078-observe.js -r $PWD/scripts/t1079-observe.js" T1078_BANDIT_ALL=1 [T1079_BANDIT_CAMP=1] node scripts/t577-server-run.js 800 1020
//            (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1079.json` · 표는 `scripts/t1079-table.js`)
//   뜨는 것(이미 있는 문 앞에서 읽기만 — 새 수 0):
//     ⓐ 도적 하루 뒤마다 — 무기 짐 셈: 들어온 것(장물 실물 `stats.armsLoot` · T521) = 선 단의 짐(`g.arms`) + 흩어진 단의 더미(`bandits.t1079().piles`) + 몸 짐(무기를 든 해산 몸) +
//        마을 곳간으로 내린 것(`t1079().stat.vilArms`) — 나머지 = 소멸(끔 판은 해산한 단의 짐이 여기로 간다). 날마다 최대 · 끝 날 · 소멸이 처음 선 날 · 그 단.
//     ⓑ 시설 — 선 더미 · 흩어진 더미 · 이은 더미 · 더미 식량 · 무게 kg(증인) · 해산 남은 사람 갈래(합류 · 주민 · 기록 없음).
//     ⓒ econ `_raidScrum` 이 읽은 무기(호스트 `world.banditArmed` 를 감싸 — 부른 수 · 든 수 합 · 사람 수 합).
//   ⚠값을 안 바꾼다: 감싸개는 원 함수를 같은 인자로 부르고 그 돌려줌을 그대로 돌려준다.
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1079.json' : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const Ev = require(path.join(ROOT, 'server', 'events'));
const rec = {
  ver: 1,
  knob: Object.fromEntries(['T1078_BANDIT_ALL', 'T1079_BANDIT_CAMP', 'T521_GANG_ARMS', 'VILLAGE_NPC_CAP', 'VILLAGE_DAY_MS'].map((k) => [k, process.env[k] != null ? process.env[k] : null])),
  days: 0, lastDay: null,
  arms: { inMax: 0, lostMax: 0, lostDays: 0, firstLost: null, end: null, gone: [] },
  camp: { pilesMax: 0, leftMax: 0, foodMax: 0, kgMax: 0, rows: [] },
  scrum: { calls: 0, armed: 0, men: 0 },
  perf: { dayN: 0, dayMs: 0, dayMax: 0 },
  errs: [],
};
const err = (where, e) => { if (rec.errs.length < 40) rec.errs.push(where + ': ' + String(e && e.message || e)); };
let B = null, VL = null;
const hr = () => { const t = process.hrtime(); return t[0] * 1e3 + t[1] / 1e6; };
const armsOf = (o) => { let a = 0; if (o && B) for (const k of Object.keys(o)) if (B.ARMS_RES.has(k)) a += +o[k] || 0; return a; };
let prevGangs = new Map();
function dayAfter() {
  try {
    const host = VL.banditHost(); if (!host || !host.players) return;
    const day = host.world.day | 0; rec.days++; rec.lastDay = day;
    const w = host.world;
    if (typeof w.banditArmed === 'function' && !w.banditArmed._t1079o) {   // ⓒ 감싸기(켬만 선다)
      const f0 = w.banditArmed;
      w.banditArmed = function (g) { const r = f0.apply(this, arguments); rec.scrum.calls++; rec.scrum.armed += Math.floor(+r || 0); rec.scrum.men += Math.max(0, (g && g.n) | 0); return r; };
      w.banditArmed._t1079o = 1;
    }
    const st = B.stats(), t = B.t1079 ? B.t1079() : { piles: [], carry: [], stat: null };
    const inn = +(st.armsLoot || 0);
    const gs = B.gangs();
    const live = gs.reduce((a, g) => a + armsOf(g.arms), 0);
    const left = t.piles.filter((p) => p.gid == null).reduce((a, p) => a + armsOf(p.arms), 0);
    const carry = t.carry.reduce((a, c) => a + (+c.weapon || 0), 0);
    const vil = t.stat ? +t.stat.vilArms || 0 : 0;
    const lost = +(inn - live - left - carry - vil).toFixed(6);
    const A = rec.arms;
    A.inMax = Math.max(A.inMax, inn);
    if (lost > 1e-6) { A.lostDays++; if (A.firstLost == null) A.firstLost = day; }
    A.lostMax = Math.max(A.lostMax, lost);
    //   사라진 단의 짐(끔 판 · 그 단 · 날) — 어제 선 단 중 오늘 없는 단의 어제 무기 짐
    const now = new Map(gs.map((g) => [g.id, armsOf(g.arms)]));
    for (const [id, a] of prevGangs) if (!now.has(id) && a > 0 && A.gone.length < 40) A.gone.push({ day, gid: id, arms: +a.toFixed(6) });
    prevGangs = now;
    A.end = { day, inn: +inn.toFixed(6), live: +live.toFixed(6), left: +left.toFixed(6), carry, vil: +vil.toFixed(6), lost };
    const C = rec.camp, piles = t.piles;
    C.pilesMax = Math.max(C.pilesMax, piles.length); C.leftMax = Math.max(C.leftMax, piles.filter((p) => p.gid == null).length);
    for (const p of piles) { C.foodMax = Math.max(C.foodMax, p.food); C.kgMax = Math.max(C.kgMax, p.kg); }
    if (piles.length && C.rows.length < 200 && day % 50 === 0) C.rows.push({ day, piles: piles.map((p) => [p.gid, p.left, +p.food.toFixed(1), +armsOf(p.arms).toFixed(2), +p.kg.toFixed(1)]) });
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
}
const mk = Ev.createLedger;
Ev.createLedger = function () {
  const L = mk.apply(this, arguments);
  try { if (!hooked) hook(); } catch (e) { err('hook', e); }
  return L;
};
process.on('exit', () => {
  try {
    for (const k of ['dayMs', 'dayMax']) rec.perf[k] = +rec.perf[k].toFixed(2);
    try { rec.t1079 = B.t1079 ? B.t1079() : null; if (rec.t1079) { rec.t1079.carry = rec.t1079.carry.length; rec.t1079.walk = rec.t1079.walk.length; } } catch (e) {}
    try { rec.armsLoot = B.stats().armsLoot || 0; } catch (e) {}
    fs.writeFileSync(OUT, JSON.stringify(rec));
  } catch (e) { try { fs.writeFileSync(OUT, JSON.stringify(Object.assign(rec, { exitErr: String(e && e.stack) }))); } catch (e2) {} }
});
