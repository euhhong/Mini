// === scripts/lib-judge-sites.js — 하네스 **판정 자리**의 리터럴을 모으는 정본 하나(T1097 · 2026-11-03 · `test-harness-lint` T84 에서 옮김) ==========
//
// ★왜 — 하네스 린트 둘이 같은 "판정 자리"를 읽는다:
//   · `test-harness-lint.js` ② (T84) — 판정 자리에 **이모지** 0
//   · `lint-harness-words.js` (T1097) — 판정 자리의 **한글 글자**가 제품 소스에 있다(말투가 바뀌면 옛 정규식이 남는다)
//   자리 규칙을 두 벌 두면 하나만 고쳐지는 날이 온다(사본 0). 그래서 T84 의 `judgeHits` 본문을 글자 그대로 여기로 옮기고,
//   "무엇을 찾나"만 술어(`has(text)`)로 받는다. `test-harness-lint` 는 `has = EMO.test` 로 부른다(같은 답 — ④ 미끼들이 지킨다).
//
// 판정 자리(T84 · T751 그대로):
//   · `.test/.includes/.startsWith/.endsWith/.match/.indexOf/.search` 의 인자와 리터럴 수신자
//   · `page.$`/`$$`/`locator`/`click`/`waitForSelector`/`fill` 의 셀렉터
//   · `===`/`!==`/`==`/`!=` 비교의 양쪽
//   · `ok()`/`chk()`/`assert()` 의 조건 인자(이름 먼저 꼴 `function ok(name, cond, …)` 이면 둘째)
'use strict';
const path = require('path');
const acorn = require(path.join(__dirname, '..', 'node_modules', 'acorn'));
const JUDGE_PRED = new Set(['test', 'includes', 'startsWith', 'endsWith', 'match', 'indexOf', 'search']);
const JUDGE_SEL = new Set(['$', '$$', 'locator', 'click', 'waitForSelector', 'fill']);

/** 리터럴 노드의 글자(정규식 = 패턴 · 문자열 = 값 · 템플릿 = 조각을 `${}` 로 이음) — 리터럴이 아니면 null */
function litText(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'Literal' && node.regex) return node.regex.pattern;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked || '').join('${}');
  return null;
}

/** 파일 하나에서 판정 자리의 리터럴 중 `has(글자)` 가 참인 것을 모은다 → [{ line, why, text, kind: 'regex'|'string'|'template' }] */
function judgeLiterals(src, has) {
  const ast = acorn.parse(src, { ecmaVersion: 2023, sourceType: 'script', locations: true, allowReturnOutsideFunction: true });
  const hits = [];
  const hasNode = (node) => {
    if (!node || typeof node !== 'object') return false;
    if (node.type === 'Literal' && node.regex) return has(node.regex.pattern);
    if (node.type === 'Literal' && typeof node.value === 'string') return has(node.value);
    if (node.type === 'TemplateLiteral') return node.quasis.some((q) => has(q.value.cooked || ''));
    return false;
  };
  const scan = (node, why) => {   // 이 서브트리 안의 걸린 리터럴을 전부 담는다
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((x) => scan(x, why)); return; }
    if (hasNode(node)) hits.push({ line: node.loc.start.line, why,
      text: node.regex ? '/' + node.regex.pattern + '/' : (node.value != null ? String(node.value) : node.quasis.map((q) => q.value.cooked).join('${}')),
      kind: node.regex ? 'regex' : node.type === 'TemplateLiteral' ? 'template' : 'string', raw: litText(node) });
    for (const k of Object.keys(node)) if (k !== 'loc' && k !== 'range') scan(node[k], why);
  };
  // ★[T751] **이름 먼저 꼴** — 그 파일이 `function ok(name, cond, …)`(또는 `const ok = (n, c, d) =>`)로 스스로 선언하면
  //   판정 자리는 **둘째** 인자다(`e2e-mtcut` · `e2e-mtfoot` · `e2e-mtocc` · `e2e-mtfuzz`). 첫 매개 = 이름 꼴 **그리고**
  //   둘째 매개 = 조건 꼴(`c`·`cond`·`condition`) 둘 다일 때만이다. 종전엔 첫 인자(= 이름 · 장식)를 조건으로 읽어
  //   라벨의 ★를 판정으로 물었고(린트 탄생 `00b3094a` 09-04 부터) **진짜 조건은 안 읽었다**. 선언이 없거나 첫 인자가
  //   이름 꼴이 아니면 종전 그대로 첫 인자다(느슨하게 풀지 않는다 — 읽는 자리를 바로잡을 뿐 · `test-harness-lint` ④e·④f 미끼).
  const NAME_FIRST = /^(n|name|label|msg|message|title|desc|what)$/, COND_2ND = /^(c|cond|condition)$/;
  const condIdx = {};
  for (const st of ast.body) {
    const decl = st.type === 'FunctionDeclaration' ? [[st.id && st.id.name, st.params]]
      : st.type === 'VariableDeclaration' ? st.declarations.map((d) => [d.id && d.id.name, d.init && /FunctionExpression$/.test(d.init.type) ? d.init.params : null]) : [];
    for (const [nm, ps] of decl) if (/^(ok|chk|assert)$/.test(nm || '') && ps && ps.length >= 2 && ps[0].type === 'Identifier' && NAME_FIRST.test(ps[0].name) && ps[1].type === 'Identifier' && COND_2ND.test(ps[1].name)) condIdx[nm] = 1;
  }
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'CallExpression') {
      const c = n.callee, mem = c && c.type === 'MemberExpression', prop = mem && c.property && c.property.name;
      if (prop && JUDGE_PRED.has(prop)) { n.arguments.forEach((a) => scan(a, `.${prop}()`)); if (mem && hasNode(c.object)) scan(c.object, `.${prop}() 수신자`); }
      if (prop && JUDGE_SEL.has(prop)) n.arguments.forEach((a) => scan(a, `${prop}() 셀렉터`));
      if (c && c.type === 'Identifier' && /^(ok|chk|assert)$/.test(c.name) && n.arguments.length > (condIdx[c.name] || 0)) scan(n.arguments[condIdx[c.name] || 0], 'ok() 조건');
    }
    if (n.type === 'BinaryExpression' && /^(===|!==|==|!=)$/.test(n.operator)) { scan(n.left, `${n.operator} 비교`); scan(n.right, `${n.operator} 비교`); }
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'range') walk(n[k]);
  };
  walk(ast);
  // 같은 줄 중복 제거
  const seen = new Set();
  return hits.filter((h) => { const k = h.line + '|' + h.text; if (seen.has(k)) return false; seen.add(k); return true; });
}

module.exports = { judgeLiterals, JUDGE_PRED, JUDGE_SEL };
