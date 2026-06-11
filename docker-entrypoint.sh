#!/bin/sh
set -e

# 업로드 디렉터리 보장
mkdir -p "${UPLOAD_DIR:-/data/uploads}"

# DB 마이그레이션 적용 (최초 실행 시 테이블 생성)
echo "▶ DB 마이그레이션 적용 중…"
npx prisma migrate deploy

echo "▶ 서버 시작 (port ${PORT:-3000})"
exec npm run start -- --port "${PORT:-3000}" --hostname "${HOSTNAME:-0.0.0.0}"
