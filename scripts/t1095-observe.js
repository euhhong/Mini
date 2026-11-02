'use strict';
// (@regress 없음 — 러너 밖 · T1095 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1095-observe.js — 채굴 일괄 수요 문(T1095) — 서버 판 자(`t577-server-run.js` · `server-baseline-check.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/t1095-observe.js" T1095_OBS=/tmp/x/on [T1095_MINE_DEMAND=0] node scripts/server-baseline-check.js 계측/서버기준선_2026-11-02.json
//   아이 존만 · 존이 끝날 때 `<T1095_OBS>-<시드>.json` 에 `villages.t1095Stat()` 와 광부 있는 마을의 곳간 원석 · land.ore · 광맥 잔여(oFrac 식 그대로 읽기)를 적는다.
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T1095_OBS ? `${process.env.T1095_OBS}-${process.env.T577_SEED}.json` : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
process.on('exit', () => {
  const rec = { knob: process.env.T1095_MINE_DEMAND || null, seed: process.env.T577_SEED };
  try {
    const VL = require(path.join(ROOT, 'server', 'villages'));
    rec.stat = VL.t1095Stat();
    const st = VL.__p3Bind({}).state, dep = st.deps || {}, K = dep.ORE_K || 1000;
    rec.vils = [];
    for (const v of (st.villages || [])) {
      const e = v.econ; if (!e) continue;
      let sum = 0, n = 0;
      const cells = v._oreCells || [];
      for (const c of cells) { sum += dep.oreStockAt ? dep.oreStockAt(c.cx, c.cy) : 0; n++; }
      rec.vils.push({ name: v.name, miner: (e.counts && e.counts.miner) || 0, pop: e.npcs.length, ore: +((e.storage && e.storage.ore) || 0).toFixed(2),
        landOre: e.land ? e.land.ore : null, baseOre: v._baseOre != null ? v._baseOre : null, cells: cells.length, cellLeft: n ? +(sum / (n * K)).toFixed(4) : null, oreOut: +(e._oreOutLast || 0).toFixed(3) });
    }
  } catch (e) { rec.err = String(e && e.stack); }
  try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) {}
});
