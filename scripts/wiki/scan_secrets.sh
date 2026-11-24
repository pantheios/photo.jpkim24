#!/usr/bin/env bash
# CI: 위키 문서에 민감정보가 포함되어 있는가 (P0 보안)
#
# 검출 패턴 (SCHEMA.md §4):
#   password = ...
#   api_key = ...
#   token = ...
#   secret = ...
#   Bearer <token>
#
# 화이트리스트: 패턴 자체를 명시하는 정의 문장은 허용.
#   예: "password\\s*[:=]" (정의), "password = secret123" (위반)

set -euo pipefail

WIKI_DIR=".wiki"
HITS=0
TMP=$(mktemp)
trap 'rm -f "${TMP}"' EXIT

# ripgrep이 있으면 사용, 없으면 grep
if command -v rg >/dev/null 2>&1; then
    SEARCH() { rg -nP "$@" "${WIKI_DIR}" || true; }
else
    SEARCH() {
        local pattern="$1"; shift
        grep -rnP "${pattern}" "${WIKI_DIR}" "$@" 2>/dev/null || true
    }
fi

PATTERNS=(
    '(?i)password\s*[:=]\s*["'"'"'][^"'"'"']{4,}'
    '(?i)api[_-]?key\s*[:=]\s*["'"'"'][^"'"'"']{8,}'
    '(?i)\btoken\s*[:=]\s*["'"'"'][^"'"'"']{8,}'
    '(?i)\bsecret\s*[:=]\s*["'"'"'][^"'"'"']{8,}'
    'Bearer\s+[A-Za-z0-9\-_\.=]{20,}'
    'sk-[A-Za-z0-9]{20,}'                 # OpenAI 키 형식
    'AKIA[0-9A-Z]{16}'                    # AWS Access Key
    'AIza[0-9A-Za-z\-_]{35}'              # Google API Key
)

echo "[scan_secrets] ${WIKI_DIR} 스캔..."
for pattern in "${PATTERNS[@]}"; do
    RESULT=$(SEARCH "${pattern}")
    if [ -n "${RESULT}" ]; then
        echo "${RESULT}" >> "${TMP}"
    fi
done

# 화이트리스트 — 정의/예시 패턴 제외 (정규식 자체를 인용한 라인)
if [ -s "${TMP}" ]; then
    # 정규식 인용("..."나 백틱 안에 있는 패턴)은 학습 목적으로 허용
    grep -vE '`[^`]*(password|api_key|token|secret)[^`]*`' "${TMP}" \
        | grep -vE '"\^?\\?[a-z_]+\\\?\s*\[' \
        | grep -vE '#\s*예:|#\s*example' \
        > "${TMP}.filtered" || true
    if [ -s "${TMP}.filtered" ]; then
        echo "🔴 민감정보 의심 라인 검출:"
        cat "${TMP}.filtered"
        HITS=$(wc -l < "${TMP}.filtered")
    fi
fi

if [ "${HITS}" -gt 0 ]; then
    echo "🔴 ${HITS} 위반"
    exit 1
fi
echo "✅ 민감정보 패턴 미검출"
