---
description: LLM Wiki 컴파일 이력 (append-only)
category: log
---

# Wiki Compile Log

> append-only. 새 컴파일은 **위에 추가**한다 (최신이 위).

---

## 2026-06-14 — 위키 초기화

**모드:** `init`
**소스:** (아직 컴파일 전 — `/wiki-compile`로 raw 처리)
**생성:**
- `SCHEMA.md`, `INDEX.md`, `log.md`
- `overviews/`, `references/`, `decisions/` (빈 디렉터리)
- `scripts/wiki/{compile,lint,validate_links,validate_index,scan_secrets,validate_schema}.sh`

**다음 단계:**
1. `SCHEMA.md` 검토 후 프로젝트 특수 규칙 추가
2. `/wiki-compile` 으로 README/코드 주석/API 명세 컴파일
3. 결과 검토 후 git commit

---

## 2026-06-14 — full

**모드:** `--full` (위키 비어 있어 첫 전체 컴파일)
**소스 변경:** README.md, prisma/schema.prisma, src/lib/**, src/app/api/**, src/app/{page,post}.tsx, src/components/MediaGallery.tsx, scripts/mac-sync/sync.py
**위키 변경:**
- 생성(overviews): 시스템_아키텍처, 도메인_모델, 사진_동기화_개요
- 생성(references): 데이터_모델, api_엔드포인트, 라이브러리_모듈, 상세정보_메타
- 생성(decisions): 001 저장소, 002 동기화 선택, 003 HEIC sips, 004 촬영일 그룹핑, 005 인증
- 수정: INDEX.md 재생성
**Lint:** PASS
**Secrets:** PASS
**Git SHA:** 992f875
**Self-confidence:** 0.9 (코드 직접 분석 기반)

---

<!-- 향후 컴파일은 이 위에 추가. 형식:
## YYYY-MM-DD — <full|incremental|lint>

**모드:** `--full` 또는 `--incremental`
**소스 변경:** <git diff 또는 변경 파일>
**위키 변경:**
- 생성: ...
- 수정: ...
- 삭제: ...
**토큰:** in <input> / out <output>
**Lint:** PASS / FAIL
**Secrets:** PASS / FAIL
**Git SHA:** <hash>
-->
