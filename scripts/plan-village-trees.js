#!/usr/bin/env node
// === scripts/plan-village-trees.js — 마을 둘레 **흩어진 나무** 굽기(T1107 · ★재민 11-02 문 7-b) ==========
//
// ★왜 — 재민 11-02: "명시적 '숲'이 아니어도 마을 근처에 나무는 충분히 많았으면 · 나무가 과해서 평야가 좁아 보일까 걱정".
//   T717 ①: 평형 몫이 땔감 수요를 대는 마을은 숲이 있는 마을뿐이다(land.wood < 0.6 28곳은 수요의 6%).
//   ⇒ 숲 덩어리를 새로 그리지 않고, 마을 둘레(영토 밖 · 반경 R = 영토 + 40셀 — 카드가 준 수)에 **외딴 나무 · 작은 나무 무리 · 밭둑 나무줄**을 놓는다.
//
// ★밀도 셋은 지어내지 않는다 — **이 지도에서 숲이 있는 마을들이 이미 가진 둘레 밀도**다(같은 고리 · 같은 생성기):
//     둘레 밀도 = 그 마을 고리(영토 밖 0 ~ 40셀 · 뭍 칸) 안 선 나무(`chunk.generateChunkResources` 시딩 날 원판) ÷ 고리 뭍 칸
//     낮음 = land.wood 0.6 ~ 1.0 마을들의 중앙 · 중간 = 1.0 ~ 1.6 마을들의 중앙 · 높음 = ≥ 1.6 마을들의 중앙
//     (land.wood 칸 경계 0.6 · 1.0 · 1.6 은 T717 ①-3 표의 그 경계 — 새 수 0)
//   마을마다 고리 밀도가 그 값에 못 미치면 모자란 그루만큼 놓는다(넘는 마을은 0 — 이미 숲 마을이다).
//   셋은 **겹친 꼴**이다 — 마을마다 한 줄의 차례로 굽고 낮음 = 앞 n낮음 · 중간 = 앞 n중간 · 높음 = 앞 n높음(그림이 서로 견줘진다).
//
// ★모양(재민 "숲 덩어리가 아니다") — 고리 안 자리(셀)를 씨 해시로 고르고, 자리마다 셋 중 하나(해시 몫 · 같은 몫):
//     외딴 나무 1 그루 · 작은 나무 무리(극좌표 r·√u — `plan-village-forage` 군락 꼴 · 점 `GROVE_N` 3 · 반경 `GROVE_R` 110px) ·
//     밭둑 나무줄(영토 가장자리 접선 방향 한 줄 · 그루 `GROVE_N` 3 · 간격 `FOREST_SP_MIN` 60px = 숲 격자 최소 간격).
//   어느 나무도 다른 나무(원판 · 이미 놓은 것)와 `FOREST_SP_MIN` 안에 서지 않는다 · 물 · 바위 · 어느 마을 영토 · 존 밖 칸에는 안 선다.
//   (3 · 110 · 60 은 남의 정본 수 — `plan-village-forage.js` GROVE_N · GROVE_R · `chunk.js` FOREST_SP_MIN)
//
// ★결정론 · 주사위 0 — 자리는 `chunk.seedRand(존, 800000 + 마을 번호, 차례, ·)` 로만 정해진다(다시 구우면 같은 파일).
// ★데이터 손편집 금지 — 이 스크립트가 `server/village-trees-<존>.json` 을 통째로 쓴다(`--apply`). 실체화는 `chunk.js`(손잡이 `T1107_VILLAGE_TREES`).
//
// 실행: node scripts/plan-village-trees.js [--zone hanbando] [--seeds <LAB_SEEDCACHE>] [--apply]
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const R = (p) => require(path.join(ROOT, p));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const APPLY = argv.includes('--apply');
const Z = arg('--zone', 'hanbando');

const { ZONES } = R('server/zone-config');
const T = R('server/terrain'); if (T.setZonesMeta) T.setZonesMeta(ZONES);
const C = R('server/chunk');
const VillageLayout = R('server/village-layout');
const Villages = R('server/villages');
const P = Villages.__labProbe;
const ZONE = ZONES[Z], SZ = P.SZ, CS = C.CHUNK_SIZE;
P.setZoneId(Z);

const RING = 40;                 // ★카드가 준 수 — 마을 둘레 반경 R = 영토 + 40셀
const GROVE_N = 3, GROVE_R = 110; // ★`plan-village-forage.js` 의 군락 꼴(점 셋 · 반경 110px)
const SP_MIN = 60;               // ★`chunk.js FOREST_SP_MIN` — 숲 격자 최소 간격(px)
const WOOD_BANDS = [[0.6, 1.0, 'low'], [1.0, 1.6, 'mid'], [1.6, Infinity, 'high']];   // ★T717 ①-3 표의 land.wood 경계

// ── 지형 어댑터 — `t702-forest-audit` · `t17-metrics` 와 같은 술어 ──
const _inZone = (x, y) => !(x < 0 || y < 0 || x >= ZONE.zoneWidth || y >= ZONE.zoneHeight);
const isWaterTileLocal = (x, y) => {
  if (!_inZone(x, y)) return false;
  const tx = Math.floor(x / SZ), ty = Math.floor(y / SZ);
  try { return !!T.isWaterCellLocal(Z, tx * SZ + SZ / 2, ty * SZ + SZ / 2); } catch { return false; }
};
const isRockTileLocal = (x, y) => { if (!_inZone(x, y)) return false; try { return !!T.isRockCellLocal(Z, x, y); } catch { return false; } };
const isTerrainBlockedLocal = (x, y) => (!_inZone(x, y)) ? true : (isRockTileLocal(x, y) || isWaterTileLocal(x, y));
const _t601 = R('server/streams').rulerDeps(Z, { isTerrainBlockedLocal, isWaterTileLocal });
const ta = P.makeTerrainAdapter(T, ZONE, _t601.deps);

// ── 마을 — `t702-forest-audit` 와 같은 길(캐시가 있으면 그것) ──
let seeds = null;
const SEEDF = arg('--seeds', '');
if (SEEDF && fs.existsSync(SEEDF)) {
  seeds = JSON.parse(fs.readFileSync(SEEDF, 'utf8'));
  if (((seeds[0] && seeds[0].t601s) || '') !== _t601.sig) { console.log('  ⚠ 캐시 개울 표식이 다르다 — 다시 굽는다'); seeds = null; }
}
if (!seeds) {
  const hard = T.getZoneVillages(Z) || [];
  const picked = P.pickSeedVillages(hard, ta, { seedAll: !!ZONE.seedAllVillages, max: ZONE.villageMax || 0 });
  seeds = [];
  for (const hv of picked) {
    const c = P.findOpenCenter(ta, Math.round(hv.x / SZ), Math.round(hv.y / SZ));
    if (!c) continue;
    let layout;
    try { if (ta.prepareFert) ta.prepareFert(c.ccx, c.ccy, 62); layout = VillageLayout.generate(ta, c.ccx, c.ccy, P.INITIAL_POP, {}); } catch (e) { continue; }
    const lp = P.extractLandParamsApprox(ta, c.ccx, c.ccy, layout);
    seeds.push({ name: hv.name, ccx: c.ccx, ccy: c.ccy, lp, layout: { territory: layout.territory } });
  }
}
const terrAll = new Set();
for (const s of seeds) for (const c of (s.layout.territory || [])) terrAll.add(c[0] * 65536 + c[1]);
const blockedCell = (cx, cy) => { const x = cx * SZ + SZ / 2, y = cy * SZ + SZ / 2; return !_inZone(x, y) || isWaterTileLocal(x, y) || isRockTileLocal(x, y) || terrAll.has(cx * 65536 + cy); };

// ── 원판 나무(시딩 날 · 장부 없음) — 청크 단위로 한 번씩 ──
const chunkTrees = new Map();
function treesOfChunk(kx, ky) {
  const k = kx + ',' + ky;
  if (chunkTrees.has(k)) return chunkTrees.get(k);
  let out = [];
  try { out = C.generateChunkResources(Z, ZONE.biome, kx, ky, CS, null, undefined).filter((r) => r.type === 'tree').map((r) => [r.x, r.y]); } catch (e) { out = []; }
  chunkTrees.set(k, out);
  return out;
}

// ── 마을마다 고리(영토 밖 · 영토까지 유클리드 ≤ RING 셀 · 뭍 칸) ──
function ringOf(s) {
  const terr = s.layout.territory || [];
  const own = new Set(terr.map((c) => c[0] * 65536 + c[1]));
  // 가장자리 칸만 거리 셈에 쓴다(안쪽 칸은 가장자리보다 가깝지 않다)
  const edge = terr.filter((c) => !(own.has((c[0] + 1) * 65536 + c[1]) && own.has((c[0] - 1) * 65536 + c[1]) && own.has(c[0] * 65536 + c[1] + 1) && own.has(c[0] * 65536 + c[1] - 1)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of terr) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }
  if (!terr.length) { x0 = x1 = s.ccx; y0 = y1 = s.ccy; edge.push([s.ccx, s.ccy]); }
  const cells = [];   // [cx, cy, 가장 가까운 가장자리 칸 dx, dy(접선 방향용)]
  for (let cy = y0 - RING; cy <= y1 + RING; cy++) {
    for (let cx = x0 - RING; cx <= x1 + RING; cx++) {
      if (own.has(cx * 65536 + cy)) continue;
      let best = Infinity, bx = 0, by = 0;
      for (const e of edge) { const dx = cx - e[0], dy = cy - e[1], d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bx = dx; by = dy; } }
      if (best > RING * RING) continue;
      if (blockedCell(cx, cy)) continue;
      cells.push([cx, cy, bx, by]);
    }
  }
  return { cells, x0: x0 - RING, y0: y0 - RING, x1: x1 + RING, y1: y1 + RING };
}

const t0 = Date.now();
const rows = [];
for (let vi = 0; vi < seeds.length; vi++) {
  const s = seeds[vi];
  const ring = ringOf(s);
  const inRing = new Set(ring.cells.map((c) => c[0] * 65536 + c[1]));
  // 고리 안 원판 나무
  const pts = [];
  const kx0 = Math.floor(ring.x0 * SZ / CS), kx1 = Math.floor((ring.x1 + 1) * SZ / CS), ky0 = Math.floor(ring.y0 * SZ / CS), ky1 = Math.floor((ring.y1 + 1) * SZ / CS);
  for (let ky = ky0; ky <= ky1; ky++) for (let kx = kx0; kx <= kx1; kx++) for (const p of treesOfChunk(kx, ky)) pts.push(p);
  let have = 0;
  for (const p of pts) if (inRing.has(Math.floor(p[0] / SZ) * 65536 + Math.floor(p[1] / SZ))) have++;
  rows.push({ vi, name: s.name, wood: (s.lp && s.lp.wood) || 0, ccx: s.ccx, ccy: s.ccy, terr: (s.layout.territory || []).length, ringLand: ring.cells.length, have, dens: ring.cells.length ? have / ring.cells.length : 0, ring, pts });
}
// ── 밀도 셋 — 숲 마을 등급의 둘레 밀도 중앙 ──
const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const DENS = {};
for (const [lo, hi, nm] of WOOD_BANDS) {
  const xs = rows.filter((r) => r.wood >= lo && r.wood < hi && r.ringLand > 0).map((r) => r.dens);
  DENS[nm] = { lo, hi: Number.isFinite(hi) ? hi : null, n: xs.length, density: med(xs) || 0 };
}
// ── 놓기 — 마을마다 한 줄의 차례(높음까지) · 낮음 · 중간은 그 앞부분 ──
const near = (list, x, y) => { for (const p of list) { const dx = p[0] - x, dy = p[1] - y; if (dx * dx + dy * dy < SP_MIN * SP_MIN) return true; } return false; };
const out = [];
let total = 0;
for (const r of rows) {
  const tgt = {}; for (const nm of ['low', 'mid', 'high']) tgt[nm] = Math.max(0, Math.round(DENS[nm].density * r.ringLand) - r.have);
  const need = tgt.high;
  const inRing = new Set(r.ring.cells.map((c) => c[0] * 65536 + c[1]));
  const ringCell = new Map(r.ring.cells.map((c) => [c[0] * 65536 + c[1], c]));
  // 이웃 검사용 격자(셀 → 그 셀 둘레 나무들)
  const grid = new Map();
  const gkey = (x, y) => Math.floor(x / SP_MIN) + ',' + Math.floor(y / SP_MIN);
  const addG = (p) => { const k = gkey(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); };
  const nearG = (x, y) => { const gx = Math.floor(x / SP_MIN), gy = Math.floor(y / SP_MIN); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = grid.get((gx + dx) + ',' + (gy + dy)); if (l && near(l, x, y)) return true; } return false; };
  for (const p of r.pts) addG(p);
  const placed = [];   // [x, y, 모양 0 외딴 · 1 무리 · 2 나무줄]
  //   자리 술어는 `chunk.js` 가 실체화 때 묻는 그 둘(점 자리 물 · 바위)까지 — 굽은 자리가 실체화에서 빠지지 않게
  const ok = (x0, y0) => { const x = Math.round(x0), y = Math.round(y0); const k = Math.floor(x / SZ) * 65536 + Math.floor(y / SZ); return inRing.has(k) && !nearG(x, y) && !T.isWaterCellLocal(Z, x, y) && !(typeof T.isRockCellLocal === 'function' && T.isRockCellLocal(Z, x, y)); };
  const put = (x, y, kind) => { const p = [Math.round(x), Math.round(y), kind]; placed.push(p); addG(p); };
  const cells = r.ring.cells;
  let a = 0;
  const MAXA = cells.length * 4;   // 시도 상한 — 고리 칸 수의 몇 배(자리가 다 차면 멈춘다)
  while (placed.length < need && a < MAXA && cells.length) {
    const u = C.seedRand(Z, 800000 + r.vi, a, 1), ux = C.seedRand(Z, 800000 + r.vi, a, 2), uy = C.seedRand(Z, 800000 + r.vi, a, 3), uk = C.seedRand(Z, 800000 + r.vi, a, 4);
    a++;
    const c = cells[Math.min(cells.length - 1, Math.floor(u * cells.length))];
    const x = c[0] * SZ + ux * SZ, y = c[1] * SZ + uy * SZ;
    const kind = Math.min(2, Math.floor(uk * 3));
    if (kind === 0) { if (ok(x, y)) put(x, y, 0); continue; }
    if (kind === 1) {   // 작은 나무 무리 — 극좌표 r·√u(가운데 촘촘)
      for (let i = 0; i < GROVE_N && placed.length < need; i++) {
        const v1 = C.seedRand(Z, 810000 + r.vi, a * GROVE_N + i, 1), v2 = C.seedRand(Z, 810000 + r.vi, a * GROVE_N + i, 2);
        const rr = GROVE_R * Math.sqrt(v1), th = v2 * Math.PI * 2;
        const px = x + Math.cos(th) * rr, py = y + Math.sin(th) * rr;
        if (ok(px, py)) put(px, py, 1);
      }
      continue;
    }
    // 밭둑 나무줄 — 영토 가장자리 접선(가장 가까운 가장자리 칸 방향의 수직) 한 줄
    const len = Math.hypot(c[2], c[3]) || 1;
    const tx = -c[3] / len, ty = c[2] / len;
    for (let i = 0; i < GROVE_N && placed.length < need; i++) {
      const off = (i - (GROVE_N - 1) / 2) * SP_MIN;
      const px = x + tx * off, py = y + ty * off;
      if (ok(px, py)) put(px, py, 2);
    }
  }
  r.tgt = tgt; r.placed = placed.length;
  total += placed.length;
  out.push({ name: r.name, ccx: r.ccx, ccy: r.ccy, n: { low: Math.min(tgt.low, placed.length), mid: Math.min(tgt.mid, placed.length), high: placed.length }, t: placed });
}

// ── 표 ──
console.log(`\n=== T1107 마을 둘레 흩어진 나무 — ${Z} · 마을 ${rows.length} · 고리 = 영토 밖 ${RING}셀(뭍 · 남의 영토 밖) · ${((Date.now() - t0) / 1000).toFixed(0)}초 ===`);
for (const nm of ['low', 'mid', 'high']) console.log(`  ${nm}: land.wood ${DENS[nm].lo} ~ ${DENS[nm].hi == null ? '' : DENS[nm].hi} 마을 ${DENS[nm].n}곳 둘레 밀도 중앙 ${DENS[nm].density.toFixed(5)} 그루/칸(= ${(1 / Math.max(1e-9, DENS[nm].density)).toFixed(1)}칸당 한 그루)`);
const sum = (k) => out.reduce((a, o) => a + o.n[k], 0);
console.log(`  더한 그루(51마을 합): 낮음 ${sum('low')} · 중간 ${sum('mid')} · 높음 ${sum('high')} · 원판 고리 나무 ${rows.reduce((a, r) => a + r.have, 0)} · 고리 뭍 칸 ${rows.reduce((a, r) => a + r.ringLand, 0)}`);
console.log('\n| 마을 | land.wood | 영토 칸 | 고리 뭍 칸 | 원판 고리 나무(밀도) | 더함 낮음 · 중간 · 높음 |');
console.log('|---|---:|---:|---:|---:|---|');
for (const r of rows) console.log(`| ${r.name} | ${(+r.wood).toFixed(2)} | ${r.terr} | ${r.ringLand} | ${r.have} (${r.dens.toFixed(4)}) | ${out[r.vi].n.low} · ${out[r.vi].n.mid} · ${out[r.vi].n.high} |`);
const doc = { zone: Z, made: 'scripts/plan-village-trees.js', ring: RING, shape: { groveN: GROVE_N, groveR: GROVE_R, spMin: SP_MIN }, bands: WOOD_BANDS.map((b) => [b[0], Number.isFinite(b[1]) ? b[1] : null, b[2]]),
  density: Object.fromEntries(Object.entries(DENS).map(([k, v]) => [k, +v.density.toFixed(6)])), villages: out };
if (APPLY) {
  const f = path.join(ROOT, 'server', `village-trees-${Z}.json`);
  fs.writeFileSync(f, JSON.stringify(doc));
  console.log(`\n→ ${path.relative(ROOT, f)} (${fs.statSync(f).size.toLocaleString('en-US')} B · 그루 ${total})`);
} else console.log('\n(--apply 없음 — 파일 안 씀)');
