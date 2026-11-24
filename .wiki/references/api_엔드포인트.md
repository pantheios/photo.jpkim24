---
description: 인증·업로드·동기화·게시물·미디어 서빙 등 모든 API 라우트 명세
source: src/app/api, src/app/media/[...path]/route.ts, src/middleware.ts
category: references
---

# API 엔드포인트

> **소스:** [src/app/api](../../src/app/api), [src/app/media/[...path]/route.ts](../../src/app/media/[...path]/route.ts)

미들웨어가 `api/auth`·`api/ingest`·정적자원을 제외한 모든 경로에 로그인을 강제(미인증 API/미디어는 401).

## 인증 (`api/auth/*`)
- `POST /api/auth/signup` — 가입. 첫 사용자는 관리자(초대코드 불필요), 이후는 유효한 미사용·미만료 초대코드 필수. 비번 6자 이상. 성공 시 세션 쿠키 설정.
- `POST /api/auth/login` — 이메일/비번 로그인, 세션 쿠키 발급.
- `POST /api/auth/logout` — 세션 삭제.

## 초대 (`api/invites`) — 관리자
- `GET` — 초대 목록(사용자 포함). `POST` — 새 초대코드 발급(헷갈리는 글자 제외 8자).

## 아이 (`api/child`)
- `GET` — 아이 목록(생일 빠른 순). `POST`/`DELETE`(관리자) — 추가/삭제. 삭제해도 게시물엔 영향 없음.

## 직접 업로드 (`api/upload`)
- `POST` — 로그인 필요. multipart `files[]`+`caption`. 50MB·허용 타입 검증, 이미지 EXIF 중 가장 이른 날짜를 게시물 촬영일로. 한 번에 한 Post 생성.

## 맥 에이전트 인입 (`api/ingest`) — Bearer 토큰
- `POST` — 헤더 `Authorization: Bearer <IngestToken>`. multipart: `file`, `uuid`(필수), `isVideo`, `takenAt`, `persons`(JSON 배열), `meta`(JSON). 동작: 토큰 검증 → `externalId=uuid` 중복이면 `{duplicate:true}` → 미디어 파이프라인 → 촬영일(KST)별 Post(`syncKey="osx:<날짜>"`)에 묶음 → persons를 등록 아이와 매칭해 MediaChild 태깅 → meta 저장. 300MB 초과 413.

## 인입 토큰 (`api/ingest-tokens`) — 관리자
- `GET` 목록 / `POST` 발급(값은 응답에서만 노출) / `DELETE` 폐기.

## iCloud (`api/icloud`, `api/icloud/sync`) — 관리자
- 공유앨범 링크 등록/해제, 수동 동기화 트리거. 엔진은 [sync.ts](../../src/lib/sync.ts).

## 게시물·댓글·반응
- `GET/DELETE /api/posts/[id]` — 조회/삭제(작성자 또는 관리자).
- `GET/POST /api/posts/[id]/comments`, `DELETE /api/comments/[id]`.
- `POST /api/posts/[id]/reactions` — 이모지 토글(사용자당 이모지 1개).

## 미디어 태그 (`api/media/[id]/children`) — 관리자
- `PUT` — body `{childIds:[]}`로 사진의 아이 태그를 통째 교체. 얼굴 인식 교정용. 존재하지 않는 아이 id는 무시.

## 보호된 미디어 서빙 (`/media/[...path]`)
- `GET` — 로그인 필요(미들웨어). 업로드 루트 안으로 경로 안전결합(디렉터리 탈출 차단), `Content-Type` 추론. **Range 요청 지원**(206) — 동영상 seek. 캐시 `private, immutable`.

## 관련 문서

- [사진 동기화 개요](../overviews/사진_동기화_개요.md)
- [데이터 모델](데이터_모델.md)
- [라이브러리 모듈](라이브러리_모듈.md)
- [인증·초대제](../decisions/005_인증_jwt_초대제.md)
- 카탈로그 → [INDEX](../INDEX.md)

---

_마지막 컴파일: 2026-06-14_
