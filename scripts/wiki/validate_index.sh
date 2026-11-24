#!/usr/bin/env bash
# CI: 모든 위키 문서가 INDEX.md에 등록되어 있는가 + INDEX 링크가 실제 문서를 가리키는가

set -euo pipefail

WIKI_DIR=".wiki"
INDEX="${WIKI_DIR}/INDEX.md"
ERRORS=0

if [ ! -f "${INDEX}" ]; then
    echo "🔴 INDEX.md 없음: ${INDEX}"
    exit 1
fi

# 1) INDEX에 등록된 경로 추출
INDEX_LINKS=$(grep -oE '\([a-zA-Z0-9_가-힣/.\-]+\.md\)' "${INDEX}" \
              | tr -d '()' \
              | sort -u)

# 2) 실제 위키 문서 목록 (INDEX/SCHEMA/log 제외)
# (macOS BSD find 호환: -printf 대신 cd 후 상대경로 + ./ 제거)
ACTUAL_DOCS=$( (cd "${WIKI_DIR}" && find . -name "*.md" \
              ! -name "INDEX.md" ! -name "SCHEMA.md" ! -name "log.md") \
              | sed 's|^\./||' \
              | sort -u)

# 3) INDEX 미등록 문서 검출
echo "[validate_index] 미등록 문서 검사:"
for doc in ${ACTUAL_DOCS}; do
    # INDEX의 href는 INDEX.md 기준 상대 경로
    if ! echo "${INDEX_LINKS}" | grep -qF "${doc}"; then
        echo "  🔴 INDEX에 없음: ${doc}"
        ERRORS=$((ERRORS+1))
    fi
done

# 4) INDEX의 죽은 링크 (없는 파일 가리킴)
echo "[validate_index] INDEX 링크의 실제 파일 존재 검사:"
while IFS= read -r link; do
    # INDEX는 .wiki/INDEX.md 이므로 .wiki/<link>가 실제 경로
    target="${WIKI_DIR}/${link}"
    if [ ! -f "${target}" ]; then
        echo "  🔴 INDEX 링크 깨짐: ${link} (→ ${target})"
        ERRORS=$((ERRORS+1))
    fi
done <<< "${INDEX_LINKS}"

if [ "${ERRORS}" -gt 0 ]; then
    echo "🔴 INDEX 정합성 ${ERRORS}건 실패"
    exit 1
fi
echo "✅ INDEX ↔ 위키 정합 완료"
