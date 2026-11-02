'use strict';
// (@regress 없음 — 러너 밖 · T1076 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1076-observe.js — 원정마다 군량 · 사기 — 서버 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/t1076-observe.js" [T1076_ARMY_MORALE=1] VILLAGE_NPC_CAP=Infinity node scripts/t577-server-run.js 800 1020
//            (아이 존만 · 판 JSON 곁 `<판>-<시드>.t1076.json`)
//   장부 하루(`events.createLedger` 의 `scanDay`)마다 war-core 진행 전쟁(`world._warWars`)을 읽는다 — 원정마다 마지막으로 본 값:
//     선포 날 · 병력 · 국면 · 작전 · 짐 남은 날(`_packRem`) · 군량 장부(`_rationBook` — 먹음 · 못 먹음 · 굶은 몸-날) · 사기(`_mrl` · 평형 `_mrlEq` · 계단 죽음 `_mrlDead`) · 최저 사기 · 빚(몸 평균).
//   끝난 전쟁은 war-core 가 목록에서 뺀다 — 마지막 본 값이 그 전쟁의 끝 값이다(전쟁 글은 t1031 관찰기 몫).
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1076.json' : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const Ev = require(path.join(ROOT, 'server', 'events'));
const rec = { ver: 1, seed: +(process.env.T577_SEED || 0), knob: { T1076_ARMY_MORALE: process.env.T1076_ARMY_MORALE || null, VILLAGE_NPC_CAP: process.env.VILLAGE_NPC_CAP || null, T906_ARMY_STARVE: process.env.T906_ARMY_STARVE || null }, wars: {}, lastDay: null, errs: [] };
const r3 = (x) => (x == null || !Number.isFinite(+x) ? null : Math.round(+x * 1000) / 1000);
function snap(world, day) {
  for (const w of (world && world._warWars) || []) {
    if (!w || w.id == null) continue;
    const o = rec.wars[w.id] || (rec.wars[w.id] = { id: w.id, atk: w.atk && w.atk.name, def: w.def && w.def.name, born: w.born, force: w.force, minMrl: null, days: 0 });
    o.days++; o.last = day; o.phase = w.phase; o.op = w.op; o.pack = r3(w._packRem);
    const bk = w._rationBook; if (bk) { o.eaten = r3(bk.eaten); o.unfed = r3(bk.unfed || 0); o.hungry = bk.hungryDays || 0; o.starveDead = bk.starveDead || 0; }
    if (w._mrl != null) { o.mrl = r3(w._mrl); o.eq = r3(w._mrlEq); o.mrlDead = w._mrlDead || 0; o.minMrl = o.minMrl == null ? o.mrl : Math.min(o.minMrl, o.mrl); }
    if (w._debt && w._debt.size) { let s = 0; for (const v of w._debt.values()) s += v; o.debt = r3(s / w._debt.size); }
  }
  rec.lastDay = day;
}
const mk = Ev.createLedger;
Ev.createLedger = function () {
  const L = mk.apply(this, arguments);
  const sd = L.scanDay;
  if (typeof sd === 'function') L.scanDay = function (world, day) { try { snap(world, day | 0); } catch (e) { if (rec.errs.length < 20) rec.errs.push(String(e && e.message || e)); } return sd.apply(this, arguments); };
  return L;
};
process.on('exit', () => { try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) {} });
