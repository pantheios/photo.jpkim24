---
description: 본 프로젝트 LLM Wiki 카탈로그 — LLM이 최초 진입점으로 사용
category: index
---

# claude_work — Wiki INDEX

> **마지막 컴파일:** 2026-06-14
> **사용법:** LLM이 이 인덱스를 먼저 읽고 관련 문서로 드릴다운한다.

> **프로젝트:** "우리집 사진첩" — 셀프호스팅 가족 사진 공유 서비스(Next.js 16 · Prisma/SQLite).

---

## 빠른 라우팅

| 알고 싶은 것 | 카테고리 |
|------------|---------|
| 이 프로젝트가 뭐 하는지 / 데이터 흐름 / 시스템 구조 | overviews/ |
| 특정 함수/엔드포인트/모듈/스키마 명세 | references/ |
| 왜 이렇게 만들었는지 / 기술 선택 사유 | decisions/ |

---

## Overviews — 큰 그림 (HOW)

- [시스템 아키텍처](overviews/시스템_아키텍처.md) — 컴포넌트·런타임·데이터 흐름·저장 구조
- [도메인 모델](overviews/도메인_모델.md) — 엔티티와 관계, 촬영일별 묶음·정렬·나이 라벨
- [사진 동기화 개요](overviews/사진_동기화_개요.md) — 맥/iCloud/직접 업로드 세 경로와 중복 방지

---

## References — 참조 (WHAT)

- [데이터 모델](references/데이터_모델.md) — Prisma 스키마 전체 모델·필드
- [API 엔드포인트](references/api_엔드포인트.md) — 모든 API 라우트 + 미디어 서빙
- [라이브러리 모듈](references/라이브러리_모듈.md) — src/lib 모듈별 책임
- [상세정보 메타](references/상세정보_메타.md) — `Media.meta` JSON 구조·추출·표시

---

## Decisions — 결정 사유 (WHY)

- [001 저장소 SQLite+파일](decisions/001_저장소_sqlite_파일.md) — 셀프호스팅·간편 백업
- [002 동기화 osxphotos vs iCloud](decisions/002_사진동기화_osxphotos_vs_icloud.md) — 주력/대안 선택
- [003 HEIC sips 폴백](decisions/003_heic_sips_폴백.md) — sharp 실패 시 맥 sips 변환
- [004 촬영일별 게시물 그룹핑](decisions/004_촬영일별_게시물_그룹핑.md) — syncKey 설계
- [005 인증 JWT+초대제](decisions/005_인증_jwt_초대제.md) — 세션·가입·인입 토큰

---

## 메타

- [SCHEMA.md](SCHEMA.md) — 위키 컨벤션·보안 규칙·우선순위
- [log.md](log.md) — 컴파일 이력

---

_마지막 컴파일: 2026-06-14_
