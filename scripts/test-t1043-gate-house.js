#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(scripts/run-regress.sh · 표 없으면 안 돈다)
// @nightly C   ← 야간 분할(T238) — 게이트 짧은 판 둘(판당 2~4분 · 굽기 + 견줌 · 둘 같이)
// === scripts/test-t1043-gate-house.js — 판 자 결정론 착지 게이트 한 줄(`scripts/gate-house.js` · T1043 · 2026-11-01) ==========================
//
// 판정 사본 0: 게이트 파일 그대로를 짧은 판(시드 42 · 20날)으로 부른다. 게이트가 부르는 자(`server-baseline-check.js --house` 굽기 → `--vclock` 견줌)는
//   손대지 않는다. 지키는 것:
//     ⓪ 정적 — 게이트가 굽기 `--make … --house` · 견줌 `<구운 판> --house --vclock` 두 줄을 부르고, 끝 줄 PASS/FAIL 글자가 있고,
//        부하 고리가 부모 pid · 시한을 본다(남는 고리 0 — T1013 사고 기록)
//     ① 판 자 기본 + 부하 고리 1 — 나감 0 · 끝 줄 `GATE-HOUSE PASS` · 부하 고리 pid 가 판 뒤 살아 있지 않다 · 임시 판 폴더가 지워졌다
//     ② ★미끼 — 벽시계 굽기 아이만 다른 세계(이 파일이 프리로드로 실려 아이 존 · 가상 시계 아님일 때만 `T400_BUILD_ACT=0`)면
//        나감 1 · 끝 줄 `GATE-HOUSE FAIL · 벽시계 ≠ 가상 시계` (게이트가 갈림을 본다 — 자명 통과 금지)
//   진짜 벽시계 자리 미끼(`T146_BUILD_MS=1 T1013_BAND_DAY=0` — 사냥터 짓기를 내일로)는 날 281 에야 갈려 짧은 판에 안 닿는다 — 400날 판은 보고/T1043 §3.
'use strict';
if (require.main !== module) {   // ★프리로드 갈래 — 게이트 · 기준선 자 · 판 자 부모 · 부하 고리에도 실린다: 아무것도 안 한다(본문이 돌면 판이 판을 낳는다)
  //   벽시계 굽기 아이(아이 존 · 가상 시계 아님)만 세계를 바꾼다 — 미끼 판에서만(`T1043_BAIT=wall`)
  if (process.env.T1043_BAIT === 'wall' && process.env.T577_SEED && !process.env.T745_VCLOCK) process.env.T400_BUILD_ACT = '0';
  return;
}
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const GATE = path.join(__dirname, 'gate-house.js');
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (d !== undefined && d !== '' ? `  ${d}` : '')); };
function gate(args, env) {
  return new Promise((resolve) => {
    const E = Object.assign({}, process.env);
    delete E.T745_VCLOCK; delete E.T1043_BAIT; Object.assign(E, env);
    const ch = spawn(process.execPath, [GATE, ...args], { cwd: ROOT, env: E, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    ch.stdout.on('data', (b) => { out += b; }); ch.stderr.on('data', (b) => { out += b; });
    ch.on('close', (code) => resolve({ code, out, last: out.trim().split('\n').pop() }));
  });
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
(async () => {
  console.log('\n=== 판 자 결정론 착지 게이트 한 줄 — scripts/gate-house.js(시드 42 · 20날) ===');
  {
    const G = fs.readFileSync(GATE, 'utf8');
    ok(/sbc\(\['--make', BAKE, '--days', String\(DAYS\), '--seeds', SEEDS, '--house'\]/.test(G) && /sbc\(\[BAKE, '--house', '--vclock'\]/.test(G)
      && /GATE-HOUSE PASS · /.test(G) && /GATE-HOUSE FAIL · /.test(G) && /process\.ppid!==P\|\|Date\.now\(\)>T/.test(G),
      '⓪ 게이트 글자 — 굽기(--make --house) → 견줌(--house --vclock) · 끝 줄 PASS/FAIL · 부하 고리는 부모 pid · 시한을 본다');
  }
  const A = ['--days', '20', '--seeds', '42'];
  const [p, b] = await Promise.all([gate([...A, '--load', '1'], {}), gate(A, { T1043_BAIT: 'wall', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${__filename}`.trim() })]);
  const pids = ((p.out.match(/부하 고리 pid ([\d ]+)/) || [])[1] || '').trim().split(/\s+/).filter(Boolean).map(Number);
  const tmpd = (p.out.match(/(\/[^\s]*gate-house-[A-Za-z0-9]+)\//) || [])[1];
  ok(p.code === 0 && /^GATE-HOUSE PASS · 벽시계 = 가상 시계 같음 1\/1 · /.test(p.last), '★① 판 자 기본 + 부하 고리 1 — 나감 0 · 끝 줄 PASS', p.last);
  ok(pids.length === 1 && pids.every((x) => !alive(x)) && !!tmpd && !fs.existsSync(tmpd), '① 판 뒤 — 부하 고리 남은 것 0 · 임시 판 폴더 지움', `고리 ${pids.join(',') || '?'} · 폴더 ${tmpd || '?'}`);
  ok(b.code === 1 && /^GATE-HOUSE FAIL · 벽시계 ≠ 가상 시계 다름 1\/1 · /.test(b.last), '[미끼 · ②] 벽시계 굽기 아이만 다른 세계 — 나감 1 · 끝 줄 FAIL', b.last);
  console.log(`\n=== PASS ${pass} / FAIL ${fail} ===`);
  process.exit(fail ? 1 : 0);
})();
