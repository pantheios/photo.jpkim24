#!/usr/bin/env bash
# scripts/wiki/lint.sh — Wiki 건강 점검
#
# Fast Lint (매 Ingest):  bash scripts/wiki/lint.sh --fast
# Full Lint (5회마다):    bash scripts/wiki/lint.sh --full
# 부패 감지:               bash scripts/wiki/lint.sh --staleness

set -euo pipefail

WIKI_DIR=".wiki"
MODE="${1:-${WIKI_LINT_MODE:---fast}}"
ERRORS=0

run() {
    echo "  → $1"
    if bash "scripts/wiki/$2" "${@:3}"; then
        echo "    ✅ PASS"
    else
        echo "    🔴 FAIL"
        ERRORS=$((ERRORS+1))
    fi
}

echo "[Lint] mode=${MODE}"

case "${MODE}" in
    --fast)
        run "INDEX.md 링크 검증" "validate_links.sh"
        run "INDEX ↔ 위키 정합성" "validate_index.sh"
        ;;

    --full)
        run "INDEX.md 링크 검증" "validate_links.sh"
        run "INDEX ↔ 위키 정합성" "validate_index.sh"
        run "민감정보 스캔" "scan_secrets.sh"
        run "SCHEMA 컨벤션 검증" "validate_schema.sh"
        ;;

    --staleness)
        # KTNET 본 적용에서는 wiki_stale_check 뷰 조회
        # 데모에서는 log.md의 마지막 컴파일 날짜 추출
        if [ -f "${WIKI_DIR}/log.md" ]; then
            LAST_DATE=$(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' "${WIKI_DIR}/log.md" | head -1)
            echo "  마지막 컴파일: ${LAST_DATE:-unknown}"
            if [ -n "${LAST_DATE:-}" ]; then
                AGE=$(( ( $(date +%s) - $(date -d "${LAST_DATE}" +%s 2>/dev/null || echo 0) ) / 86400 ))
                echo "  경과: ${AGE}일"
                if [ "${AGE}" -gt 30 ]; then
                    echo "  🔴 STALE (30일 초과) — 재컴파일 필요"
                    ERRORS=$((ERRORS+1))
                elif [ "${AGE}" -gt 14 ]; then
                    echo "  🟡 WARNING (14일 초과)"
                else
                    echo "  ✅ OK"
                fi
            fi
        fi
        ;;

    *)
        echo "Usage: $0 [--fast|--full|--staleness]"
        exit 1
        ;;
esac

if [ "${ERRORS}" -gt 0 ]; then
    echo "[Lint] 🔴 ${ERRORS} 검사 실패"
    exit 1
fi
echo "[Lint] ✅ 모든 검사 통과"
