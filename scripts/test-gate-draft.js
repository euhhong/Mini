#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(scripts/run-regress.sh · 표 없으면 안 돈다)
// === scripts/test-gate-draft.js — 징발 묶임 · 몰사 경보 게이트(`scripts/gate-draft.js` · T1082 · 2026-11-02) — 가짜 판 표로 빨강 · 초록 ====================
//
// 판정 사본 0: 판은 안 돌린다(서버 0 · 1초 안). 가짜 판 장부(`<뿌리>/run-<판>/base-<시드>.t815.json` — `t815-observe.js` 와 같은 꼴)를 세우고
//   게이트를 `--from <뿌리>` 로 부른다 — 게이트 안의 잣대(`t1037-table.js` → `t815-table.js`)가 그대로 돈다. 지키는 것:
//     ⓪ 정적 — 게이트가 판 자(`t577-server-run.js`)를 프리로드 둘(`t815-observe.js` · `diverge-ctl.js`) · `DCTL_SKIP=raid:n` 으로 부르고, 잣대는 `t1037-table.js` 를 부르며,
//        끝 줄 PASS/FAIL 글자가 있다
//     ① 초록 — 판 넷 × 3시드 다 자유민 > 0 → 나감 0 · `GATE-DRAFT PASS · 묶임 0 · 몰사 0 · 셈만 0`
//     ② 빨강(묶임) — raid2 판 시드 7 마을 하나가 16일 자유민 0(인구 30) → 나감 1 · 묶임 1 · 그 마을 이름이 끝 줄에
//     ③ 빨강(셈만 하나) — 판 기본 시드 42 마을 하나가 3일 자유민 0(인구 3 · 묶임 잣대 밖)인데 그날들 죽음이 세어졌다 → 나감 1 · 셈만 ≥ 1 · 묶임 0
//     ④ 몰사 — 묶임이 풀린 이튿날 인구 0 → 나감 1 · 몰사 1
//     ⑤ 판 장부가 빠졌다(raid3 시드 1020 없음) → 나감 2 · 장부 없음(조용히 초록 금지)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const GATE = path.join(__dirname, 'gate-draft.js');
let pass = 0, fail = 0;
const ok = (c, m, d) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (d !== undefined && d !== '' ? `  ${d}` : '')); };
const COLS = ['pop', 'tfe', 'eaten', 'deathsToday', 'deadTot', 'dPAccum', 'drafted', 'packers', 'free', 'K', 'logi', 'hunger', 'health', 'happy', 'prestige', 'dP', 'prodK', 'surplusFood', 'foodWorkers'];
const C = Object.fromEntries(COLS.map((c, i) => [c, i]));
const NAMES = ['농촌1', '농촌2', '어촌1'];
const DAYS = 200, SEEDS = [1020, 7, 42], RUNS = ['on', 'on~raid1', 'on~raid2', 'on~raid3'];
// 한 마을 하루 줄 — 기본은 인구 30 · 자유민 30(징발 0)
function row(pop, free, deaths) { const r = new Array(COLS.length).fill(0); r[C.pop] = pop; r[C.free] = free; r[C.drafted] = pop - free; r[C.deathsToday] = deaths || 0; r[C.tfe] = 100; return r; }
// edit(run, seed, vi, day) → [pop, free, deaths] | null
function build(tag, edit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `tgd-${tag}-`));
  for (const run of RUNS) {
    const dir = path.join(root, 'run-' + run); fs.mkdirSync(dir, { recursive: true });
    for (const s of SEEDS) {
      const rows = [];
      for (let d = 1; d <= DAYS; d++) rows.push([d, NAMES.map((_, vi) => { const e = edit && edit(run, s, vi, d); return e ? row(e[0], e[1], e[2]) : row(30, 30); })]);
      fs.writeFileSync(path.join(dir, `base-${s}.t815.json`), JSON.stringify({ names: NAMES, cols: COLS, rows }));
    }
  }
  return root;
}
function gate(root) { const r = spawnSync(process.execPath, [GATE, '--from', root], { encoding: 'utf8' }); const out = (r.stdout || '') + (r.stderr || ''); return { code: r.status, out, last: out.trim().split('\n').pop() }; }
console.log('\n=== 징발 묶임 · 몰사 경보 게이트 — scripts/gate-draft.js(가짜 판 표) ===');
{
  const G = fs.readFileSync(GATE, 'utf8');
  ok(/'t577-server-run\.js'\)/.test(G) && /'t815-observe\.js'/.test(G) && /'diverge-ctl\.js'/.test(G) && /env\.DCTL_SKIP = 'raid:' \+ r\.slice\(4\)/.test(G)
    && /'t1037-table\.js'\), BASE, '--json', J\]/.test(G) && /GATE-DRAFT PASS · 묶임 0 · 몰사 0 · 셈만 0 · /.test(G) && /GATE-DRAFT FAIL · /.test(G)
    && /if \(pins \+ wipes \+ phantom === 0\)/.test(G),
    '⓪ 게이트 글자 — 판 자 + 프리로드 둘 · raid:n · 잣대 t1037-table · 셋 합 0 일 때만 PASS · 끝 줄 PASS/FAIL');
}
const roots = [];
{
  const g = gate(roots[roots.push(build('green')) - 1]);
  ok(g.code === 0 && /^GATE-DRAFT PASS · 묶임 0 · 몰사 0 · 셈만 0 · 판 4 × 3시드 · 200날/.test(g.last), '★① 초록 — 판 넷 × 3시드 자유민 > 0 → 나감 0 · PASS', g.last);
}
{
  const g = gate(roots[roots.push(build('pin', (run, s, vi, d) => (run === 'on~raid2' && s === 7 && vi === 1 && d >= 100 && d <= 115 ? [30, 0, 0] : null))) - 1]);
  ok(g.code === 1 && /^GATE-DRAFT FAIL · 묶임 1 · 몰사 0 · 셈만 0 — on~raid2 묶임 1 · 몰사 0 · 셈만 0\(7 농촌2 100 ~ 115일 · 30명\)/.test(g.last), '★② 빨강(묶임) — raid2 시드 7 농촌2 16일 자유민 0 → 나감 1 · 그 마을이 끝 줄에', g.last);
}
{
  const g = gate(roots[roots.push(build('phantom', (run, s, vi, d) => (run === 'on' && s === 42 && vi === 2 && d >= 50 && d <= 52 ? [3, 0, 1] : null))) - 1]);
  ok(g.code === 1 && /^GATE-DRAFT FAIL · 묶임 0 · 몰사 0 · 셈만 2 — on 묶임 0 · 몰사 0 · 셈만 2 · /.test(g.last), '★③ 빨강(셈만 느는 죽음 하나라도) — 묶임 잣대 밖 3일(인구 3)인데 센 죽음 → 나감 1', g.last);
}
{
  const g = gate(roots[roots.push(build('wipe', (run, s, vi, d) => (run === 'on~raid1' && s === 1020 && vi === 0 ? (d >= 60 && d <= 72 ? [20, 0, 0] : d >= 73 ? [0, 0, 0] : null) : null))) - 1]);
  ok(g.code === 1 && /^GATE-DRAFT FAIL · 묶임 1 · 몰사 1 · /.test(g.last), '④ 빨강(몰사) — 묶임이 풀린 이튿날 인구 0 → 나감 1 · 몰사 1', g.last);
}
{
  const root = build('missing'); roots.push(root); fs.unlinkSync(path.join(root, 'run-on~raid3', 'base-1020.t815.json'));
  const g = gate(root);
  ok(g.code === 2 && /^GATE-DRAFT FAIL · 판 장부 없음 — on~raid3/.test(g.last), '⑤ 판 장부가 빠졌다 → 나감 2 · 장부 없음(조용히 초록 금지)', g.last);
}
for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
console.log(`\n=== PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
