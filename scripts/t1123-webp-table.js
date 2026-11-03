#!/usr/bin/env node
// === scripts/t1123-webp-table.js — 게임 그림 png → 같은 화소 webp 표(T1123 ③ · 판정 0) ===
//
// ★무엇: 무리마다 png 를 **무손실 webp** 로 다시 눌러(PIL · /tmp 에만) 크기를 대고, 화소가 같은지 **잠금 자 정본**으로 잰다.
//   자 = `scripts/asset-lock.js` `lockValue`(png · webp 같은 자 · 투명 아래 RGB 는 0 으로 본다) — 여기서 다시 적지 않는다(사본 0).
//   png 쪽 값이 잠금표(`icons.lock.json`)와 같은지도 대 둔다(자의 증인 — 배포본이 잠금 그대로인가).
//   배포본 무접촉 — 눌린 webp 는 /tmp 에만 쓰고 지운다.
//
// 실행: node scripts/t1123-webp-table.js [--out 계측/x.json]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./asset-lock.js');

const ROOT = path.join(__dirname, '..');
const AST = path.join(ROOT, 'public', 'assets');
const GROUPS = ['trees', 'nature', 'buildings', 'bridge', 'crops', 'terrain', 'icons'];
const LOCK = JSON.parse(fs.readFileSync(path.join(AST, 'icons.lock.json'), 'utf8'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't1123-webp-'));
const ENC = 'PIL WEBP lossless=True quality=100 method=6';
const PY = `import sys\nfrom PIL import Image\nfor a in sys.argv[1:]:\n  s,d=a.split('|')\n  Image.open(s).convert('RGBA').save(d,'WEBP',lossless=True,quality=100,method=6)\n`;

const out = { enc: ENC, ruler: 'asset-lock.js lockValue(pixel)', groups: {}, top: [] };
const rows = [];
for (const g of GROUPS) {
  const d = path.join(AST, g);
  if (!fs.existsSync(d)) continue;
  const files = fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort();
  const pairs = files.map((f) => `${path.join(d, f)}|${path.join(TMP, g + '__' + f.replace(/\.png$/, '.webp'))}`);
  for (let i = 0; i < pairs.length; i += 40) {
    const r = spawnSync('python3', ['-c', PY, ...pairs.slice(i, i + 40)], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
  }
  const G = { n: 0, png: 0, webp: 0, same: 0, lockHit: 0, lockN: 0 };
  for (const f of files) {
    const p = path.join(d, f), w = path.join(TMP, g + '__' + f.replace(/\.png$/, '.webp'));
    const hp = L.lockValue(p).hash, hw = L.lockValue(w).hash;
    const ps = fs.statSync(p).size, ws = fs.statSync(w).size;
    const lv = (LOCK[g] || {})[f.replace(/\.png$/, '')];
    G.n++; G.png += ps; G.webp += ws; if (hp === hw) G.same++;
    if (typeof lv === 'string') { G.lockN++; if (lv === hp) G.lockHit++; }
    rows.push({ g, f, png: ps, webp: ws, same: hp === hw, lock: typeof lv === 'string' ? lv === hp : null });
    fs.unlinkSync(w);
  }
  out.groups[g] = G;
  console.log(`${g.padEnd(10)} ${String(G.n).padStart(4)}장 · png ${(G.png / 1e6).toFixed(2)} MB → webp ${(G.webp / 1e6).toFixed(2)} MB (${(G.webp / Math.max(1, G.png) * 100).toFixed(1)}%) · 화소 같음(잠금 자) ${G.same}/${G.n} · png 잠금표 대조 ${G.lockHit}/${G.lockN}`);
}
fs.rmSync(TMP, { recursive: true, force: true });
rows.sort((a, b) => b.png - a.png);
out.top = rows.slice(0, 20);
console.log('큰 순 열:');
for (const r of rows.slice(0, 10)) console.log(`  ${r.g}/${r.f} ${(r.png / 1e3).toFixed(0)} KB → ${(r.webp / 1e3).toFixed(0)} KB · 화소 같음 ${r.same} · 잠금 ${r.lock}`);
const oi = process.argv.indexOf('--out');
if (oi >= 0) { fs.writeFileSync(path.join(ROOT, process.argv[oi + 1]), JSON.stringify(out, null, 1)); console.log('적음', process.argv[oi + 1]); }
