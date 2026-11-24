---
description: 맥 osxphotos 동기화를 주력으로, iCloud 공유앨범을 대안으로 둔 이유
source: scripts/mac-sync/sync.py, src/lib/sync.ts, src/lib/icloud.ts, README.md
category: decisions
---

# 결정 002 — 동기화 방식: osxphotos(주력) vs iCloud 공유앨범(대안)

> **소스:** [scripts/mac-sync/sync.py](../../scripts/mac-sync/sync.py), [src/lib/icloud.ts](../../src/lib/icloud.ts), [README.md](../../README.md)

## 결정
**맥 osxphotos 동기화 에이전트를 주력**으로 하고, iCloud 공유앨범 공개링크 방식은 코드에 남기되 **기본 비활성**(`ICLOUD_SYNC_DISABLED=1`)으로 둔다.

## 맥락
아이 사진을 자동으로, 가급적 원본 화질로, 외부 노출 없이 사진첩에 모으고 싶다. 두 방식을 모두 구현해 비교했다.

## 비교
| | osxphotos (주력) | iCloud 공유앨범 (대안) |
|---|---|---|
| 화질 | 원본 | 공유앨범 축소본 |
| 노출 | 없음(로컬→서버 직접) | "공개 웹사이트" 링크 아는 사람은 열람 가능 |
| 인물 선별 | 사진앱 인식으로 아이만 | 앨범에 넣은 것 전부 |
| 메타(인물·EXIF·위치) | export DB에서 풍부 | 제한적 |
| 의존성 | 맥 + osxphotos + launchd | 비공식 API(Apple이 바꿀 수 있음) |
| 맥 필요 | 켜져 있어야 함 | 불필요(서버 단독) |

## 사유
osxphotos는 **원본 화질·무노출·아이 자동 선별·풍부한 메타**라는 핵심 이점이 모두 크다. iCloud 방식은 맥이 없을 때의 폴백 가치가 있어 제거하지 않고 비활성으로 보존.

## 트레이드오프
- 주력 방식은 맥이 켜져 있어야만 동기화(launchd 1시간 주기).
- 두 동기화 코드 경로를 모두 유지해야 함(중복). 단 미디어 파이프라인·촬영일 묶음은 공유.

## 관련 문서

- [사진 동기화 개요](../overviews/사진_동기화_개요.md)
- [촬영일별 게시물 그룹핑](004_촬영일별_게시물_그룹핑.md)
- 카탈로그 → [INDEX](../INDEX.md)

---

_마지막 컴파일: 2026-06-14_
