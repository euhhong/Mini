'use strict';
// (@regress 없음 — 러너 밖 · T1091 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1091-observe.js — 하루 감소 상한 · 로지스틱 항이 명부 N(원정 간 징발자 포함)을 쓰는 몫 — 서버 판 자 곁 프리로드 ===
//
// ★[T1091 2026-11-02 · PM 코드 읽기] econ `tickVillage` 인구 갱신의 N 은 `v.npcs.length`(`sim/economy-sim.js` "2) 소비" 첫 줄)다 — 원정 간 징발자(`_warDraft`)가 든다.
//   그 N 이 ⓐ 하루 감소 상한 `maxDelta = N × POP_MAX_DELTA_PCT` ⓑ 로지스틱 항 `r·N·(1−(N/K)^θ)` ⓒ 건강 · 행복 · 위신 항(× N)에 들고,
//   기근 죽음은 집에 있는 자유민에게만 떨어진다(징발자는 고리가 건너뛴다 · T295 ①).
//   쓰는 법:  NODE_OPTIONS="-r $PWD/scripts/t1091-observe.js [-r $PWD/scripts/diverge-ctl.js]" [DCTL_SKIP=raid:n] T577_TAG=base T577_DIR=<뿌리>/run-<판> node scripts/t577-server-run.js 800 1020,7,42
//             (`T577_SEED` 가 있는 아이 서버만 잰다 · 판 JSON 곁 `<판>-<시드>.t1091.json` · `T1091_OUT` 로 바꿀 수 있다)
//   ① 마을 × econ 날 — 틱에 징발자가 있던 날만 한 줄(틱을 감싸 앞뒤를 읽는다 · `t924-observe` 와 같은 문):
//      [날 · 명부 N(틱 머리) · 징발 · 짐꾼 · 그날 죽음(`lib-day-deaths` 정본) · 틱 앞 빚 · 틱 뒤 빚 · K · 로지스틱 · 굶주림 · 건강 · 행복 · 위신 · dP(상한 앞) · 주거 게이트 · 로지스틱 재셈 맞음]
//   ② 징발 없는 날은 셈만(마을-날 · 죽음).
//   ⚠상수(`POP_MAX_DELTA_PCT` · `POP_GROWTH_RATE` · `LOGISTIC_THETA`)는 econ 이 내보내지 않는다 — 이 파일은 정본 글(`sim/economy-sim.js`)의 그 줄을 읽어 쓴다(옮겨 적지 않는다).
//     줄마다 로지스틱 재셈(명부 N · K · 읽은 r · θ) = econ `_dpDebug.logi` 인지 본다(`ok` 칸 — K 반올림 폭을 안 봐 엄하다 · 표 기계 `t1091-table` 이 K ± 0.05 폭으로 다시 본다).
const path = require('path');
const fs = require('fs');
if (!process.env.T577_SEED) return;
const OUT = process.env.T1091_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1091.json' : '');
const ROOT = path.join(__dirname, '..');
const V1 = require(path.join(ROOT, 'sim', 'economy-sim'));
const DD = require('./lib-day-deaths'); DD.install(V1);
const SRC = fs.readFileSync(path.join(ROOT, 'sim', 'economy-sim.js'), 'utf8');
const K_ = (name) => { const m = new RegExp('^const ' + name + ' = ([0-9.]+);', 'm').exec(SRC); return m ? +m[1] : null; };
const C = { POP_MAX_DELTA_PCT: K_('POP_MAX_DELTA_PCT'), POP_GROWTH_RATE: K_('POP_GROWTH_RATE'), LOGISTIC_THETA: K_('LOGISTIC_THETA') };
const COLS = ['day', 'n', 'drafted', 'packers', 'deaths', 'a0', 'a1', 'K', 'logi', 'hunger', 'health', 'happy', 'prestige', 'dP', 'gated', 'ok'];
const rec = { ver: 1, consts: C, cols: COLS, v: {}, noDraft: { villageDays: 0, deaths: 0 }, draft: { villageDays: 0, deaths: 0 }, errs: 0, err0: null, okBad: 0 };
const r3 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 1000) / 1000;
function logi(n, K) { return C.POP_GROWTH_RATE * n * (1 - Math.pow(n / Math.max(1, K), C.LOGISTIC_THETA)); }
function row(v, day, a0, n0) {
  let dr = 0, pk = 0; for (const x of (v.npcs || [])) if (x._warDraft) { dr++; if (x._warPack) pk++; }
  const dd = DD.deathsToday(v);
  if (!dr) { rec.noDraft.villageDays++; rec.noDraft.deaths += dd; return; }
  rec.draft.villageDays++; rec.draft.deaths += dd;
  const D = v._dpDebug || {};
  const ok = (D.K != null && D.logi != null && n0 > 0) ? (Math.abs(logi(n0, D.K) - D.logi) <= 0.0006 + 1e-9 * Math.abs(D.logi) + Math.abs(D.logi) * 1e-3 ? 1 : 0) : null;
  if (ok === 0) rec.okBad++;
  (rec.v[v.name] || (rec.v[v.name] = [])).push([day, n0, dr, pk, dd, r3(a0), r3(v._dPAccum), D.K, D.logi, D.hunger, D.health, D.happy, D.prestige, D.dP, D.gated ? 1 : 0, ok]);
}
const _tick = V1.tickVillage;
V1.tickVillage = function (v, day) {
  const a0 = +(v && v._dPAccum) || 0, n0 = (v && v.npcs) ? v.npcs.length : 0;
  const r = _tick.apply(this, arguments);
  try { if (n0 > 0) row(v, day | 0, a0, n0); } catch (e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 400); }
  return r;
};
process.on('exit', () => { if (OUT) try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 관측 실패는 판을 안 건드린다 */ } });
