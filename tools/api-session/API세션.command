#!/bin/bash
# 미니 API 세션 — 더블클릭하면 묻고 돌린다. 창을 여러 개 열면 동시에 여러 개가 돈다(창마다 제 가지 · 제 대화).
# 설명: ~/Mini/_api/runner/README.md · 족보 755
cd "$(dirname "$0")/_api/runner" 2>/dev/null || cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null; then echo "Node 가 없습니다 — brew install node 뒤 다시 여십시오."; read -r; exit 1; fi
[ -d node_modules/@anthropic-ai/claude-agent-sdk ] || npm install --no-audit --no-fund || { read -r; exit 1; }
R=""; K=""; C=""
if ls ../대화/*.json >/dev/null 2>&1 || [ -f ../지난대화.json ]; then
  read -r -p "지난 대화를 이어서 할까요? (y = 이어서 · 엔터 = 새로): " Y; [ "$Y" = "y" ] && R="--resume"
fi
if [ -z "$R" ]; then
  KEYS=$(ls ~/.config/mini-api/ 2>/dev/null | grep '^key-' | sed 's/^key-//' | tr '\n' ' ')
  if [ -n "$KEYS" ]; then read -r -p "어느 키로? (엔터 = 기본 · 다른 키: ${KEYS}): " KN; [ -n "$KN" ] && K="--key=$KN"; fi
  echo "카드 번호(예: T1150)를 적거나, 시킬 일을 말로 적으십시오."
  read -r -p "> " C
fi
read -r -p "모델 opus / sonnet (엔터 = opus): " M
read -r -p "이번 상한 달러 (엔터 = 15): " B
node run.mjs $R $K "$C" --model="${M:-opus}" --budget="${B:-15}"
read -r -p "엔터를 누르면 창을 닫습니다 "
