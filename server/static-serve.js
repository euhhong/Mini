'use strict';
// ═════════════════════════════════════════════════════════════════════════════
// central 정적 응답 — ★[T1123 2026-11-03] 캐시 · 304 · gzip (재민 11-03 Safari "첫 화면 렉")
//
// ★왜: 라이브 응답에 `Cache-Control` 이 `no-cache, no-store` 였고 `ETag` · `Last-Modified` 가 없었다 —
//   로비에 올 때마다 322개 · 20.8 MB 를 처음부터 다시 받았다. `terrain.json`(990 KB)도 압축 없이 갔다.
//
// 손잡이 `T1123_STATIC_CACHE`(`!== '0'` 켬 기본 · 되돌림 `=0` = 종전 머리 그대로 — `no-cache, no-store` · 압축 0).
// 켬:
//   · 모든 파일에 `ETag`(내용 sha1) · `Last-Modified`(mtime) — `If-None-Match` · `If-Modified-Since` 가 맞으면 304(몸 0).
//   · `?v=<그 파일의 내용 sha1>` 로 온 요청 → `Cache-Control: public, max-age=31536000, immutable`(카드가 준 수).
//     그 밖(?v= 가 없거나 옛 값) → `Cache-Control: no-cache`(늘 다시 묻는다 — 바뀌지 않았으면 304).
//   · html 은 내보낼 때 `src="x.js?v=…"` · `href="x.css?v=…"` 의 값을 **그 파일의 내용 sha1** 로 갈아 쓴다.
//     ⚠index.html 의 `?v=5h0` 는 배포마다 안 바뀌는 고정 글자였다 — 그 값에 immutable 을 걸면 다음 배포의 js 를
//       한 해 동안 못 받는다. 그래서 값은 사람이 적지 않고 내용이 정한다(배포해서 바뀐 파일만 새 주소가 된다).
//     `?v=` 가 없던 줄(`style.css`)은 그대로 둔다(304 로 산다) — 마크업은 손대지 않는다.
//   · js · json · css · html · svg · txt 는 gzip(처음 한 번 눌러 붙잡아 둔다 · 내용 sha1 이 바뀌면 다시 누른다).
//   · 형식 표에 json · webp · svg · ogg · m4a · woff2 · glb · jpg 를 더한다(종전엔 octet-stream 으로 갔다).
// ⚠판정 0 · 그림 0 · 새 수 0(카드가 준 31536000 하나).
// ═════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const MIME_OLD = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
const MIME_NEW = Object.assign({}, MIME_OLD, {
  '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
});
const GZ_EXT = new Set(['.js', '.json', '.css', '.html', '.svg', '.txt', '.md']);
const IMMUTABLE = 'public, max-age=31536000, immutable';

function on() { return process.env.T1123_STATIC_CACHE !== '0'; }

// 파일 하나의 붙잡은 값 — mtime · 크기가 같으면 다시 안 읽는다.
const _ent = new Map();   // filePath → { mtimeMs, size, sha, gz, body(html 만) }
function _sha(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }
function entry(filePath) {
  const st = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  // html 은 붙잡지 않는다 — 제 mtime 이 그대로여도 가리키는 js 가 바뀌면 `?v=` 가 바뀌어야 한다(가리키는 파일 쪽은 붙잡힌다).
  const e0 = ext === '.html' ? null : _ent.get(filePath);
  if (e0 && e0.mtimeMs === st.mtimeMs && e0.size === st.size) return e0;
  let buf = fs.readFileSync(filePath);
  if (ext === '.html') buf = Buffer.from(rewriteHtml(buf.toString('utf8'), path.dirname(filePath)), 'utf8');
  const e = { mtimeMs: st.mtimeMs, size: st.size, mtime: st.mtime, ext, sha: _sha(buf), gz: null, body: ext === '.html' ? buf : null, len: buf.length };
  if (GZ_EXT.has(ext)) e.gz = zlib.gzipSync(buf);
  if (ext !== '.html') _ent.set(filePath, e);
  return e;
}
// html 안 `?v=` 값을 그 파일의 내용 sha1 로 — 같은 오리진의 상대 주소만(없는 파일 · 바깥 주소는 그대로).
function rewriteHtml(html, dir) {
  return html.replace(/((?:src|href)=")([^"?#:]+)\?v=[^"]*"/g, (m, a, rel) => {
    const f = path.join(dir, rel.replace(/^\//, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return m;
    try { return `${a}${rel}?v=${entry(f).sha}"`; } catch (e) { return m; }
  });
}

function _vOf(url) {
  const q = url.indexOf('?'); if (q < 0) return null;
  const m = /(?:^|&)v=([^&]*)/.exec(url.slice(q + 1));
  return m ? m[1] : null;
}

// 보낸다 — `url` 은 요청 원문(쿼리 포함) · 종전 길과 같은 자리에서 부른다.
function serve(req, res, filePath, url, mimeOverride) {
  const ext = path.extname(filePath).toLowerCase();
  if (!on()) {
    const mime = mimeOverride || MIME_OLD[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    return fs.createReadStream(filePath).pipe(res);
  }
  const e = entry(filePath);
  const mime = mimeOverride || MIME_NEW[ext] || 'application/octet-stream';
  const etag = `"${e.sha}"`;
  const v = _vOf(url || '');
  const h = {
    'Content-Type': mime,
    'ETag': etag,
    'Last-Modified': e.mtime.toUTCString(),
    'Cache-Control': (v && v === e.sha) ? IMMUTABLE : 'no-cache',
  };
  if (e.gz) h['Vary'] = 'Accept-Encoding';
  const inm = req.headers['if-none-match'];
  const ims = req.headers['if-modified-since'];
  const fresh = inm != null
    ? inm.split(',').map((s) => s.trim().replace(/^W\//, '')).some((t) => t === etag || t === '*')
    : (ims != null && Date.parse(ims) >= Math.floor(e.mtimeMs / 1000) * 1000);
  if (fresh) { res.writeHead(304, h); return res.end(); }
  const gz = e.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  if (gz) {
    h['Content-Encoding'] = 'gzip'; h['Content-Length'] = e.gz.length;
    res.writeHead(200, h); return res.end(req.method === 'HEAD' ? undefined : e.gz);
  }
  if (e.body) { h['Content-Length'] = e.body.length; res.writeHead(200, h); return res.end(req.method === 'HEAD' ? undefined : e.body); }
  h['Content-Length'] = e.size;
  res.writeHead(200, h);
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(filePath).pipe(res);
}

module.exports = { serve, on, entry, rewriteHtml, IMMUTABLE, _ent };
