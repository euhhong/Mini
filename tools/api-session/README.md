# API 세션(S-API) — 카드 하나를 API 크레딧으로 끝까지

재민 Console 의 **API 크레딧**(Ultra 월 $200 · 결제일 4일 · 안 쓰면 소멸)으로 도는 작업 세션이다. 엔진은 Claude Agent SDK, 곧 다른 세션들(Claude Code)과 같다. 채팅 창은 없고 **재민 맥 터미널**에서 돈다. 크레딧은 Claude Code · 앱 사용량에는 쓰이지 않고, API · Agent SDK 에만 쓰인다. (족보 755)

## 한 번만 할 일

1. **API 키 만들기.** https://platform.claude.com/settings/keys 에서 크레딧이 연결된 org("재민's Individual Org")를 고르고 키를 만든다.
2. **키 저장.** 키를 복사한 뒤 터미널에서:
   ```bash
   mkdir -p ~/.config/mini-api && pbpaste > ~/.config/mini-api/key && chmod 600 ~/.config/mini-api/key
   ```
   키는 채팅 · 레포 · 메모리에 절대 붙이지 않는다. `~/Mini` 밖에 두기 때문에 PM 세션도 이 키를 볼 수 없다.
3. **Node 22 이상.** `node -v` 로 확인한다. 낮으면 `brew install node`(서버 하네스가 `--experimental-sqlite` 를 쓴다).

## 돌리기

- 더블클릭: `~/Mini/API세션.command` 를 연다. 카드 번호, 모델, 상한을 차례로 물어본다.
- 터미널:
  ```bash
  cd ~/Mini/_api/runner && npm install      # 처음 한 번
  node run.mjs T1150                       # 기본: opus · 카드당 $15 · 주기 상한 $100
  node run.mjs T1150 --model=sonnet --budget=5
  node run.mjs T1150 --dry                 # API 안 부름 — 클론 · 가지 · 프롬프트만 확인
  ```
- 도중에 `Ctrl-C` 를 누르면 멈춘다. 남은 변경은 wip 커밋으로 남기고 가지를 민다. 한 번 더 누르면 바로 끝난다.

## 러너가 하는 일

1. `~/Mini/_api/repo` 에 자기 클론을 만든다. `durango-mini` 와는 따로다. 그다음 최신 main 을 받는다.
2. 카드는 main 의 `지시/지시_T◯.md` 에서 읽는다. 없으면 `~/Mini/지시/` 에서 읽는다.
3. 새 가지 `batch/api-t◯-MMDD` 를 만들고 워크트리 `~/Mini/_api/wt/…` 를 연 뒤 `npm ci` 를 돌린다.
4. 에이전트가 다른 세션과 같은 규약으로 일한다. 공통 인계 → 일 → 하네스 → 커밋 → `보고/T◯_날짜.md` 순서다.
5. 끝나면 남은 변경을 커밋하고 **batch 가지만** 민다. 새 ref 만 밀고 force 는 쓰지 않는다. **main 착지는 PM** 이 한다.
6. 다음 셋을 남긴다.
   - `~/Mini/_api/장부.tsv`: 카드마다 쓴 돈
   - `~/Mini/_api/결과/<가지>.md`: 한 장 요약
   - `~/Mini/_api/logs/<가지>.jsonl`: 전체 기록

## 안전장치

- **돈**
  - 카드당 상한(`--budget`, 기본 $15)을 넘으면 SDK 가 그 자리에서 끊는다.
  - 결제 주기 상한(`--cap`, 기본 $100)은 장부를 보고 넘을 것 같으면 시작하지 않는다.
- **자격**
  - 시작할 때 자격 출처가 `ANTHROPIC_API_KEY` 가 아니면 멈춘다. 구독 로그인으로 새지 않게 하려는 것이다.
- **가드**(`guard.mjs`, 하네스 `node test-guard.mjs`)는 도구를 쓰기 전마다 본다. 막는 것:
  - ssh · scp · 서버 IP
  - git push · force · 리모트 바꾸기 · 전역 설정 · main checkout
  - `durango-mini` 폴더, PAT, API 키, `~/.ssh`, 서버 비밀, DuckDNS 토큰 주소
  - 환경 변수 덤프, sudo, 집 · 뿌리를 통째로 지우는 명령, 상주 작업 등록
  - 작업 폴더 밖 쓰기. 쓸 수 있는 곳은 작업 폴더, `~/Mini/산그림`, `~/Mini/_api/tmp` 다.
- **샌드박스**
  - 맥의 OS 샌드박스로 Bash 의 쓰기 범위와 네트워크(github · npm · pypi · 공개 끝점)를 묶는다.
  - 키 · PAT 파일 읽기와 키 환경 변수는 막는다.
  - 문제가 나면 `--no-sandbox` 로 끄고 가드만으로 돈다.

## PM 쪽

- 맥 세션 카드 중 **이미 다른 세션에 준 카드는 주지 않는다.**
- 착지("됨") 때 `batch/api-*` 가지도 다른 가지처럼 훑는다.
- 러너가 바뀌면 `~/Mini/_api/runner/` 에 새로 깐다. 정본은 레포 `tools/api-session/` 이다.
