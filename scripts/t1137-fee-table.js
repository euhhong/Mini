#!/usr/bin/env node
// === scripts/t1137-fee-table.js — 거래소 수수료 판 셋(낮음 · 중간 · 높음) 표 (T1137 ⑤ · 판정 0) ===
//
// ★카드: "수수료율 · 할인 폭은 손잡이 — 수는 손으로 박지 말고 판 셋을 재서 보고: 사람 거래 수 · 마을 곳간 수수료 수입 · 견적 화면 글자".
//   손잡이 기본은 0(수수료 없음)이다. 이 표는 PM 이 고를 재료다 — 판 셋의 수(아래 PLATES)는 **재는 점**이지 기본값이 아니다.
//
// ★무엇을 재나(결정론 · 주사위 0): 랩 econ 세계(시드 7 · 마을 5 · 200일 — test-membership 과 같은 진입점) 하나를 판마다 새로 만든다.
//   사람 = 마을 × 낼 품목(곳간이 받는 재화 전부) × 가진 개수(1 · 3 · 5 · 10 · 20 · 40) × 신분(비구성원 · 인정 구성원) — 받을 것 = 곡식(곡식을 낼 때는 나무).
//   사람은 가진 것 안에서 수수료까지 낼 수 있는 가장 많은 낱개로 낸다(견적이 "모두 n개를 냅니다"를 보이니 사람은 그만큼 줄여 낸다 — 낼 수 있는 가장 큰 q).
//   ⓐ 서는 거래 수(받을 것 > 0) ⓑ 수수료로 곳간에 든 단위(마을별 합) ⓒ 받은 곡식(수수료 없을 때 대비) ⓓ 견적 화면 글자 한 보기.
//   차례: 사람들은 같은 세계에서 차례로 거래한다(앞사람이 시세를 움직인다 — 실제 장과 같다) · 차례는 판마다 같다.
//
// 실행: node scripts/t1137-fee-table.js [--out 계측/x.json]
'use strict';
process.env.ENABLE_VILLAGES = process.env.ENABLE_VILLAGES || '0';
process.env.DB_PATH = process.env.DB_PATH || `/tmp/t1137-fee-${process.pid}.db`;
const path = require('path');
const fs = require('fs');
const R = (p) => require(path.join(__dirname, '..', p));
const econV2 = R('sim/economy-sim-v2');
const Events = R('server/events');
const Villages = R('server/villages');

const PLATES = [
  { k: '없음', fee: 0, member: 0 },
  { k: '낮음', fee: 0.02, member: 0.01 },
  { k: '중간', fee: 0.05, member: 0.025 },
  { k: '높음', fee: 0.10, member: 0.05 },
];
const HAVE = [1, 3, 5, 10, 20, 40];
const feeOf = (n, r) => (n > 0 && r > 0) ? Math.ceil(n * r - 1e-9) : 0;   // trade.js `_feeOf` 와 같은 식(견적이 같은 수를 낸다 — 아래 대조)

function world() {
  const w = econV2.createWorldV2({ seed: 7, villageCount: 5, picker: 'rational', infoRange: 5000, raidPer100: 0.005 });
  const _log = console.log; console.log = () => {};
  try { for (let d = 0; d < 200; d++) econV2.tickWorldV2(w); } finally { console.log = _log; }
  return w;
}

const out = { at: new Date().toISOString(), plates: [] };
for (const PL of PLATES) {
  const w = world();
  const L = Events.createLedger({ econV2, vidOf: (v, i) => i, depositMap: Villages.playerVillageDepositMap() });
  L.prime(w);
  const P = Villages.__labProbe._memberProbe;
  const vils = w.villages.map((e, i) => ({ name: `랩마을${i}`, ccx: 100 + i * 40, ccy: 100, dbId: i, econ: e }));
  P.setup(L, vils, econV2);
  const AT = vils.map((v) => P.anchorPx(v));
  const dep = Villages.playerVillageDepositMap();
  const resItems = {}; for (const [it, r] of Object.entries(dep)) (resItems[r] = resItems[r] || []).push(it);
  const row = { plate: PL.k, fee: PL.fee, member: PL.member, tries: 0, ok: 0, okBy: { 비구성원: 0, 인정: 0 }, feeUnits: 0, feeByVil: {}, gotFood: 0, sample: null, quoteEqExec: 0, quoteN: 0 };
  for (let vid = 0; vid < vils.length; vid++) {
    for (const res of Object.keys(resItems).sort()) {
      const item = resItems[res][0];
      const take = res === 'food' ? 'wood' : 'food';
      for (const have of HAVE) for (const who of ['비구성원', '인정']) {
        const rate = who === '인정' ? PL.member : PL.fee;
        row.tries++;
        //   가진 것 안에서 수수료까지 낼 수 있는 가장 큰 q
        let q = have; while (q > 0 && q + feeOf(q, rate) > have) q--;
        if (q < 1) continue;
        const inv = { [item]: have };
        const qt = Villages.villageTradeQuote(vid, AT[vid].x, AT[vid].y, res, take, q, null, Object.assign({ inventory: inv }, rate > 0 ? { feeRate: rate } : {}));
        if (!qt || qt.err || !(qt.take > 0)) continue;
        const s0 = +(vils[vid].econ.storage[res] || 0);
        const r = Villages.villageTradeExec(vid, AT[vid].x, AT[vid].y, inv, res, take, q, null, 0, rate);
        if (!r || r.err || !r.ok) continue;
        row.ok++; row.okBy[who]++;
        row.quoteN++; if ((qt.fee || 0) === (r.fee || 0) && qt.take === r.take) row.quoteEqExec++;
        const fu = r.feeUnits || 0;
        row.feeUnits += fu; row.feeByVil[vid] = +((row.feeByVil[vid] || 0) + fu).toFixed(3);
        if (take === 'food') row.gotFood += r.take;
        if (!row.sample && (r.fee || 0) > 0 && have === 20) {
          const ko = Events.koRes(res);
          row.sample = `${ko} ${q} 곡식 ${qt.take} · 수수료 ${ko} ${qt.fee} — 마을 곳간에 들어갑니다 (${Math.round(qt.feeRate * 1000) / 10}% · 올림 · 모두 ${qt.giveTotal}개를 냅니다)`;
        }
        void s0;
      }
    }
  }
  row.feeUnits = +row.feeUnits.toFixed(3);
  out.plates.push(row);
  console.log(`${PL.k.padEnd(3)} 율 ${PL.fee} · 인정 ${PL.member} | 시도 ${row.tries} · 선 거래 ${row.ok}(비구성원 ${row.okBy.비구성원} · 인정 ${row.okBy.인정}) · 수수료 곳간 수입 ${row.feeUnits} 단위 ${JSON.stringify(row.feeByVil)} · 받은 곡식 ${row.gotFood} · 견적 = 실행 ${row.quoteEqExec}/${row.quoteN}`);
  if (row.sample) console.log(`    견적 글자: ${row.sample}`);
}
const oi = process.argv.indexOf('--out');
if (oi >= 0) { fs.writeFileSync(path.join(__dirname, '..', process.argv[oi + 1]), JSON.stringify(out, null, 1)); console.log('적음', process.argv[oi + 1]); }
try { for (const s of ['', '-wal', '-shm']) fs.unlinkSync(process.env.DB_PATH + s); } catch (e) {}
