'use strict';
// (@regress 없음 — `scripts/t1139-slice-hist.js` 가 존 서버에 `-r` 로 싣는다 · 계측만 · 세계 무접촉)
// =============================================================================
// T1139 ② — 문 그래프 짓기 **조각 한 틱**(`server/chunk-gates.js` `tick(budget, nowMs)` 한 부름 — T679 ③ "최대 5.45 ms")을 하나하나 적고,
//   같은 판의 GC 이벤트(`perf_hooks` PerformanceObserver 'gc')를 같은 시계(`performance.now`)로 적는다.
//   ★존 서버 글자 0 · 손잡이 0 — `create` 가 돌려준 그릇의 `tick` 을 감싸 시각만 잰다(인자 · 반환 · 차례 그대로).
//   ★짓기 줄이 있던 부름만 센다(부르기 직전 `busy()` — zone.js `_t678Busy` 와 같은 술어 · T679 "짓는 틱").
//   ★본 스레드에서만(일꾼 스레드 — WAL 체크포인트 · 경계 걸음표 — 는 `-r` 을 물려받지만 여기선 아무것도 안 한다).
//   SIGTERM 을 받으면(존의 `gracefulShutdown` 보다 먼저 — 먼저 단 듣개) `T1139_SLICE_OUT` 에 JSON 한 벌을 적는다.
// =============================================================================
const { isMainThread } = require('worker_threads');
const OUT = process.env.T1139_SLICE_OUT;
if (isMainThread && OUT) {
  const fs = require('fs'), path = require('path');
  const { performance, PerformanceObserver } = require('perf_hooks');
  const CG = require(path.join(__dirname, '..', 'server', 'chunk-gates.js'));
  const S = [];    // [시작 ms, 걸린 ms, 지은 수] × n(짓기 줄이 있던 부름)
  const GC = [];   // [시작 ms, 걸린 ms, 종류] × n
  let calls = 0, made = 0;
  const create = CG.create;
  CG.create = function (...args) {
    const G = create.apply(this, args);
    const tick = G.tick;
    G.tick = function (budget, nowMs) {
      calls++;
      const busy = G.busy();
      const t0 = performance.now();
      const r = tick.call(this, budget, nowMs);
      const ms = performance.now() - t0;
      if (busy) S.push(+t0.toFixed(4), +ms.toFixed(4), r);
      return r;
    };
    G._t1139 = () => ({ calls, busy: S.length / 3 });
    made++;
    return G;
  };
  const take = (L) => { for (const e of L) GC.push(+e.startTime.toFixed(4), +e.duration.toFixed(4), (e.detail && e.detail.kind) != null ? e.detail.kind : e.kind); };
  const obs = new PerformanceObserver((list) => take(list.getEntries()));
  obs.observe({ entryTypes: ['gc'] });
  let dumped = false;
  const dump = () => {
    if (dumped) return; dumped = true;
    try { take(obs.takeRecords()); } catch (e) {}
    try { fs.writeFileSync(OUT, JSON.stringify({ calls, made, slices: S, gc: GC, now: performance.now() })); } catch (e) {}
  };
  process.on('SIGTERM', dump);
  process.on('exit', dump);
}
