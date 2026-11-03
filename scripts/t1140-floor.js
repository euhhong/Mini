#!/usr/bin/env node
// === scripts/t1140-floor.js — T1140 ④ 바닥 자: 서 있는 몸 한 걸음 머리의 메모리 값 — 몸 객체 ↔ 차례 리터럴 ↔ 열(타입 배열) (러너 밖 · 서버 0) ===
//   ★왜 — T1140 ① 표본에서 `npcStep` 의 무거운 줄은 셈이 아니라 **그 틱에 몸 칸을 처음 짚는 줄**이었다(막힘 서 있음 판정 · 결정 문 · 도착 뒤 첫 줄).
//     JS 로 0.3 µs 가 서나, 아니면 열(C/WASM 이 쓰는 꼴)이어야 서나를 숫자로 묻는다(문 18).
//   ★무엇 — 같은 걸음 머리(서 있는 몸이 틱마다 하는 일: 관측 도장 · 결정 문 · 대피 · 막힘 서 있음 판정 + 막힘 칸 쓰기 · 목표 키 · 되묻기 문 · 따라가기 끝)를
//     ⓐ 몸 객체(zone.js 의 T806 켬 리터럴 글자 그대로 + `_t671Shape`) ⓑ 차례 리터럴(`_t1140Lit` — `T1140_HOT_ORDER`) ⓒ 열(Float64Array/Int32Array · 몸 번호 = 슬롯)
//     세 꼴로 돌린다. 틱 사이에 캐시를 비운다(틱의 다른 일 — 존 한 틱 ≈ 3 ms 가 걸음 문 사이에 캐시를 갈아 끼우는 몫 — 을 흉내 · 버퍼 `T1140F_FLUSH_MB` 기본 8MB 훑기).
//     몸 사이사이에 다른 객체를 섞어 짓는다(존 몸은 부팅 때 마을 · 집 · 짐과 섞여 태어난다 — 몸이 메모리에 붙어 있지 않다).
//   ⚠흉내 자다 — 존의 값이 아니다. 존에서 잰 수(① 표)와 견줄 것은 **세 꼴의 차**(같은 일 · 같은 캐시 비우기)다.
// 실행: node scripts/t1140-floor.js [몸=615] [틱=3000]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const N = +(process.argv[2] || 615), TICKS = +(process.argv[3] || 3000), FLUSH_MB = +(process.env.T1140F_FLUSH_MB || 8);
const Z = fs.readFileSync(path.join(ROOT, 'server', 'zone.js'), 'utf8');
const fnSrc = (S, name) => { const i = S.indexOf(`function ${name}(`); const j = S.indexOf('\n}\n', i); return S.slice(i, j + 2); };
const sp = fnSrc(Z, 'spawnNpc'), a = sp.indexOf('\n', sp.indexOf('T806_HOT_INOBJ ? {')), b = sp.indexOf('  } : {\n    pid, playerId', a);
const env = 'const PLAYER_MAX_HP = 100, HUNGER_MAX = 100, THIRST_MAX = 100;\n';
const mk806 = new Function('pid', 'npcId', 'name', 'color', 'cx', 'cy', 'opts', env + 'return ({' + sp.slice(a + 1, b) + '});');
const mk1140 = new Function('pid', 'npcId', 'name', 'color', 'cx', 'cy', 'opts', env + fnSrc(Z, '_t1140Lit') + '\nreturn _t1140Lit(pid, npcId, name, color, cx, cy, opts);');
const shape = new Function('p', fnSrc(Z, '_t671Shape').replace(/^function _t671Shape\(p\) \{/, '').replace(/\}\s*$/, '').replace(/if \(T1140_STUCK_INLINE[^\n]*\n/, ''));
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const junk = [];
function makeBodies(mk) {
  const B = [];
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 6; k++) junk.push({ a: rnd(), b: [rnd(), rnd()], c: 'j' + i + k });   // 사이에 다른 객체
    const cx = 1000 + rnd() * 30000, cy = 1000 + rnd() * 30000, p = mk('p' + i, 'npc_' + i, '이름', '#fff', cx, cy, { villageId: 'v' + (i % 51) });
    shape(p);
    p.npcHomeX = cx; p.npcHomeY = cy; p.simVillageId = i % 51; p.simLonOff = 0.01 * (i % 7);
    p.nextDecisionAt = 1.7e12 + rnd() * 1e3; p.targetX = cx + 3.3; p.targetY = cy - 2.1;
    p.path = [{ x: p.targetX, y: p.targetY }]; p.pathIndex = 1; p._t791P = p.path; p._t791Pn = 1; p._t791Px = p.targetX; p._t791Py = p.targetY;
    p._stuckPos = { x: cx, y: cy, at: 1.7e12 }; p._stuckN = 0; p._t670TkX = p.targetX; p._t670TkY = p.targetY; p._t670Tk = (p.targetX | 0) + '_' + (p.targetY | 0);
    p._pathFor = p._t670Tk; p._pathAt = 1.7e12; p.vx = 0.5; p.vy = -0.5; p.behavior = 'wander';
    B.push(p);
  }
  return B;
}
// 서 있는 몸 한 걸음 머리 — zone.js `npcStep` 앞머리 · `detectStuck` 서 있음 갈래 · 되묻기 문 · `followNpcPath` 끝(같은 필드 · 같은 차례)
function headObj(npc, now) {
  npc._t540StepAt = now;
  if (!(!npc.canadiaVillage && now < npc.nextDecisionAt)) npc.nextDecisionAt = now + 1000;
  if (npc.simEvacUntil && now < npc.simEvacUntil) return 1;
  if (npc.canadiaTask === 'traveling') return 2;
  if (npc.targetX != null && npc.targetY != null && (!npc.path || npc.pathIndex >= (npc.path === npc._t791P ? npc._t791Pn : npc.path.length))) {
    const dx = npc.x - npc.targetX, dy = npc.y - npc.targetY;
    if (dx * dx + dy * dy < 144) { const S = npc._stuckPos; S.x = npc.x; S.y = npc.y; S.at = now; npc._stuckN = 0; }
  }
  if (npc.targetX !== npc._t670TkX || npc.targetY !== npc._t670TkY) return 3;
  const need = !npc.path || npc.pathIndex >= (npc.path === npc._t791P ? npc._t791Pn : npc.path.length) || npc._pathFor !== npc._t670Tk;
  if (need) { npc.pathIndex = 0; npc._pathAt = now; }
  if (npc.pathIndex === 0) { const dx = npc._t791Px - npc.x, dy = npc._t791Py - npc.y; if (dx * dx + dy * dy < 100) { npc.pathIndex = 1; npc.vx = 0; npc.vy = 0; } }
  return npc.behavior === 'gather' ? 4 : 0;
}
// 열 — 같은 일 · 같은 차례(몸 번호 i · 길은 길이 · 첫 점만 · 목표 키는 정수 둘 · 문자열 0)
function makeCols(B) {
  const n = B.length, F = (k) => Float64Array.from(B, (p) => +p[k]), I = (k) => Int32Array.from(B, (p) => p[k] | 0);
  return { n, x: F('x'), y: F('y'), vx: F('vx'), vy: F('vy'), tx: F('targetX'), ty: F('targetY'), nd: F('nextDecisionAt'), st: new Float64Array(n), ev: new Float64Array(n), can: new Int32Array(n), trav: new Int32Array(n),
    pn: I('_t791Pn'), pi: I('pathIndex'), px: F('_t791Px'), py: F('_t791Py'), sx: F('x'), sy: F('y'), sa: new Float64Array(n), sn: new Int32Array(n), tkx: F('_t670TkX'), tky: F('_t670TkY'), pf: new Int32Array(n), tk: new Int32Array(n), pat: new Float64Array(n), beh: new Int32Array(n) };
}
function headCol(C, i, now) {
  C.st[i] = now;
  if (!(!C.can[i] && now < C.nd[i])) C.nd[i] = now + 1000;
  if (C.ev[i] && now < C.ev[i]) return 1;
  if (C.trav[i]) return 2;
  if (C.pi[i] >= C.pn[i]) { const dx = C.x[i] - C.tx[i], dy = C.y[i] - C.ty[i]; if (dx * dx + dy * dy < 144) { C.sx[i] = C.x[i]; C.sy[i] = C.y[i]; C.sa[i] = now; C.sn[i] = 0; } }
  if (C.tx[i] !== C.tkx[i] || C.ty[i] !== C.tky[i]) return 3;
  if (C.pi[i] >= C.pn[i] || C.pf[i] !== C.tk[i]) { C.pi[i] = 0; C.pat[i] = now; }
  if (C.pi[i] === 0) { const dx = C.px[i] - C.x[i], dy = C.py[i] - C.y[i]; if (dx * dx + dy * dy < 100) { C.pi[i] = 1; C.vx[i] = 0; C.vy[i] = 0; } }
  return C.beh[i] === 1 ? 4 : 0;
}
const flush = new Float64Array((FLUSH_MB << 20) / 8); let sink = 0;
function flushCache() { for (let i = 0; i < flush.length; i += 8) sink += flush[i]++; }
const now0 = 1.7e12;
function bench(label, fn) {
  // 덥히기
  for (let t = 0; t < 200; t++) fn(now0 + t * 33);
  let ns = 0, nsWarm = 0;
  for (let t = 0; t < TICKS; t++) {
    flushCache();
    const a0 = process.hrtime.bigint(); fn(now0 + 1e5 + t * 33); const a1 = process.hrtime.bigint(); ns += Number(a1 - a0);
    const b0 = process.hrtime.bigint(); fn(now0 + 1e5 + t * 33 + 1); const b1 = process.hrtime.bigint(); nsWarm += Number(b1 - b0);   // 캐시가 찬 채 같은 일 한 번 더
  }
  return { label, coldNsPerBody: +(ns / TICKS / N).toFixed(1), warmNsPerBody: +(nsWarm / TICKS / N).toFixed(1) };
}
const B806 = makeBodies(mk806), B1140 = makeBodies(mk1140), C = makeCols(B806);
const order = Array.from({ length: N }, (_, i) => i);   // 결정 문 차례 = `npcs` 차례(태어난 차례)
const res = [];
for (let rep = 0; rep < 3; rep++) {
  res.push(bench('ⓐ 몸 객체(T806 켬 리터럴)', (now) => { let s = 0; for (const p of B806) s += headObj(p, now); sink += s; }));
  res.push(bench('ⓑ 차례 리터럴(T1140_HOT_ORDER)', (now) => { let s = 0; for (const p of B1140) s += headObj(p, now); sink += s; }));
  res.push(bench('ⓒ 열(타입 배열 · 슬롯)', (now) => { let s = 0; for (const i of order) s += headCol(C, i, now); sink += s; }));
}
const by = {}; for (const r of res) (by[r.label] = by[r.label] || []).push(r);
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[(b.length - 1) >> 1]; };
const out = { at: new Date().toISOString(), N, TICKS, FLUSH_MB, node: process.version, rows: Object.entries(by).map(([k, v]) => ({ label: k, coldNsPerBody: med(v.map((x) => x.coldNsPerBody)), warmNsPerBody: med(v.map((x) => x.warmNsPerBody)), reps: v })) };
console.log(JSON.stringify(out.rows.map((r) => [r.label, r.coldNsPerBody, r.warmNsPerBody])));
if (process.env.T1140F_OUT) fs.writeFileSync(process.env.T1140F_OUT, JSON.stringify(out, null, 1));
if (sink === 42) console.log('');
