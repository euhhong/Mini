#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(표 없으면 안 돈다)
// === scripts/test-t1143-no-dissolve.js — NPC 마을은 해체 없음 [T1143 · ★재민 11-04 "해체 없도록 하자" · 족보 740] ===
//   잰다(손잡이는 모듈 상수라 팔마다 아이 프로세스 · 서버 안 띄움):
//   ① 손잡이 `T1143_NO_DISSOLVE` 켬 기본 · `=0` 만 끔(없음 · 빈 값 · '1' = 켬)
//   ② 정적 — 해체 문 조건에 `!(T1143_NO_DISSOLVE && !e.founder)` 한 칸(NPC 마을 = `econ.founder` 없음 · 사람 마을은 종전) · 손잡이 글자 `=== '0'` 하나
//   ③ 정적 — 절망 이탈 문은 글자 그대로(`n > BDT_GMIN` — 그 문은 마지막 3명을 안 떠나보낸다 · 마을을 0 으로 못 만든다)
//   판 값(운영 꼴 서버 판 3시드 800날 · 해체 0)은 보고 T1143 §2.
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (x != null && x !== '' ? `  ${x}` : '')); };
const probe = (v) => { const e = Object.assign({}, process.env); delete e.T1143_NO_DISSOLVE; if (v != null) e.T1143_NO_DISSOLVE = v;
  return execFileSync(process.execPath, ['-e', `console.log(require(${JSON.stringify(path.join(ROOT, 'server', 'bandits.js'))}).t1143On())`], { env: e, encoding: 'utf8' }).trim().split('\n').pop(); };
console.log('① 손잡이');
const arms = { none: probe(null), empty: probe(''), one: probe('1'), zero: probe('0') };
ok(arms.none === 'true' && arms.empty === 'true' && arms.one === 'true', '켬 기본 — 손잡이 없음 · 빈 값 · "1" 셋 다 켬', JSON.stringify(arms));
ok(arms.zero === 'false', '`=0` 만 끔(종전 해체 문)', arms.zero);
console.log('② · ③ 정적');
const B = fs.readFileSync(path.join(ROOT, 'server', 'bandits.js'), 'utf8');
ok(/const T1143_NO_DISSOLVE = !\(typeof process !== 'undefined' && !!process\.env && process\.env\.T1143_NO_DISSOLVE === '0'\);/.test(B), "손잡이 글자는 `=== '0'` 하나로 끈다", '');
ok(/if \(day >= _open && !e\._banditized && !\(T1143_NO_DISSOLVE && !e\.founder\) && \(e\._bdtFall \|\| 0\) >= BDT_DIS_FALL && fe < n \* BDT_DIS_FOOD/.test(B), '해체 문 조건에 `!(T1143_NO_DISSOLVE && !e.founder)` 한 칸 — NPC 마을만 · 문턱(순감 · 곳간 · 잔존)은 글자 그대로', '');
ok((B.match(/T1143_NO_DISSOLVE &&/g) || []).length === 1, '손잡이를 읽는 자리는 해체 문 하나', '');
ok(/\} else if \(S\.GANGS\.length && e\._bdtCri >= BDT_EXO_D && day - \(e\._bdtExoAt \|\| -999\) >= BDT_EXO_GAP && n > BDT_GMIN\) \{/.test(B) && /const BDT_CONV = 0\.4, BDT_GMIN = 3/.test(B), '절망 이탈 문은 글자 그대로(`n > BDT_GMIN` · BDT_GMIN 3 — 마지막 사람들은 안 떠난다)', '');
console.log(`\n=== ${pass + fail}건 중 PASS ${pass} · FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
