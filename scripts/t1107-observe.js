'use strict';
// (@regress 없음 — 러너 밖 · T1107 관찰기 · 읽기만 · 제품 손잡이 0)
// === scripts/t1107-observe.js — 마을 둘레 땅: 트인 땅 · 선 나무 · 벤 자리 · 밭 — 서버 판 자 아이 존 곁 프리로드 ===
//   서버: NODE_OPTIONS="… -r $PWD/scripts/t1107-observe.js" node scripts/t577-server-run.js 800 1020,7,42   (판 JSON 곁 `<판>-<시드>.t1107.json`)
//   찍는 날(`T1107_SNAP` · 기본 2,365,799,1094 — 그 날을 지난 첫 econ 틱 앞에서 한 번 · 판이 그 날까지 안 가면 안 찍는다):
//     마을마다 둘레 땅(영토 ∪ 영토 밖 유클리드 ≤ 40셀 — 카드의 R · 그날의 영토 `_terrSet`) 칸을 센다:
//       뭍 칸 · 영토 칸 · 밭 칸(`_farmSet`) · 집 칸(`_houseCells`) · 선 나무 칸(큰 나무 · 어린나무 — 존 색인 `t325TreesAtCell`) · 그중 어린나무만 칸 ·
//       원판 나무 칸(같은 색인 · 벤 장부 없이 `raw`) · 벤 자리 칸(원판엔 나무 · 지금 선 나무 0) · 트인 땅 % = 1 − 선 나무 칸 ÷ 뭍 칸
//     그림 마을(`T1107_PIC` · 기본 셋 — 평야 · 어촌 · 임업)은 칸마다 한 글자 지도도 적는다(`scripts/t1107-pic.py` 가 PNG 로 굽는다):
//       `~` 물 · `^` 바위 · `.` 트인 땅 · `t` 영토 · `f` 밭 · `h` 집 · `T` 큰 나무 · `s` 어린나무 · `x` 벤 자리(원판 나무 · 지금 0) · ` ` 둘레 밖
//   읽기만 — 존 색인은 세계에 안 쓴다(같은 생성기를 칸으로 거른 것 · T301). 손잡이 · 장부 무접촉.
const path = require('path');
const fs = require('fs');
const A1 = process.argv[1] || '';
const SERVER = !!process.env.T577_SEED && /server[\/\\]zone\.js$/.test(A1);
if (!SERVER) return;
const OUT = process.env.T1107_OUT || (process.env.T577_OUT ? process.env.T577_OUT.replace(/\.json$/, '') + '.t1107.json' : '');
if (!OUT) return;
const ROOT = path.join(__dirname, '..');
const SNAP = String(process.env.T1107_SNAP || '2,365,799,1094').split(',').map(Number).filter((x) => x >= 0).sort((a, b) => a - b);
const PIC = String(process.env.T1107_PIC || '농촌3,어촌3,임업6').split(',').filter(Boolean);
const RING = 40;
const V1 = require(path.join(ROOT, 'sim', 'economy-sim'));
const TER = require(path.join(ROOT, 'server', 'terrain'));
let VIL = null;
const rec = { snap: SNAP, pic: PIC, ring: RING, knob: { T1107_REGROW_K: process.env.T1107_REGROW_K || null, T1107_VILLAGE_TREES: process.env.T1107_VILLAGE_TREES || null, T325_WOOD_ACT: process.env.T325_WOOD_ACT || null },
  shots: [], err: null, ms: 0 };
const done = new Set();
let lastDay = -1;
function regionOf(vil) {
  const own = vil._terrSet || new Set();
  const terr = [];
  for (const k of own) { const i = k.indexOf(','); terr.push([+k.slice(0, i), +k.slice(i + 1)]); }
  if (!terr.length) terr.push([vil.ccx, vil.ccy]);
  const has = (x, y) => own.has(x + ',' + y);
  const edge = terr.filter((c) => !(has(c[0] + 1, c[1]) && has(c[0] - 1, c[1]) && has(c[0], c[1] + 1) && has(c[0], c[1] - 1)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of terr) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }
  x0 -= RING; y0 -= RING; x1 += RING; y1 += RING;
  const cells = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (has(cx, cy)) { cells.push([cx, cy, 1]); continue; }
    let best = Infinity;
    for (const e of edge) { const dx = cx - e[0], dy = cy - e[1], d2 = dx * dx + dy * dy; if (d2 < best) best = d2; if (best <= 1) break; }
    if (best <= RING * RING) cells.push([cx, cy, 0]);
  }
  return { cells, x0, y0, x1, y1 };
}
function shoot(day) {
  const t0 = process.hrtime.bigint();   // 벽시계(가상 시계 `t745-vclock` 이 `Date.now` 를 바꾼다)
  const k = VIL.__labProbe._t707Probe.setup();
  const deps = k && k.deps, vils = (k && k.villages) || [], Z = k && k.zoneId;
  if (!deps || typeof deps.t325TreesAtCell !== 'function') { rec.err = rec.err || 'deps 없음'; return; }
  const SZ = 32;
  const shot = { day, v: {}, pic: {} };
  for (const vil of vils) {
    if (!vil || !vil.econ) continue;
    const name = vil.econ.name || vil.name;
    const R = regionOf(vil);
    const farm = vil._farmSet || new Set();
    const house = new Set((vil._houseCells || []).map((c) => c.cx + ',' + c.cy));
    const S = { land: 0, terr: 0, farm: 0, house: 0, tree: 0, sap: 0, raw: 0, cut: 0, ringLand: 0, ringTree: 0, ringRaw: 0, ringCut: 0, pop: (vil.econ.npcs || []).length };
    const isPic = PIC.indexOf(name) >= 0;
    const W = R.x1 - R.x0 + 1, H = R.y1 - R.y0 + 1;
    const grid = isPic ? Array.from({ length: H }, () => new Array(W).fill(' ')) : null;
    for (const c of R.cells) {
      const cx = c[0], cy = c[1], key = cx + ',' + cy, px = cx * SZ + SZ / 2, py = cy * SZ + SZ / 2;
      let ch = '.';
      if (TER.isWaterCellLocal(Z, px, py)) ch = '~';
      else if (typeof TER.isRockCellLocal === 'function' && TER.isRockCellLocal(Z, px, py)) ch = '^';
      if (ch === '.') {
        S.land++;
        let a = null, b = null; try { a = deps.t325TreesAtCell(cx, cy); b = deps.t325TreesAtCell(cx, cy, true); } catch (e) { a = null; b = null; }
        const nT = (a || []).filter((r) => r.type === 'tree').length, nS = (a || []).filter((r) => r.type === 'sapling').length, nR = (b || []).length;
        if (nT + nS > 0) { S.tree++; if (nT === 0) S.sap++; }
        if (nR > 0) { S.raw++; if (nT + nS === 0) S.cut++; }
        if (!c[2]) { S.ringLand++; if (nT + nS > 0) S.ringTree++; if (nR > 0) { S.ringRaw++; if (nT + nS === 0) S.ringCut++; } }
        if (c[2]) { S.terr++; ch = 't'; }
        if (farm.has(key)) { S.farm++; ch = 'f'; }
        if (house.has(key)) { S.house++; ch = 'h'; }
        if (nT > 0) ch = 'T'; else if (nS > 0) ch = 's'; else if (nR > 0 && ch !== 'f' && ch !== 'h') ch = 'x';
      }
      if (grid) grid[cy - R.y0][cx - R.x0] = ch;
    }
    S.open = S.land ? +(1 - S.tree / S.land).toFixed(4) : null;
    shot.v[name] = S;
    if (grid) shot.pic[name] = { x0: R.x0, y0: R.y0, rows: grid.map((r) => r.join('')) };
  }
  shot.ms = Number((process.hrtime.bigint() - t0) / 1000000n);
  rec.shots.push(shot);
  try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 읽기만 */ }
}
const _tick = V1.tickVillage;
V1.tickVillage = function (v, day) {
  try {
    const d = v && v._world ? v._world.day : day;
    if (Number.isFinite(d) && d !== lastDay) {
      lastDay = d;
      if (!VIL) VIL = require(path.join(ROOT, 'server', 'villages'));
      for (const s of SNAP) if (!done.has(s) && d >= s) { done.add(s); shoot(d); }
    }
  } catch (e) { if (!rec.err) rec.err = String(e && e.stack || e).slice(0, 400); }
  return _tick.apply(this, arguments);
};
process.on('exit', () => { try { fs.writeFileSync(OUT, JSON.stringify(rec)); } catch (e) { /* 읽기만 */ } });
