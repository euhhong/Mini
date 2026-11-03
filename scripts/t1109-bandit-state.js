#!/usr/bin/env node
// (@regress 없음 — 러너 밖 · T1109 표 기계 · 판 DB 를 읽기만 · 판정 0)
// === scripts/t1109-bandit-state.js — 판 자 DB 의 도적 층 저장 줄(`bandit_state`)에서 걷기 장부 셈을 읽는다 ===
//   node scripts/t1109-bandit-state.js <판 디렉터리>/base-<시드>.db ...
//   불행 이탈 떠남(`t1075Leave`) · 닿음(`t765Arrive`) · 걷던 몸이 주민이 됨(`t765Joined`) · 길 위 죽음(`t1080Dead`) · 길 위 사람-날(`t1080RoadDays`) ·
//   다시 고르기(`t1080Reroute`) · 해체 걷기(`t577Walk`) · 판 끝 길 위 줄(표지 `t1075` 줄 수)
'use strict';
const D = require('better-sqlite3');
const tot = {};
for (const f of process.argv.slice(2)) {
  const db = new D(f, { readonly: true });
  const r = db.prepare('select day, data from bandit_state').get();
  if (!r) { console.log(f, '저장 줄 없음'); continue; }
  const j = JSON.parse(r.data), s = j.stats || {}, W = j.walk || [];
  const o = { day: r.day, t1075Leave: s.t1075Leave || 0, t765Arrive: s.t765Arrive || 0, t765Joined: s.t765Joined || 0, t1080Dead: s.t1080Dead || 0,
    t1080RoadDays: s.t1080RoadDays || 0, t1080Reroute: s.t1080Reroute || 0, t577Walk: s.t577Walk || 0, road: W.length, road1075: W.filter((w) => w.t1075).length };
  console.log(f, JSON.stringify(o));
  for (const [k, v] of Object.entries(o)) if (k !== 'day') tot[k] = (tot[k] || 0) + v;
}
console.log('합', JSON.stringify(tot));
