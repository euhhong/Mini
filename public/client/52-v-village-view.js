// @@split-added — 분할 이후 새로 만든 조각(결합 검사 대상 아님 · scripts/split-verify.sh)
// === public/client/52-v-village-view.js — 마을 화면 · 메뉴 넷(대시보드 · 프로젝트 · 구성원 · 창고) ====================
//
// ★근거: [T1070 · ★재민 11-01 · 11-02] 정본 `설계/설계_마을화면_오석.md` · 그림 `설계/시안/오석/마을_{dash,proj,mem,store}.jpg`.
//   "마을 가입과 개인 사유지 건설은 강하게 유도 — 마을 전용 화면에서 현황 · 자원 · 진행 중인 프로젝트, 그 마을 고유의 정보와
//    앞으로 뭘 할 수 있는지를 충분히 보여 주는 기대되는 화면." · "메뉴를 여러 개 — 각 화면은 간단하게."
//
// ★★제1 규약: **자료는 `villageView` 하나에서만 읽는다**(T1072 · 서버가 보내는 한 덩어리). 여기서 세계 값을 계산하지 않는다 —
//   숫자 · 이름 · 문장(다 되면 · 소식 · 할 일)은 서버가 싣는다. 클라는 숫자를 문장 틀(하십시오체)에 넣고 막대를 그리기만 한다.
//   서버에 없는 칸은 그리지 않는다(빈 칸 · 회부 — 보이는 것 = 일어난 것). 원격 시세 없음: 마을 중심에서 멀면 시세 칸 = "가까이 가야 볼 수 있습니다".
// ★★제2 규약: **새 동작 0.** 버튼은 이미 있는 길만 부른다 —
//   부탁 보기 = 이 화면 대시보드의 부탁 목록 · 내 땅 정하기 = 개인 사유지(`claim` kind `personal` · T45 · C 키와 같은 문) ·
//   가진 것 주기 = 그 부탁의 납품(`village_deliver` + 품목 · 게시판 줄 버튼과 같은 문) · 재료 가져오기 = 기부(`village_donate` · T769 회관 기부와 같은 문).
// ★제3 규약: 재질(오석 판 · 판 글자 · 판 막대 · 판 버튼 · 판 선 · 판 테두리)은 **T1071 오석 모듈**(`52-u-oseok.js` · `Oseok` · 판 글자 길 = 캔버스 2D)이 입힌다 —
//   ★[T1083] 그린 DOM 에 `vvSkin` 이 붙인다(글자는 잎 칸 `vv-t` 하나씩 · 막대 `vv-bar` · 버튼 `vv-btn` · 선 `vv-rl` · 테두리 겹 `vv-fr`). 모듈이 없으면 배치 CSS 의 회색 판 그대로.
//   재질을 여기서 따로 만들지 않는다(사본 금지). 본문 18px 아래 0 · 이모지 0(닫기 · 사람 그림은 선 SVG).
// ★제4 규약: 최상위 실행문 0(분할 규약) — 선언만. 판 DOM · 스타일 · 키는 **처음 열 때** 붙인다.
// ★손잡이 `T1070_VILLAGE_VIEW`(URL 인자 · ★기본 끔): `=1` 이면 Shift+G 가 이 화면을 연다. 끔이면 종전 게시판 판 그대로(`47-s-board.js`).
//   기본 끔인 까닭 — 서버 자료(T1072 `villageView`)가 아직 없다. 서버 없이 켜면 빈 화면이거나 예시 값이다(보이는 것 = 일어난 것 위반).
//   T1072 착지 뒤: 기본 켬 + 옛 게시판 판을 걷는다(T1070 보고 회부).

let vvData = null, vvVid = null, vvTab = 'dash', vvMemAll = false, vvWired = false;

function vvKnobOn() { try { return new URLSearchParams(location.search).get('T1070_VILLAGE_VIEW') === '1'; } catch (e) { return false; } }

// ★서버 자료 → 화면이 읽는 모양. 지금은 임시 자료(`test/fixtures/village-view.ui-draft.json`) 모양 그대로다.
//   T1072 `villageView` 의 필드 표가 오면 **이 함수 한 곳만** 맞춘다(화면 함수들은 이 모양만 안다).
// ★[PM land1038] 서버 `villageView`(T1072 · `test/fixtures/village-view.json` 꼴 — `head` 칸이 있다) → 이 화면이 읽는 꼴(임시 자료 꼴). 임시 자료 꼴이 오면 그대로.
//   T1070 × T1072 를 한 판에 합치니 서버가 진짜 자료를 보내 `D.requests.map` 이 던졌다(e2e-village-view 페이지 오류) — 맞추는 자리는 이 함수 하나(T1070 약속).
function vvAdapt(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.head) return raw;
  const H = raw.head || {}, Me = raw.me || {}, Da = raw.dash || {}, rows = (x) => (x && Array.isArray(x.rows)) ? x.rows : (Array.isArray(x) ? x : []);
  const name = H.name || '';
  const pr = {}; for (const r of rows(raw.prices)) pr[r.res] = r;
  const pj = raw.projects || {}, mem = raw.members || {}, st = raw.store || {}, prc = raw.prices || {};
  return {
    vid: H.vid, name, region: '', chief: (H.chief && H.chief.name) || '', day: H.day,
    member: !!Me.member, contrib: { n: Me.contrib | 0, need: Me.need | 0 },
    join: { remainText: (Me.left | 0) > 0 ? `${Me.left}만 더 모으면 ${name} 사람이 될 수 있습니다.` : '', perks: [], oneRequest: true },
    stats: { pop: Da.pop | 0, popDelta: 0, season: (H.cal && H.cal.seasonKo) || '', toWinter: Da.toWinter, winter: [], workN: Da.projectsN | 0, workNext: '' },
    requests: rows(raw.requests).map((r) => ({ item: r.ko || r.item, res: r.item || r.res, qty: r.qty, filled: r.filled | 0, unit: '', why: r.line || '', contrib: r.rewQty | 0 })),
    news: rows(raw.news).map((n) => ({ when: (n.ago | 0) === 0 ? '오늘' : `${n.ago}일 전${n.from ? ' · 들려온 소문' : ''}`, text: n.line || '' })),
    projects: { hint: '모자란 재료를 가져오면 더 빨리 끝납니다. 가져온 만큼 기여도 쌓입니다.',
      active: (pj.now || []).map((q) => ({ name: q.name, status: q.stageLabel || (q.toDays != null ? `${q.toDays}일 뒤 도착` : ''), frac: q.stages ? (q.stage | 0) / q.stages : 0,
        needs: (q.need || []).map((x) => ({ item: x.ko || x.res, have: x.have | 0, need: x.need | 0 })), after: '' })),
      done: (pj.done || []).map((d) => ({ when: (d.ago | 0) === 0 ? '오늘' : `${d.ago}일 전`, text: d.line || '' })) },
    members: { total: mem.n | 0, delta: 0, jobs: (mem.byJob || []).map((j) => ({ job: j.ko || j.job, n: j.n | 0 })),
      people: (mem.people || []).map((p) => ({ name: p.name, job: p.jobKo || p.job, chief: !!p.chief, act: p.act || '' })) },
    store: { near: !!(raw.gate && raw.gate.near), base: prc.numeraireKo || '', baseOptions: prc.numeraireKo ? [prc.numeraireKo] : [],
      note: ['시세는 이 마을이 지금 매기는 값입니다.', '많이 팔리면 내려가고, 귀해지면 오릅니다.', '이웃 마을 값은 직접 가 봐야 알 수 있습니다.'], noteWhen: '',
      rows: rows(st).map((r) => ({ item: r.ko || r.res, qty: r.qty, unit: '', plenty: Math.max(0, Math.min(1, (r.daysOf || 0) / 30)), price: pr[r.res] ? pr[r.res].num : null, trend: r.short ? 1 : (r.glut ? -1 : 0) })) },
  };
}

// 서버 응답(제안: `{ type: 'village_view', view }` — 이름은 T1072 가 정한다 · 30-n-net.js 의 case 한 줄이 이리로 넘긴다)
let vvVer = 0;   // ★[T1083] 자료 판 번호 — 바뀌면 머리 · 탭 판을 다시 짓는다(같으면 지어 둔 판을 보이기만)
function villageViewOnMessage(view) {
  vvData = vvAdapt(view); vvVer++;
  if (vvData && vvData.vid != null && vvVid == null) vvVid = vvData.vid;
  if (villageViewOpen()) vvRender();
}

function villageViewOpen() { const p = document.getElementById('vvPane'); return !!(p && !p.classList.contains('hidden')); }
function openVillageView(vid) {
  vvVid = vid;
  vvTab = 'dash'; vvMemAll = false;
  vvPaneEl().classList.remove('hidden');
  try { if (typeof sendPrimary === 'function') sendPrimary({ type: 'village_view', vid }); } catch (e) {}   // 자료 요청(서버가 모르면 그냥 버린다 — T1072 전)
  vvRender();
}
function closeVillageView() { const p = document.getElementById('vvPane'); if (p) p.classList.add('hidden'); }

function vvPaneEl() {
  let p = document.getElementById('vvPane');
  if (p) return p;
  vvStyle();
  p = document.createElement('div');
  p.id = 'vvPane';
  p.className = 'hidden';
  p.innerHTML = '<div class="vv-wrap"><div class="vv-head" id="vvHead"></div><div class="vv-body" id="vvBody"></div></div>';
  document.body.appendChild(p);
  if (!vvWired) {
    vvWired = true;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && villageViewOpen()) closeVillageView(); });
    p.addEventListener('click', vvOnClick);
  }
  return p;
}


// ── 판 CSS(배치) — 재질은 `52-u-oseok.js`(T1071 · `Oseok`)가 입힌다(`vvSkin` · ★[T1083]). 모듈이 없으면 이 CSS 의 회색 판 그대로(T1070 임시 판).
//   여기 색은 모듈이 없을 때만 보이는 대체 값이다 — 재질을 여기서 만들지 않는다(사본 금지). 본문 18px 이상.
function vvStyle() {
  if (document.getElementById('vvStyle')) return;
  const s = document.createElement('style');
  s.id = 'vvStyle';
  s.textContent = `
#vvPane{position:fixed;inset:0;z-index:9000;background:#121212;color:#d9d9d9;font-family:'Noto Sans CJK KR','Noto Sans KR',var(--font);font-size:18px;line-height:1.45;overflow:auto}
#vvPane.hidden{display:none}
#vvPane .vv-wrap{max-width:1440px;margin:0 auto;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;min-height:100%}
#vvPane .vv-body{display:flex;flex-direction:column;gap:16px;flex:1}
#vvPane .vv-grow{flex:1}
#vvPane .vv-plate{background:#4a4a4a;box-sizing:border-box;padding:20px 32px;position:relative}
#vvPane .vv-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 32px}
#vvPane .vv-col{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
#vvPane .vv-line{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
#vvPane .vv-tabs{display:flex;gap:40px}
#vvPane .vv-tab{background:none;border:0;color:inherit;font:inherit;padding:4px 2px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px}
#vvPane .vv-tab .vv-rl{width:100%;height:3px;visibility:hidden}
#vvPane .vv-tab.on .vv-rl{visibility:visible}
#vvPane .vv-meter{justify-self:end;display:flex;align-items:flex-start;gap:24px}
#vvPane .vv-close{position:relative;width:44px;height:44px;background:none;border:0;color:#e0e0e0;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center}
#vvPane .vv-bar{height:12px;background:#262626;box-sizing:border-box;position:relative}
#vvPane .vv-bar>i{display:block;height:100%;background:#d6d6d6}
#vvPane .vv-btn{position:relative;background:none;border:1px solid #cfcfcf;color:#e6e6e6;font:inherit;cursor:pointer;white-space:nowrap;height:52px;padding:0 24px;display:inline-flex;align-items:center;justify-content:center}
#vvPane .vv-btn.main{outline:1px solid #cfcfcf;outline-offset:3px}
#vvPane .vv-btn.os-btn{border:0;outline:0}
#vvPane .vv-row{display:grid;align-items:center;gap:16px;padding:12px 0}
#vvPane .vv-rl{display:block;height:2px;background:#666;position:relative}
#vvPane .vv-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
#vvPane .vv-card,#vvPane .vv-chip,#vvPane .vv-far{position:relative;padding:16px 20px}
#vvPane .vv-chip{padding:6px 18px}
#vvPane .vv-far{margin-bottom:12px}
#vvPane .vv-fr{position:absolute;inset:0;border:1px solid #9a9a9a;box-sizing:border-box;pointer-events:none}
#vvPane .vv-t{display:inline-block}
`;
  document.head.appendChild(s);
}

const vvEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 판 글자 한 칸(잎 — 자식 없음) · sz px(18 아래 금지 — 모듈이 지킨다) · f = serif(제목 명조) | sans(굵은 고딕 · 버튼) | sansm(본문 고딕)
const vvT = (s, sz, f, id) => `<span class="vv-t"${id ? ` id="${id}"` : ''} data-sz="${sz || 18}" data-f="${f || 'sansm'}" style="font-size:${sz || 18}px">${vvEsc(s)}</span>`;
const vvBar = (f) => `<div class="vv-bar" data-p="${Math.max(0, Math.min(1, +f || 0))}"><i style="width:${Math.round(Math.max(0, Math.min(1, +f || 0)) * 100)}%"></i></div>`;
const vvBtn = (label, attrs, main) => `<button class="vv-btn${main ? ' main' : ''}" ${attrs} data-label="${vvEsc(label)}"${main ? ' data-main="1"' : ''}>${vvEsc(label)}</button>`;
const vvRl = () => '<i class="vv-rl"></i>';
const vvFr = '<i class="vv-fr"></i>';
const vvRows = (arr) => arr.join(vvRl());   // 줄 사이에 판 선
// 받침 있으면 a(이 · 은 · 을) · 없으면 b(가 · 는 · 를) — 한글 마지막 글자만 본다(문장 틀용)
function vvJosa(w, a, b) { const c = String(w || '').charCodeAt(String(w || '').length - 1); if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28) ? a : b; return a; }
const vvSvgX = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4L20 20M20 4L4 20" stroke="currentColor" stroke-width="1.8"/></svg>';
const vvSvgMan = '<svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" style="color:#dcdcdc;flex:none"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="26" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M26 20V31M18 25H34M26 31L20 39M26 31L32 39" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

// 마을 중심에서 먼가 — 클라가 이미 아는 근접(`evNearVid` — 30-n-net 근접 틱)과 서버가 시세를 실었나(`store.near`)
function vvFar() {
  const near = (typeof evNearVid !== 'undefined') ? evNearVid : null;
  return near == null || near !== vvVid || !(vvData && vvData.store && vvData.store.near);
}

// ★★[T1083] 오석 판 입히기 — T1071 모듈(`Oseok` · 판 글자 길 = 캔버스 2D)을 그린 DOM 에 붙인다. 판 무늬는 화면 자리만큼 밀어 판끼리 결이 이어지게.
//   모듈이 없으면(조각이 안 붙은 판) 아무것도 안 한다 — 배치 CSS 의 회색 판 그대로다.
let vvSkinMs = 0;   // 마지막 입히기 ms(e2e · 보고 표 — 판 열 때 · 탭 바꿀 때의 값)
function vvSkin(root) {
  if (typeof Oseok === 'undefined' || !root) return;
  const t0 = performance.now();
  const pane = document.getElementById('vvPane');
  if (pane && !pane._vvGround) { Oseok.ground(pane, { ox: 0, oy: 0 }); pane._vvGround = true; }
  const pr = pane ? pane.getBoundingClientRect() : { left: 0, top: 0 };
  for (const el of [...(root.matches && root.matches('.vv-plate') ? [root] : []), ...root.querySelectorAll('.vv-plate')]) { const r = el.getBoundingClientRect(); Oseok.plate(el, { ox: r.left - pr.left, oy: r.top - pr.top }); }   // 뿌리 자신이 판(머리)이면 그것도
  for (const el of root.querySelectorAll('.vv-t')) Oseok.text(el, el.textContent, { size: +el.dataset.sz || 18, font: el.dataset.f || 'sansm' });
  for (const el of root.querySelectorAll('.vv-bar')) Oseok.bar(el, +el.dataset.p || 0, { w: el.clientWidth, h: el.clientHeight });
  for (const el of root.querySelectorAll('.vv-rl')) { if (el.clientWidth > 0) Oseok.rule(el, { lw: 1.4, w: el.clientWidth, h: el.clientHeight }); }
  for (const el of root.querySelectorAll('.vv-fr')) Oseok.frame(el, { lw: 1.6, w: el.clientWidth, h: el.clientHeight });
  //   버튼은 입히기 전에 배치가 정한 폭 · 높이를 박는다(모듈의 `.os-btn` 은 안쪽 여백이 0 이라 그대로 두면 글자 폭으로 줄어든다)
  for (const el of root.querySelectorAll('.vv-btn')) { if (!el._osBtn) { el.style.width = `${el.offsetWidth}px`; el.style.height = `${el.offsetHeight}px`; } Oseok.button(el, el.dataset.label, { primary: !!el.dataset.main, size: 20, font: 'sans', w: el.offsetWidth, h: el.offsetHeight }); }
  vvSkinMs = performance.now() - t0;
}

function vvRender() {
  const head = document.getElementById('vvHead'), body = document.getElementById('vvBody');
  if (!head || !body) return;
  const D = vvData;
  const closeBtn = `<button class="vv-close" data-vv="close" aria-label="닫기">${vvFr}${vvSvgX}</button>`;
  if (!D) {
    head.innerHTML = `<div></div><div></div><div class="vv-meter">${closeBtn}</div>`;
    body.innerHTML = `<div class="vv-plate">${vvT('마을 소식을 받는 중입니다.', 20)}</div>`;
    vvSkin(document.getElementById('vvPane'));
    return;
  }
  const tabs = [['dash', '대시보드'], ['proj', '프로젝트'], ['mem', '구성원'], ['store', '창고']];
  const C = D.contrib || null;
  //   ★[T1083] 머리는 자료가 바뀔 때만 다시 짓는다(탭 바꿈은 고른 표시만 옮긴다 — 판 글자를 다시 안 그린다)
  if (head._vvVer !== vvVer) {
    head._vvVer = vvVer;
    head.innerHTML = `<div class="vv-col">${vvT(D.name, 52, 'serif', 'vvName')}`
      + `${vvT([D.region, D.chief ? `촌장 ${D.chief}` : null, D.day != null ? `${D.day}일째` : null].filter(Boolean).join(' · '), 18)}</div>`
      + `<div class="vv-tabs">${tabs.map(([k, l]) => `<button class="vv-tab" data-vv="tab" data-k="${k}">${vvT(l, 24, 'sansm')}${vvRl()}</button>`).join('')}</div>`
      + `<div class="vv-meter">${(!D.member && C && C.need > 0) ? `<div><div class="vv-line">${vvT('마을 사람이 되기까지', 20)}${vvT(`${C.n} / ${C.need}`, 24, 'sans', 'vvContrib')}</div><div style="width:290px;margin-top:8px">${vvBar(C.n / C.need)}</div></div>` : ''}`
      + `${closeBtn}</div>`;
    head.classList.add('vv-plate');
    body.innerHTML = tabs.map(([k]) => `<div class="vv-tabbody" data-k="${k}" style="display:none"></div>`).join('');
    vvSkin(head);
  }
  for (const b of head.querySelectorAll('.vv-tab')) b.classList.toggle('on', b.dataset.k === vvTab);
  //   탭 판: 지어 둔 것을 보이기만 — 처음 볼 때 · 자료가 바뀐 뒤 · 그 탭의 꼴을 바꾸는 상태(창고 먼/가까움 · 구성원 더 보기)가 바뀌었을 때만 짓는다.
  //   ⚠보이게 한 **뒤에** 짓는다 — 판 · 막대 · 선의 크기는 보이는 칸에서만 잰다.
  const sig = vvTab === 'store' ? `s${vvFar() ? 1 : 0}` : vvTab === 'mem' ? `m${vvMemAll ? 1 : 0}` : '';
  for (const tb of body.querySelectorAll('.vv-tabbody')) tb.style.display = tb.dataset.k === vvTab ? 'contents' : 'none';
  const cur = body.querySelector(`.vv-tabbody[data-k="${vvTab}"]`);
  if (cur && cur._vvSig !== sig) {
    cur._vvSig = sig;
    cur.innerHTML = vvTab === 'proj' ? vvProj(D) : vvTab === 'mem' ? vvMem(D) : vvTab === 'store' ? vvStore(D) : vvDash(D);
    vvSkin(cur);
  } else vvSkinMs = 0;
}

function vvDash(D) {
  let h = '';
  const J = D.join;
  if (!D.member && J) {
    h += `<div class="vv-plate" style="display:grid;grid-template-columns:1.3fr 1fr .9fr;gap:24px">`
      + `<div class="vv-col">${vvT('아직 이 마을 사람이 아닙니다', 38, 'serif')}<div style="height:8px"></div>${vvT('마을 일을 도우면 기여가 쌓입니다.', 20)}${J.remainText ? vvT(J.remainText, 20) : ''}</div>`
      + `<div class="vv-col">${vvT('마을 사람이 되면', 26)}${(J.perks || []).map((t) => vvT(`· ${t}`, 20)).join('')}</div>`
      + `<div class="vv-col">${J.oneRequest ? vvT('부탁 하나만 들어주면', 20) + vvT('바로 마을 사람이 됩니다.', 20) : ''}`
      + `<div style="display:flex;gap:12px;margin-top:20px">${vvBtn('부탁 보기', 'data-vv="req"', true)}${vvBtn('내 땅 정하기', 'data-vv="claim"')}</div></div></div>`;
  }
  const S = D.stats || {};
  const cards = [];
  if (S.pop != null) cards.push(`<div class="vv-plate vv-col">${vvT('사는 사람', 20)}${vvT(`${S.pop}명`, 56, 'serif', 'vvPop')}${S.popDelta ? vvT(`이번 철에 ${Math.abs(S.popDelta)}명 ${S.popDelta > 0 ? '늘었습니다' : '줄었습니다'}`, 18) : ''}</div>`);
  if (S.season) cards.push(`<div class="vv-plate vv-col">${vvT('지금은', 20)}${vvT(S.season, 56, 'serif')}${S.toWinter > 0 ? vvT(`겨울까지 ${S.toWinter}일 남았습니다`, 18) : ''}</div>`);
  if (S.winter && S.winter.length) cards.push(`<div class="vv-plate">${vvT('겨울 준비', 20)}${S.winter.map((w) => `<div class="vv-line" style="margin-top:10px">${vvT(w.short ? `${w.label}${vvJosa(w.label, '이', '가')} 모자랍니다` : w.label, 18)}${vvT(`${Math.round(w.frac * 100)}%`, 18)}</div>${vvBar(w.frac)}`).join('')}</div>`);
  if (S.workN != null) cards.push(`<div class="vv-plate vv-col">${vvT('하고 있는 일', 20)}${vvT(`${S.workN}가지`, 56, 'serif')}${S.workNext ? vvT(S.workNext, 18) : ''}</div>`);
  if (cards.length) h += `<div class="vv-grid4">${cards.join('')}</div>`;
  h += `<div class="vv-grow" style="display:grid;grid-template-columns:1.7fr 1fr;gap:16px">`;
  h += `<div class="vv-plate" id="vvReq">${vvT('마을의 부탁', 32, 'serif')}${vvRows((D.requests || []).map((r, i) => `<div class="vv-row" style="grid-template-columns:1.4fr 1.1fr .6fr auto">`
    + `<div class="vv-col">${vvT(`${r.item} ${r.qty}${r.unit || ''}`, 24)}${vvT(r.why || '', 18)}</div>`
    + `<div>${vvT(`${r.filled} / ${r.qty} 모임`, 18)}${vvBar(r.qty ? r.filled / r.qty : 0)}</div>`
    + `<div>${r.contrib != null ? vvT(`기여 +${r.contrib}`, 22) : ''}</div>`
    + `${vvBtn('가진 것 주기', `data-vv="give" data-i="${i}"`)}</div>`)) || vvT('지금은 부탁이 없습니다.', 20)}</div>`;
  h += `<div class="vv-plate">${vvT('마을 소식', 32, 'serif')}${vvRows((D.news || []).map((n) => `<div class="vv-row" style="grid-template-columns:1fr"><div class="vv-col">${vvT(n.when, 18)}${vvT(n.text, 20)}</div></div>`))}</div>`;
  return h + '</div>';
}

function vvProj(D) {
  const P = D.projects || {};
  let h = `<div class="vv-plate"><div class="vv-line" style="margin-bottom:12px">${vvT('지금 하고 있는 일', 32, 'serif')}${vvT(P.hint || '', 20)}</div>`;
  h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${(P.active || []).map((p, i) => {
    const all = (p.needs || []).length && p.needs.every((n) => n.have >= n.need);
    return `<div class="vv-card">${vvFr}<div class="vv-line">${vvT(p.name, 28, 'serif')}${vvT(p.status || '', 18)}</div>`
      + `<div style="margin:12px 0">${vvBar(p.frac)}</div><div class="vv-col">${vvT('필요한 것', 18)}`
      + `${vvT(`${(p.needs || []).map((n) => `${n.item} ${n.have}/${n.need}${n.unit || ''}`).join(' · ')}${all ? ' · 다 챙김' : ''}`, 22)}`
      + `<div style="height:6px"></div>${vvT(p.after || '', 18)}</div><div style="text-align:right;margin-top:12px">${vvBtn('재료 가져오기', `data-vv="bring" data-i="${i}"`)}</div></div>`;
  }).join('')}</div></div>`;
  h += `<div class="vv-grow" style="display:grid;grid-template-columns:1.7fr 1fr;gap:16px"><div class="vv-plate vv-col">${vvT('앞으로 할 일', 32, 'serif')}${(P.next || []).map((t) => vvT(`· ${t}`, 20)).join('')}</div>`
    + `<div class="vv-plate">${vvT('끝낸 일', 32, 'serif')}${(P.done || []).map((d) => `<div class="vv-line">${vvT(d.name, 20)}${vvT(`${d.ago}일 전`, 20)}</div>`).join('')}</div></div>`;
  return h;
}

function vvMem(D) {
  const M = D.members || {};
  const ppl = M.people || [];
  const show = vvMemAll ? ppl : ppl.slice(0, 16);
  const more = (M.total || ppl.length) - show.length;
  let h = `<div class="vv-plate vv-grow" style="display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;margin-bottom:16px">${vvT('함께 사는 사람', 32, 'serif')}`
    + `${vvT(`${M.total != null ? `${M.total}명` : ''}${M.delta ? ` · 이번 철에 ${Math.abs(M.delta)}명 ${M.delta > 0 ? '늘었습니다' : '줄었습니다'}` : ''}`, 20)}`
    + `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-left:auto">${(M.jobs || []).map((j) => `<span class="vv-chip">${vvFr}${vvT(`${j.job} ${j.n}`, 18)}</span>`).join('')}</div></div>`;
  h += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${show.map((p) => `<div class="vv-card">${vvFr}<div style="display:flex;gap:16px;align-items:center">${vvSvgMan}`
    + `<div class="vv-col">${vvT(p.name, 28, 'serif')}${vvT([p.chief ? '촌장' : null, p.job, p.sub || null, p.newcomer ? '새로 옴' : null].filter(Boolean).join(' · '), 18)}</div></div>`
    + `<div style="margin-top:14px">${vvT(p.act || '', 18)}</div></div>`).join('')}</div>`;
  h += `<div class="vv-line" style="margin-top:auto;padding-top:20px">${vvT(M.hint || '', 20)}${more > 0 && !vvMemAll ? vvBtn(`${more}명 더 보기`, 'data-vv="more"') : ''}</div></div>`;
  return h;
}

function vvStore(D) {
  const S = D.store || {};
  const far = vvFar();
  const unit = ((S.rows || []).find((r) => r.item === S.base) || {}).unit || '';
  const tr = (t) => (t >= 2 ? '▲▲ 크게 오름' : t === 1 ? '▲ 오름' : t === -1 ? '▼ 내림' : t <= -2 ? '▼▼ 크게 내림' : '— 그대로');
  const cols = 'grid-template-columns:1fr .8fr 1.2fr 1fr 1fr';
  let h = `<div class="vv-grow" style="display:grid;grid-template-columns:2fr 1fr;gap:16px"><div class="vv-plate">${vvT('곳간에 있는 것', 32, 'serif')}`;
  if (far) h += `<div class="vv-far" id="vvFar">${vvFr}${vvT('시세는 가까이 가야 볼 수 있습니다.', 20)}</div>`;
  h += `<div class="vv-row" style="${cols}">${vvT('물건', 18)}${vvT('가진 양', 18)}${vvT('넉넉함', 18)}${vvT(`시세 (${S.base || ''} 기준)`, 18)}${vvT('어제보다', 18)}</div>${vvRl()}`;
  h += vvRows((S.rows || []).map((r) => `<div class="vv-row" style="${cols}">${vvT(r.item, 22)}${vvT(`${r.qty}${r.unit || ''}`, 20)}${vvBar(r.plenty)}`
    + `<span>${far ? '' : vvT(`${r.price}${unit}`, 20)}</span><span>${far ? '' : vvT(tr(r.trend), 20)}</span></div>`));
  h += `</div><div style="display:flex;flex-direction:column;gap:16px"><div class="vv-plate">${vvT('시세 기준', 32, 'serif')}`
    + `<div style="display:flex;gap:12px;margin:12px 0 16px">${(S.baseOptions || []).map((b) => vvBtn(b, `data-vv="base" data-b="${vvEsc(b)}" style="flex:1"`, b === S.base)).join('')}</div>`
    + `<div class="vv-col">${(S.note || []).map((t) => vvT(t, 20)).join('')}${S.noteWhen ? `<div style="height:8px"></div>${vvT(S.noteWhen, 18)}` : ''}</div></div>`
    + `<div class="vv-plate">${vvT('모자란 것', 32, 'serif')}${vvRows((S.short || []).map((s) => `<div class="vv-row" style="grid-template-columns:.8fr 1.6fr auto">${vvT(s.item, 22)}${vvT(s.why || '', 20)}<span>${s.trend != null ? vvT(`값 ${s.trend > 0 ? '▲' : s.trend < 0 ? '▼' : '—'}`, 20) : ''}</span></div>`))}`   // 값 흐름은 서버가 실을 때만(지어내지 않는다)
    + `${S.shortHint ? `<div class="vv-col" style="margin:16px 0">${vvT(S.shortHint, 20)}</div>` : ''}${vvBtn('부탁 보기', 'data-vv="req"', true)}</div></div></div>`;
  return h;
}

// 버튼 — 전부 이미 있는 길(제2 규약)
function vvOnClick(e) {
  const b = e.target.closest('[data-vv]');
  if (!b) return;
  const a = b.dataset.vv, D = vvData;
  const send = (m) => { try { if (typeof sendPrimary === 'function') sendPrimary(m); } catch (er) {} };
  if (a === 'close') closeVillageView();
  else if (a === 'tab') { vvTab = b.dataset.k; vvRender(); }
  else if (a === 'more') { vvMemAll = true; vvRender(); }
  else if (a === 'req') { vvTab = 'dash'; vvRender(); const r = document.getElementById('vvReq'); if (r) r.scrollIntoView({ block: 'start' }); }
  else if (a === 'claim') send({ type: 'claim', kind: 'personal' });   // 개인 사유지 — C 키와 같은 문(T45)
  else if (a === 'give' && D) { const r = (D.requests || [])[+b.dataset.i]; if (r) send({ type: 'village_deliver', vid: vvVid, item: r.res || r.item }); }   // 게시판 줄 버튼과 같은 문
  else if (a === 'bring' && D) {   // 기부 — 회관 기부 단추와 같은 문(T769) · 든 것 중 이 일에 필요한 것만 · 모자란 만큼까지(서버가 최종 판정)
    const p = ((D.projects || {}).active || [])[+b.dataset.i];
    const inv = (typeof inventory !== 'undefined' && inventory) ? inventory : {};
    const want = {};
    if (p) for (const n of (p.needs || [])) { const q = Math.min(inv[n.item] || 0, Math.max(0, n.need - n.have)); if (q >= 1) want[n.item] = q; }
    if (Object.keys(want).length) send({ type: 'village_donate', vid: vvVid, want });
    else if (typeof showNotice === 'function') showNotice('가져올 재료가 짐에 없습니다.');
  }
  else if (a === 'base') send({ type: 'village_view', vid: vvVid, base: b.dataset.b });   // 시세 기준 고르기 — 서버가 그 기준으로 다시 보낸다(T1072 · 클라는 환산하지 않는다)
}
