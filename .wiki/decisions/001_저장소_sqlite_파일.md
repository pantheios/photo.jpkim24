---
description: SQLite + 로컬 파일 저장을 택한 이유 — 셀프호스팅·간편 백업
source: README.md, prisma/schema.prisma, src/lib/storage.ts
category: decisions
---

# 결정 001 — SQLite + 로컬 파일 저장

> **소스:** [README.md](../../README.md), [prisma/schema.prisma](../../prisma/schema.prisma), [src/lib/storage.ts](../../src/lib/storage.ts)

## 결정
메타데이터는 **SQLite**(Prisma 7 + better-sqlite3 어댑터), 원본·썸네일은 **로컬 파일시스템**(`UPLOAD_DIR`, 연/월 샤딩)에 저장한다. 별도 DB 서버·오브젝트 스토리지를 쓰지 않는다.

## 맥락
가족용 비공개 사진첩을 NAS/집 서버(또는 맥+외장SSD)에서 셀프호스팅하는 것이 목표. 사용자 수는 가족 단위로 적고, 트래픽이 낮으며, 운영을 단순하게 유지하는 것이 최우선.

## 사유
- **백업이 폴더 복사 한 번** — `/data`(DB + uploads)만 복사하면 전체 백업. 외부 의존 없음.
- **운영 부담 최소화** — DB 데몬 불필요, 단일 프로세스. Docker 볼륨 하나 또는 외장SSD 마운트로 끝.
- **충분한 성능** — 가족 규모 동시성에 SQLite로 차고 넘침. 피드는 페이지네이션(15개)으로 부하 관리.

## 트레이드오프
- 수평 확장·고동시성 쓰기에는 부적합(이 프로젝트엔 무관).
- 파일이 DB 밖에 있어 정합성은 앱이 책임(삭제 시 `deleteMediaFiles`로 파일 정리).
- 저장소가 단일 디스크 → 디스크 장애 대비는 사용자 백업에 의존.

## 관련 문서

- [시스템 아키텍처](../overviews/시스템_아키텍처.md)
- [데이터 모델](../references/데이터_모델.md)
- 카탈로그 → [INDEX](../INDEX.md)

---

_마지막 컴파일: 2026-06-14_
