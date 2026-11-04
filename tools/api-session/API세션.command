#!/bin/bash
# 미니 API 세션 — 더블클릭하면 카드 번호를 묻고 돌린다(설명: ~/Mini/_api/runner/README.md · 족보 755)
cd "$(dirname "$0")/_api/runner" 2>/dev/null || cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null; then echo "Node 가 없습니다 — brew install node 뒤 다시 여십시오."; read -r; exit 1; fi
[ -d node_modules/@anthropic-ai/claude-agent-sdk ] || npm install --no-audit --no-fund || { read -r; exit 1; }
R=""
if [ -f ../지난대화.json ]; then read -r -p "지난 대화를 이어서 할까요? (y = 이어서 · 엔터 = 새로): " Y; [ "$Y" = "y" ] && R="--resume"; fi
if [ -n "$R" ]; then read -r -p "이어서 할 말: " C; else echo "카드 번호(예: T1150)를 적거나, 시킬 일을 말로 적으십시오."; read -r -p "> " C; fi
read -r -p "모델 opus / sonnet (엔터 = opus): " M
read -r -p "이번 상한 달러 (엔터 = 15): " B
node run.mjs $R "$C" --model="${M:-opus}" --budget="${B:-15}"
read -r -p "엔터를 누르면 창을 닫습니다 "
