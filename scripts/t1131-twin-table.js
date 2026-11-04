#!/usr/bin/env node
// === scripts/t1131-twin-table.js — 배포 png ↔ webp 쌍둥이 표(T1131 게이트 "화소: 잠금 자 같음 전수") ===
//
// ★무엇: 게임 그림 일곱 무리(`asset-lock.js` `TWIN_GROUPS`)마다 png · webp 장 수 · 바이트 · **화소 같음**(잠금 자 정본 `lockValue` —
//   투명 아래 RGB 는 0 으로 본다 · 여기서 다시 적지 않는다) · 잠금표 값과 같음(둘 다)을 센다.
//   쌍둥이를 쓴 자(`scripts/webp_twins.py` · PIL lossless=True quality=100 method=6 — T1123 표와 같은 설정)와 재는 자가 다르다(PIL ↔ pngjs · @cwasm/webp).
// 실행: node scripts/t1131-twin-table.js [--out 계측/x.json]
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./asset-lock.js');

const LOCK = JSON.parse(fs.readFileSync(L.LOCK, 'utf8'));
const out = { at: new Date().toISOString(), ruler: 'asset-lock.js lockValue(pixel)', enc: 'scripts/webp_twins.py (PIL WEBP lossless=True quality=100 method=6)', groups: {}, bad: [], top: [] };
const rows = [];
let N = 0, SAME = 0, LOCKN = 0, LOCKHIT = 0, P = 0, W = 0;
for (const g of L.TWIN_GROUPS) {
  const d = path.join(L.AST, g);
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort();
  const G = { n: 0, png: 0, webp: 0, twin: 0, same: 0, lockN: 0, lockHit: 0 };
  for (const f of files) {
    const k = f.slice(0, -4), p = path.join(d, f), w = path.join(d, k + '.webp');
    G.n++; G.png += fs.statSync(p).size;
    if (!fs.existsSync(w)) { out.bad.push(`${g}/${k}: webp 없음`); continue; }
    G.twin++; G.webp += fs.statSync(w).size;
    const hp = L.lockValue(p).hash, hw = L.lockValue(w).hash, lv = (LOCK[g] || {})[k];
    if (hp === hw) G.same++; else out.bad.push(`${g}/${k}: 화소 다름 png ${hp} ↔ webp ${hw}`);
    if (typeof lv === 'string') { G.lockN++; if (lv === hp && lv === hw) G.lockHit++; else out.bad.push(`${g}/${k}: 잠금표 ${lv} ↔ png ${hp} · webp ${hw}`); }
    rows.push({ g, k, png: fs.statSync(p).size, webp: fs.statSync(w).size });
  }
  out.groups[g] = G; N += G.n; SAME += G.same; LOCKN += G.lockN; LOCKHIT += G.lockHit; P += G.png; W += G.webp;
  console.log(`${g.padEnd(10)} ${String(G.n).padStart(4)}장 · 쌍둥이 ${G.twin} · png ${(G.png / 1e6).toFixed(2)} MB → webp ${(G.webp / 1e6).toFixed(2)} MB (${(G.webp / Math.max(1, G.png) * 100).toFixed(1)}%) · 화소 같음 ${G.same}/${G.n} · 잠금표 같음 ${G.lockHit}/${G.lockN}`);
}
out.total = { n: N, same: SAME, lockN: LOCKN, lockHit: LOCKHIT, png: P, webp: W };
rows.sort((a, b) => b.png - a.png); out.top = rows.slice(0, 10);
console.log(`합 ${N}장 · png ${(P / 1e6).toFixed(2)} MB → webp ${(W / 1e6).toFixed(2)} MB (${(W / P * 100).toFixed(1)}%) · 화소 같음 ${SAME}/${N} · 잠금표 같음 ${LOCKHIT}/${LOCKN} · 어긋남 ${out.bad.length}`);
for (const b of out.bad.slice(0, 20)) console.log('  ✗ ' + b);
const oi = process.argv.indexOf('--out');
if (oi >= 0) { fs.writeFileSync(path.join(__dirname, '..', process.argv[oi + 1]), JSON.stringify(out, null, 1) + '\n'); console.log('적음', process.argv[oi + 1]); }
process.exit(out.bad.length ? 1 : 0);
