# T1155 — 같은 틀의 낮·밤 ABBA

제품 dadba977, 선행 API T1154 1424a2c9. provenance.json은 제품 여섯 파일의 SHA256과 틀의 SHA256·mtime을 담는다. manifest.json/table.json은 실제 8회 실행의 원자료이며, comparison.json은 완료된 두 반복 창씩의 자기 시간과 npcStep 범위를 집계했다.

raw/*.json.gz 및 raw/*.jsonl.gz: 각 실행 창과 V8 표본. move-off/on.log.gz 및 hot-columns-guard.log.gz: 최종 제품의 검사 결과. retired-prototype.json: 도적 simJob 쓰기 누락을 발견해 제외한 초기 실행.

틀은 관측자만 연결해 만든 NPC 세계이며, 생성 제품은 bf0c3c93 OFF, t100 200일이다. tpl-t100.db.gz를 풀고 provenance.json의 template.mtimeMs를 T1155_TEMPLATE_MTIME_MS로 준다. 같은 파일의 모든 팔을 비교해야 한다.

    gzip -dc 계측/T1155_2026-11-05/tpl-t100.db.gz > /tmp/t1155-tpl.db
    T1155_SOURCE_HEAD=dadba977 T1155_TEMPLATE_MTIME_MS=1793915558071.5571 /workspace/.tools/node-v22.23.0-linux-x64/bin/node scripts/t1155-measure.js /absolute/immutable-source /tmp/t1155-tpl.db /tmp/t1155-abba-new
    python3 scripts/t1155-table.py /tmp/t1155-abba-new

실측의 시계 원점은 원본 틀 파일 mtime을 직접 읽었다. 후속 재현 입구는 이 값을 명시적으로 보존할 수 있게 했다. 실측은 독립 위상 복원·60초 데우기·15초 조각 셋이며, 같은 상자에 다른 계측 작업도 있었다. 기본 ON 판정에는 전체 npcStep 증가도 함께 읽는다.

서버·랩 최종 대조는 진행 중이다. 이 폴더의 ABBA 완료가 카드 전체 완료를 뜻하지 않는다.
