# 우리집 사진첩 🍼

bebememo를 대체하는 셀프호스팅 가족 사진 공유 서비스.
초대받은 가족만 들어올 수 있는 비공개 공간에, 사진을 올리고 댓글·이모지 반응을 남길 수 있습니다.
아기 생일을 등록하면 모든 사진에 **"생후 N일 / N개월"** 이 자동 표시됩니다.

## 주요 기능

- **가족 초대제** — 첫 가입자가 관리자. 관리자가 발급한 초대코드로만 가입 가능
- **사진/동영상 업로드** — 다중 업로드, 썸네일 자동 생성, EXIF 촬영일 자동 추출, HEIC 지원
- **iCloud 공유앨범 동기화** — 공유앨범의 "공개 웹사이트" 링크만 등록하면 30분마다 새 사진을 자동으로 가져와 촬영일별 게시물로 묶음. 아이폰에서 공유앨범에 사진 추가 = 업로드 끝
- **타임라인 피드** — 촬영일 기준 시간순, 아기 나이 라벨 표시
- **댓글 + 이모지 반응** — ❤️ 😍 👏 🥹 😂 🎉
- **PWA** — 폰 홈화면에 추가하면 앱처럼 사용
- **SQLite + 로컬 파일 저장** — 백업은 `/data` 폴더 복사가 전부

## 기술 스택

Next.js 16 (App Router) · Prisma 7 + SQLite (better-sqlite3 어댑터) · sharp · Tailwind CSS 4 · JWT 세션 (jose)

## 로컬 개발

```bash
cp .env.example .env          # SESSION_SECRET 교체: openssl rand -base64 32
npm install
npx prisma migrate deploy
npm run dev
```

http://localhost:3000 접속 → 첫 가입자가 자동으로 관리자가 됩니다.

## NAS / 집 서버 배포 (Docker)

```bash
SESSION_SECRET=$(openssl rand -base64 32) docker compose up -d --build
```

- 포트: `3000` (compose에서 변경 가능)
- 데이터: `album-data` 볼륨의 `/data` (SQLite DB + 업로드 원본). 이 폴더만 백업하면 됨
- 컨테이너 시작 시 마이그레이션 자동 적용
- 외부 접속: 리버스 프록시(HTTPS) 뒤에 두는 것을 권장. PWA 설치와 보안 쿠키에 HTTPS 필요

## iCloud 공유앨범 연동 방법

1. 아이폰 **사진 앱 → 공유 앨범** 선택 → 참여자 화면에서 **"공개 웹사이트"** 켜기
2. 생성된 `https://www.icloud.com/sharedalbum/#B0…` 링크 복사
3. 사진첩 **관리 → iCloud 공유앨범 연동**에 붙여넣기
4. 끝. 이후 공유앨범에 사진을 추가하면 자동으로 가져옵니다

> ⚠️ 비공식 API를 사용하므로 Apple이 형식을 바꾸면 동작이 멈출 수 있습니다.
> 공개 링크는 URL을 아는 사람이라면 원본 앨범을 볼 수 있으니 링크 관리에 주의하세요.

환경변수:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | — | SQLite 경로 (`file:/data/app.db`) |
| `UPLOAD_DIR` | `./data/uploads` | 사진 저장 경로 |
| `SESSION_SECRET` | — | JWT 서명 키 (필수) |
| `ICLOUD_SYNC_INTERVAL_MIN` | `30` | 자동 동기화 간격(분), 최소 5 |
| `ICLOUD_SYNC_DISABLED` | — | `1`이면 자동 동기화 끔 |

## 구조

```
src/
  app/            페이지 + API 라우트
    api/auth/     가입(초대코드)·로그인·로그아웃
    api/upload/   다중 업로드 (sharp 썸네일 + EXIF)
    api/icloud/   공유앨범 연동·수동 동기화
    media/        보호된 사진 서빙 (Range 지원)
  lib/
    icloud.ts     공유앨범 webstream API 클라이언트
    sync.ts       동기화 엔진 (촬영일별 게시물 그룹핑)
    media.ts      이미지 파이프라인 (썸네일·EXIF·HEIC→JPEG)
    age.ts        "생후 N일" 계산
  instrumentation-node.ts  주기 동기화 타이머
prisma/           스키마 + 마이그레이션
```
