#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · 착지 게이트 · 판 15~18분 · 제품 무변 · 판정 0 · 하네스는 scripts/test-t1043-gate-house.js)
// === scripts/gate-house.js — 판 자 결정론 착지 게이트 한 줄(T1043 · 2026-11-01 · `인계/공통.md` §2 ⑪) ===================================
//
// ★왜 [T1013 회부 · T1043 ③] 판 자 벽시계 자리 다섯(T969 쉼터 · T986 도적 하루 · T990/T1001 길의 날 · 광맥 시각 · T1013 사냥터 짓기)이 econ 날에
//   묶인 뒤로 집 행위 켬(`--house`) 판의 벽시계 판 = 가상 시계 판이다(800날 3시드 · 부하 판 포함). 착지 판에서 그것이 서 있는지를
//   명령 두 줄(굽기 · 견줌)로 봤는데, 그 두 줄을 PM 게이트가 그대로 부르도록 한 파일로 묶었다. 자는 하나도 안 바꾼다 — 같은 두 줄을 차례로 부른다.
//
// 쓰는 법:
//   node scripts/gate-house.js                          # --house 400날 3시드 벽시계 굽기 → 그 판 ↔ --vclock 견줌(2코어 ≈ 564 + 531초)
//   node scripts/gate-house.js --keep 계측/서버기준선_<날짜>_house.json   # 구운 판을 그 이름으로 남긴다(안 주면 임시 폴더 · 끝나면 지움)
//   node scripts/gate-house.js --load 2                 # 부하 판 — 굽는 동안 바쁜 고리 2(벽시계 몫이 바닥나는 자리를 드러낸다 · T1013)
//   node scripts/gate-house.js --days 20 --seeds 42     # 짧은 판(하네스 · 손 확인)
//   끝 줄 하나: `GATE-HOUSE PASS · …` (나감 0) · `GATE-HOUSE FAIL · …` (나감 1 = 갈림 · 2 = 판 실패)
//
// ★지키는 것
//   ① 판 조건은 `server-baseline-check.js --house` 그대로(`VILLAGE_CARAVAN_MAX=0` · `T400_BUILD_ACT=1` · t577 아이 기본 — T941 · T990 · T1013 손잡이).
//      부르는 쪽 env 는 그대로 아이까지 간다(미끼 · 되돌림 판을 그대로 칠 수 있게) — 이 파일이 지우거나 더하는 손잡이는 0 이다. 걸린 `T…_` env 는 머리 줄에 적는다.
//   ② 부하 고리는 굽기 동안만 돈다. 고리마다 부모(이 파일)가 사라지거나 시한(2시간)이 지나면 스스로 멈춘다 — 판 뒤 남는 고리 0(T1013 사고 기록).
//   ③ 판 폴더(DB 1~2 GB)는 이 파일이 만든 임시 폴더 하나에 두고 끝에 지운다. 끊기면(SIGINT · SIGTERM · SIGHUP) 기준선 자를 아이 판까지(프로세스 묶음) 멈추고 지운다.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SBC = path.join(__dirname, 'server-baseline-check.js');
const A = process.argv.slice(2);
const opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const DAYS = parseInt(opt('--days', '400'), 10);
const SEEDS = String(opt('--seeds', '1020,7,42'));
const LOAD = Math.max(0, parseInt(opt('--load', '0'), 10) || 0);
const KEEP = opt('--keep', null);
if (!(DAYS > 0) || !/^\d+(,\d+)*$/.test(SEEDS)) { console.error('쓰는 법: [--days 400] [--seeds 1020,7,42] [--load N] [--keep <out.json>]'); process.exit(2); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-house-'));
const BAKE = KEEP ? path.resolve(KEEP) : path.join(TMP, 'house.json');
const loops = [];
let cur = null;   // 지금 도는 기준선 자(제 프로세스 묶음 — 아이 판까지 한 번에 멈춘다)
function stopLoops() { for (const ch of loops) { try { ch.kill('SIGKILL'); } catch (e) {} } loops.length = 0; }
function cleanup() { stopLoops(); if (cur) { try { process.kill(-cur.pid, 'SIGKILL'); } catch (e) {} cur = null; } try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(2); });

function startLoops(n) {
  //   스스로 멈추는 바쁜 고리 — 2^20 번마다 부모 pid 와 시한을 본다(부모가 죽으면 ppid 가 바뀐다)
  const src = `const P=${process.pid},T=Date.now()+7200000;for(let i=1;;i++){if((i&1048575)===0&&(process.ppid!==P||Date.now()>T))break;}`;
  for (let i = 0; i < n; i++) loops.push(spawn(process.execPath, ['-e', src], { stdio: 'ignore' }));
  return loops.map((c) => c.pid);
}
function sbc(args, tag) {
  return new Promise((resolve) => {
    const env = Object.assign({}, process.env, { TMPDIR: TMP });
    const t0 = Date.now();
    const ch = spawn(process.execPath, [SBC, ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    cur = ch;
    let last = '', all = '';
    const line = (out) => { let rest = ''; return { feed(b) { rest += b.toString(); const ls = rest.split('\n'); rest = ls.pop(); for (const l of ls) { all += l + '\n'; out.write(`  [${tag}] ${l}\n`); } }, end() { if (rest) { all += rest; out.write(`  [${tag}] ${rest}\n`); rest = ''; } } }; };
    const o = line(process.stdout), e = line(process.stderr);
    ch.stdout.on('data', (b) => o.feed(b));
    ch.stderr.on('data', (b) => e.feed(b));
    ch.on('close', (code) => { cur = null; o.end(); e.end(); const m = all.match(/=== [^\n]* ===/g); if (m) last = m[m.length - 1]; resolve({ code, last, sec: Math.round((Date.now() - t0) / 1000) }); });
  });
}
(async () => {
  const knobs = Object.keys(process.env).filter((k) => /^T\d+_/.test(k)).sort().map((k) => `${k}=${process.env[k]}`);
  console.log(`=== 판 자 결정론 게이트(--house) — ${DAYS}날 · 시드 ${SEEDS} · 부하 고리 ${LOAD} · 걸린 T…_ env ${knobs.length ? knobs.join(" ") : "없음(판 자 기본)"} ===`);
  const t0 = Date.now();
  // ① 벽시계 굽기(부하 판이면 그동안 고리)
  const pids = LOAD ? startLoops(LOAD) : [];
  if (LOAD) console.log(`  부하 고리 pid ${pids.join(' ')}`);
  const mk = await sbc(['--make', BAKE, '--days', String(DAYS), '--seeds', SEEDS, '--house'], '굽기');
  stopLoops();
  if (mk.code !== 0) { console.log(`GATE-HOUSE FAIL · 굽기 판 실패(나감 ${mk.code}) · ${mk.sec}초`); process.exit(2); }
  // ② 그 판 ↔ 가상 시계
  const vc = await sbc([BAKE, '--house', '--vclock'], '견줌');
  const sec = Math.round((Date.now() - t0) / 1000);
  const what = (vc.last || '').replace(/^=== | ===$/g, '');
  const tail = `${DAYS}날 · 시드 ${SEEDS} · 부하 ${LOAD} · 굽기 ${mk.sec}초 + 견줌 ${vc.sec}초 = ${sec}초${KEEP ? ` · 남김 ${path.relative(ROOT, BAKE)}` : ''}`;
  if (vc.code === 0) { console.log(`GATE-HOUSE PASS · 벽시계 = 가상 시계 ${what} · ${tail}`); process.exit(0); }
  console.log(`GATE-HOUSE FAIL · ${vc.code === 1 ? '벽시계 ≠ 가상 시계' : `견줌 판 실패(나감 ${vc.code})`} ${what} · ${tail}`);
  process.exit(vc.code === 1 ? 1 : 2);
})();
