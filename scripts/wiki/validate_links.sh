#!/usr/bin/env bash
# CI: 모든 마크다운 링크가 실제 파일을 가리키는가
# Output: 깨진 링크 목록 (있을 시 exit 1)

set -euo pipefail

WIKI_DIR=".wiki"
ERRORS=0
SKIP_PATTERN='^(https?:|mailto:|#)'

while IFS= read -r -d '' md_file; do
    # 본문에서 마크다운 링크 추출: [text](href)
    while IFS=$'\t' read -r line_no href; do
        # 외부 URL/앵커는 검증 제외
        [[ "${href}" =~ ${SKIP_PATTERN} ]] && continue

        # 앵커 분리
        target="${href%%#*}"
        [ -z "${target}" ] && continue

        # 상대 경로 해결
        dir=$(dirname "${md_file}")
        resolved="${dir}/${target}"

        # 정규화 (../, ./)
        # 실제 파일/디렉터리 존재 확인
        if [ ! -e "${resolved}" ]; then
            echo "🔴 ${md_file}:${line_no}  → 깨진 링크: ${href}"
            ERRORS=$((ERRORS+1))
        fi
    done < <(grep -nE '\[[^]]+\]\([^)]+\)' "${md_file}" \
             | sed -E 's/^([0-9]+):.*\[[^]]+\]\(([^)]+)\).*/\1\t\2/' \
             | head -200)
done < <(find "${WIKI_DIR}" -name "*.md" -print0)

if [ "${ERRORS}" -gt 0 ]; then
    echo "🔴 깨진 링크 ${ERRORS}건"
    exit 1
fi
echo "✅ 모든 링크 정합 (디렉터리: ${WIKI_DIR})"
