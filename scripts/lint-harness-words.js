#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · 자. `test-harness-lint` ⑪ 이 부르고, 미끼는 `test-lint-harness-words`)
// === scripts/lint-harness-words.js — 하네스 판정 자리의 **한글 글자**가 제품 소스에 아직 있나(T1097 · 2026-11-03) ====================================
//
// ★왜 [T1069 착지 · PM land1038] 게임 말투를 하십시오체로 고친 뒤, 하네스 일곱의 단언이 옛 해라체로 남아 빨갰다
//   (`/너무 멀/` ↔ "멉니다" · `/먹였다/` ↔ "먹였습니다" · `/납품/` ↔ "바쳤습니다" …). PM 이 손으로 찾았다. 말투 카드가 또 오면
//   또 손으로 찾게 된다 — 그래서 자로 둔다. 하네스가 문장을 찾는 글자는 **서버 · 클라가 낼 수 있는 글자**여야 한다.
//
// 가르는 규칙(코드로):
//   ① 하네스 = `scripts/test-*.js` · `scripts/e2e-*.js`. 판정 자리는 정본 `lib-judge-sites.js`(T84 이모지 린트와 같은 자리 — 사본 0).
//      그 자리의 리터럴 중 한글이 든 것(정규식 · 문자열 · 템플릿)만 본다. 장식(`console.log` · `ok()` 의 메시지)은 안 본다.
//   ② 글자 = 리터럴 안의 **글자 그대로인 조각**(한글 첫 글자 ~ 끝 · 끝 띄어쓰기만 뺌 · 두 글자 이상 · 띄어쓰기 · 가운뎃점 포함 — `/너무 멀/` → "너무 멀").
//      정규식은 이스케이프(`\d` 등) · 글자 묶음(`[…]`) · 되풀이(`?` `*` `+` `{}`) · 무리 기호에서 끊고 `|` 로 갈래를 나눈다 —
//      갈래 하나라도 조각이 다 있으면 "있다". 템플릿은 `${…}` 자리에서 끊는다. 제품 쪽은 **주석 뺀 한 줄**의 부분 글자로 찾는다.
//   ③ 제품 소스 = `server/` · `public/` · `sim/` · `lab/` · `tools/` · `scripts/`(하네스 빼고) 의 .js · .mjs · .html · .json · .css · .txt · .sh · .py(판 자 · 운영 스크립트도 글자를 낸다) —
//      **주석은 뺀다**(정본 `code-only.js` · html 은 `<script>` 안을 그것으로 · `<!-- -->` 를 뺀다). 주석에만 남은 옛 말투는 "없다"다.
//   ④ 지금 없는 토막은 **그 리터럴 줄이 태어난 커밋**(`git blame`)의 제품 소스에서 다시 본다:
//        · 지금 없는 토막 하나라도 그때는 있었다 → **빨강**(제품 글자가 하네스 밑에서 바뀌었다 — 말투 카드 꼴)
//        · 지금 없는 토막이 다 그때도 없었다 → **참고**(하네스 제 글자 · 판 자 출력 · 런타임에 짓는 이름 — 마을 · 사람 이름 등. 이 자는 판단하지 않는다)
//      런타임 이름(하네스가 넣은 길드 · 마을 · 사람 이름 — 그 파일 문자열에 있고 제품엔 없는 낱말)은 조각에서 끊는다("열린뜰에 들었습니다" → "에 들었습니다").
//      판정 글자가 그 파일 안에서 닫히는 하네스(입력 픽스처 문장 → 기대값 — `test-notice`)는 `ALLOW` 에 이유와 함께 둔다.
//      `--old <ref>` 를 주면 태어난 커밋 대신 그 ref 하나와 견준다(예: 말투 카드 앞 main). 그 판엔 **줄어듦**(노랑 · 나감에 안 듦)도 낸다 —
//      지금도 어딘가 있지만 그 ref 보다 나오는 자리가 준 조각(다른 문장에 같은 글자가 남아 "있다"가 되는 꼴 · 말투 카드 손 점검 목록).
//   ⑥ 망 0(T1112) — git 은 전송 금지로만 부른다. 지역에 태어난 판이 없는 줄(얇은 · 부분 클론)은 **건너뜀**으로 세어 끝 줄에 적는다.
//   ⑤ 끝 줄 하나: `LINT-HARNESS-WORDS PASS · …`(나감 0) · `LINT-HARNESS-WORDS FAIL · 빨강 N · …`(나감 1). `--json <파일>` · `--list ref` 로 참고 목록.
//
// 쓰는 법:  node scripts/lint-harness-words.js [--root <레포>] [--old <ref>] [--json <out>] [--list ref]
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const A = process.argv.slice(2);
const opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const ROOT = path.resolve(opt('--root', path.join(__dirname, '..')));
const OLD = opt('--old', null), JOUT = opt('--json', null), LIST = opt('--list', null);
const { judgeLiterals, JUDGE_PRED } = require('./lib-judge-sites');
const codeOnly = require('./code-only.js');

const HAN = /[가-힣]/;
const PROD_TOPS = ['server', 'public', 'sim', 'lab', 'tools', 'scripts'];
const PROD_EXT = /\.(js|mjs|html|json|css|txt|sh|py)$/;
const isHarness = (rel) => /^scripts\/(test|e2e)-[^/]*\.js$/.test(rel);
//   ★[T1112 · PM land1039 추신] **망 0** — 부분 · 얇은 클론(`blob:none` 약속 원격)에선 `blame` · `grep <ref>` · `show` 가 없는 옛 블롭을 원격에서 하나씩
//   받아 왔다(`test-harness-lint` 20분+ · 망 의존). 모든 git 부름에 전송 금지(`protocol.allow=never` · `GIT_NO_LAZY_FETCH=1`)를 걸어, 지역에 없는 옛 판은
//   **그 줄을 건너뛴다**(건너뜀 수를 끝 줄에 적는다 — 조용히 초록 아님 · 빨강도 아님).
const GIT_ENV = Object.assign({}, process.env, { GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' });
const git = (args, o) => execFileSync('git', ['-c', 'protocol.allow=never', '-C', ROOT, ...args], Object.assign({ encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'], env: GIT_ENV }, o || {}));

// ── 제품 글자: 파일 원문 → 주석 뺀 글자 → 한글 토막 집합에 더한다
function stripText(rel, src) {
  if (/\.(js|mjs)$/.test(rel)) return codeOnly(src);
  if (/\.(sh|py)$/.test(rel)) return src.replace(/^\s*#(?!!).*$/gm, ' ');   // 줄 머리 `#` 주석(셔뱅 빼고)
  if (/\.html$/.test(rel)) return src.replace(/<!--[\s\S]*?-->/g, ' ').replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + codeOnly(b) + c);
  return src;
}
function addRuns(arr, text) { for (const L of text.split('\n')) if (HAN.test(L)) arr.push(L.trim()); }   // 한글이 든 줄(주석 뺀)
function prodNow() {
  const set = [];
  const walk = (dir) => {
    let ents; try { ents = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(rel); continue; }
      if (!PROD_EXT.test(e.name) || isHarness(rel)) continue;
      let s; try { s = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e2) { continue; }
      if (!HAN.test(s)) continue;
      addRuns(set, stripText(rel, s));
    }
  };
  for (const t of PROD_TOPS) walk(t);
  return set;
}
//   토막이 있나 = 제품 줄 하나의 부분 글자인가(정규식 `/먹였/` 는 "먹였습니다" 를 문다 · `/너무 멀/` 은 "너무 멉니다" 를 안 문다)
function makeHas(lines) {
  const hay = '\n' + lines.join('\n') + '\n'; const memo = new Map(), cm = new Map();
  const has = (r) => { if (!memo.has(r)) memo.set(r, hay.includes(r)); return memo.get(r); };
  has.count = (r) => { if (!cm.has(r)) { let n = 0, i = -1; while ((i = hay.indexOf(r, i + 1)) >= 0) n++; cm.set(r, n); } return cm.get(r); };   // 몇 자리에 나오나(`--old` 줄어듦)
  return has;
}

// ── 리터럴 → 갈래마다 토막(글자 그대로인 조각 · 앞은 한글 첫 글자부터 · 두 글자 이상)
const SEP = '\u0000';
function chunks(t) {
  //   앞은 한글 첫 글자에서 · 뒤는 띄어쓰기만 걷는다(`/곳간 —/` 의 "—" · `/허기 0/` 의 "0" 은 글자다 — 문장 꼴이 바뀐 것을 본다)
  return t.split(SEP).map((x) => { const a = x.search(/[가-힣]/); if (a < 0) return ''; return x.slice(a).replace(/\s+$/, ''); })
    .filter((x) => x.length >= 2);
}
function altsOf(h) {
  let t = h.raw == null ? h.text : h.raw;
  if (h.kind === 'regex') {
    //   이스케이프 · 글자 묶음 · 되풀이 · 무리는 글자가 아니다 — 거기서 끊는다(`\s+` · `[다요]` · `멀?` · `(?:…)`)
    t = t.replace(/\\./g, SEP).replace(/\[[^\]]*\]/g, SEP).replace(/\{\d*,?\d*\}/g, SEP);
    //   되풀이 기호 앞 한 글자는 있을 수도 없을 수도 있다 — 그 글자째 끊는다(`멀?다` → "멀" · "다" 따로)
    t = t.replace(/.[?*]/g, SEP).replace(/[+]/g, SEP);
    const alts = [];
    for (const a of t.split('|')) { const c = chunks(a.replace(/[()^$.]/g, SEP)); if (c.length) alts.push(c); }
    return alts;
  }
  const c = chunks(t.split('${}').join(SEP));
  return c.length ? [c] : [];
}
const okWith = (alts, has) => alts.some((a) => a.every(has));
//   ★런타임 이름 거름 — 하네스가 **제 손으로 세계에 넣은 이름**(길드 "열린뜰" · 마을 "물레" · 사람 이름 …)은 서버가 그 자리에 붙여 돌려준다
//     (`${이름}에 들었습니다`). 그 낱말은 하네스 파일의 어느 문자열 리터럴(판정 자리 밖 포함)에 나오고 **제품 소스엔 없는** 한글 이음이다.
//     이름 후보는 **세계에 넣는 리터럴**에서만 걷는다(장식 · 판정 자리 밖) — 라벨이 옛 글자를 되뇌어도 이름이 안 된다.
//     조각 안의 그 낱말을 끊는 자리로 바꾼다("열린뜰에 들었습니다" → "에 들었습니다") — 나머지 글자는 그대로 견준다(느슨하게 풀지 않는다).
const acorn = require(path.join(__dirname, '..', 'node_modules', 'acorn'));
function fixtureNames(src, has) {
  const out = new Set();
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 2023, sourceType: 'script', allowReturnOutsideFunction: true }); } catch (e) { return out; }
  const add = (t) => { for (const w of String(t).match(/[가-힣]{2,}/g) || []) if (!has(w)) out.add(w); };
  //   세계에 넣는 글자만 — 장식(`console.*` · `ok/chk/assert/say` 의 인자 · `process.stdout.write`)과 판정 자리(술어 · 비교)는 건너뛴다.
  //   (라벨이 옛 글자를 되뇌면 그 글자가 "이름"으로 보여 빨강을 숨긴다 — 미끼 `test-lint-harness-words` ②: 라벨이 "먹였다" 를 되뇐다)
  const SKIP_CALL = /^(ok|chk|assert|say|log|fail|pass|note)$/;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'CallExpression') {
      const c = n.callee, obj = c && c.type === 'MemberExpression' ? c.object : null, prop = c && c.type === 'MemberExpression' && c.property ? c.property.name : null;
      if ((c && c.type === 'Identifier' && SKIP_CALL.test(c.name)) || (obj && obj.type === 'Identifier' && obj.name === 'console') || (prop && JUDGE_PRED.has(prop))
        || (obj && obj.type === 'MemberExpression' && obj.object && obj.object.name === 'process' && prop === 'write')) { walk(c); return; }
    }
    if (n.type === 'BinaryExpression' && /^(===|!==|==|!=)$/.test(n.operator)) return;
    if (n.type === 'Literal' && typeof n.value === 'string') add(n.value);
    if (n.type === 'TemplateElement') add(n.value.cooked || '');
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'range') walk(n[k]);
  };
  walk(ast);
  return out;
}
function dropNames(alts, names, has) {
  if (!names.size) return alts;
  const ws = [...names].sort((a, b) => b.length - a.length);
  return alts.map((a) => a.flatMap((c) => { if (has(c)) return [c]; let t = c; for (const w of ws) if (t.includes(w)) t = t.split(w).join(SEP); return t === c ? [c] : chunks(t); })).filter((a) => a.length);
}

// ★판정 글자가 **그 파일 안에서 닫히는** 하네스 — 입력 픽스처 문장을 제 손으로 넣고 기대값을 견준다(제품 문장이 아니다 · 이유를 코드에 적는다 — `test-harness-lint` ALLOW 꼴)
const ALLOW = {
  'test-notice.js': '알림 경계(T78)의 입력 픽스처(`🏴‍☠️ 약탈!`)와 기대값(`약탈!`)이 곧 판정 글자다 — 서버 문장이 아니다',
};
// ── 하네스 전수
const SCR = path.join(ROOT, 'scripts');
const files = fs.readdirSync(SCR).filter((f) => /^(test|e2e)-.*\.js$/.test(f)).sort();
const hasNow = makeHas(prodNow());
const lits = [], all = [];
let parsed = 0, judged = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(SCR, f), 'utf8');
  if (!HAN.test(src)) { parsed++; continue; }
  let hs; try { hs = judgeLiterals(src, (t) => HAN.test(t)); parsed++; } catch (e) { lits.push({ f, line: 0, text: '파싱 실패: ' + String(e.message).slice(0, 60), alts: [], missing: [], state: 'red' }); continue; }
  const names = fixtureNames(src, hasNow);
  if (ALLOW[f]) continue;
  for (const h of hs) {
    const alts = dropNames(altsOf(h), names, hasNow); if (!alts.length) continue;   // 한글 한 글자뿐(또는 이름뿐) — 견줄 글자가 없다
    judged++;
    all.push({ f, line: h.line, why: h.why, text: h.text, alts });
    if (okWith(alts, hasNow)) continue;
    lits.push({ f, line: h.line, why: h.why, text: h.text, alts, missing: [...new Set(alts.flat().filter((r) => !hasNow(r)))] });
  }
}
// ── 지금 없는 것 → 태어난 커밋(또는 --old)에서 다시
//   태어난 커밋 = `git blame --porcelain` — 파일마다 한 번(`-L n,n` 여럿 · 줄마다 부르지 않는다)
//   ★지역에 옛 판이 있나 — 부분 클론(약속 원격)은 옛 블롭이 없어 `blame` 이 하나에 3초씩 헛돈다(전송 금지로 끝내 실패). 한 번 떠 보고 없으면 통째로 건너뛴다.
//   얇은 클론은 경계 커밋에 매긴다 — 빨강이 참고로 숨을 수 있어 머리 줄에 적는다(T1097 회부 2).
const repoNote = [];
let noHistory = false;
try { if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') repoNote.push('얇은 클론 — 경계 판에 매김(빨강이 참고로 숨을 수 있다 · `git fetch --unshallow`)'); } catch (e) {}
try {
  let partial = false;
  try { partial = /\S/.test(git(['config', '--get-regexp', '^(remote\\..*\\.promisor|extensions\\.partialclone)$'])); } catch (e) { partial = false; }
  if (partial && lits.some((L) => !L.state)) {
    const f0 = lits.find((L) => !L.state).f;
    const cs = git(['rev-list', '-n', '2', 'HEAD', '--', 'scripts/' + f0]).split('\n').filter(Boolean);
    if (cs.length > 1) { try { git(['cat-file', '-e', `${cs[1]}:scripts/${f0}`]); } catch (e) { noHistory = true; } }
    if (noHistory) repoNote.push('부분 클론 — 옛 블롭이 지역에 없어 태어난 판을 못 본다(망 0 · 그 줄은 건너뜀)');
  }
} catch (e) {}
const byRef = new Map();
const byFile = new Map();
for (const L of lits) { if (L.state) continue; if (!byFile.has(L.f)) byFile.set(L.f, []); byFile.get(L.f).push(L); }
for (const [f, Ls] of byFile) {
  const at = new Map();
  if (!OLD && !noHistory) {
    const ls = [...new Set(Ls.map((L) => L.line))];
    try {
      const b = git(['blame', '--porcelain', ...ls.flatMap((n) => ['-L', `${n},${n}`]), '--', 'scripts/' + f]);
      for (const l of b.split('\n')) { const m = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l); if (m) at.set(+m[2], m[1]); }
    } catch (e) { /* 지역에 옛 판이 없다(얇은 · 부분 클론) — 아래에서 건너뛴다 */ }
  }
  for (const L of Ls) {
    if (noHistory && !OLD) { L.state = 'skip'; continue; }
    let r = OLD || at.get(L.line) || null;
    if (r && /^0+$/.test(r)) r = 'HEAD';   // 아직 커밋 안 된 줄 — 지금 트리와 같은 판
    if (!r) { L.state = 'skip'; continue; }
    L.ref = r;
    if (!byRef.has(r)) byRef.set(r, []);
    byRef.get(r).push(L);
  }
}
const pathspec = ['--', ...PROD_TOPS, ':(exclude)scripts/test-*', ':(exclude)scripts/e2e-*'];
//   태어난 판 훑기는 글자 파일만(소리 · 그림 · 큰 지형 json 을 안 읽는다 — 판마다 0.5초 → 0.2초) · json 은 이름 · 자료라 말투가 사는 자리가 아니다
const pathspecText = ['--', ...PROD_TOPS.flatMap((t) => ['js', 'mjs', 'html', 'sh', 'py', 'txt', 'css'].map((e) => `:(glob)${t}/**/*.${e}`)), ':(exclude)scripts/test-*', ':(exclude)scripts/e2e-*'];
//   옛 판 제품 글자(정밀) — 그 조각이 든 파일만 꺼내 주석을 정본(`code-only.js`)으로 뺀다. `--old` 판(줄어듦 셈)이 쓴다.
function prodAt(ref, need) {
  const set = [];
  const tmp = path.join(require('os').tmpdir(), `lhw-${process.pid}.txt`);
  fs.writeFileSync(tmp, need.join('\n') + '\n');
  let list = '';
  try { list = git(['grep', '-l', '-F', '-f', tmp, ref, ...pathspec]); } catch (e) { if (e.status !== 1) { fs.unlinkSync(tmp); return null; } list = ''; }   // 1 = 없음 · 그 밖 = 옛 판 자료 없음
  fs.unlinkSync(tmp);
  for (const line of list.split('\n').filter(Boolean)) {
    const rel = line.slice(line.indexOf(':') + 1);
    if (!PROD_EXT.test(rel) || isHarness(rel)) continue;
    let s; try { s = git(['show', `${ref}:${rel}`]); } catch (e) { continue; }
    addRuns(set, stripText(rel, s));
  }
  return set;
}
//   옛 판 제품 글자(빠름 · 태어난 판들) — `git grep` 한 번이 그 조각이 든 **줄**만 낸다. 주석은 줄 단위로 뺀다
//   (줄 머리 `//` · `*` · `#` · 따옴표 밖 ` //` 뒤). 정본 토크나이저보다 거칠다 — 옛 판에서 주석에만 있던 글자를 "있었다"로 읽으면 빨강이 늘 쪽이다(숨지 않는다).
function prodLinesAt(ref, need) {
  const tmp = path.join(require('os').tmpdir(), `lhw-${process.pid}.txt`);
  fs.writeFileSync(tmp, need.join('\n') + '\n');
  let out = '', list = '';
  //   ① `-l` 로 그 조각이 든 파일만(파일마다 첫 맞음에서 멈춘다 — 빠르다) ② 그 파일들만 줄로
  try { list = git(['grep', '-l', '-I', '-F', '-f', tmp, ref, ...pathspecText]); } catch (e) { if (e.status !== 1) { fs.unlinkSync(tmp); return null; } list = ''; }
  const rels = list.split('\n').filter(Boolean).map((l) => l.slice(ref.length + 1)).filter((rel) => PROD_EXT.test(rel) && !isHarness(rel));
  if (rels.length) { try { out = git(['grep', '-I', '-F', '-f', tmp, ref, '--', ...rels]); } catch (e) { if (e.status !== 1) { fs.unlinkSync(tmp); return null; } out = ''; } }
  fs.unlinkSync(tmp);
  const set = [];
  for (const raw of out.split('\n')) {
    const i = raw.indexOf(':', ref.length + 1); if (i < 0) continue;
    const rel = raw.slice(ref.length + 1, i); if (!PROD_EXT.test(rel) || isHarness(rel)) continue;
    let t = raw.slice(i + 1);
    const tt = t.trim();
    if (/^(\/\/|\*|\/\*)/.test(tt) || (/\.(sh|py)$/.test(rel) && /^#(?!!)/.test(tt))) continue;
    if (/\.(js|mjs|html)$/.test(rel)) { let q = null; for (let k = 0; k < t.length; k++) { const c = t[k]; if (q) { if (c === '\\') k++; else if (c === q) q = null; } else if (c === "'" || c === '"' || c === '`') q = c; else if (c === '/' && t[k + 1] === '/' && (k === 0 || /\s/.test(t[k - 1]))) { t = t.slice(0, k); break; } } }
    if (HAN.test(t)) set.push(t.trim());
  }
  return set;
}
if (process.env.LHW_DEBUG) console.error(`[lhw] 태어난 판 ${byRef.size} · 줄 ${[...byRef.values()].reduce((a, b) => a + b.length, 0)}`);
for (const [ref, Ls] of byRef) {
  const need = [...new Set(Ls.flatMap((L) => L.alts.flat()))];
  if (ref === 'HEAD' && !OLD) { for (const L of Ls) { L.drift = []; L.state = 'ref'; } continue; }
  const set = OLD ? prodAt(ref, need) : prodLinesAt(ref, need);
  if (set == null) { for (const L of Ls) L.state = 'skip'; continue; }   // 옛 판 자료가 지역에 없다 — 건너뜀
  const hasOld = makeHas(set);
  //   빨강 = 지금 없는 토막 하나라도 그때는 있었다(낱말이 하네스 밑에서 사라졌다). 그때도 없던 토막(조사가 붙은 런타임 이름 "돌칼이" 등)은 가르지 않는다.
  for (const L of Ls) { L.drift = L.missing.filter((r) => hasOld(r)); L.state = L.drift.length ? 'red' : 'ref'; }
}
const red = lits.filter((L) => L.state === 'red'), ref = lits.filter((L) => L.state === 'ref'), skip = lits.filter((L) => L.state === 'skip');
//   ★`--old <ref>` 판만: **줄어듦**(노랑 · 빨강 아님) — 지금도 어딘가 있지만 그 ref 보다 나오는 자리가 줄었다.
//     말투 카드 꼴: `/너무 멀/` 은 다른 문장("너무 멀어")에 남아 "있다"가 되지만, 고친 문장 몫만큼 자리가 준다(PM land1038 이 고친 일곱이 이 꼴이었다 — 보고 T1097).
const yellow = [];
if (OLD) {
  const okNow = all.filter((L) => okWith(L.alts, hasNow));
  const hasO = makeHas(prodAt(OLD, [...new Set(okNow.flatMap((L) => L.alts.flat()))]) || []);
  for (const L of okNow) { const d = [...new Set(L.alts.flat())].filter((c) => hasNow.count(c) < hasO.count(c)).map((c) => `${c} ${hasO.count(c)}→${hasNow.count(c)}`); if (d.length) yellow.push(Object.assign(L, { state: 'yellow', drop: d })); }
}
const show = (L) => `  ${L.state === 'red' ? '✗' : '·'} ${L.f}:${L.line} ${L.why || ''} ${JSON.stringify(L.text).slice(0, 90)} — 지금 없음 ${L.missing ? L.missing.join(' · ') : ''}${L.drift && L.drift.length ? ` (그때 있음 ${L.drift.join(' · ')})` : ''}${L.ref ? ` · 태어난 판 ${String(L.ref).slice(0, 8)}` : ''}`;
console.log(`=== 하네스 판정 글자 ↔ 제품 소스 — 하네스 ${files.length} · 파싱 ${parsed} · 한글 판정 리터럴 ${judged} · 지금 없음 ${lits.length}(빨강 ${red.length} · 참고 ${ref.length}${skip.length ? ` · 건너뜀 ${skip.length}` : ''})${OLD ? ` · ${OLD} 보다 줄어듦 ${yellow.length}` : ''} ===`);
if (skip.length && !noHistory) repoNote.push(`부분 클론 · 옛 판 자료 없음 — 태어난 판을 지역에서 못 읽은 줄 ${skip.length}(망 0 · 건너뜀)`);
for (const n of repoNote) console.log(`  ⚠ ${n}`);
for (const L of red) console.log(show(L));
for (const L of yellow) console.log(`  ~ ${L.f}:${L.line} ${L.why || ''} ${JSON.stringify(L.text).slice(0, 90)} — 줄어듦 ${L.drop.join(' · ')}(${OLD} → 지금)`);
if (LIST === 'ref') for (const L of ref) console.log(show(L));
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify({ files: files.length, parsed, judged, old: OLD, red, ref, skip, yellow }, null, 1));
const ok = red.length === 0 && parsed === files.length;
console.log(ok ? `LINT-HARNESS-WORDS PASS · 빨강 0 · 한글 판정 리터럴 ${judged} · 참고 ${ref.length}(하네스 제 글자 · 런타임 이름)${skip.length ? ` · 건너뜀 ${skip.length}(태어난 판이 지역에 없음 — 얇은 · 부분 클론 · 망 0)` : ''}`
  : `LINT-HARNESS-WORDS FAIL · 빨강 ${red.length}${parsed !== files.length ? ` · 파싱 실패 ${files.length - parsed}` : ''} · ${red.slice(0, 4).map((L) => `${L.f}:${L.line} ${(L.drift && L.drift.length ? L.drift : L.missing).join('·')}`).join(' ; ')}`);
process.exit(ok ? 0 : 1);
