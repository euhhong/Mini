'use strict';
// [T1159] 원정 표지는 후보 명부일 뿐이다. 집 영토 밖에 있는 실제 몸만 뺀다.
// 보통 일터로 나간 주민, 아직 집결 중인 병사, 몸/영토를 모르는 항목은 빼지 않는다.
function homePopulation(vil, players, cellSize) {
  const total = vil && vil.econ && vil.econ.npcs ? vil.econ.npcs.length : 0;
  if (!vil || !vil._terrSet || !players) return total;
  let away = 0;
  const seen = new Set();
  for (const pid of vil.npcPids || []) {
    if (seen.has(pid)) continue;
    seen.add(pid);
    const p = players.get(pid);
    if (!p || !(p._muster || p._t1104W != null) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    // 좌표는 존의 픽셀, 영토는 존의 셀 정본이다.
    if (!vil._terrSet.has(Math.floor(p.x / cellSize) + ',' + Math.floor(p.y / cellSize))) away++;
  }
  return Math.max(0, total - away);
}
module.exports = { homePopulation };
