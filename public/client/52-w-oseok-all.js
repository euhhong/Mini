// @@split-added — 분할 이후 새로 만든 조각(결합 검사 대상 아님 · scripts/split-verify.sh)
// === public/client/52-w-oseok-all.js — 오석 판을 화면 전체에(T1124) ==================================================
//
// ★근거: [T1124 · ★재민 11-02 "UI 재질 = 오석 판(실제 기념비처럼 다듬은 검은 돌 · 판 글자 · 밝기 2)" — 옛 먹선(09-03) 대체 ·
//   재민 11-03 "배포했는데 왜 디자인 안 바뀌었어?"] 오석은 마을 화면(T1070 · T1083)에만 있었다. 로비 · HUD 위쪽 줄 · 가방 · 제작(옆 판) ·
//   게시판 · 알림 판을 같은 재질로 덮는다.
// ★손잡이 `T1124_OSEOK_ALL`(URL 인자 · ★기본 끔): `=1` 이면 이 층이 붙는다. 끔이면 먹선 그대로(`style.css` 토큰 — 한 줄도 안 바뀐다).
// ★★제1 규약 — **재질 사본 0.** 판 · 바닥 무늬는 T1071 모듈(`52-u-oseok.js`)이 내놓는 변수(`--os-plate-*` · `--os-ground-*`)와
//   그 모듈의 판 겉(`.os-plate` 의 모따기 · 그림자)을 쓴다. 글자색 · 홈 · 선은 모듈 값(`Oseok.C` 의 frost · svgFrost · cssFrost · groove ·
//   cssShadow)만 읽는다 — 색 리터럴 0 · 새 수 0(글자 바닥 18px 은 카드 수).
//   · 본문 글자 = `C.frost`(판 글자 밝은 돌가루 — 판 대비 7.6) · 흐린 글자 = `C.svgFrost`(5.6) · 선 · 테 = `C.cssFrost` · 칸 바닥 = `C.groove`
//   · 판 글자 길 = 모듈의 css 길(겉 글자 그늘 `C.cssShadow`) — 가방 · HUD 처럼 자주 바뀌는 글자를 캔버스로 다시 그리지 않는다.
// ★제2 규약 — **동작 0.** DOM 구조 · 문구 · 이벤트를 안 바꾼다. 판에 클래스 하나(`os-plate`)를 더하고, 18px 아래 글자에 크기만 덧쓴다.
// ★제3 규약 — 최상위 실행문 0(분할 규약). `99-main.js` 가 손잡이를 보고 `oseokAllInstall()` 을 부른다.

// 판 자리 — 이 여섯(+ 로비 바닥)만 덮는다(카드 ①)
const OSA_ROOTS = ['#lobby .lobby-card', '#hud > .hud-row:first-child', '#invDropdown', '#sidePanel', '#boardPane', '#notice'];
const OSA_FLOOR = 18;   // 글자 바닥 px(카드 ②)
let osaOn = false, osaObs = null, osaQueue = new Set(), osaRaf = 0;
const osaStats = { floored: 0, passes: 0, ms: 0 };

function oseokAllOn() { try { return new URLSearchParams(location.search).get('T1124_OSEOK_ALL') === '1'; } catch (e) { return false; } }

function oseokAllInstall() {
  if (osaOn || typeof Oseok === 'undefined' || typeof document === 'undefined') return;
  osaOn = true;
  Oseok.install();
  const C = Oseok.C, F = Oseok.FONTS;
  const g = (v) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };   // 모듈 값 → 회색(모듈 `gray` 와 같은 식)
  const sans = Oseok.fontCss('sansm', OSA_FLOOR).replace(/^\S+\s+\S+\s+/, ''), serif = Oseok.fontCss('serif', OSA_FLOOR).replace(/^\S+\s+\S+\s+/, '');
  const R = OSA_ROOTS.map((s) => `html.os-all ${s}`).join(',');
  const IN = (sel) => OSA_ROOTS.map((s) => `html.os-all ${s} ${sel}`).join(',');
  const st = document.createElement('style'); st.id = 'oseok-all-style';
  st.textContent = `
html.os-all{--osa-fg:${g(C.frost)};--osa-dim:${g(C.svgFrost)};--osa-line:${g(C.cssFrost)};--osa-groove:${g(C.groove)}}
html.os-all #notice{line-height:normal}
html.os-all #lobby{background-color:var(--os-ground-col);background-image:var(--os-ground-img);background-size:512px 512px}
${R}{background-color:var(--os-plate-col);background-image:var(--os-plate-img);background-size:512px 512px;border-color:transparent;
  --fg:var(--osa-fg);--fg-strong:var(--osa-fg);--accent:var(--osa-fg);--accent-hi:var(--osa-fg);--dim:var(--osa-dim);--dim-2:var(--osa-dim);
  --line:var(--osa-line);--line-2:var(--osa-line);--pane:transparent;--pane-solid:transparent;--head:transparent;--inset:transparent;--bg:var(--osa-groove);
  color:var(--osa-fg);font-family:${sans};font-size:${OSA_FLOOR}px;text-shadow:${C.cssShadow}}
${IN(':is(h1,h2,h3,.sp-title,.id-title,.pane-head .ph-title,#boardPaneTitle)')}{font-family:${serif};color:var(--osa-fg)}
${IN(':is(.badge,.id-head,.sp-head,.pane-head,.bp-row,.bd-sec,.bp-hdr)')}{background:transparent;border-color:var(--osa-line)}
${IN(':is(input,select,textarea)')}{background:var(--osa-groove);color:var(--osa-fg);border:1px solid var(--osa-line);font:inherit;text-shadow:none}
${IN(':is(button,.bp-give)')}{background:transparent;color:var(--osa-fg);border:1px solid var(--osa-line);font-family:${sans};text-shadow:${C.cssShadow}}
${IN(':is(button,.bp-give):hover')}{background:var(--osa-groove);filter:none}
`;
  document.head.appendChild(st);
  document.documentElement.classList.add('os-all');
  for (const s of OSA_ROOTS) for (const el of document.querySelectorAll(s)) osaPlate(el);
  // 늦게 서는 판(게시판은 처음 열 때 · 옆 판 · 가방 · 알림 안의 글은 그때그때) — 새 노드 · 글자가 오면 판 겉과 글자 바닥을 다시 본다(프레임 하나에 한 번)
  //   판 밖 변경(캔버스 둘레 HUD 아래 줄 · 채팅 …)은 곧바로 버린다 — 판 안 노드와 새로 선 판만 줄에 넣는다
  const ALL = OSA_ROOTS.join(',');
  osaObs = new MutationObserver((recs) => {
    let any = false;
    for (const r of recs) {
      const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (t && osaRootOf(t)) { osaQueue.add(t); any = true; }
      for (const n of r.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        if (osaRootOf(n)) { osaQueue.add(n); any = true; }
        else if (n.querySelector && n.querySelector(ALL)) { for (const x of n.querySelectorAll(ALL)) osaQueue.add(x); any = true; }
      }
    }
    if (any && !osaRaf) osaRaf = requestAnimationFrame(osaFlush);
  });
  osaObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  for (const s of OSA_ROOTS) for (const el of document.querySelectorAll(s)) osaQueue.add(el);
  osaRaf = requestAnimationFrame(osaFlush);
  osaLayoutWatch(); osaLayout();
}

// ★알림 자리 — 18px 로 커진 HUD 위쪽 줄과 화면 가운데 위 알림 판이 겹친다. 알림을 **위쪽 줄 오른쪽 끝과 지도 판 사이**에 세운다.
//   틈은 `#hud` 의 줄 틈(style.css `gap`)을 읽는다 — 새 수 0. 위쪽 줄 · 창 크기가 바뀔 때만 다시 잰다.
let osaLayoutRo = null;
function osaLayout() {
  const row = document.querySelector('#hud > .hud-row:first-child'), nt = document.getElementById('notice'), hud = document.getElementById('hud');
  if (!row || !nt || !hud) return;
  const gap = parseFloat(getComputedStyle(hud).rowGap) || 0, r = row.getBoundingClientRect();
  if (!(r.width > 0)) return;
  const mm = document.getElementById('minimap'), mr = mm ? mm.getBoundingClientRect() : null;
  const right = (mr && mr.width > 0) ? mr.left - gap : innerWidth - gap;
  nt.style.left = `${r.right + gap}px`; nt.style.transform = 'none'; nt.style.top = `${r.top}px`;
  nt.style.maxWidth = `${Math.max(0, right - r.right - 2 * gap)}px`;
}
function osaLayoutWatch() {
  if (osaLayoutRo || typeof ResizeObserver === 'undefined') return;
  const row = document.querySelector('#hud > .hud-row:first-child'); if (!row) return;
  osaLayoutRo = new ResizeObserver(() => osaLayout()); osaLayoutRo.observe(row);
  addEventListener('resize', osaLayout);
}

// 판 겉(모듈의 모따기 · 그림자) — 무늬는 위 CSS 가 변수로 얹는다(id 규칙이 배경을 쥐고 있어 `.os-plate` 배경만으로는 안 보인다)
function osaPlate(el) { if (el && !el.classList.contains('os-plate')) Oseok.plate(el, { shadow: false }); }
function osaRootOf(el) { for (const s of OSA_ROOTS) { const r = el.closest && el.closest(s); if (r) return r; } return null; }

// 글자 바닥 — 판 안에서 제 글자(글자 마디)를 가진 요소의 크기가 바닥 아래면 바닥으로 덧쓴다(한 번 덧쓴 요소는 다시 안 잰다)
function osaFlush() {
  osaRaf = 0;
  const t0 = performance.now();
  const els = new Set();
  for (const n of osaQueue) {
    if (!n.isConnected) continue;
    if (OSA_ROOTS.some((s) => n.matches && n.matches(s))) osaPlate(n);
    const root = osaRootOf(n);
    if (!root) continue;
    els.add(n); for (const e of n.querySelectorAll('*')) els.add(e);
  }
  osaQueue.clear();
  const small = [];
  for (const e of els) {
    if (e.dataset.osf || e.tagName === 'CANVAS' || e.tagName === 'svg' || !osaRootOf(e)) continue;
    let own = false; for (const c of e.childNodes) if (c.nodeType === 3 && c.nodeValue.trim()) { own = true; break; }
    if (!own && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.tagName)) continue;
    if (parseFloat(getComputedStyle(e).fontSize) < OSA_FLOOR) small.push(e);   // 읽기를 먼저 다 하고
  }
  for (const e of small) { e.style.fontSize = `${OSA_FLOOR}px`; e.dataset.osf = '1'; }   // 쓰기는 뒤에 한 번에
  osaStats.floored += small.length; osaStats.passes++; osaStats.ms += performance.now() - t0;
}
