# 우리집 사진첩 — 셀프호스팅용 이미지
FROM node:22-bookworm-slim AS base
WORKDIR /app

# --- 의존성 설치 (dev 포함: 빌드 + prisma CLI에 필요) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- 빌드 ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 빌드 시점엔 실제 DB가 필요 없지만 prisma generate에 URL 형식이 필요
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npm run build

# --- 실행 ---
FROM base AS run
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
