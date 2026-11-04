// === scripts/t1123-count-hook.js — 재는 자 전용: central 이 낸 응답 상태를 센다(제품 무접촉 · `node -r` 로 얹는다) [T1131] ===
//   T1123 맥 VM WebKit 판(`서버가 본 둘째 방문`)의 자를 레포로 올렸다 — WebKit Resource Timing 은 캐시에서 꺼낸 것에도 transferSize 를 싣는 판이 있어
//   "네트 요청"을 브라우저 쪽에서만 세면 틀린다(쟀다 — 컨테이너 WebKit 26.6 둘째 방문: 브라우저 쪽 64 · 서버 쪽 0). 서버가 본 것이 증인이다.
//   한 줄 = `<상태> <요청 주소> <Cache-Control>` · 파일은 env `T1123_COUNT` · 재는 쪽(`t1123-lobby-measure.js --server-count`)이 방문마다 비운다.
'use strict';
const http = require('http');
const fs = require('fs');
const F = process.env.T1123_COUNT;
const wh = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (code, a, b) {
  try { const h = (a && typeof a === 'object') ? a : ((b && typeof b === 'object') ? b : {}); if (F) fs.appendFileSync(F, `${code} ${(this.req && this.req.url) || ''} ${(h['Cache-Control'] || '-').replace(/\s+/g, '')}\n`); } catch (e) { /* 재는 자 — 삼킨다 */ }
  return wh.apply(this, arguments);
};
