#!/usr/bin/env node
// @regress   ← 통합 러너가 이 표를 보고 자기 목록을 만든다(표 없으면 안 돈다)
// === scripts/test-static-cache.js — central 정적 응답(캐시 · 304 · gzip) + 로비 게임 그림 문 [T1123] ===
//
// ★왜 [재민 11-03 Safari 실기 "처음 메인 페이지도 렉이 너무 극심"]
//   로비 하나에 요청 322개 · 20.8 MB · 라이브 응답에 `Cache-Control`/`ETag`/`Last-Modified` 0 · terrain.json 압축 0.
//   고친 것 둘 — ② `server/static-serve.js`(손잡이 `T1123_STATIC_CACHE`) · ① 클라 게임 그림 문(손잡이 `T1123_LOBBY_LAZY`).
//
// 절
//   ⓐ 켬 — html 의 `?v=` 가 **그 파일의 내용 sha1** 로 갈렸다(사람이 적은 `5h0` 가 남지 않는다)
//   ⓑ 켬 — `?v=<내용 sha1>` 이면 immutable(카드가 준 31536000) · 옛 값이면 no-cache · ETag · Last-Modified · 304(INM · IMS)
//   ⓒ 켬 — js · json · css gzip(풀면 원본과 바이트 같다) · png · webp 는 안 누른다 · 형식(webp · json)
//   ⓓ 내용이 바뀌면 `?v=` 가 바뀐다(임시 폴더 — 붙잡은 값이 낡지 않는다 · html 은 안 붙잡는다)
//   ⓔ 끔(`T1123_STATIC_CACHE=0`) — 종전 머리 그대로(no-store · ETag 0 · 압축 0 · `?v=5h0` 그대로)
//   ⓕ /zones 칸 `lobbyLazy` — 켬 기본 · `T1123_LOBBY_LAZY=0` 이면 칸 없음
//   ⓖ Chromium(존 없이 central 만) — 켬: 게임 그림 요청은 **문이 열린 뒤에만** 시작 · 문이 열리고 나무 열둘이 다 온다 ·
//      끔: 문이 /zones 에서 곧바로 열린다(`끔`) · 두 번째 방문은 304(바이트가 확 준다)
//
// 실행: node scripts/test-static-cache.js
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn } = require('child_process');
const FB = require('./fixture-boot');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (extra !== undefined ? `  ${extra}` : '')); };
const sha = (b) => crypto.createHash('sha1').update(b).digest('hex');
const procs = [];
FB.reapOnExit(procs);
const dbs = [];
function bootCentral(port, env) {
  const db = path.join(os.tmpdir(), `t1123-sc-${process.pid}-${port}.db`); dbs.push(db);
  const p = spawn(process.execPath, [path.join(ROOT, 'server', 'central.js')], {
    cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(port), DB_PATH: db, PUBLIC_HOST: 'localhost', ENABLED_ZONES: 'hanbando' }, env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  procs.push(p);
  return FB.waitUp(p, /central server up on/, { name: `central:${port}` });
}
async function get(base, u, h) {
  const r = await fetch(base + u, { headers: h || {} });
  const body = Buffer.from(await r.arrayBuffer());
  return { s: r.status, h: (k) => r.headers.get(k), body };
}
// fetch 는 gzip 을 저절로 푼다 — 눌린 몸을 보려면 http 로 받는다
function rawGet(port, u, h) {
  return new Promise((res, rej) => {
    require('http').get({ host: 'localhost', port, path: u, headers: h || {} }, (r) => {
      const bufs = []; r.on('data', (d) => bufs.push(d)); r.on('end', () => res({ s: r.statusCode, h: r.headers, body: Buffer.concat(bufs) }));
    }).on('error', rej);
  });
}

(async () => {
  console.log('\n=== T1123 정적 응답 · 로비 게임 그림 문 ===');
  const pOn = await FB.freePort(), pOff = await FB.freePort();
  const [uOn, uOff] = await Promise.all([bootCentral(pOn, {}), bootCentral(pOff, { T1123_STATIC_CACHE: '0', T1123_LOBBY_LAZY: '0' })]);
  ok(uOn.ok && uOff.ok, 'central 둘 기동(켬 · 끔)', `${uOn.why} / ${uOff.why}`);
  const ON = `http://localhost:${pOn}`, OFF = `http://localhost:${pOff}`;
  const PUB = path.join(ROOT, 'public');

  console.log('\nⓐ html 의 ?v= = 그 파일의 내용 sha1');
  const ix = (await get(ON, '/')).body.toString('utf8');
  const refs = [...ix.matchAll(/(?:src|href)="([^"?#:]+)\?v=([^"]*)"/g)].map((m) => ({ rel: m[1], v: m[2] }));
  const srcIx = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const srcN = (srcIx.match(/\?v=/g) || []).length;
  ok(refs.length > 0 && refs.length === srcN, '`?v=` 줄 수가 원본과 같다(빠진 줄 0)', `${refs.length} / ${srcN}`);
  const bad = refs.filter((r) => r.v !== sha(fs.readFileSync(path.join(PUB, r.rel.replace(/^\//, ''))))).map((r) => r.rel);
  ok(bad.length === 0, '모든 `?v=` 가 그 파일의 내용 sha1 이다', bad.slice(0, 3).join(' '));
  ok(!/\?v=5h0/.test(ix), '사람이 적은 고정 값(`5h0`)이 남지 않는다');

  console.log('\nⓑ immutable · no-cache · ETag · Last-Modified · 304');
  const r0 = refs.find((r) => /99-main\.js$/.test(r.rel)) || refs[0];
  const a = await get(ON, `/${r0.rel.replace(/^\//, '')}?v=${r0.v}`);
  ok(a.s === 200 && a.h('cache-control') === 'public, max-age=31536000, immutable', '`?v=<내용 sha1>` → immutable 1년', a.h('cache-control'));
  const b = await get(ON, `/${r0.rel.replace(/^\//, '')}?v=5h0`);
  ok(b.s === 200 && b.h('cache-control') === 'no-cache', '옛 `?v=` → no-cache(늘 다시 묻는다)', b.h('cache-control'));
  ok(a.h('etag') === `"${r0.v}"` && !!a.h('last-modified'), 'ETag = 내용 sha1 · Last-Modified 있음', `${a.h('etag')} · ${a.h('last-modified')}`);
  const tree = await get(ON, '/assets/trees/tree01.png');
  ok(tree.s === 200 && tree.h('cache-control') === 'no-cache' && !!tree.h('etag'), '그림(?v= 없음) — no-cache + ETag', `${tree.h('cache-control')} · ${tree.h('etag')}`);
  const t304 = await get(ON, '/assets/trees/tree01.png', { 'if-none-match': tree.h('etag') });
  ok(t304.s === 304 && t304.body.length === 0, 'If-None-Match 맞음 → 304 · 몸 0', `${t304.s} · ${t304.body.length}B`);
  const ims = await get(ON, '/assets/trees/tree01.png', { 'if-modified-since': tree.h('last-modified') });
  ok(ims.s === 304, 'If-Modified-Since 맞음 → 304', ims.s);
  const stale = await get(ON, '/assets/trees/tree01.png', { 'if-none-match': '"0000"' });
  ok(stale.s === 200 && stale.body.length === fs.statSync(path.join(PUB, 'assets/trees/tree01.png')).size, '★돌연변이 — 다른 ETag 면 200 · 온 몸', `${stale.s} · ${stale.body.length}B`);

  console.log('\nⓒ gzip · 형식');
  for (const u of ['/terrain.json', '/client/00-const.js', '/style.css']) {
    const r = await rawGet(pOn, u, { 'accept-encoding': 'gzip' });
    const file = u === '/terrain.json' ? path.join(ROOT, 'server', 'hanbando-terrain.json') : path.join(PUB, u);
    const raw = fs.readFileSync(file);
    let same = false; try { same = zlib.gunzipSync(r.body).equals(raw); } catch (e) {}
    ok(r.s === 200 && r.h['content-encoding'] === 'gzip' && same, `${u} gzip · 풀면 원본과 같다`, `${(raw.length / 1e3).toFixed(0)} KB → ${(r.body.length / 1e3).toFixed(0)} KB`);
  }
  const noAe = await rawGet(pOn, '/terrain.json', {});
  ok(!noAe.h['content-encoding'] && noAe.body.length === fs.statSync(path.join(ROOT, 'server', 'hanbando-terrain.json')).size, 'Accept-Encoding 없으면 안 누른다', noAe.h['content-encoding'] || '없음');
  const png = await rawGet(pOn, '/assets/trees/tree01.png', { 'accept-encoding': 'gzip' });
  ok(!png.h['content-encoding'], 'png 는 안 누른다', png.h['content-encoding'] || '없음');
  const wf = fs.readdirSync(path.join(PUB, 'assets', 'mountains')).find((f) => f.endsWith('.webp'));
  const wb = await rawGet(pOn, '/assets/mountains/' + wf, { 'accept-encoding': 'gzip' });
  ok(wb.h['content-type'] === 'image/webp' && !wb.h['content-encoding'], 'webp 형식 image/webp · 안 누른다', wb.h['content-type']);
  const js = await rawGet(pOn, '/assets/trees/tree_species.json', {});
  ok(js.h['content-type'] === 'application/json', 'json 형식 application/json', js.h['content-type']);

  console.log('\nⓓ 내용이 바뀌면 ?v= 가 바뀐다(임시 폴더)');
  {
    const SS = require(path.join(ROOT, 'server', 'static-serve.js'));
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 't1123-'));
    fs.writeFileSync(path.join(d, 'a.js'), 'var a=1;');
    fs.writeFileSync(path.join(d, 'index.html'), '<script src="a.js?v=5h0"></script><script src="https://x.y/b.js?v=1"></script><script src="none.js?v=2"></script>');
    const h1 = SS.entry(path.join(d, 'index.html')).body.toString();
    const fd = fs.openSync(path.join(d, 'a.js'), 'w'); fs.writeSync(fd, 'var a=22;'); fs.closeSync(fd);
    const t = new Date(Date.now() + 2000); fs.utimesSync(path.join(d, 'a.js'), t, t);
    const h2 = SS.entry(path.join(d, 'index.html')).body.toString();
    ok(h1.includes(`a.js?v=${sha('var a=1;')}`) && h2.includes(`a.js?v=${sha('var a=22;')}`), 'a.js 가 바뀌면 html 의 ?v= 도 바뀐다(html 은 안 붙잡는다)');
    ok(h2.includes('https://x.y/b.js?v=1') && h2.includes('none.js?v=2'), '바깥 주소 · 없는 파일은 그대로 둔다');
    fs.rmSync(d, { recursive: true, force: true });
  }

  console.log('\nⓔ 끔 — 종전 머리 그대로');
  const ixOff = (await get(OFF, '/')).body.toString('utf8');
  ok(ixOff === srcIx, '끔: index.html 바이트 그대로(`?v=5h0`)');
  const off = await rawGet(pOff, '/terrain.json', { 'accept-encoding': 'gzip' });
  ok(off.h['cache-control'] === 'no-cache' && !off.h.etag && !off.h['content-encoding'], '끔: terrain.json 종전 머리(no-cache · ETag 0 · 압축 0)', `${off.h['cache-control']}`);
  const offJs = await rawGet(pOff, '/client/00-const.js', { 'accept-encoding': 'gzip' });
  ok(offJs.h['cache-control'] === 'no-cache, no-store, must-revalidate' && !offJs.h.etag && !offJs.h['content-encoding'], '끔: js 종전 머리(no-store)', offJs.h['cache-control']);

  console.log('\nⓕ /zones 칸 lobbyLazy');
  const zOn = JSON.parse((await get(ON, '/zones')).body.toString()), zOff = JSON.parse((await get(OFF, '/zones')).body.toString());
  ok(zOn.lobbyLazy === true && !('lobbyLazy' in zOff), '켬 기본 칸 있음 · `=0` 이면 칸 없음', `${zOn.lobbyLazy} / ${zOff.lobbyLazy}`);

  console.log('\nⓖ Chromium — 로비 게임 그림 문(존 없이 central 만)');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const look = async (base) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { performance.setResourceTimingBufferSize(5000); } catch (e) {} });
    const visit = async () => {
      const page = await ctx.newPage();
      await page.goto(base + '/', { waitUntil: 'load' });
      // 문이 열리고 나무 열둘이 다 올 때까지(상한은 표에만 — 판정은 값으로)
      await page.waitForFunction(() => window.__gimg && window.__gimg().open && typeof TREE_SPRITES !== 'undefined' && TREE_SPRITES.every((im) => im.complete && im.naturalWidth > 0), null, { timeout: 120000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const g = window.__gimg ? window.__gimg() : null;
        const res = performance.getEntriesByType('resource').filter((e) => /\/assets\/(trees|mountains|nature|crops|bridge|buildings|terrain)\/|\/terrain\.json/.test(e.name));
        return { g, n: res.length, early: res.filter((e) => g && g.at != null && e.startTime < g.at).map((e) => e.name.replace(location.origin, '')).slice(0, 3),
          trees: TREE_SPRITES.filter((im) => im.complete && im.naturalWidth > 0).length,
          tx: performance.getEntriesByType('resource').reduce((s, e) => s + (e.transferSize || 0), 0) };
      });
      await page.close();
      return r;
    };
    const first = await visit(), second = await visit();
    await ctx.close();
    return { first, second };
  };
  const L = await look(ON), O = await look(OFF);
  ok(L.first.g && L.first.g.lazy === true && L.first.g.open && /시작 화면 정보 없음|로비 다 뜸/.test(L.first.g.why), '켬: 문이 로비 쪽에서 열렸다(존이 없으니 「시작 화면 정보 없음」)', JSON.stringify(L.first.g));
  ok(L.first.n > 0 && L.first.early.length === 0, '★켬: 게임 그림 요청은 **문이 열린 뒤에만** 시작했다', `${L.first.n}개 · 앞선 것 ${L.first.early.join(' ') || '0'}`);
  ok(L.first.trees === 12, '켬: 문이 열리고 나무 열둘이 다 왔다', L.first.trees);
  ok(O.first.g && O.first.g.lazy === false && /끔/.test(O.first.g.why) && O.first.trees === 12, '끔: /zones 에서 곧바로 열렸다(종전 꼴)', JSON.stringify(O.first.g));
  ok(L.second.tx < L.first.tx / 4, '★켬: 두 번째 방문 받은 바이트가 첫 방문의 ¼ 아래(304 · immutable)', `${(L.first.tx / 1e6).toFixed(2)} MB → ${(L.second.tx / 1e6).toFixed(2)} MB`);
  ok(O.second.tx > O.first.tx / 2, '대조 — 끔: 두 번째 방문도 다 받는다(no-store)', `${(O.first.tx / 1e6).toFixed(2)} MB → ${(O.second.tx / 1e6).toFixed(2)} MB`);
  await browser.close();

  for (const f of dbs) for (const s of ['', '-wal', '-shm']) { try { fs.unlinkSync(f + s); } catch (e) {} }
  console.log(`\n=== ${pass}/${fail} ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
