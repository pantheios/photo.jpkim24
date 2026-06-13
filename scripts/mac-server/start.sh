#!/bin/bash
# 우리집 사진첩 서버 시작 스크립트 (launchd에서 실행)
# 설정은 외장SSD의 server.env에서 읽는다 — 드라이브가 안 꽂혀 있으면 종료(launchd가 재시도).
set -euo pipefail

ENV_FILE="$HOME/Library/Application Support/photo-album/server.env"
DATA_DIR="/Volumes/ORICO_SSD/photo-album"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date '+%F %T') 설정 파일이 없습니다: $ENV_FILE" >&2
  sleep 60
  exit 1
fi

# 외장SSD 마운트 확인 (node가 TCC로 막히면 로그로 구분되도록 stat 먼저 시도)
if ! stat "$DATA_DIR" >/dev/null 2>&1; then
  echo "$(date '+%F %T') 외장SSD($DATA_DIR)에 접근할 수 없습니다 — 마운트 또는 권한(전체 디스크 접근) 확인. 60초 후 재시도됩니다." >&2
  sleep 60   # launchd 재시작 폭주 방지
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

cd "$APP_DIR"
exec /opt/homebrew/bin/node node_modules/.bin/next start
