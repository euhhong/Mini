#!/usr/bin/env node
// @regress
// === scripts/test-crop-memo.js — 활동일 · 계절 기억(T1041 ⓓ · 손잡이 `T1041_CROP_MEMO`)이 답을 안 바꾸는가 ===
//   ★왜 — T1041 몸∞ 판 자 시간 해부: 생활층 농사 하루가 `crops.grownDays`(심은 날 → 오늘을 하루씩 `_dormant` → `seasonOf` → `calendar.dateOf`)를
//     밭 칸 · 일꾼마다 다시 세 판 CPU 의 16% 를 먹었다. 손잡이는 같은 물음(작물 · 심은 날 · 오늘 / 날 → 계절)에 같은 답을 기억만 한다.
//   재는 것:
//     ① 손잡이 — 켬이 기본(env 없음) · `=0` 이면 끔.
//     ② 값 무변 — 34종 × 심은 날 × 오늘(겨울 · 춘화 · 다년생 · 1년생이 다 든 넓은 격자)의 `grownDays` · `isReady` · `dormantAt` · `seasonOfDay` 를
//        켬 판과 끔 판(아이 프로세스 · 종전 줄)이 낸 답을 줄줄이 견준다 — 하나도 안 달라야 한다.
//        ★★자명 통과 금지 — 끔 판 답이 고르게 갈린다(0 < 활동일 < 다 자람 인 칸 · 휴면 참/거짓 · 계절 넷)를 먼저 본다.
//     ③ 기억이 실제로 쓰인다 — 같은 물음을 두 번 물으면 켬 판은 두 번째에 기억에서 답한다(셈 `t1041Stat` · 끔 판은 0).
//     ④ 날이 바뀌면 활동일 기억을 비운다 — 오늘이 바뀐 물음은 다시 센다(어제 답을 오늘 쓰지 않는다).
//     ⑤ 번들 · 랩 둘이 같은 글자를 싣는다(브라우저 판 — `process.env` 없으면 켬).
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const CP = path.join(ROOT, 'server', 'crops.js');

function grid() {   // 넓은 격자 — 음수 날 · 첫해 · 여러 해 · 겨울 경계 가로지름
  const C = require(CP);
  const rows = [];
  const planted = []; for (let p = -60; p <= 900; p += 13) planted.push(p);
  const offs = [0, 1, 7, 30, 45, 89, 90, 91, 120, 180, 250, 365, 420, 700];
  for (const id of C.IDS) for (const p of planted) for (const o of offs) {
    const t = p + o, t2 = t + 0.6;   // 소수 날(존 날 조각)도 같은 날로 접히는지
    rows.push([id, p, t, C.grownDays(id, p, t), C.isReady(id, p, t), C.dormantAt(id, t), C.grownDays(id, p, t2)]);
  }
  const seasons = []; for (let d = -800; d <= 3000; d += 7) seasons.push([d, C.seasonOfDay(d), C.seasonOfDay(d + 0.5)]);
  return { on: C.T1041_CROP_MEMO, rows, seasons, stat: C.t1041Stat() };
}
if (process.env.T1041_SUB === 'grid') { fs.writeSync(1, JSON.stringify(grid())); process.exit(0); }

let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (x !== undefined && x !== '' ? `  ${x}` : '')); };
const kid = (env) => JSON.parse(execFileSync(process.execPath, [__filename], { env: Object.assign({}, process.env, { T1041_SUB: 'grid' }, env), encoding: 'utf8', maxBuffer: 1 << 28 }));
console.log('\n=== 활동일 · 계절 기억이 답을 안 바꾼다 (T1041 ⓓ · `T1041_CROP_MEMO`) ===');

console.log('\n① 손잡이');
const env0 = Object.assign({}, process.env); delete env0.T1041_CROP_MEMO;
const on = kid({ T1041_CROP_MEMO: '' }), off = kid({ T1041_CROP_MEMO: '0' });
ok(on.on === true, '★켬이 기본(env 없음 · 빈 값)', on.on);
ok(off.on === false, '★`T1041_CROP_MEMO=0` 이면 끔(종전 줄)', off.on);

console.log('\n② 값 무변 — 켬 판 ↔ 끔 판');
{
  const n = off.rows.length;
  const mid = off.rows.filter((r) => r[3] > 0 && !r[4]).length, ready = off.rows.filter((r) => r[4]).length, zero = off.rows.filter((r) => r[3] === 0).length;
  const dorm = off.rows.filter((r) => r[5]).length;
  const ss = new Set(off.seasons.map((x) => x[1]));
  ok(mid > 100 && ready > 100 && zero > 100 && dorm > 50 && dorm < n && ss.size === 4,
    '★★자명 통과 금지 — 끔 판 답이 고르게 갈린다(자라는 중 · 다 자람 · 0 · 휴면 참/거짓 · 계절 넷)', `칸 ${n} · 자라는 중 ${mid} · 다 자람 ${ready} · 0 ${zero} · 휴면 ${dorm} · 계절 ${[...ss].join('/')}`);
  let diff = 0, first = null;
  for (let i = 0; i < n; i++) { const a = on.rows[i], b = off.rows[i]; if (JSON.stringify(a) !== JSON.stringify(b)) { diff++; if (!first) first = { on: a, off: b }; } }
  ok(on.rows.length === n && diff === 0, '★grownDays · isReady · dormantAt · 소수 날 — 켬 = 끔(칸마다)', `${n}칸 · 다름 ${diff}${first ? ' · 첫 ' + JSON.stringify(first) : ''}`);
  const sd = on.seasons.filter((x, i) => JSON.stringify(x) !== JSON.stringify(off.seasons[i])).length;
  ok(on.seasons.length === off.seasons.length && sd === 0, '★seasonOfDay — 켬 = 끔(−800 ~ 3000 날 · 소수 날)', `${on.seasons.length}날 · 다름 ${sd}`);
}

console.log('\n③ 기억이 실제로 쓰인다');
ok(on.stat.grownHit > 0 && on.stat.seasonHit > 0, '★켬 판 — 같은 물음의 두 번째는 기억에서(활동일 · 계절 둘 다)', JSON.stringify(on.stat));
ok(off.stat.grownHit === 0 && off.stat.grownMiss === 0 && off.stat.seasonHit === 0 && off.stat.seasonMiss === 0, '끔 판 — 기억 셈 0(종전 줄만 돈다)', JSON.stringify(off.stat));

console.log('\n④ 날이 바뀌면 활동일 기억을 비운다');
{
  delete require.cache[CP];
  process.env.T1041_CROP_MEMO = '';
  const C = require(CP);
  const s0 = C.t1041Stat();
  const a = C.grownDays('wheat', 250, 400), b = C.grownDays('wheat', 250, 400), s1 = C.t1041Stat();
  const c = C.grownDays('wheat', 250, 401), s2 = C.t1041Stat();
  const d = C.grownDays('wheat', 250, 400), s3 = C.t1041Stat();
  ok(a === b && s1.grownHit - s0.grownHit === 1, '같은 날 같은 물음 — 두 번째는 기억(답 같음)', `${a} · ${b}`);
  ok(s2.grownMiss - s1.grownMiss === 1 && c === C._grownDays0('wheat', 250, 401), '오늘이 바뀌면 다시 센다(종전 몸 답과 같다)', `${c}`);
  ok(s3.grownMiss - s2.grownMiss === 1 && d === a, '어제로 되돌아가도 다시 센다(기억은 그날 하나뿐)', `${d}`);
}

console.log('\n⑤ 번들 · 랩 — 같은 글자');
{
  const B = path.join(ROOT, 'sim', 'economy-engine.browser.js');
  const has = (t) => /T1041_CROP_MEMO/.test(t) && /function _grownDays0\(/.test(t);
  ok(fs.existsSync(B) && has(fs.readFileSync(B, 'utf8')), '★번들(`sim/economy-engine.browser.js`)이 같은 손잡이 · 종전 몸을 싣는다');
  for (const f of ['마을실험실.html', '전쟁실험실.html']) {
    const p = path.join(ROOT, 'lab', f); if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8'); if (!/function grownDays\(/.test(t)) continue;
    ok(has(t), `★랩 ${f} 인라인 엔진도 같은 글자`);
  }
}

console.log(`\n=== ${pass + fail}건 중 PASS ${pass} · FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
