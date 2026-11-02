// battle-core.js 를 대상 HTML(전쟁실험실.html · 전투실험실.html)의 <!-- BATTLE-CORE --> 마커 사이에 인라인.
//   전쟁실험실.html은 file://로 직접 열리는 자체완결 프로토타입이라, 외부 src 대신 인라인이 안전.
//   sim/inline-engine.js(economy-engine → 마을실험실) 형제 패턴.
//   전투 코어 수정 후: node sim/inline-battle.js  (대상 기본 = lab/전쟁실험실.html · lab/전투실험실.html, 인자로 경로 지정 가능)
//   ★[T1090] 07-10 원본(lab/원본/ · 맥 _archive)은 대상 아님(읽기 전용).
const fs = require('fs');
const path = require('path');

// ★[T1090 2026-11-02] 대상 = 인라인 코어를 쓰는 랩 전부(레포 안 lab/). 전투실험실도 이제 대상이다 — 07-10 원본은
//   lab/원본/전투실험실_0710.html(대조 기준 · 고치지 않음)로 두고, lab/전투실험실.html 은 이 코어를 인라인해 쓴다.
//   종전 기본값(저장소 밖 ../../전쟁실험실.html)과 "전투실험실은 대상 아님" 막이는 그 원본을 지키던 것 — 원본 자리만 막는다.
const corePath = path.join(__dirname, 'battle-core.js');
const labRoot = path.join(__dirname, '..', 'lab');
const DEFAULT_LABS = ['전쟁실험실.html', '전투실험실.html'];
const targets = process.argv.slice(2).length ? process.argv.slice(2).map(a => path.resolve(a)) : DEFAULT_LABS.map(f => path.join(labRoot, f));
for (const target of targets) {
if (/[\\/]원본[\\/]/.test(target) || /_archive/.test(target)) {
  throw new Error(`원본 · 보관 사본은 인라인 대상이 될 수 없음(읽기 전용): ${target}`);
}
if (!fs.existsSync(target)) {
  console.error(`[inline-battle] 대상 HTML 없음: ${target}`);
  console.error('  코어를 넣을 자리에 아래 마커 한 쌍을 두세요:');
  console.error('    <!-- BATTLE-CORE -->');
  console.error('    <!-- /BATTLE-CORE -->');
  process.exit(1);
}

let H = fs.readFileSync(target, 'utf8');
// </script>가 HTML 파싱을 깨지 않게 이스케이프(코어는 순수 JS라 보통 없음)
const core = fs.readFileSync(corePath, 'utf8').replace(/<\/script>/g, '<\\/script>');
const block =
  '<!-- BATTLE-CORE · durango-mini/sim/battle-core.js 인라인 · 재생성: node durango-mini/sim/inline-battle.js -->\n' +
  '<script>\n' + core + '\n</scr' + 'ipt>\n' +
  '<!-- /BATTLE-CORE -->';

// 기존 마커 쌍이 있으면 그 사이(마커 포함)를 교체, 없으면 첫 <script> 앞에 삽입.
const pairRe = /<!-- BATTLE-CORE[\s\S]*?<!-- \/BATTLE-CORE -->/;
if (pairRe.test(H)) {
  H = H.replace(pairRe, block);
  console.log('[inline-battle] 기존 BATTLE-CORE 블록 교체');
} else {
  const i = H.indexOf('<script>');
  if (i < 0) throw new Error(`${path.basename(target)}에 <script>가 없음 — 마커를 둘 위치를 찾지 못함`);
  H = H.slice(0, i) + block + '\n' + H.slice(i);
  console.log('[inline-battle] 첫 <script> 앞에 BATTLE-CORE 블록 삽입');
}
fs.writeFileSync(target, H);
console.log(`[inline-battle] 완료: ${target} (${(H.length / 1024).toFixed(0)} KB)`);
}
