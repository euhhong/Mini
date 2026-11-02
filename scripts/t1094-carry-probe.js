'use strict';
// (@regress 없음 — 러너 밖 · T1094 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1094-carry-probe.js — 원정 짐 관찰기(서버 판 자 `t577-server-run.js` · 기준선 `server-baseline-check.js` 곁 프리로드) =======================
//
// ★왜 [지시 T1094 · 문 5 · 6] 원정이 곳간 무기를 싣고 가고(`T403_ARMS_LEDGER`) · 몸이 질 수 있는 만큼만(`carry.js CAP_KG`) 가져가나 —
//   원정마다 그 몸들이 처음 실은 짐(군량 팩 · 무기)과 집에 남긴 몫을 한 줄로 남긴다.
//   잼 자리 = **떠나는 순간** — 호스트가 공격 몸을 세우고 군량 · 무기를 실은 바로 뒤 교전 명부에 올리는 문(war-live `enlist` · 공격 편 첫 몸)에서 한 번(`at: 'enlist'`) ·
//     그 문을 안 지난 전쟁은 war-core 하루 경계(`daily` 앞)에서(`at: 'daily'` — 그날 이미 싸웠을 수 있다): 그 전쟁의 공격 몸이 섰고(`instantiated`) 아직 안 적었으면 —
//     몸 수 · 병력 · 몸마다 짐 무게(몸 인벤 전부 · `weights.js` — 플레이어 · 군량 · 무기와 같은 표) 가장 작은 · 가운데 · 가장 큰 · `CAP_KG` 넘는 몸 수 ·
//     군량 팩(`_rationBook` — 곳간에서 실은 식량등가 · 몸에 나눈 몫 · 몸 짐 kg) · 무기(장부 `w._arms` — 반출 · 지금 · 민병 · 몸 짐 `w._armsPack` 합 · kg) ·
//     문 6 셈(`w._t1094` — 켬 판에서만 선다: 집에 남긴 군량 식량등가 · kg · 남긴 무기 · kg)
//   그리고 판 끝에 문 6 셈(`state._t1094St` — 전쟁 셈 `_warStat` 곁 칸) · 전쟁 셈 `_warStat.t811` 을 사진으로.
//   ⚠읽기만 — 감싸는 것은 war-core 가 돌려준 문 하나(`daily`)와 war-live 가 돌려준 문 하나(`enlist`)뿐 · 받은 값 그대로 · RNG 무접촉.
//
// 쓰는 법:  NODE_OPTIONS="… -r $PWD/scripts/t1094-carry-probe.js" node scripts/t577-server-run.js …  (또는 server-baseline-check.js — NODE_OPTIONS 를 아이에 그대로 넘긴다)
//   ⇒ `<판>-<시드>.t1094.json` { seed, ex: [ { d, wid, atk, def, force, n, kg: [min, med, max], over, pack, arms, t1094 } ], stat, errs }
const path = require('path');
const fs = require('fs');
if (!process.env.T577_SEED) return;
const OUT = process.env.T1094_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1094.json' : '');
const ROOT = path.join(__dirname, '..');
const WCM = require(path.join(ROOT, 'sim', 'war-core'));
let W = null; try { W = require(path.join(ROOT, 'server', 'weights')); } catch (e) { W = null; }
let CAP = 0; try { const C = require(path.join(ROOT, 'server', 'carry')); CAP = (C && C.CFG && C.CFG.CAP_KG) || 0; } catch (e) { CAP = 0; }
const rec = { ver: 1, seed: +process.env.T577_SEED, cap: CAP, ex: [], stat: null, errs: 0, err0: null };
const r3 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 1000) / 1000;
function err(e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 600); }
let _vst = null;
function vstate() {
  if (_vst) return _vst;
  try { const k = require.resolve(path.join(ROOT, 'server', 'villages.js')); const m = require.cache[k]; if (m && m.exports && typeof m.exports.__p3Bind === 'function') _vst = m.exports.__p3Bind({}).state; } catch (e) { _vst = null; }
  return _vst;
}
const kgOf = (k) => (W && W.kgOfOrDefault) ? W.kgOfOrDefault(k) : 0;
function invKg(inv, keys) { let s = 0; if (!inv) return 0; for (const k of (keys || Object.keys(inv))) { const q = inv[k] || 0; if (q > 0) s += q * kgOf(k); } return s; }
const SEEN = new Set();
function look(S, d, at, only) {
  if (!S || !S.warBodies || !S.deps || !S.deps.players) return;
  const players = S.deps.players;
  for (const body of S.warBodies.values()) {
    if (only && body.fight !== only) continue;
    const w = body.w; if (!w || SEEN.has(w.id) || !body.instantiated || !(body.pids && body.pids.length)) continue;
    SEEN.add(w.id);
    const kg = []; let packKg = 0, armKg = 0, over = 0;
    for (const pid of body.pids) {
      const p = players.get(pid); if (!p) continue;
      const k = invKg(p.inventory); kg.push(k); if (CAP > 0 && k > CAP + 1e-9) over++;
      if (w._packKeys && p._warPackOf === w.id) packKg += invKg(p.inventory, w._packKeys);
    }
    kg.sort((a, b) => a - b);
    const M = w._armsPack; let onB = 0; if (M) for (const q of M.values()) onB += q || 0; armKg = onB * kgOf('weapon');
    const bk = w._rationBook, a = w._arms, t = w._t1094;
    if (rec.ex.length < 5000) rec.ex.push({ d, at, wid: w.id, atk: w.atk && w.atk.name, def: w.def && w.def.name, force: w.force, n: kg.length,
      kg: kg.length ? [r3(kg[0]), r3(kg[kg.length >> 1]), r3(kg[kg.length - 1])] : null, over, sumKg: r3(kg.reduce((s, x) => s + x, 0)),
      pack: bk ? { load: r3(bk.load), split: r3(bk.split), ledgerEaten: r3(bk.ledgerEaten), kg: r3(packKg) } : null,
      arms: a ? { force: a.force, out: a.out, now: r3(a.weapon), militia: a.militia, onBodies: M ? r3(onB) : null, kg: M ? r3(armKg) : null } : null,
      t1094: t ? JSON.parse(JSON.stringify(t)) : null });
  }
}
const cw = WCM.createWar;
WCM.createWar = function () {
  const Wd = cw.apply(this, arguments);
  const dl = Wd.daily;
  Wd.daily = function (d) {
    try { look(vstate(), d | 0, 'daily'); } catch (e) { err(e); }
    return dl.apply(this, arguments);
  };
  return Wd;
};
// 떠나는 순간 — 호스트 `_warInstantiateAttackers` 가 군량(`_warRationLoad`) · 무기(`_warArmsLoad`)를 실은 바로 뒤 교전 명부에 올린다(`state.warLive.enlist`)
const WLM = require(path.join(ROOT, 'server', 'war-live'));
const cwl = WLM.createWarLive;
WLM.createWarLive = function () {
  const L = cwl.apply(this, arguments);
  const en = L && L.enlist;
  if (typeof en === 'function') L.enlist = function (f, side) {
    if (side === 'A' && f) { try { const S = vstate(); look(S, (S && S.world && S.world.day) | 0, 'enlist', f); } catch (e) { err(e); } }
    return en.apply(this, arguments);
  };
  return L;
};
process.on('exit', () => {
  if (!OUT) return;
  try { const S = vstate(); if (S) rec.stat = { t1094: S._t1094St || null, t811: (S._warStat && S._warStat.t811) || null }; } catch (e) { err(e); }
  try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 판 끝 */ }
});
