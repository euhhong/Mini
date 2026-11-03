'use strict';
// (@regress 없음 — 러너 밖 · T1141 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1141-observe.js — 마을 소멸 진단 관찰기(서버 판 자 곁 프리로드 · 10-23 트리 · main 공용) ===
//   쓰는 법: NODE_OPTIONS="-r <이 파일>" T577_TAG=base T577_DIR=<판> node scripts/t577-server-run.js 800 <시드>  ⇒ <판>/base-<시드>.t1141.json
//   ROOT = 아이 존의 작업 자리(cwd) — 그 트리의 econ · 장부를 싣는다. 표 기계 `scripts/t1141-table.js`.
// T1141 관찰기(두 트리 공용 · 읽기만) — 서버 판 자 아이 존에 -r 로 싣는다.
const path = require('path'), fs = require('fs');
if (!process.env.T577_SEED) return;
const OUT = process.env.T1141_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1141.json' : '');
let ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, 'server', 'events.js'))) ROOT = path.join(path.dirname(process.argv[1] || ''), '..');
const V1 = require(path.join(ROOT, 'sim', 'economy-sim'));
const Ev = require(path.join(ROOT, 'server', 'events'));
const GR = ['rice', 'wheat', 'barley'];
const COLS = ['pop', 'tfe', 'fe', 'food', 'rice', 'wheat', 'barley', 'xRice', 'xWheat', 'xBarley', 'xFood', 'imp', 'dead', 'farmer', 'hap', 'bFall', 'bPeak', 'bz', 'K', 'drafted'];
const rec = { root: ROOT, cols: COLS, names: null, land: null, rows: [], ev: [], errs: 0, err0: null };
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
let last = -1;
function snap(world, day) {
  if (day === last) return; last = day;
  const V = world.villages || [];
  if (!rec.names) {
    rec.names = V.map((v) => v.name);
    rec.land = V.map((v) => { const L = v.land || {}; return { fertility: r2(L.fertility), arable: r2(L.arable), water: r2(L.water), wood: r2(L.wood), game: r2(L.game), stone: r2(L.stone), ore: r2(L.ore), size: r2(L.size), spec: v.specialty || v._specialty || null }; });
  }
  if (!rec.td && day >= 2) {   // 교역로 걸음 날(정본 villageDist → travelDaysForDistance) — 길 없는 쌍 = null
    try { const V2 = require(path.join(ROOT, 'sim', 'economy-sim-v2'));
      rec.tdMatrix = !!world._distMatrix;
      rec.td = V.map((a) => V.map((b) => { if (a === b) return 0; const d = V1.villageDist(a, b); return isFinite(d) ? V2.travelDaysForDistance(d) : null; }));
    } catch (e) { rec.td = 'err:' + e.message; }
  }
  const row = V.map((v) => {
    const S = v.storage || {}, T = v.tradeStats || {}, X = T.exportBy || {};
    let tfe = 0; try { tfe = V1.totalFoodEquivalent(v); } catch (e) { tfe = -1; }
    let dr = 0; for (const n of (v.npcs || [])) if (n && n._warDraft) dr++;
    return [(v.npcs || []).length, r2(tfe), r2((S.food || 0) + (S.fish || 0) + (S.meat || 0) + (S.cooked_food || 0)), r2(S.food), r2(S.rice), r2(S.wheat), r2(S.barley),
      r2(X.rice), r2(X.wheat), r2(X.barley), r2(X.food), r2(T.foodImported), v._deadTot || 0, (v.counts && v.counts.farmer) || 0,
      r2(v.lastStats ? v.lastStats.happiness : null), v._bdtFall || 0, v._bdtPeak || 0, v._banditized ? 1 : 0, v._dpDebug ? v._dpDebug.K : null, dr];
  });
  rec.rows.push([day, row]);
}
const KEEP = { POP_COLLAPSE: 1, DISSOLVED: 1, EMPTIED: 1, STARVED: 1, WINTER_SHORT: 1, RESCUED: 1 };
function takeEv(out) { if (Array.isArray(out)) for (const e of out) if (e && KEEP[e.type]) rec.ev.push([e.day, e.vid, e.type, e.mag]); }
const mk = Ev.createLedger;
Ev.createLedger = function () {
  const L = mk.apply(this, arguments);
  const sd = L.scanDay;
  L.scanDay = function (world, day, extra, opt) {
    try { snap(world, day | 0); } catch (e) { rec.errs++; if (!rec.err0) rec.err0 = String(e && e.stack || e).slice(0, 300); }
    const r = sd.apply(this, arguments);
    try {
      if (r && typeof r.next === 'function' && !Array.isArray(r)) {   // 조각 판(steps) — 끝값을 가로챈다
        const g = r;
        return { next(a) { const x = g.next(a); if (x.done) takeEv(x.value); return x; }, return(v) { return g.return(v); }, throw(e) { return g.throw(e); }, [Symbol.iterator]() { return this; } };
      }
      takeEv(r);
    } catch (e) { rec.errs++; }
    return r;
  };
  return L;
};
process.on('exit', () => { if (OUT) try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) {} });
