'use strict';
// === scripts/lib-slow-link.js — 느린 길(하네스 안 TCP 대리) [T1125 ④] ===================================================
//
// ★왜 [T1125] 넘긴 뒤 먹통(★재민 11-03 — 학교 망 → 도쿄)은 **길이 느려서** 난다. 이 상자엔 `tc netem` 이 없다(ip · tc 명령 0) —
//   그래서 브라우저와 존 사이에 TCP 대리 하나를 세워 길을 늦춘다(카드 ④ "하네스 안 지연 소켓").
//   · 내려가는 쪽(존 → 브라우저): 초당 바이트 상한(`kbps` × 1024) + 한쪽 지연(왕복 ÷ 2)
//   · 올라가는 쪽(브라우저 → 존): 한쪽 지연(왕복 ÷ 2) — 상한 없음(입력 · ping 은 작다)
//   · 대리 줄이 `hiwat`(기본 256 KB)를 넘으면 존 쪽 소켓 읽기를 멈춘다 — 진짜 느린 TCP 처럼 존의 보낼 대기(`sendBuf`)가 찬다
// 쓰는 법: const L = await slowLink({ listen: 3998, target: 3021, kbps: 200, rttMs: 150 }); … L.stats → { conns, down, up } · await L.close()
// 판정 0 — 길만 만든다. 수(속도 · 왕복)는 부르는 쪽이 고른다.
const net = require('net');

function slowLink(o) {
  const rate = Math.max(1, +o.kbps || 200) * 1024, half = Math.max(0, (+o.rttMs || 0) / 2), hiwat = o.hiwat || 256 * 1024;
  const stats = { conns: 0, down: 0, up: 0, perConn: [] };
  const live = new Set();
  const server = net.createServer((cl) => {
    stats.conns++; const pc = { down: 0, up: 0, at: Date.now() }; stats.perConn.push(pc);
    const up = net.connect(o.target, '127.0.0.1');
    const q = []; let qBytes = 0, budget = 0, last = Date.now(), upEnded = false, dead = false;
    const kill = () => { if (dead) return; dead = true; clearInterval(pump); try { cl.destroy(); } catch (e) {} try { up.destroy(); } catch (e) {} live.delete(kill); };
    live.add(kill);
    up.setNoDelay(true); cl.setNoDelay(true);
    // 올라가는 쪽 — 지연만(같은 지연의 타이머는 넣은 차례대로 돈다)
    cl.on('data', (b) => { stats.up += b.length; pc.up += b.length; setTimeout(() => { if (!dead) up.write(b); }, half); });
    // 내려가는 쪽 — 지연 + 초당 상한
    up.on('data', (b) => { q.push({ b, at: Date.now() + half }); qBytes += b.length; if (qBytes > hiwat) up.pause(); });
    const pump = setInterval(() => {
      const now = Date.now(); budget = Math.min(rate * 0.05, budget + rate * (now - last) / 1000); last = now;
      while (q.length && q[0].at <= now && budget >= 1) {
        const h = q[0], n = Math.min(h.b.length, Math.floor(budget));
        const part = n === h.b.length ? h.b : h.b.subarray(0, n);
        if (n === h.b.length) q.shift(); else h.b = h.b.subarray(n);
        budget -= n; qBytes -= n; stats.down += n; pc.down += n;
        cl.write(part);
      }
      if (qBytes <= hiwat / 2 && up.isPaused && up.isPaused()) up.resume();
      if (upEnded && !q.length) kill();
    }, 10);
    up.on('end', () => { upEnded = true; });
    up.on('error', () => kill()); up.on('close', () => { upEnded = true; });
    cl.on('error', () => kill()); cl.on('close', () => kill());
  });
  return new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(o.listen, '127.0.0.1', () => res({ stats, close: () => new Promise((r) => { for (const k of Array.from(live)) k(); server.close(() => r()); }) }));
  });
}

module.exports = { slowLink };
