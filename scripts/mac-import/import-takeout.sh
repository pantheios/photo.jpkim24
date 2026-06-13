#!/bin/bash
# 구글포토 테이크아웃 → 사진 앱(iCloud) 임포트 — 견고 버전
#
# 사진 앱은 iCloud 업로드·얼굴 인식으로 자주 바빠서, 한 번에 많이 넘기면
# AppleEvent 타임아웃(-1712)으로 죽는다. 그래서:
#   - 작은 청크(기본 100장)로 나눠 넣어 사진 앱이 매번 숨 쉴 틈을 준다
#   - 청크가 실패하면 사진 앱이 회복할 때까지 기다렸다 자동 재시도
#   - --resume: 이미 임포트된 파일은 osxphotos DB로 즉시 건너뜀 (몇 번 죽어도 이어감)
#   - --skip-dups: 기존 라이브러리에 있는 사진은 중복으로 건너뜀
#   - "수정됨"(구글 보정본)은 제외 — 사이드카가 없어 날짜가 깨짐
#
# 사용: iTerm에서  bash ~/claude_work/scripts/mac-import/import-takeout.sh
# 중단해도 다시 같은 명령으로 실행하면 이어서 진행된다.
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"

SRC="/Volumes/T7/google/Takeout/Google 포토"
ROOT_EXTRA="/Volumes/T7/google"
REPORTS="/Volumes/ORICO_SSD/photo-album/import-reports"
REPORT="$REPORTS/import-robust.csv"
mkdir -p "$REPORTS"

CHUNK=100          # 한 번에 사진 앱에 넘길 파일 수 (작을수록 안정적, 느림)
MAX_RETRY=6        # 청크 실패 시 재시도 횟수
RECOVER_WAIT=45    # 재시도 전 사진 앱 회복 대기(초)

EDITED_NFC='수정됨'
EDITED_NFD=$(python3 -c "import unicodedata,sys;sys.stdout.write(unicodedata.normalize('NFD','수정됨'))")

ensure_photos() {
  pgrep -x Photos >/dev/null 2>&1 || { open -a Photos; sleep 15; }
}

echo "[$(date '+%H:%M:%S')] 대상 파일 목록 작성 중..."
# NUL 구분으로 안전하게 배열에 적재 (보정본 제외)
files=()
while IFS= read -r -d '' f; do files+=("$f"); done < <(
  find "$SRC" "$ROOT_EXTRA" -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.heic' -o -iname '*.png' \
       -o -iname '*.gif' -o -iname '*.webp' -o -iname '*.tiff' \
       -o -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' \) \
    ! -name "*${EDITED_NFC}*" ! -name "*${EDITED_NFD}*" -print0
)
TOTAL=${#files[@]}
echo "[$(date '+%H:%M:%S')] 대상 ${TOTAL}개 — 청크 ${CHUNK}장씩, 실패 시 최대 ${MAX_RETRY}회 재시도"
echo

ensure_photos

i=0
chunk_no=0
failed_chunks=0
while (( i < TOTAL )); do
  chunk=("${files[@]:i:CHUNK}")
  chunk_no=$((chunk_no + 1))
  from=$((i + 1)); to=$((i + ${#chunk[@]}))
  echo "[$(date '+%H:%M:%S')] 청크 ${chunk_no}: ${from}~${to} / ${TOTAL}"

  attempt=1
  ok=0
  while (( attempt <= MAX_RETRY )); do
    if osxphotos import --resume --skip-dups --sidecar \
         --report "$REPORT" --append "${chunk[@]}"; then
      ok=1
      break
    fi
    echo "   ⚠ 실패 (시도 ${attempt}/${MAX_RETRY}) — ${RECOVER_WAIT}초 대기 후 사진 앱 회복 시도"
    sleep "$RECOVER_WAIT"
    ensure_photos
    attempt=$((attempt + 1))
  done

  if (( ok == 0 )); then
    failed_chunks=$((failed_chunks + 1))
    echo "   ✗ 청크 ${chunk_no} ${MAX_RETRY}회 실패 — 다음 실행 시 --resume으로 재시도됩니다"
  fi
  i=$((i + CHUNK))
done

echo
echo "[$(date '+%H:%M:%S')] 종료 — 총 ${chunk_no}청크, 실패 ${failed_chunks}청크"
if (( failed_chunks > 0 )); then
  echo "실패한 청크가 있습니다. 같은 명령을 한 번 더 실행하면 이어서 재시도됩니다."
fi