'use strict';
// (@regress 없음 — 러너 밖 · T1080 관찰기 · 제품 무변 · 읽기만)
// === scripts/t1080-observe.js — 해체 뒤 걷는 사람(길 위 날 · 도착 · 길 위 죽음 · 다시 고름) — 서버 판 자(`t577-server-run.js`) 곁 프리로드 ===
//   쓰는 법: NODE_OPTIONS="-r $PWD/scripts/t1080-observe.js" T577_CAND_WALK=1 [T1080_ROAD_LIFE=0] node scripts/t577-server-run.js 800 1020
//   아이 존만 · 존이 끝날 때 판 JSON 곁 `<판>-<시드>.t1080.json` 에 도적 층 셈(`bandits.t1080()` · `t765()` · `stats()`)과 몸 나감 셈을 적는다(이미 실린 그 모듈 — require 캐시).
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
if (!(process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1))) return;
const OUT = process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1080.json' : '';
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
process.on('exit', () => {
  const rec = { knob: { T577_CAND_WALK: process.env.T577_CAND_WALK || null, T1080_ROAD_LIFE: process.env.T1080_ROAD_LIFE || null, T858_NO_SHIELD: process.env.T858_NO_SHIELD || null } };
  try {
    const B = require(path.join(ROOT, 'server', 'bandits')), VL = require(path.join(ROOT, 'server', 'villages'));
    rec.t1080 = B.t1080 ? B.t1080() : null; rec.t765 = B.t765(); rec.stats = Object.assign({}, B.stats(), { log: undefined });
    try { rec.bodyExit = VL.bodyExitStats(); } catch (e) {}
    try { rec.t765Body = VL.t765Stat ? VL.t765Stat() : null; } catch (e) {}
  } catch (e) { rec.err = String(e && e.stack); }
  try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) {}
});
