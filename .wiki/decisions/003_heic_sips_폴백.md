---
description: 아이폰 HEIC가 sharp(libheif)에서 실패할 때 맥 sips로 우회 변환하는 이유
source: src/lib/media.ts
category: decisions
---

# 결정 003 — HEIC 처리: sharp 실패 시 sips 폴백

> **소스:** [src/lib/media.ts](../../src/lib/media.ts)

## 결정
이미지 처리는 기본적으로 **sharp**로 하되, HEIC/HEIF가 디코딩 실패하면 맥 네이티브 **`sips`**로 JPEG 변환 후 다시 sharp에 태워 표시본·썸네일을 만든다.

## 맥락
아이폰 사진은 대부분 HEIC. 일부 HEIC(HDR gain map 등 보조 이미지의 참조가 많은 파일)는 sharp 내장 libheif의 보안 제한(iref 참조 16개)에 걸려 "Security limit exceeded"로 디코딩이 거부된다. 이 경우 기존엔 원본 HEIC를 그대로 저장 → 브라우저가 HEIC를 못 열어 **사진이 깨져 보임**(실제로 수백 장 발생).

## 사유
- 서버가 **macOS에서 동작**하므로 `sips`가 항상 존재하고, 문제의 HEIC를 안정적으로 JPEG로 변환한다.
- 폴백은 **sharp 실패 시에만** 동작 → 정상 이미지의 빠른 경로는 유지, 비용은 실패분에만.
- 변환된 JPEG는 sharp가 정상 처리 → 썸네일·해상도까지 복구.

## 트레이드오프
- **macOS 의존**(`sips`). 다른 OS로 서버를 옮기면 이 폴백은 무력화 → libheif 갱신이나 다른 변환기 필요.
- 임시 파일 입출력 비용(실패한 HEIC에 한함).
- 이미 깨진 채 저장된 과거 파일은 별도 일괄 재생성으로 복구함.

## 관련 문서

- [라이브러리 모듈](../references/라이브러리_모듈.md) — media.ts
- [시스템 아키텍처](../overviews/시스템_아키텍처.md)
- 카탈로그 → [INDEX](../INDEX.md)

---

_마지막 컴파일: 2026-06-14_
