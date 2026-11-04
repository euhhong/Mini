#!/usr/bin/env node
'use strict';
// (@regress 없음 — 러너 밖 · T1144 표 기계 · `t646-anatomy table` 의 table.json 만 읽는다 · 판정 0)
// === scripts/t1144-life.js — 생활 층 안 함수별 µs/사람(포함) · 대조로 나눈 생활 층 ===
//   node scripts/t1144-life.js <table.json> [--json <파일>]
//   칸 = npcStep × (그 함수가 사슬에 있는 표본 ÷ npcStep 표본)(T1140 자 그대로) · 생활 층 ÷ 대조 = 손 안 댄 구간 합으로 나눈 몫(상자 흐름 보정)
const fs = require('fs');
const T = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ji = process.argv.indexOf('--json'), JOUT = ji > 0 ? process.argv[ji + 1] : null;
const CTRL = ['몹 AI', '델타·방송(AOI)', '꼬리(어로·저장·쓰러짐·계측)', '계단·낙하·게이지·HP', '청크', '공간 색인·입력 시한'];
const FN = [['생활 층', 'npcLifeTick@villages.js'], ['밭 칸 훑기', '_lifeNextFarmCell@villages.js'], ['└ 사건 길', '_t1144NextFarmCell@villages.js'], ['└ 칸 일', '_cellTask@villages.js'],
  ['└ └ cropTaskOf', 'cropTaskOf@villages.js'], ['└ └ grownDays', 'grownDays@crops.js'], ['어부 던짐', '_t340Try@villages.js'], ['require(어로)', '_fishingMod@villages.js'],
  ['집터 크루', '_t400BodyStep@villages.js'], ['개간 문', '_lifeNeedClear@villages.js'], ['해 질 녘 정산', '_t720Step@villages.js']];
const out = [];
for (const r of T.runs) {
  const L = r.lines || {}, m = Object.fromEntries(L.incl || []), u = (k) => (m[k] || 0) * L.stepUs / (L.stepSamples || 1);
  const seg = r.segUs || {};
  const ctrl = CTRL.reduce((a, k) => a + (seg[k] || 0), 0);
  const row = { tag: r.tag, W: r.W, npcStep: +(L.stepUs || 0).toFixed(3) };
  for (const [n, k] of FN) row[n] = +u(k).toFixed(3);
  row.ctrl = ctrl ? +ctrl.toFixed(3) : null;
  row['생활 층 ÷ 대조'] = ctrl ? +(row['생활 층'] / ctrl).toFixed(3) : null;
  out.push(row);
}
const cols = Object.keys(out[0] || {});
console.log('| ' + cols.join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|');
for (const r of out) console.log('| ' + cols.map((c) => r[c]).join(' | ') + ' |');
if (JOUT) fs.writeFileSync(JOUT, JSON.stringify(out, null, 1));
