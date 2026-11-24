#!/usr/bin/env bash
# CI: 모든 위키 문서가 SCHEMA.md 컨벤션을 준수하는가
#   1) frontmatter (description, category) 존재
#   2) 문서당 토큰 5,000 이하 (Karpathy 자문)
#   3) "## 관련 문서" 섹션 존재 (백링크)
#   4) "_마지막 컴파일: YYYY-MM-DD_" 푸터 존재

set -euo pipefail

WIKI_DIR=".wiki"
ERRORS=0

# 토큰 추정 (러프): 한국어/영문 혼합 평균 1토큰 ≈ 2.5 byte
TOKEN_LIMIT=5000
BYTE_LIMIT=$((TOKEN_LIMIT * 25 / 10))   # ≈ 12,500 bytes

while IFS= read -r -d '' md_file; do
    # INDEX/SCHEMA/log은 컨벤션 일부 면제
    base=$(basename "${md_file}")
    case "${base}" in
        INDEX.md|SCHEMA.md|log.md) IS_META=1 ;;
        *) IS_META=0 ;;
    esac

    # 1) frontmatter
    head_block=$(head -10 "${md_file}")
    if ! echo "${head_block}" | head -1 | grep -q '^---$'; then
        echo "🔴 ${md_file}: frontmatter 누락"
        ERRORS=$((ERRORS+1))
    else
        if ! echo "${head_block}" | grep -q '^description:'; then
            echo "🔴 ${md_file}: frontmatter description 누락"
            ERRORS=$((ERRORS+1))
        fi
        if ! echo "${head_block}" | grep -q '^category:'; then
            echo "🔴 ${md_file}: frontmatter category 누락"
            ERRORS=$((ERRORS+1))
        fi
    fi

    # 2) 토큰 상한 (메타 제외)
    if [ "${IS_META}" -eq 0 ]; then
        bytes=$(wc -c < "${md_file}")
        if [ "${bytes}" -gt "${BYTE_LIMIT}" ]; then
            est=$((bytes * 10 / 25))
            echo "🔴 ${md_file}: 토큰 추정 ${est} > ${TOKEN_LIMIT} (분할 필요)"
            ERRORS=$((ERRORS+1))
        fi
    fi

    # 3) 관련 문서 섹션 (메타/log 제외)
    if [ "${IS_META}" -eq 0 ]; then
        if ! grep -qE '^## 관련 문서' "${md_file}"; then
            echo "🔴 ${md_file}: '## 관련 문서' 섹션 누락"
            ERRORS=$((ERRORS+1))
        fi
    fi

    # 4) 마지막 컴파일 푸터 (메타 제외)
    if [ "${IS_META}" -eq 0 ]; then
        if ! tail -3 "${md_file}" | grep -qE '_마지막 컴파일: [0-9]{4}-[0-9]{2}-[0-9]{2}_'; then
            echo "🔴 ${md_file}: '_마지막 컴파일: YYYY-MM-DD_' 푸터 누락"
            ERRORS=$((ERRORS+1))
        fi
    fi

done < <(find "${WIKI_DIR}" -name "*.md" -print0)

if [ "${ERRORS}" -gt 0 ]; then
    echo "🔴 SCHEMA 컨벤션 ${ERRORS}건 위반"
    exit 1
fi
echo "✅ SCHEMA 컨벤션 모두 준수"
