'use strict';
// (@regress 없음 — 러너 밖 · T1104 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1104-observe.js — 약탈 · 토벌 걸음 · 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/diverge-ctl.js -r $PWD/scripts/t1078-observe.js -r $PWD/scripts/t1079-observe.js -r $PWD/scripts/t1104-observe.js" T1078_BANDIT_ALL=1 T1079_BANDIT_CAMP=1 [T1104_BANDIT_WALK=1] node scripts/t577-server-run.js 800 1020
//            (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1104.json` · 표는 `scripts/t1104-table.js`)
//   뜨는 것(이미 있는 문 앞에서 읽기만 — 새 수 0): 도적 하루 뒤마다 단의 걸음 장부(`bandits.t1104()` — 은거지 · 길목으로 · 돌아옴 날 수) · 걷는 원정 수 · 판 끝 증인 셈.
//   ⚠값을 안 바꾼다(도적 하루를 감싸 그 뒤에 읽기만 — T1079 관찰기와 같은 감싸개 꼴).
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1104.json' : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const Ev = require(path.join(ROOT, 'server', 'events'));
const rec = { ver: 1, knob: Object.fromEntries(['T1078_BANDIT_ALL', 'T1079_BANDIT_CAMP', 'T1104_BANDIT_WALK', 'VILLAGE_NPC_CAP', 'VILLAGE_DAY_MS'].map((k) => [k, process.env[k] != null ? process.env[k] : null])),
  days: 0, lastDay: null, gangDays: { camp: 0, out: 0, back: 0 }, supMax: 0, rows: [], errs: [] };
const err = (where, e) => { if (rec.errs.length < 40) rec.errs.push(where + ': ' + String(e && e.message || e)); };
let B = null, hooked = false;
function dayAfter() {
  try {
    if (!B.t1104) return;
    const t = B.t1104(); rec.days++;
    const day = B.t986 ? B.t986().lastDay : null; rec.lastDay = day;
    for (const g of t.gangs) { const st = g.t ? g.t.st : 'camp'; rec.gangDays[st] = (rec.gangDays[st] || 0) + 1; }
    rec.supMax = Math.max(rec.supMax, t.sups.length);
    if (day != null && day % 100 === 0 && rec.rows.length < 20) rec.rows.push({ day, gangs: t.gangs.map((g) => [g.id, g.n, g.t ? g.t.st : null]), sups: t.sups.length, stat: t.stat });
  } catch (e) { err('day', e); }
}
function hook() {
  hooked = true;
  B = require(path.join(ROOT, 'server', 'bandits'));
  for (const name of ['dayTick', 'onGameTick']) {
    const f0 = B[name];
    B[name] = function () {
      const d0 = B.t986 ? B.t986().lastDay : null;
      const r = f0.apply(this, arguments);
      try { const d1 = B.t986 ? B.t986().lastDay : null; if (d1 !== d0) dayAfter(); } catch (e) { err('after', e); }
      return r;
    };
  }
}
const mk = Ev.createLedger;
Ev.createLedger = function () { const L = mk.apply(this, arguments); try { if (!hooked) hook(); } catch (e) { err('hook', e); } return L; };
process.on('exit', () => {
  try { try { const t = B && B.t1104 ? B.t1104() : null; rec.on = t ? t.on : null; rec.stat = t ? t.stat : null; rec.sups = t ? t.sups.length : null; } catch (e) {} fs.writeFileSync(OUT, JSON.stringify(rec)); }
  catch (e) { try { fs.writeFileSync(OUT, JSON.stringify(Object.assign(rec, { exitErr: String(e && e.stack) }))); } catch (e2) {} }
});
