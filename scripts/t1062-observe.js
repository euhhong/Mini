'use strict';
// (@regress 없음 — 러너 밖 · T1062 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1062-observe.js — T1062 관찰기: 목재 그림자 가격이 읽는 칸 — 서버 판 자 · 랩 t17 곁 프리로드 ===
//
// ★[T1062 2026-11-01 · T1046 회부 2] 한계가치 문의 목재 값 `w(wood)` 가 서버에서 랩보다 낮다(21 ~ 24 ↔ 41 — T1046 · 랩 직선 · T1050 앞).
//   land1037 뒤 랩도 서버 집 규칙(T1050 — 크루가 곳간 목재로 짓는다 · econ `houseCrewDay` 한 벌)이다. 같은 꼴이 되는지 · 남는 차가 어디인지.
//   칸(마을 × 날 · 그날 econ 틱 **앞** = 직업 고르기가 그날 읽는 곳간 · 전날 크루가 꺼낸 뒤):
//     day · N · wood(곳간 목재) · pW(그림자 가격 — v2 `computeShadowPrices` 의 wood 와 같은 두 함수 `_priceFromV2(_targetV2(v, 'wood', ctx))` · 읽기만 · 세계 칸 되돌림)
//     tgt · sEff(그 값의 목표 · 유효 재고 — v2 `_targetV2(v, 'wood', ctx)` 그대로 · 읽기만)
//     pend(크루 대기 목재 — 서 있는 집터가 완공까지 더 꺼낼 목재 = Σ 남은 단계 표 목재 − 집터에 이미 놓은 목재 · `houseCrewDay` 의 `rem − mat` 글자)
//     pWr(같은 값 식에 유효 재고만 `sEff − pend`(바닥 0.1 — v2 의 그 바닥)로 넣은 값 · 견줌 전용 · 세계에 안 쓴다)
//     cons(목재 소비 EMA `_consEMA.wood`) · live(`_t400Live`) · stage(집터 단계 · 없으면 −1)
//   집터: 랩 = `v._t1050.site`(econ 칸) · 서버 = 생활층 `vil._site` — econ 마을에 백참조가 없어 크루 문 `houseCrewDay`(내보낸 칸 — 서버 `E.houseCrewDay` 가 부르는 그 칸)를
//     감싸 그 마을의 마지막 집터를 WeakMap 에 둔다(값 무변 · 인자 그대로 넘김 · 마을 칸에 안 쓴다). 완공된 집터는 단계가 공정 끝이라 pend = 0.
//   쓰는 법:
//     서버: NODE_OPTIONS="… -r $PWD/scripts/t1062-observe.js" node scripts/t577-server-run.js 800 1020,7,42   (판 JSON 곁 `<판>-<시드>.t1062.json`)
//     랩:   T1062_OUT=<파일> NODE_OPTIONS="-r $PWD/scripts/t1062-observe.js" node scripts/t17-metrics.js 800 1020
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
const SERVER = !!process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1);
const LAB = !SERVER && !!process.env.T1062_OUT && /scripts[\/\\](t17-metrics|t176-ab)\.js$/.test(A1);
if (!SERVER && !LAB) return;
const OUT = SERVER ? (process.env.T1062_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1062.json' : '')) : process.env.T1062_OUT;
if (!OUT) return;
const V1 = require(path.join(__dirname, '..', 'sim', 'economy-sim'));
// ★v2 는 첫 틱에서 읽어 들인다 — 프리로드에서 먼저 읽으면 v2 가 v1 표에 특산을 더하는 차례가 판 자보다 앞서, 사건 장부가 보는 품목 차례가 바뀐다(랩 t17 사건 수 2 건 차 — 이 카드가 실측 · 세계 값은 무변). 판 자가 이미 읽은 같은 모듈을 받는다.
let V2 = null;
const COLS = ['day', 'N', 'wood', 'pW', 'tgt', 'sEff', 'pend', 'pWr', 'cons', 'live', 'stage'];
const rec = { where: SERVER ? 'server' : path.basename(A1), cols: COLS, v: {}, errs: 0, err0: null };
const r2 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 100) / 100;
const r4 = (x) => (x == null || !Number.isFinite(+x)) ? null : Math.round(+x * 10000) / 10000;
const SITE = new WeakMap();
const _hcd = V1.houseCrewDay;
if (typeof _hcd === 'function') V1.houseCrewDay = function (v, s2) { try { if (v && s2) SITE.set(v, s2); } catch (e) { /* 읽기만 */ } return _hcd.apply(this, arguments); };
function pendWood(s2) {
  if (!s2) return 0;
  let rem = 0; const n = V1.hutStageCount();
  for (let i = (s2.stage | 0); i < n; i++) rem += ((V1.hutEconStage(i) || {}).wood || 0);
  return Math.max(0, rem - ((s2.mat && s2.mat.wood) || 0));
}
const _tick = V1.tickVillage;
V1.tickVillage = function (v, day) {
  try {
    if (v && v.storage && v._world && typeof v._world.priceFn === 'function') {
      const N = (v.npcs || []).length;
      const s2 = (v._t1050 && v._t1050.site !== undefined) ? v._t1050.site : (SITE.get(v) || null);
      const pend = pendWood(s2);
      if (!V2) V2 = require(path.join(__dirname, '..', 'sim', 'economy-sim-v2'));
      // ★읽기만 — v2 값 식은 그날 첫 부름에서 세계 칸 `world._effDemCache`(그날 세계 총공급 · `_worldStockOf`)를 만든다.
      //   틱 앞에서 이 관찰기가 먼저 부르면 그 칸이 다른 순간의 곳간으로 서서 그날 다른 값을 읽힌다(랩 t17 사건 장부 2 건 차 — 이 카드 실측).
      //   부르기 전 칸을 쥐고 다 읽은 뒤 그대로 되돌린다(없었으면 지운다) — 세계가 보는 칸은 관찰기가 없을 때와 같다.
      const W = v._world, _had = Object.prototype.hasOwnProperty.call(W, '_effDemCache'), _c0 = W._effDemCache;
      let pW, T, pWr;
      try {
        T = V2._targetV2(v, 'wood', V2._targetCtxV2(v));
        pW = V2._priceFromV2(T);   // = `computeShadowPrices(v).wood`(wood 는 원석 상한 밖 — 같은 두 함수)
        pWr = V2._priceFromV2(Object.assign({}, T, { sEff: Math.max(0.1, T.sEff - pend) }));
      } finally { if (_had) W._effDemCache = _c0; else delete W._effDemCache; }
      const key = v.name || String(v.id);
      (rec.v[key] || (rec.v[key] = [])).push([day, N, r2(v.storage.wood || 0), r4(pW), r2(T.target), r2(T.sEff), r2(pend), r4(pWr),
        r4((v._consEMA || {}).wood || 0), v._t400Live ? 1 : 0, s2 && pend > 0 ? (s2.stage | 0) : -1]);
    }
  } catch (e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 400); }
  return _tick.apply(this, arguments);
};
process.on('exit', () => { try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 관측 실패는 판을 안 건드린다 */ } });
