#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · 착지 · 야간 게이트 · 판 넷 × 3시드 800날 · 제품 무변 · 판정 0 · 하네스는 scripts/test-gate-draft.js)
// === scripts/gate-draft.js — 징발 묶임 · 몰사 경보 게이트 한 줄(T1082 · 2026-11-02 · 판정대기 문 2 닫음 · `인계/공통.md` §2 ⑫) =======================
//
// ★왜 [재민 11-02 · 문 2 = (다) 특례 안전망 없이 닫는다 — 대신 다시 생기면 잡도록 경보] T1037 이 지금 세계 기본 판 열둘(판 넷 × 3시드 · 800날)에서
//   징발 묶임 0 · 몰사 0 · 셈만 느는 죽음 0 을 셌다. 그 셈을 착지 · 야간 게이트가 그대로 부르도록 한 파일로 묶었다. 판 · 잣대는 하나도 안 바꾼다:
//   판 = T1037 의 그 줄(`보고/T1037_2026-11-01.md` §판) — 서버 판 자 `t577-server-run.js 800 1020,7,42` + 프리로드 `t815-observe.js`(마을 하루 장부)
//        · `diverge-ctl.js`(갈림 대조 — `DCTL_SKIP=raid:n` 이면 n 번째 습격 조우 하나만 건너뜀) · 판 넷 = 판 기본 · raid:1 · raid:2 · raid:3.
//   잣대 = `t1037-table.js`(그 안에서 `t815-table.js`) 그대로 — 묶임 = 자유민 0 이 10일 이상 · 첫날 인구 ≥ 5 · 몰사 = 묶임이 풀린 뒤 3일 안 인구 0 ·
//          셈만 느는 죽음 = 전날 끝에도 자유민 0 이던 날 센 죽음. 이 파일은 그 표의 수를 읽어 **하나라도 1 이상이면 빨강**일 뿐이다(문턱 = 0 · 새 수 0).
//
// 쓰는 법:
//   node scripts/gate-draft.js                              # 판 넷 × 3시드 800날을 차례로 돌리고 판단(2코어 · 아래 시간)
//   node scripts/gate-draft.js --keep /tmp/gd               # 판 폴더를 남긴다(안 주면 임시 폴더 · 끝나면 지움 — 판 DB 1~2 GB)
//   node scripts/gate-draft.js --from <뿌리>                 # 판은 안 돌리고 이미 있는 판(<뿌리>/run-on · run-on~raid1..3/base-<시드>.t815.json)만 판단
//   node scripts/gate-draft.js --runs on,raid1 --days 120   # 판 일부 · 짧은 판(손 확인 — 착지 게이트는 기본값 그대로)
//   끝 줄 하나: `GATE-DRAFT PASS · …`(나감 0) · `GATE-DRAFT FAIL · …`(나감 1 = 묶임 · 몰사 · 셈만 ≥ 1 · 2 = 판 실패 · 표 없음)
//
// ★지키는 것
//   ① 부르는 쪽 env 는 그대로 아이까지 간다(되돌림 판을 그대로 칠 수 있게). 이 파일이 정하는 것은 판 이름 · 판 폴더 · `DCTL_SKIP` · 프리로드 둘 · 동시 3 뿐이다.
//   ② 판 하나는 제 프로세스 묶음으로 띄운다 — 끊기면(SIGINT · SIGTERM · SIGHUP) 아이 판까지 묶음째 멈추고 임시 폴더를 지운다.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2);
const opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const DAYS = parseInt(opt('--days', '800'), 10);
const RUNS = String(opt('--runs', 'on,raid1,raid2,raid3')).split(',').filter(Boolean);
const FROM = opt('--from', null), KEEP = opt('--keep', null);
const RUN_OK = /^(on|raid[123])$/;
if (!(DAYS > 0) || !RUNS.length || !RUNS.every((r) => RUN_OK.test(r))) { console.error('쓰는 법: [--days 800] [--runs on,raid1,raid2,raid3] [--keep <dir> | --from <dir>]'); process.exit(2); }
const dirName = (r) => (r === 'on' ? 'on' : `on~${r}`);   // T1037 판 이름(`t1037-table.js` 가 읽는 이름)
const SEEDS = '1020,7,42';   // `t1037-table.js` 가 세 시드를 다 읽어야 판 하나를 센다

const TMP = FROM ? null : (KEEP ? (fs.mkdirSync(KEEP, { recursive: true }), path.resolve(KEEP)) : fs.mkdtempSync(path.join(os.tmpdir(), 'gate-draft-')));
const BASE = FROM ? path.resolve(FROM) : TMP;
let cur = null;
function cleanup() { if (cur) { try { process.kill(-cur.pid, 'SIGKILL'); } catch (e) {} cur = null; } if (TMP && !KEEP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} } }
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(2); });

function runOne(r) {
  return new Promise((resolve) => {
    const dir = path.join(BASE, 'run-' + dirName(r));
    fs.mkdirSync(dir, { recursive: true });
    const pre = `-r ${path.join(__dirname, 't815-observe.js')} -r ${path.join(__dirname, 'diverge-ctl.js')}`;
    const env = Object.assign({}, process.env, { T577_TAG: 'base', T577_DIR: dir, T577_PAR: '3', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} ${pre}`.trim() });
    if (r === 'on') delete env.DCTL_SKIP; else env.DCTL_SKIP = 'raid:' + r.slice(4);
    delete env.DCTL_ARM;   // 갈래는 판 기본(main) 하나
    const t0 = Date.now();
    const ch = spawn(process.execPath, [path.join(__dirname, 't577-server-run.js'), String(DAYS), SEEDS], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    cur = ch;
    let tail = '';
    const keep = (b) => { tail = (tail + b.toString()).slice(-4000); };
    ch.stdout.on('data', keep); ch.stderr.on('data', keep);
    ch.on('close', (code) => {
      cur = null;
      //   판 DB(+WAL)는 장부(.t815.json)를 남긴 뒤 지운다 — 판 넷 × 3시드 DB 를 다 들고 있으면 디스크가 모자란다
      try { for (const x of fs.readdirSync(dir)) if (/\.db(-wal|-shm)?$/.test(x)) fs.unlinkSync(path.join(dir, x)); } catch (e) {}
      resolve({ r, code, sec: Math.round((Date.now() - t0) / 1000), tail });
    });
  });
}
(async () => {
  const knobs = Object.keys(process.env).filter((k) => /^T\d+_/.test(k) && k !== 'T699_ROUTE_CACHE').sort().map((k) => `${k}=${process.env[k]}`);
  console.log(`=== 징발 묶임 · 몰사 경보 게이트 — 판 ${RUNS.map(dirName).join(' · ')} × 시드 ${SEEDS}${FROM ? ` · 이미 있는 판 ${BASE}` : ` · ${DAYS}날 · 판 ${BASE}`} · 걸린 T…_ env ${knobs.length ? knobs.join(' ') : '없음(판 자 기본)'} ===`);
  const t0 = Date.now(), per = [];
  if (!FROM) for (const r of RUNS) {
    const x = await runOne(r); per.push(`${dirName(r)} ${x.sec}초`);
    console.log(`  · 판 ${dirName(r)} ${x.sec}초(나감 ${x.code})`);
    if (x.code !== 0) { console.log(x.tail.split('\n').slice(-8).map((l) => '    ' + l).join('\n')); console.log(`GATE-DRAFT FAIL · 판 ${dirName(r)} 판 실패(나감 ${x.code})`); process.exit(2); }
  }
  // 잣대 — T1037 표 기계 그대로(사본 0)
  const J = path.join(BASE, 'gate-draft.t1037.json');
  let txt = '';
  try { txt = execFileSync(process.execPath, [path.join(__dirname, 't1037-table.js'), BASE, '--json', J], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { console.log(`GATE-DRAFT FAIL · 표 기계 실패 — ${String(e.message).split('\n')[0]}`); process.exit(2); }
  const q = (JSON.parse(fs.readFileSync(J, 'utf8')).q2 || {}).on || {};
  for (const l of txt.split('\n')) if (/^\| (판|on)/.test(l) || /^\|---/.test(l)) console.log('  ' + l);
  const sec = Math.round((Date.now() - t0) / 1000);
  const missing = RUNS.map(dirName).filter((k) => !q[k]);
  if (missing.length) { console.log(`GATE-DRAFT FAIL · 판 장부 없음 — ${missing.join(' · ')}(시드 ${SEEDS} 의 base-<시드>.t815.json 셋이 다 있어야 판 하나를 센다)`); process.exit(2); }
  const rs = RUNS.map(dirName).map((k) => [k, q[k]]);
  const tot = (f) => rs.reduce((s, [, r]) => s + r[f], 0);
  const pins = tot('pins'), wipes = tot('wipes'), phantom = tot('phantom');
  const days = [...new Set(rs.flatMap(([, r]) => r.days))].join('·');
  const tail = `판 ${rs.length} × 3시드 · ${days}날 · 끝 인구 ${rs.map(([, r]) => r.popEnd.toLocaleString('en-US')).join(' / ')}${FROM ? '' : ` · ${per.join(' + ')} = ${sec}초`}`;
  if (pins + wipes + phantom === 0) { console.log(`GATE-DRAFT PASS · 묶임 0 · 몰사 0 · 셈만 0 · ${tail}`); process.exit(0); }
  const bad = rs.filter(([, r]) => r.pins + r.wipes + r.phantom > 0).map(([k, r]) => `${k} 묶임 ${r.pins} · 몰사 ${r.wipes} · 셈만 ${r.phantom}${r.list.length ? `(${r.list.slice(0, 3).join(' / ')}${r.list.length > 3 ? ' …' : ''})` : ''}`);
  console.log(`GATE-DRAFT FAIL · 묶임 ${pins} · 몰사 ${wipes} · 셈만 ${phantom} — ${bad.join(' ; ')} · ${tail}`);
  process.exit(1);
})();
