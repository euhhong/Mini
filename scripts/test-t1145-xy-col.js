#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(scripts/run-regress.sh · 표 없으면 안 돈다)
// === scripts/test-t1145-xy-col.js — x · y 열 정본(`sim/body-cols.js` · `T1145_XY_COL` · T1145 · 2026-11-04) =========================
//
// 판정 사본 0: 열 모듈은 `sim/body-cols.js` 를 그대로 `require` · 존은 `server/zone.js` 를 그대로 띄운다(자식 프로세스 · `--allow-natives-syntax`).
// 지키는 것:
//   ⓪ 글자 — 손잡이 한 줄(`'1'` 만 켬 · T806 켬 · T1140 차례 끔에서만) · 리터럴 머리 갈래 하나 · 열 모듈 `require` 한 번(사본 0)
//   ① 열 모듈 — 615 몸이 **빠른 속성 · 한 숨은 꼴**(나중에 칸이 붙어도) · 경계값 15 `Object.is` · `+=` · `Object.assign` · 구조 분해 · 펼침 · JSON 값
//      · 수 아닌 쓰기(`undefined` · 문자열)는 그 몸만 되돌려 값 그대로 · 떠난 몸 번호는 **되돌린 뒤에만** 다시 준다(떠난 몸 = 마지막 값 · 새 몸과 끊김)
//      · 열이 커져도 값 그대로 · ★미끼: T738 꼴(데이터 칸을 그 자리에서 접근자로)은 **사전 모드**로 내려간다(이 판이 그 꼴을 피했다는 증거)
//   ② 존(켬) — 주민 몸 전부가 열 몸(접근자 = 모듈 함수 · 열 칸 = 몸 값 · 빠른 속성) · 관측자 셋을 세워 몸이 걷는 동안 열 = 몸 값 · 움직인 몸 > 0
//      · 수 아닌 쓰기 0 · 숨은 꼴 수(적다)
//   ③ 존(끔 · 기본) — 열 0 · x 는 데이터 칸(종전 그대로) · 존(켬 + `T1140_HOT_ORDER=1`) — 켬을 무시한다(열 0)
'use strict';
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (d !== undefined && d !== '' ? `  ${d}` : '')); };
const ROLE = process.argv[2];
// V8 속 묻기 — 자식(`--allow-natives-syntax`)에서만 글자를 짓는다(부모 · 러너는 그 깃발 없이 이 파일을 읽는다)
const NAT = ROLE ? { fast: new Function('o', 'return %HasFastProperties(o)'), same: new Function('a', 'b', 'return %HaveSameMap(a, b)') } : null;

// ── 자식: 열 모듈 ──────────────────────────────────────────────────────────────
if (ROLE === '--mod') {
  const BC = require(path.join(ROOT, 'sim', 'body-cols.js'));
  const out = {};
  const live = new Set();
  const C = BC.create({ cap: 16, alive: (p) => live.has(p) });
  const mk = (i) => { const s = C.alloc(); const o = { pid: 'p' + i, a: 1, vx: 0, vy: 0, _colS: s, path: undefined }; C.attach(o, i * 1.5, i * -2.25); live.add(o); return o; };
  const A = []; for (let i = 0; i < 615; i++) A.push(mk(i));
  for (const p of A) { p.npcWorkX = null; p.npcWorkY = null; }   // 나중에 붙는 칸(스폰 뒤 대입과 같은 꼴)
  out.fast = A.every((p) => NAT.fast(p)); out.sameMap = A.every((p) => NAT.same(p, A[0]));
  out.vals0 = A.every((p, i) => p.x === i * 1.5 && p.y === i * -2.25 && C.X[p._colS] === p.x);
  const V = [0, -0, NaN, Infinity, -Infinity, 1, -1, 0.1, 1e-310, 5e-324, -5e-324, Number.MAX_VALUE, 2 ** 53 + 2, 31871.123456789, -0.000001];
  const d = A[1]; let bad = 0; for (const v of V) { d.x = v; d.y = -v; if (!Object.is(d.x, v) || !Object.is(d.y, -v)) bad++; } out.edge = bad;
  const p = A[2]; p.x = 10; p.x += 1.25; p.y = 4; p.y -= 0.5; Object.assign(p, { x: p.x * 2 }); const { x, y } = p;
  out.ways = x === 22.5 && y === 3.5 && C.X[p._colS] === 22.5 && C.Y[p._colS] === 3.5;
  const sp = { ...p }; out.spread = sp.x === 22.5 && sp.y === 3.5 && Object.getOwnPropertyDescriptor(sp, 'x').value === 22.5;
  out.json = JSON.parse(JSON.stringify(p)).x === 22.5 && Object.keys(p).includes('x') && Object.keys(p).includes('y');
  // 수 아닌 쓰기 — 그 몸만 되돌려 값 그대로(다른 몸 · 열 무변)
  const q = A[3], qs = q._colS, qy = q.y; q.x = undefined;
  out.badSet = q.x === undefined && q.y === qy && q._colS === -1 && C.st.bad === 1 && A[4].x === 6 && !Object.getOwnPropertyDescriptor(q, 'x').get;
  const r = A[5]; r.y = 'abc'; out.badSet2 = r.y === 'abc' && r.x === 7.5 && C.st.bad === 2;
  // 떠난 몸 — 되돌리기 전엔 그 번호를 안 준다 · 되돌린 뒤 떠난 몸 = 마지막 값 · 새 몸과 끊김
  const g = A[10], gs = g._colS; g.x = 111; live.delete(g);
  const fresh = []; let early = 0;
  for (let i = 0; i < 40; i++) { const b = mk(1000 + i); fresh.push(b); if (b._colS === gs && g._colS !== -1) early++; if (g._colS !== -1 && fresh.some((f) => f._colS === gs)) early++; }   // 훑기는 새 번호 32 마다 — 되돌리기 전 그 번호가 나가면 early
  const got = fresh.find((b) => b._colS === gs);
  out.reuse = !!got && g._colS === -1 && g.x === 111 && !Object.getOwnPropertyDescriptor(g, 'x').get && (() => { got.x = 999; return g.x === 111 && got.x === 999; })();
  out.reuseFirst = early === 0 && qs >= 0;
  out.grow = C.st.grow > 0 && A.every((b, i) => i === 1 || i === 2 || i === 3 || i === 5 || i === 10 || (b.x === i * 1.5 && b.y === i * -2.25));
  out.st = C.st;
  // 미끼 — T738 꼴(데이터 칸을 그 자리에서 접근자로 다시 짓기)은 사전 모드
  const t = { pid: 'q', x: 1, y: 2, a: 1, b: 2 }; Object.defineProperty(t, 'x', C.desc.x); out.baitDict = !NAT.fast(t);
  // 미끼 — 몸마다 다른 접근자 함수(클로저)는 숨은 꼴이 갈린다
  const u1 = { pid: 'u1', a: 1 }, u2 = { pid: 'u2', a: 1 };
  Object.defineProperty(u1, 'x', { get() { return 1; }, set(v) {}, enumerable: true, configurable: true });
  Object.defineProperty(u2, 'x', { get() { return 1; }, set(v) {}, enumerable: true, configurable: true });
  out.baitClosure = !NAT.same(u1, u2);
  console.log('@@' + JSON.stringify(out));
  process.exit(0);
}

// ── 자식: 존(프로세스 안) ──────────────────────────────────────────────────────
if (ROLE === '--zone') {
  const TMP = `/tmp/t1145z-${process.pid}.db`;
  const rm = () => { for (const s of ['', '-wal', '-shm']) { try { fs.unlinkSync(TMP + s); } catch (e) {} } };
  rm(); process.on('exit', rm);
  Object.assign(process.env, { ZONE_ID: 'hanbando', PORT: String(39600 + (process.pid % 300)), DB_PATH: TMP, ENABLE_VILLAGES: '1', ENABLE_WILDLIFE: '0', ENABLE_BANDITS: '0', ENABLE_ROADS: '0', VILLAGE_DAY_MS: '1440000' });
  const log = console.log; console.log = () => {}; console.warn = () => {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    const Zone = require(path.join(ROOT, 'server', 'zone.js'));
    const H = Zone.__testBind();
    for (let i = 0; i < 600; i++) { let n = 0; for (const p of H.players.values()) if (p.isNpc && p.simVillageId != null) n++; if (n > 300) break; await sleep(200); }
    const npcs = [...H.players.values()].filter((p) => p.isNpc);
    const C = H._t1145();
    const out = { n: npcs.length, on: !!C };
    if (C) {
      out.acc = npcs.filter((p) => { const d = Object.getOwnPropertyDescriptor(p, 'x'); return d && d.get === C.desc.x.get && d.set === C.desc.x.set; }).length;
      out.colEq = npcs.filter((p) => p._colS >= 0 && C.X[p._colS] === p.x && C.Y[p._colS] === p.y).length;
      out.fast = npcs.filter((p) => NAT.fast(p)).length;
      // 관측자 셋 — 그 자리 청크가 깨어 몸이 걷는다(증인만 · 소켓 없는 칸)
      for (let i = 0; i < 3; i++) { const p = npcs[Math.floor(i * npcs.length / 3)]; H.observers.set({ __t1145: i, readyState: 0, send() {} }, { viewerX: p.x, viewerY: p.y, lastSeen: Date.now() + 1e9 }); }
      const x0 = new Map(npcs.map((p) => [p, [p.x, p.y]]));
      let looks = 0, bad = 0;
      for (let k = 0; k < 40; k++) { await sleep(250); looks++; for (const p of npcs) if (p._colS >= 0 && (C.X[p._colS] !== p.x || C.Y[p._colS] !== p.y)) bad++; }
      out.moved = npcs.filter((p) => { const a = x0.get(p); return a[0] !== p.x || a[1] !== p.y; }).length;
      out.looks = looks; out.walkBad = bad;
      const reps = []; for (const p of npcs) if (p._colS >= 0 && !reps.some((r) => NAT.same(r, p))) reps.push(p);
      out.maps = reps.length;
      out.st = C.st;
    } else {
      const d = Object.getOwnPropertyDescriptor(npcs[0] || {}, 'x');
      out.data = npcs.filter((p) => { const d2 = Object.getOwnPropertyDescriptor(p, 'x'); return d2 && !d2.get && 'value' in d2; }).length;
      out.colS = npcs.filter((p) => '_colS' in p).length;
      out.d0 = !!d;
    }
    log('@@' + JSON.stringify(out));
    process.exit(0);
  })().catch((e) => { log('@@' + JSON.stringify({ err: String(e && e.stack || e) })); process.exit(1); });
  return;
}

// ── 부모 ──────────────────────────────────────────────────────────────────────
const child = (role, env) => {
  const r = spawnSync(process.execPath, ['--allow-natives-syntax', __filename, role], { encoding: 'utf8', env: Object.assign({}, process.env, env || {}), timeout: 300000 });
  const line = ((r.stdout || '') + (r.stderr || '')).split('\n').find((l) => l.startsWith('@@'));
  return line ? JSON.parse(line.slice(2)) : { err: (r.stderr || r.stdout || '').slice(-600) };
};
console.log('\n=== T1145 x · y 열 정본 — sim/body-cols.js · T1145_XY_COL ===');
{
  const Z = fs.readFileSync(path.join(ROOT, 'server', 'zone.js'), 'utf8');
  const knob = Z.match(/^const T1145_XY_COL = process\.env\.T1145_XY_COL === '1' && T806_HOT_INOBJ && !T1140_HOT_ORDER;$/gm) || [];
  const req = Z.match(/require\('\.\.\/sim\/body-cols'\)/g) || [];
  const head = Z.match(/const player = T1145_XY_COL \? _t1145C\.attach\(_t1145Lit\(pid, npcId, name, color, cx, cy, opts\), cx, cy\) : /g) || [];
  const others = fs.readdirSync(path.join(ROOT, 'server')).filter((f) => f.endsWith('.js') && f !== 'zone.js').filter((f) => /_colS|body-cols/.test(fs.readFileSync(path.join(ROOT, 'server', f), 'utf8')));
  ok(knob.length === 1 && req.length === 1 && head.length === 1 && others.length === 0, '⓪ 손잡이 한 줄(`1` 만 · T806 켬 · T1140 차례 끔) · 열 모듈 `require` 한 번 · 리터럴 머리 갈래 하나 · 다른 서버 파일 0(사본 0)',
    `손잡이 ${knob.length} · require ${req.length} · 머리 ${head.length} · 다른 파일 ${others.join(',') || 0}`);
}
{
  const m = child('--mod');
  if (m.err) ok(false, '① 열 모듈 자식', m.err);
  else {
    ok(m.fast && m.sameMap, '① 615 몸 — 빠른 속성 · 한 숨은 꼴(나중에 칸이 붙어도)', `빠름 ${m.fast} · 한 꼴 ${m.sameMap}`);
    ok(m.vals0 && m.edge === 0, '① 값 — 처음 값 · 경계값 15(−0 · NaN · ±∞ · 비정규 · 최대) `Object.is` 그대로', `어긋남 ${m.edge}`);
    ok(m.ways && m.spread && m.json, '① 쓰기 길 — `+=` · `-=` · `Object.assign` · 구조 분해 · 펼침 · JSON · 키 목록이 열 값을 본다');
    ok(m.badSet && m.badSet2, '① 수 아닌 쓰기(`undefined` · 문자열) — 그 몸만 되돌려 값 그대로 · 다른 칸 · 다른 몸 무변', `수 아닌 쓰기 ${m.st && m.st.bad}`);
    ok(m.reuse && m.reuseFirst, '★① 떠난 몸 번호 — 되돌린 뒤에만 다시 준다 · 떠난 몸 = 마지막 값(데이터 칸) · 새 몸과 끊김', `되돌림 ${m.st && m.st.retire} · 다시 줌 ${m.st && m.st.reuse}`);
    ok(m.grow, '① 열이 커져도(16 → …) 값 그대로', `키움 ${m.st && m.st.grow}`);
    ok(m.baitDict && m.baitClosure, '★① 미끼 — T738 꼴(데이터 칸을 그 자리에서 접근자로)은 사전 모드 · 몸마다 다른 클로저는 숨은 꼴이 갈린다(이 판이 둘 다 피했다)', `사전 ${m.baitDict} · 갈림 ${m.baitClosure}`);
  }
}
{
  const z = child('--zone', { T1145_XY_COL: '1' });
  if (z.err || !z.on) ok(false, '② 존(켬) 자식', z.err || '열 없음');
  else {
    ok(z.n > 300 && z.acc === z.n && z.colEq === z.n && z.fast === z.n, '② 존(켬) — 주민 몸 전부 열 몸(접근자 = 모듈 함수 · 열 칸 = 몸 값 · 빠른 속성)', `몸 ${z.n} · 접근자 ${z.acc} · 열=값 ${z.colEq} · 빠름 ${z.fast}`);
    ok(z.moved > 20 && z.walkBad === 0 && z.looks >= 40, '★② 몸이 걷는 동안 — 열 = 몸 값(10 초 · 40 번 봄) · 움직인 몸', `움직임 ${z.moved} · 어긋남 ${z.walkBad}`);
    ok(z.st && z.st.bad === 0 && z.maps <= 8, '② 수 아닌 쓰기 0 · 숨은 꼴 수 작다', `수 아닌 쓰기 ${z.st && z.st.bad} · 꼴 ${z.maps} · 되돌림 ${z.st && z.st.retire} · 번호 ${z.st && z.st.alloc}`);
  }
}
{
  const z0 = child('--zone', {});
  ok(!z0.err && !z0.on && z0.n > 300 && z0.data === z0.n && z0.colS === 0, '③ 존(끔 · 기본) — 열 0 · x 는 데이터 칸 · 번호 칸 0(종전 그대로)', z0.err || `몸 ${z0.n} · 데이터 칸 ${z0.data}`);
  const z2 = child('--zone', { T1145_XY_COL: '1', T1140_HOT_ORDER: '1' });
  ok(!z2.err && !z2.on && z2.data === z2.n, '③ 켬 + `T1140_HOT_ORDER=1` — 켬을 무시한다(열 0 · 차례 리터럴 그대로)', z2.err || `몸 ${z2.n} · 데이터 칸 ${z2.data}`);
}
console.log(`\n=== PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
