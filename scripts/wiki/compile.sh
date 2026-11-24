#!/usr/bin/env bash
# scripts/wiki/compile.sh — LLM Wiki 컴파일 트리거
#
# Usage:
#   bash scripts/wiki/compile.sh                  # 증분 (기본)
#   bash scripts/wiki/compile.sh --full           # 전체 재컴파일
#   bash scripts/wiki/compile.sh --dry-run        # 변경분만 출력
#
# 실제 컴파일은 LLM 에이전트가 수행한다 (Claude Code 권장).
# 이 스크립트는 변경 감지 + LLM 트리거 안내 + Lint 자동 실행만 담당.

set -euo pipefail

WIKI_DIR=".wiki"
LOG_FILE="${WIKI_DIR}/log.md"
MODE="incremental"
DRY_RUN=false

for arg in "$@"; do
    case "${arg}" in
        --full)    MODE="full" ;;
        --dry-run) DRY_RUN=true ;;
        -h|--help)
            head -n 10 "$0"
            exit 0
            ;;
    esac
done

echo "[Wiki] mode=${MODE} dry_run=${DRY_RUN}"

# 1) 변경 감지 — git이 있으면 git diff, 없으면 mtime 기반
if [ "${MODE}" = "incremental" ]; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # .wiki/ 자체 변경은 컴파일 결과이므로 제외
        CHANGED=$(git diff --name-only HEAD 2>/dev/null \
                  | grep -vE "^${WIKI_DIR}/" || true)
        if [ -z "${CHANGED}" ]; then
            CHANGED=$(git diff --cached --name-only HEAD 2>/dev/null \
                      | grep -vE "^${WIKI_DIR}/" || true)
        fi
    else
        # 비-git: log.md보다 최신인 모든 파일 (.wiki/ 제외)
        if [ -f "${LOG_FILE}" ]; then
            CHANGED=$(find . -type f \
                      \( -name "*.md" -o -name "*.yaml" -o -name "*.yml" \
                         -o -name "*.py" -o -name "*.ts" -o -name "*.tsx" \
                         -o -name "*.js" -o -name "*.jsx" \
                         -o -name "*.go" -o -name "*.rs" -o -name "*.java" \) \
                      -newer "${LOG_FILE}" \
                      ! -path "./${WIKI_DIR}/*" \
                      ! -path "./node_modules/*" \
                      ! -path "./.git/*" \
                      -print 2>/dev/null || true)
        else
            MODE="full"
            CHANGED=""
        fi
    fi
else
    CHANGED="<전체>"
fi

if [ "${MODE}" = "incremental" ] && [ -z "${CHANGED}" ]; then
    echo "[Wiki] 변경된 raw 소스 없음. 컴파일 스킵."
    exit 0
fi

echo "[Wiki] 변경 감지된 파일 (LLM이 raw 여부를 판단):"
echo "${CHANGED}" | head -50 | sed 's/^/  - /'
COUNT=$(echo "${CHANGED}" | wc -l)
[ "${COUNT}" -gt 50 ] && echo "  ... (총 ${COUNT}개)"

# 2) Dry-run 종료
if [ "${DRY_RUN}" = "true" ]; then
    echo "[Wiki] --dry-run: LLM 호출 없이 종료."
    exit 0
fi

# 3) LLM 컴파일 안내
cat <<EOF

[Wiki] 다음 단계: Claude Code에서 실행

  /wiki-compile ${MODE}

  또는 직접 프롬프트:
  "위 변경 파일들을 SCHEMA.md 컨벤션에 따라 .wiki/로 컴파일하세요.
   - overviews/ (HOW), references/ (WHAT), decisions/ (WHY) 분류
   - 백링크 양방향 유지
   - INDEX.md 재생성
   - log.md에 이력 추가"

EOF

# 4) Fast Lint 자동 실행 (.wiki가 비어있지 않을 때만)
if [ -f "${WIKI_DIR}/INDEX.md" ] && [ -x "scripts/wiki/lint.sh" ]; then
    echo "[Wiki] Fast Lint 실행..."
    bash scripts/wiki/lint.sh --fast || echo "[Wiki] ⚠ Lint 경고 있음 (확인 필요)"
fi

echo "[Wiki] 컴파일 트리거 완료."
