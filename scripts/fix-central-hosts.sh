#!/bin/bash
# === scripts/fix-central-hosts.sh — central 의 이웃 존 주소(`ZONE_HOST_<ID>`)를 이 호스트 존 컨테이너의 그 줄로 채우고 central 만 다시 띄운다 (T1077 · 2026-11-02) ===
#   쓰는 법(서울 · root · 재민 손 한 번):
#     bash scripts/fix-central-hosts.sh --dry   # 먼저 — 무엇을 넣을지 이름만(값 0) · 라이브 무변
#     bash scripts/fix-central-hosts.sh         # central 하나만 다시 띄운다(옛 env 그대로 + 빠진 ZONE_HOST_<ID>) · 끝에 central /zones 주소 = 존 줄인지(같음/다름만)
#   ★왜(재민 11-02 실기 "경계에서 이번엔 튕기지 않고 연결 끊김으로 멈춘다"): 브라우저가 옮겨 붙을 닛폰 주소(`wsUrl`)는 central `/zones` 가 준다
#     (`server/zone-config.js` `hostFromEnv` — ZONE_HOST_<ID> > ZONE_HOSTS > PUBLIC_HOST). 존↔존 인계는 서울 한반도 env 의 `ZONE_HOST_NIPPON`(T485 · T1048)으로
#     통과하는데 central env 에 그 줄이 없으면(빈 줄도) 26존 표 `ZONE_HOSTS`(= 서울)로 떨어져 브라우저는 서울:3021(닫힘)로 간다 → 보낸 존 ACK 3초 시한이 몸을 지운다.
#     central 을 다시 만드는 길(redeploy-hanbando · redeploy-all · reset-world)은 옛 env 를 통째로 옮기므로 **없던 줄을 되살리지 않는다**(보고/T1077 §2).
#   규칙: ⓐ 넣을 줄 = 이 호스트 `durango-zone-*` env 의 `ZONE_HOST_<ID>`(값 있는 것) 중 central 에 **없거나 빈** 것
#     ⓑ central 에 다른 값이 이미 있으면 손대지 않는다(✗ · 어느 쪽이 맞는지 사람 판정) ⓒ 존 둘이 같은 이름에 다른 값을 가지면 멈춘다
#     ⓓ 옛 env 그대로(이미지 기본 PATH · NODE_* · HOME · HOSTNAME 만 뺀다 — redeploy-hanbando recreate() 와 같은 줄) · 같은 이미지(id) · 포트 · /data · 라벨
#     ⓔ 값은 화면 · 파일 · 명령줄 0 — 이 셸 env 로만 `docker run -e <이름>`(T887 · reset-world recreate() 와 같은 꼴)
#   ★새 수 0 · 제품 코드 0 · 존 무접촉 · 배포 0(서버 손은 재민 — 이 스크립트를 서울에서 부르는 것이 그 손이다).
set -uo pipefail
C="${FIX_CENTRAL:-durango-central}"
DRY=0
for a in "$@"; do
  case "$a" in
    --dry) DRY=1 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "모르는 인자: $a (--dry 만 있다)"; exit 2 ;;
  esac
done
DROP_ENV='^(PATH|NODE_VERSION|YARN_VERSION|NODE_ENV|HOME|HOSTNAME)='   # redeploy-hanbando.sh recreate() · reset-world.sh 와 같은 줄
F_ENV='{{range .Config.Env}}{{println .}}{{end}}'
F_DATA='{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}'
F_PORT='{{range $p, $b := .HostConfig.PortBindings}}{{$p}} {{(index $b 0).HostPort}}{{println}}{{end}}'
F_LABELS='{{range $k, $v := .Config.Labels}}{{$k}}={{$v}}{{println}}{{end}}'
say() { echo "$*"; }
die() { echo "  ✗ $*"; exit 1; }
idl() { printf '%s' "${1#ZONE_HOST_}" | tr '[:upper:]' '[:lower:]'; }   # ZONE_HOST_NIPPON → nippon

docker inspect "$C" >/dev/null 2>&1 || die "$C 컨테이너가 없다 — 이 스크립트는 있는 central 의 env 만 고친다(처음 만들기는 redeploy-all · 절차서)"
mapfile -t OLD < <(docker inspect "$C" --format "$F_ENV" 2>/dev/null | grep -v -E "$DROP_ENV" | grep -v '^$' || true)
chas() { local kv; for kv in ${OLD[@]+"${OLD[@]}"}; do [ "${kv%%=*}" = "$1" ] && return 0; done; return 1; }
cval() { local kv; for kv in ${OLD[@]+"${OLD[@]}"}; do [ "${kv%%=*}" = "$1" ] && { printf '%s' "${kv#*=}"; return 0; }; done; return 1; }

declare -A ZV ZF
for z in $(docker ps -a --format '{{.Names}}' 2>/dev/null | grep '^durango-zone-' || true); do
  while IFS= read -r kv; do
    [ -n "$kv" ] || continue
    k="${kv%%=*}"; v="${kv#*=}"; [ -n "$v" ] || continue
    if [ -n "${ZV[$k]+x}" ] && [ "${ZV[$k]}" != "$v" ]; then die "$k — 존 둘(${ZF[$k]} · $z)이 다른 값을 가진다 — 어느 쪽이 맞는지 사람 판정(값은 안 찍는다)"; fi
    ZV[$k]="$v"; ZF[$k]="$z"
  done < <(docker inspect "$z" --format "$F_ENV" 2>/dev/null | grep -E '^ZONE_HOST_[A-Z0-9_]+=' || true)
done

say "== fix-central-hosts $(date '+%F %T') — $C$([ "$DRY" = 1 ] && echo ' · 예행(라이브 무변)') =="
[ "${#ZV[@]}" -gt 0 ] || { say "  이 호스트 존 컨테이너에 ZONE_HOST_* 줄이 없다 — 옮길 것 0"; exit 0; }
ADD=(); bad=0
for k in $(printf '%s\n' "${!ZV[@]}" | sort); do
  cv=""; chas "$k" && cv="$(cval "$k")"
  if [ -n "$cv" ]; then
    if [ "$cv" = "${ZV[$k]}" ]; then say "  = $k — central 에 있다 · ${ZF[$k]} 의 그 줄과 같다"
    else say "  ✗ $k — central 값이 ${ZF[$k]} 의 그 줄과 다르다 → 손대지 않는다(어느 쪽이 맞는지 사람 판정)"; bad=1; fi
  else
    say "  + $k — central 에 $(chas "$k" && echo '빈 줄' || echo '없다') → 넣는다(값 = ${ZF[$k]} 의 그 줄)"; ADD+=("$k")
  fi
done
if [ "${#ADD[@]}" -eq 0 ]; then say "  넣을 것 0 — central 그대로(다시 띄우지 않는다)"; exit $bad; fi

IMG="$(docker inspect "$C" --format '{{.Image}}' 2>/dev/null)"; [ -n "$IMG" ] || die "$C 이미지 id 를 못 읽었다"
DATA="$(docker inspect "$C" --format "$F_DATA" 2>/dev/null)"; [ -n "$DATA" ] || die "$C 에 /data 볼륨이 없다 — 이 스크립트가 다루지 않는 꼴"
mapfile -t PORTS < <(docker inspect "$C" --format "$F_PORT" 2>/dev/null | grep -v '^$' || true)
[ "${#PORTS[@]}" -gt 0 ] || die "$C 포트 묶음을 못 읽었다"
mapfile -t LABS < <(docker inspect "$C" --format "$F_LABELS" 2>/dev/null | grep -v '^$' || true)
say "  다시 띄울 것: $C 하나 — 같은 이미지(${IMG:7:12}) · 옛 env ${#OLD[@]}줄 그대로 + ${ADD[*]} · 포트 ${#PORTS[@]} · /data 볼륨 · 라벨 ${#LABS[@]} — 존 무접촉"
if [ "$DRY" = 1 ]; then say "  (예행 — 인자 없이 다시 부르면 위대로 한다)"; exit $bad; fi

docker stop -t 30 "$C" >/dev/null 2>&1 || true   # SIGTERM 먼저(reset-world recreate() 와 같은 꼴)
docker rm "$C" >/dev/null || die "$C 를 못 지웠다 — 멈춘 채다(docker ps -a 로 본다)"
(
  a=()
  for kv in ${OLD[@]+"${OLD[@]}"}; do
    k="${kv%%=*}"; skip=0; for x in "${ADD[@]}"; do [ "$x" = "$k" ] && skip=1; done   # 빈 옛 줄은 넣을 값으로 갈음
    [ "$skip" = 1 ] && continue
    case "$kv" in *=*) export "$kv"; a+=(-e "$k") ;; esac
  done
  for k in "${ADD[@]}"; do export "$k=${ZV[$k]}"; a+=(-e "$k"); done
  for p in "${PORTS[@]}"; do a+=(-p "${p##* }:${p%%/*}"); done
  for lb in ${LABS[@]+"${LABS[@]}"}; do a+=(--label "$lb"); done
  docker run -d --name "$C" --restart unless-stopped -v "$DATA:/data" ${a[@]+"${a[@]}"} "$IMG" >/dev/null
) || die "$C 를 다시 못 띄웠다 — 옛 env 는 이 셸에만 있었다: 같은 줄로 다시 부르면 된다(옛 컨테이너는 지워졌다 · redeploy-hanbando --central 도 같은 env 를 못 되살린다)"
say "  [up] $C"
sleep 2   # redeploy-hanbando.sh 의 central 재생성 뒤 그 2초
st="$(docker inspect "$C" --format '{{.State.Status}}' 2>/dev/null)"
say "  상태 ${st:-?}"
for k in "${ADD[@]}"; do
  id="$(idl "$k")"
  h="$(docker exec "$C" node -e 'const [id]=process.argv.slice(1);try{const t=require("./server/zone-config.js").publicZoneMap(process.env.PUBLIC_HOST||"localhost")[id];console.log(t&&t.host?t.host:"")}catch(e){console.log("")}' "$id" 2>/dev/null | tail -1)"
  if [ -n "$h" ] && [ "$h" = "${ZV[$k]}" ]; then say "  ✓ central /zones → $id: wsUrl 주소 = ${ZF[$k]} 의 그 줄"
  else say "  ✗ central /zones → $id: wsUrl 주소 ≠ ${ZF[$k]} 의 그 줄$([ -z "$h" ] && echo '(central 에서 못 물었다)')"; bad=1; fi
done
[ "$st" = running ] || bad=1
say "  다음: 맥에서 \`bash <(ssh seoul cat /opt/Mini/scripts/update-live.sh) --dry\` 의 [예행 ⑧] central /zones 줄이 ✓ 인지"
exit $bad
