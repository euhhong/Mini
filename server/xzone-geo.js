'use strict';
// =============================================================================
// server/xzone-geo.js — 두 존을 합친 지형의 걸음 (T533 · 2026-09-30 · 세션3)
//
// ★무엇: 이웃한 두 존의 마을 쌍마다 ① **걸음 거리**(정본 교역 BFS — `computeAndInjectDistMatrix` 그대로)와
//   ② **경계 칸·두 구간 길**(정본 교역로 A\* — `computeRoutePts` 그대로)을 낸다. 두 존 사각을 합치고 칸마다
//   **그 칸의 주인 존** 어댑터에 묻는다(새 판정 0 · 다리 칸은 존 설정 `bridges`).
// ★누가: 존 서버의 경계 호스트(`server/xzone.js` — **워커 스레드**로 띄운다: 합친 BFS 가 12~76 초라 틱을 막으면 안 된다)와
//   자(`scripts/t525-cross-zone.js` — 같은 프로세스). **한 벌**이다(T525 자에 있던 것을 여기로 옮겼다 · 사본 0).
// ★정적이다: 지형·다리는 기동 뒤 안 바뀐다(T333) — 마을 명부가 바뀔 때만 다시 잰다.
//   ⚠땅 원판은 제 존으로 자른 채 둔다(PM 결정 #456 — 이웃 지형 질의는 재민) — 여기는 **길**만 잰다.
//
// 단위: 칸(셀) = SZ px · econ 거리 = 칸 × 2.5(`ev.coord` 문법) · 명부 = [{ name, cx, cy }](제 존 로컬 칸 — 마을 중심).
// =============================================================================
const path = require('path');

let _M = null;
// 모듈은 **부를 때** 싣는다 — 존 서버 본 스레드는 이 파일을 싣지 않는다(워커만).
function _mods() {
  if (_M) return _M;
  const _l = console.log, _w = console.warn; console.log = () => {}; console.warn = () => {};
  try {
    const ZC = require('./zone-config');
    const T = require('./terrain'); if (T.setZonesMeta) T.setZonesMeta(ZC.ZONES);
    const P = require('./villages').__labProbe;
    const econ = require('../sim/economy-sim');
    _M = { ZONES: ZC.ZONES, findZoneAt: ZC.findZoneAt, T, P, econ, SZ: P.SZ, chunk: require('./chunk') };
  } finally { console.log = _l; console.warn = _w; }
  return _M;
}
const _quiet = (f) => { const _l = console.log, _w = console.warn; console.log = () => {}; console.warn = () => {}; try { return f(); } finally { console.log = _l; console.warn = _w; } };

// ── 존 하나의 정적 어댑터 — 존 서버의 통행 정본(`zone.js isTerrainBlockedLocal`)과 같은 뜻:
//   바위 · 물(손그림 강·호수 + 해안선 띠) · 존 밖 = 막힘 · 물 위 다리 칸 = 열림(`ZONE.bridges`).
//   ⚠해안선 띠 `coast`: 존 서버는 **늘** 본다(`WATER_TILES`) · t17 계보 자는 한반도 끔(`T17_COAST` 기본 — T407) ⇒ 부르는 쪽이 준다.
function zoneAdapter(Z, opts) {
  const { ZONES, findZoneAt, T, P, SZ, chunk } = _mods();
  const ZONE = ZONES[Z];
  if (!ZONE) throw new Error(`xzone-geo: 모르는 존 ${Z}`);
  P.setZoneId(Z);
  const _in = (x, y) => !(x < 0 || y < 0 || x >= ZONE.zoneWidth || y >= ZONE.zoneHeight);
  const coast = (opts && opts.coast != null) ? !!opts.coast
    : (process.env.T17_COAST !== undefined ? process.env.T17_COAST === '1' : (Z !== 'hanbando'));
  const BAND = coast ? chunk.generateCoastlineWaterTiles({ ...ZONE, id: Z }, SZ, findZoneAt,
    Object.values(ZONES).filter((z) => z.isOcean).map((z) => ({ x0: z.worldOffsetX, y0: z.worldOffsetY, x1: z.worldOffsetX + z.zoneWidth, y1: z.worldOffsetY + z.zoneHeight }))) : null;
  const isW = (x, y) => { if (ZONE.isOcean) return true; if (!_in(x, y)) return false; const tx = Math.floor(x / SZ), ty = Math.floor(y / SZ);
    if (BAND && BAND.has(`${tx}_${ty}`)) return true; try { return !!T.isWaterCellLocal(Z, tx * SZ + SZ / 2, ty * SZ + SZ / 2); } catch { return false; } };
  const isR = (x, y) => { if (!_in(x, y)) return false; try { return !!T.isRockCellLocal(Z, x, y); } catch { return false; } };
  const BR = new Set(); { const bl = ZONE.bridges || []; for (let i = 0; i + 1 < bl.length; i += 2) BR.add(bl[i] + '_' + bl[i + 1]); }
  const deps = { isTerrainBlockedLocal: (x, y) => !_in(x, y) || isR(x, y) || isW(x, y), isWaterTileLocal: isW };
  if (BR.size) deps.isBridgeLocal = (x, y) => BR.has(Math.floor(x / SZ) + '_' + Math.floor(y / SZ));   // 존 서버 `isBridgeTileLocal` 과 같은 뜻
  return { ZONE, ta: P.makeTerrainAdapter(T, ZONE, deps) };
}
// 두 존을 합친 사각 — 칸마다 **그 칸의 주인 존** 어댑터에 묻는다(합친 지형 · 새 판정 0).
function unionAdapter(zs, opts) {
  const { SZ } = _mods();
  const Zs = zs.map((Z) => ({ Z, ...zoneAdapter(Z, opts) }));
  const x0 = Math.min(...Zs.map((o) => o.ZONE.worldOffsetX)), y0 = Math.min(...Zs.map((o) => o.ZONE.worldOffsetY));
  const x1 = Math.max(...Zs.map((o) => o.ZONE.worldOffsetX + o.ZONE.zoneWidth)), y1 = Math.max(...Zs.map((o) => o.ZONE.worldOffsetY + o.ZONE.zoneHeight));
  const cx0 = x0 / SZ, cy0 = y0 / SZ;
  const own = (cx, cy) => { const ax = (cx + cx0) * SZ + SZ / 2, ay = (cy + cy0) * SZ + SZ / 2;
    for (const o of Zs) if (ax >= o.ZONE.worldOffsetX && ay >= o.ZONE.worldOffsetY && ax < o.ZONE.worldOffsetX + o.ZONE.zoneWidth && ay < o.ZONE.worldOffsetY + o.ZONE.zoneHeight) return o;
    return null; };
  const loc = (o, cx, cy) => [cx + cx0 - o.ZONE.worldOffsetX / SZ, cy + cy0 - o.ZONE.worldOffsetY / SZ];
  const ta = {
    isBlocked: (cx, cy) => { const o = own(cx, cy); if (!o) return true; const [lx, ly] = loc(o, cx, cy); return o.ta.isBlocked(lx, ly); },
    isWater: (cx, cy) => { const o = own(cx, cy); if (!o) return false; const [lx, ly] = loc(o, cx, cy); return o.ta.isWater(lx, ly); },
    isBridgeCell: (cx, cy) => { const o = own(cx, cy); if (!o) return false; const [lx, ly] = loc(o, cx, cy); return o.ta.isBridgeCell(lx, ly); },
  };
  return { ta, ZONE: { zoneWidth: x1 - x0, zoneHeight: y1 - y0 }, x0, y0, cx0, cy0, Zs };
}
// 정본 교역 BFS(`computeAndInjectDistMatrix`)를 **그대로** 부른다 — 마을 좌표 = 셀 × 2.5(econ 단위).
function bfsMatrix(ta, ZONE, coords) {
  const { P, econ } = _mods();
  const world = { villages: coords.map((c, i) => ({ name: 'v' + i, coord: { x: c.x, y: c.y } })) };
  _quiet(() => { P._distProbe.setup(ta, ZONE, world, econ); P._distProbe.compute('xzone'); });
  return world._distMatrix;
}

// ── 경계 칸 — 합친 길(px · 합친 사각 원점)이 A 사각을 **마지막으로** 나가는 자리.
//   길이 경계를 여러 번 스치면(경계를 따라 걷는 길) 마지막 넘김을 쓰고, 두 구간의 점은 제 존 사각 안으로 붙인다
//   (몸은 제 존 밖에 설 수 없다 — 한 칸 안쪽 · 경계 칸 = 존 사각 그대로 · 새 수 0).
function _splitRoute(pts, rA, rB) {
  const inR = (p, r) => p.x >= r.x0 && p.y >= r.y0 && p.x < r.x1 && p.y < r.y1;
  let k = -1;
  for (let i = 1; i < pts.length; i++) if (inR(pts[i - 1], rA) && !inR(pts[i], rA)) k = i;
  if (k < 0) return null;
  const a = pts[k - 1], b = pts[k];
  // 선분 a→b 가 A 사각을 나가는 t(축마다 한 번 — 경계는 사각의 변이다)
  let t = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx > 0 && b.x >= rA.x1) t = Math.min(t, (rA.x1 - a.x) / dx);
  if (dx < 0 && b.x < rA.x0) t = Math.min(t, (rA.x0 - a.x) / dx);
  if (dy > 0 && b.y >= rA.y1) t = Math.min(t, (rA.y1 - a.y) / dy);
  if (dy < 0 && b.y < rA.y0) t = Math.min(t, (rA.y0 - a.y) / dy);
  const cx = a.x + dx * t, cy = a.y + dy * t;
  const clampTo = (p, r) => ({ x: Math.min(r.x1 - 1, Math.max(r.x0, p.x)), y: Math.min(r.y1 - 1, Math.max(r.y0, p.y)) });
  const cA = clampTo({ x: cx, y: cy }, rA), cB = clampTo({ x: cx, y: cy }, rB);
  const partA = pts.slice(0, k).map((p) => clampTo(p, rA)); partA.push(cA);
  const partB = [cB].concat(pts.slice(k).map((p) => clampTo(p, rB)));
  const len = (q) => { let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y); return L; };
  return { cross: { x: cx, y: cy }, partA, partB, lenA: len(partA), lenB: len(partB), multi: pts.slice(k).some((p) => inR(p, rA)) };
}

// ── 두 존 걸음표 — { dist: { a: { b: econ 거리 } }, split: { a: { b: { fA, ptA, ptB, ptsA, ptsB } } } }
//   rosterA/B = [{ name, cx, cy }](제 존 로컬 칸) · infoR = econ `infoRange` · splitR = 경계 칸·길을 낼 거리 상한(econ)
//   ptA/ptsA 는 **A 로컬 px** · ptB/ptsB 는 **B 로컬 px**(받는 존이 제 좌표로 몸을 세운다).
//   ★[T1139] 틀(합친 어댑터 · 마을 줄 · 두 사각)과 쌍 하나의 길을 꺼냈다(`_frame` · `_pairSplit`) — 늦게 파는 일꾼(`lazySplit`)이
//     **같은 두 함수**를 부른다(사본 0). 답은 글자 그대로다(같은 차례 · 같은 식).
function _frame(q) {
  const { ZONES, SZ } = _mods();
  const A = q.A, B = q.B, rA = q.rosterA || [], rB = q.rosterB || [];
  const U = unionAdapter([A, B], { coast: q.coast });
  const offA = { x: ZONES[A].worldOffsetX - U.x0, y: ZONES[A].worldOffsetY - U.y0 };
  const offB = { x: ZONES[B].worldOffsetX - U.x0, y: ZONES[B].worldOffsetY - U.y0 };
  const vil = [];
  for (const v of rA) vil.push({ z: A, name: v.name, ux: v.cx + offA.x / SZ, uy: v.cy + offA.y / SZ });
  for (const v of rB) vil.push({ z: B, name: v.name, ux: v.cx + offB.x / SZ, uy: v.cy + offB.y / SZ });
  const recA = { x0: offA.x, y0: offA.y, x1: offA.x + ZONES[A].zoneWidth, y1: offA.y + ZONES[A].zoneHeight };
  const recB = { x0: offB.x, y0: offB.y, x1: offB.x + ZONES[B].zoneWidth, y1: offB.y + ZONES[B].zoneHeight };
  return { A, B, rA, rB, U, offA, offB, vil, nA: rA.length, recA, recB };
}
const _frameBfs = (F) => bfsMatrix(F.U.ta, F.U.ZONE, F.vil.map((v) => ({ x: v.ux * 2.5, y: v.uy * 2.5 })));
// 쌍 하나(i = A 마을 · j = B 마을 — `vil` 번호)의 경계 칸·두 구간 길 — 정본 교역로 A\*(`computeRoutePts`) · 못 판 쌍 = null
function _pairSplit(F, i, j) {
  const { P, SZ } = _mods();
  const { vil, offA, offB } = F;
  const px = (v) => ({ x: (v.ux + 0.5) * SZ, y: (v.uy + 0.5) * SZ });
  const a = px(vil[i]), b = px(vil[j]);
  const pts = _quiet(() => P._routeProbe.pts(a.x, a.y, b.x, b.y));
  const sp = pts ? _splitRoute(pts, F.recA, F.recB) : null;
  if (!sp) return null;
  const toA = (p) => ({ x: Math.round(p.x - offA.x), y: Math.round(p.y - offA.y) });
  const toB = (p) => ({ x: Math.round(p.x - offB.x), y: Math.round(p.y - offB.y) });
  const fA = (sp.lenA + sp.lenB) > 0 ? sp.lenA / (sp.lenA + sp.lenB) : 0.5;
  return { multi: sp.multi, e: {
    fA: +fA.toFixed(4), ptA: toA(sp.partA[sp.partA.length - 1]), ptB: toB(sp.partB[0]),
    ptsA: sp.partA.map(toA), ptsB: sp.partB.map(toB),
  } };
}
function crossGeo(q) {
  const { P } = _mods();
  const t0 = Date.now();
  const F = _frame(q);
  const { A, B, rB, vil, nA } = F;
  const M = _frameBfs(F);
  const bfsMs = Date.now() - t0;
  const dist = {};
  for (let i = 0; i < nA; i++) {
    const row = dist[vil[i].name] = {};
    for (let j = nA; j < vil.length; j++) { const d = M[i][j]; row[vil[j].name] = (d == null || !isFinite(d)) ? null : +(+d).toFixed(1); }
  }
  // 경계 칸·두 구간 길 — 정본 교역로 A\*(`computeRoutePts`)를 합친 격자 위에서(같은 어댑터 · 같은 격자)
  const t1 = Date.now();
  const splitR = q.splitR != null ? q.splitR : Infinity;
  const split = {};
  let routed = 0, multi = 0, failed = 0;
  _quiet(() => P._routeProbe.reset());
  for (let i = 0; i < nA; i++) for (let j = nA; j < vil.length; j++) {
    const d = dist[vil[i].name][vil[j].name];
    if (d == null || !(d <= splitR)) continue;
    const s = _pairSplit(F, i, j);
    if (!s) { failed++; continue; }
    routed++; if (s.multi) multi++;
    (split[vil[i].name] || (split[vil[i].name] = {}))[vil[j].name] = s.e;
  }
  _quiet(() => P._routeProbe.reset());
  return { A, B, nA, nB: rB.length, dist, split, ms: { bfs: bfsMs, route: Date.now() - t1 }, routed, multi, failed };
}

// ── ★★[T662 2026-10-08] **한 벌을 한 번만 잰다** — 손잡이 `T662_GEO_CACHE`(★기본 켬 · `=0` = 종전: 워커마다 제가 잰다)
//   T655 회부 ②의 670초는 e2e(한 상자에 central + 한반도 + 닛폰)에서 잰 값이다. 두 존 호스트가 **같은 질문**(A<B · 같은 명부 · 같은 지형)을
//   **각자 워커로** 잰다(T533 설계 "두 존이 같은 한 벌") — 2코어 상자에선 같은 계산 둘이 존 서버 둘과 코어를 나눠 쓴다.
//   ⇒ 답을 **질문의 지문**(아래 `_geoKey`)으로 파일에 적고, 같은 지문을 먼저 잡은 워커가 재는 동안 다른 워커는 **기다렸다 읽는다**:
//     ⓐ 파일이 있으면 읽는다(재기동 · 같은 상자의 이웃 존) ⓑ 없으면 잠금 파일을 잡은(`wx` — 하나만 이긴다) 워커가 재고 적는다
//     ⓒ 못 잡은 워커는 파일이 설 때까지 기다린다 — 잠금 주인 프로세스가 죽었으면(`kill(pid, 0)` ESRCH) 잠금을 걷고 제가 잰다.
//   ★답은 바이트 같다 — 같은 함수(`crossGeo`)가 낸 같은 객체를 JSON 으로 적고 읽는다(dist · split 의 수는 유한 · 정수/소수 그대로 왕복).
//     `ms` 만 그 판의 것(읽은 판은 `cache` 칸에 'hit' · 'wait' 을 적고 bfs/route 는 0 — 잰 일이 없다).
//   ★지문 = 질문(A · B · 두 명부 · coast · splitR) + 손잡이 env(`T<번호>_*` · `VILLAGE_*` · `TERRAIN_*` — 존마다 다른 `ZONE_ID`·`DB_PATH` 는 뺀다)
//     + 워커가 실은 **모든 모듈 파일의 내용**(`require.cache` — 지형 JSON · zone-config · villages · path-core … 하나라도 바뀌면 다른 지문).
//   자리: `T662_GEO_CACHE_DIR`(없으면 OS 임시 폴더 `durango-xzone-geo`) · 같은 존 쌍의 옛 파일은 새 파일을 적을 때 지운다(쌍마다 하나).
//   ⚠다른 상자(실서버 — 존마다 제 호스트)에선 나누지 못한다(파일이 안 보인다) — 그 판은 재기동 때 ⓐ 만 산다.
const T662_GEO_CACHE = process.env.T662_GEO_CACHE !== '0';
function _geoKey(q) {
  const fs = require('fs'), crypto = require('crypto');
  _mods(); try { require('./hanbando-terrain.json'); } catch (e) {}
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify({ A: q.A, B: q.B, rosterA: q.rosterA, rosterB: q.rosterB, coast: q.coast, splitR: q.splitR == null ? null : q.splitR }));
  for (const k of Object.keys(process.env).filter((k) => /^(T\d+_|VILLAGE_|TERRAIN_)/.test(k)).sort()) h.update(`\n${k}=${process.env[k]}`);
  for (const f of Object.keys(require.cache).filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`)).sort()) {
    try { h.update(`\n${path.relative(path.join(__dirname, '..'), f)}:`); h.update(fs.readFileSync(f)); } catch (e) {}
  }
  return h.digest('hex').slice(0, 24);
}
function sharedCrossGeo(q) {
  if (!T662_GEO_CACHE) return crossGeo(q);
  const fs = require('fs'), os = require('os');
  const dir = process.env.T662_GEO_CACHE_DIR || path.join(os.tmpdir(), 'durango-xzone-geo');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return crossGeo(q); }
  const pre = `${q.A}+${q.B}.`, key = _geoKey(q);
  const file = path.join(dir, `${pre}${key}.json`), lock = path.join(dir, `${pre}${key}.lock`);
  const read = (how) => { try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); r.ms = { bfs: 0, route: 0 }; r.cache = how; return r; } catch (e) { return null; } };
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  const nap = new Int32Array(new SharedArrayBuffer(4));
  for (let waited = false; ;) {
    const hit = read(waited ? 'wait' : 'hit'); if (hit) return hit;
    let fd = -1;
    try { fd = fs.openSync(lock, 'wx'); } catch (e) { if (e.code !== 'EEXIST') return crossGeo(q); }
    if (fd >= 0) {
      try {
        fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
        const again = read(waited ? 'wait' : 'hit'); if (again) return again;   // 잠금을 잡는 사이 다른 워커가 다 적고 풀었다
        const r = crossGeo(q);
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(r)); fs.renameSync(tmp, file);
        for (const f of fs.readdirSync(dir)) if (f.startsWith(pre) && f.endsWith('.json') && path.join(dir, f) !== file) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} }
        r.cache = 'made';
        return r;
      } finally { try { fs.unlinkSync(lock); } catch (e) {} }
    }
    let pid = 0; try { pid = parseInt(fs.readFileSync(lock, 'utf8'), 10) || 0; } catch (e) {}
    if (pid && !alive(pid)) { try { fs.unlinkSync(lock); } catch (e) {} continue; }   // 잠금 주인이 죽었다 — 걷고 다시 잡는다
    waited = true;
    Atomics.wait(nap, 0, 0, 1000);   // 이웃 워커가 재는 중 — 1초씩 기다린다(워커 스레드라 존 틱은 안 막힌다)
  }
}

// ── ★★[T1139 2026-11-03 · ★PM 판정대기 문 20 ⓒ] **물은 쌍만 판다** — 하네스 전용(존 서버 손잡이 `T1139_XZ_LAZY` · 기본 끔 = 종전 한 벌)
//   T682 §3: 걸음표 길 시간의 69%가 끝내 못 판 먼 쌍 753 이다. econ 이 경계 칸·길(`split`)을 묻는 쌍은 둘뿐이다 —
//     ⓐ 떠날 때(`_XZ.split(제 마을, 스텁)` — 걸음 ≤ infoRange 일 때만 · `economy-sim-v2` 교역 고리 `dist > infoR` 거름 뒤)
//     ⓑ 돌아갈 때(`X.split(c.to, c.from)` · 몸 길 `splitNames` — 우회(재routing)로 닿은 마을이면 ⓐ 밖의 쌍일 수 있다)
//   ⇒ 한 벌은 `splitR = infoRange`(ⓐ 전부 · `setGeo` 의 '2km 안' 셈 전부)로 미리 판다. 그 밖의 쌍은 **물을 때** 이 일꾼이 판다(같은 틀 ·
//     같은 BFS 뒤 · 같은 `_pairSplit`) — 답은 미리 판 한 벌의 그 쌍과 글자 같다(`scripts/t1139-lazy-proof.js` 가 전 쌍을 거꾸로 물어 `cmp`).
//   묻는 쪽(존 본 스레드 · 자 워커)은 답이 올 때까지 기다린다(`Atomics.wait` — econ 이 `split` 을 동기로 읽는다 · 몸 없는 캐러밴 0).
//   일꾼은 만들 때 바로 띄워 틀을 데운다(처음 묻는 틱이 틀 굽는 시간을 기다리지 않게). 하네스 아닌 판은 이 함수를 안 부른다.
//   q = 한 벌을 판 그 질문(`splitR` 이 든) · r = 그 답 · opt.env = 일꾼 env · opt.onAsk(a, b, e, ms) = 물은 쌍마다(관측)
function lazySplit(q, r, opt) {
  opt = opt || {};
  const { Worker, MessageChannel, receiveMessageOnPort } = require('worker_threads');
  const splitR = q.splitR != null ? q.splitR : Infinity;
  const rA = q.rosterA || [], rB = q.rosterB || [], nA = rA.length;
  const idA = new Map(rA.map((v, i) => [v.name, i])), idB = new Map(rB.map((v, j) => [v.name, nA + j]));
  const ch = new MessageChannel(), sab = new SharedArrayBuffer(4), flag = new Int32Array(sab), port = ch.port1;
  const wk = new Worker(__filename, { workerData: { xzoneLazy: { q, port: ch.port2, flag: sab } }, transferList: [ch.port2],
    env: opt.env || process.env, stdout: true, stderr: true });
  wk.stdout.resume(); wk.stderr.resume(); wk.on('error', () => {}); wk.unref();
  const memo = new Map();
  const st = { asked: 0, found: 0, ms: 0, wallMs: 0 };
  function get(a, b) {
    const s = r.split[a] && r.split[a][b];
    if (s) return s;
    const d = r.dist[a] ? r.dist[a][b] : undefined;
    if (d == null || d <= splitR || !idA.has(a) || !idB.has(b)) return null;   // 한 벌이 판 쌍(못 판 쌍 = 빈손) · 걸음 없는 쌍 = 종전 그대로
    const k = a + '\u0000' + b;
    if (memo.has(k)) return memo.get(k);
    const t0 = Date.now();
    Atomics.store(flag, 0, 0);
    port.postMessage({ i: idA.get(a), j: idB.get(b) });
    let m;
    for (;;) { m = receiveMessageOnPort(port); if (m) break; Atomics.wait(flag, 0, 0); Atomics.store(flag, 0, 0); }
    const o = m.message;
    if (!o.ok) throw new Error(`xzone-geo 늦게 파기 실패(${a}+${b}): ${o.err}`);
    const e = o.e || null;
    memo.set(k, e);
    st.asked++; if (e) st.found++; st.ms += o.ms; st.wallMs += Date.now() - t0;
    if (opt.onAsk) opt.onAsk(a, b, e, o.ms);
    return e;
  }
  return { get, st, close: () => { try { wk.terminate(); } catch (e) {} } };
}

module.exports = { zoneAdapter, unionAdapter, bfsMatrix, crossGeo, sharedCrossGeo, lazySplit, _geoKey, _splitRoute, _frame, _pairSplit, _mods };

// ── 워커 입구 — 존 서버 경계 호스트가 `new Worker(__filename, { workerData: { xzoneGeo: q } })` 로 띄운다 ──
{
  let wt = null; try { wt = require('worker_threads'); } catch (e) {}
  // ★[T1139] 늦게 파는 일꾼 — 틀 · BFS(한 벌을 판 일꾼과 같은 차례) 뒤 물음마다 쌍 하나(`_pairSplit`)
  if (wt && !wt.isMainThread && wt.workerData && wt.workerData.xzoneLazy) {
    const L = wt.workerData.xzoneLazy, flag = new Int32Array(L.flag);
    let F = null, err = null;
    try { F = _frame(L.q); _frameBfs(F); _quiet(() => _mods().P._routeProbe.reset()); } catch (e) { err = String(e && e.stack || e); }
    L.port.on('message', (m) => {
      let out;
      try { if (err) throw new Error(err); const t = Date.now(); const s = _pairSplit(F, m.i, m.j); out = { ok: true, e: s ? s.e : null, ms: Date.now() - t }; }
      catch (e) { out = { ok: false, err: String(e && e.stack || e) }; }
      L.port.postMessage(out); Atomics.store(flag, 0, 1); Atomics.notify(flag, 0);
    });
  }
  if (wt && !wt.isMainThread && wt.workerData && wt.workerData.xzoneGeo) {
    let out;
    try { out = { ok: true, r: sharedCrossGeo(wt.workerData.xzoneGeo) }; } catch (e) { out = { ok: false, err: String(e && e.stack || e) }; }
    wt.parentPort.postMessage(out);
  }
}
