---
description: 본 위키의 구조·컨벤션·Ingest/Lint 규칙을 정의하는 사용자 소유 스키마
category: schema
owner: 사용자
---

# Wiki SCHEMA

> **소유:** 사용자 (LLM은 읽기만 가능, 수정 금지)
> **목적:** 컴파일된 위키 문서가 따라야 할 형식·규칙·우선순위를 명문화한다.

---

## 1. 디렉터리 구조

```
.wiki/
├── SCHEMA.md            # 이 문서 (사용자 소유)
├── INDEX.md             # 카탈로그 (LLM 진입점)
├── log.md               # 변경 이력 (append-only)
│
├── overviews/           # HOW — 큰 그림 (시스템·아키텍처·도메인)
├── references/          # WHAT — 참조 (API·모듈·함수·스키마)
└── decisions/           # WHY — 결정 사유 (ADR)
```

### 선택 카테고리 (raw에 풍부하면 컴파일러가 자동 생성)
- `runbooks/` — 운영 절차 (배포·장애 대응)
- `glossary/` — 도메인 용어
- `comparisons/` — 기술/라이브러리 비교

---

## 2. 문서 컨벤션

| 항목 | 규칙 |
|------|------|
| 파일명 | 자연어 (한국어 권장, 공백 대신 `_`) |
| frontmatter | `description`(1줄), `source`(원본 경로), `category` |
| 소스 출처 | 본문 시작에 `> **소스:**` 블록 |
| 백링크 | 하단 `## 관련 문서` 섹션 양방향 |
| 마지막 컴파일 | 하단 `_마지막 컴파일: YYYY-MM-DD_` |
| 토큰 상한 | **문서 1개당 최대 5,000 토큰. 초과 시 분할.** |

---

## 3. 카테고리별 컴파일 입력

| 카테고리 | 주된 raw 입력 |
|---------|--------------|
| overviews/ | README.md, 폴더 구조, 주요 진입점 코드 헤더 |
| references/ | 코드 주석(docstring), OpenAPI/Swagger 명세, 타입 정의 |
| decisions/ | README "Why" 섹션, 코드 주석의 NOTE/WHY/TODO, 기존 ADR |

---

## 4. 보안 규칙 — 민감 정보 절대 금지

- 비밀번호, API 키, 토큰, 시크릿, 개인정보 위키 문서 포함 금지
- 환경 변수는 이름만 기록 (값은 `.env` 또는 시크릿 매니저에 둘 것)
- Lint가 다음 패턴 자동 스캔:
  - `password\s*[:=]\s*["'][^"']{4,}`
  - `api[_-]?key\s*[:=]\s*["'][^"']{8,}`
  - `(token|secret)\s*[:=]\s*["'][^"']{8,}`
  - `Bearer\s+[A-Za-z0-9\-_=]{20,}`
  - `sk-[A-Za-z0-9]{20,}` (OpenAI), `AKIA[0-9A-Z]{16}` (AWS), `AIza[0-9A-Za-z\-_]{35}` (Google)

---

## 5. 지식 충돌 해소 우선순위

1. 사용자 직접 작성 문서 (README, ADR 원문)
2. 코드 자체 (실제 동작이 권위)
3. Wiki 컴파일 문서 (코드/문서에서 파생 — 모순 발견 시 재컴파일)

Lint에서 코드 ↔ Wiki 모순 감지 시 🔴 오류로 리포트한다.

---

## 6. Ingest 규칙

| 트리거 | 동작 |
|--------|------|
| README/주요 코드 변경 | `/wiki-compile` (증분) |
| API 명세 갱신 | `/wiki-compile` |
| 신규 모듈 추가 | LLM이 references/에 1:1 요약 → 관련 overviews 갱신 → INDEX 재생성 |
| 전체 재컴파일 | `/wiki-compile --full` |

---

## 7. Lint 규칙

| 종류 | 주기 | 검사 |
|------|------|------|
| Fast Lint | 매 컴파일 | INDEX 링크 정합성, 백링크 양방향 |
| Full Lint | 5회 컴파일 누적 | + 민감정보, SCHEMA 컨벤션, 토큰 상한 |
| 부패 감지 | 마지막 컴파일 30일 경과 | 🟡 14일 / 🔴 30일 |

---

## 8. CI 통합 (선택)

`.gitlab-ci.yml` 또는 GitHub Actions에서 `.wiki/**` 변경 시:
- `validate_links.sh` — 링크 검증
- `validate_index.sh` — INDEX 정합성
- `scan_secrets.sh` — 민감정보 스캔
- `validate_schema.sh` — frontmatter/토큰 상한/백링크/푸터

머지 차단(`allow_failure: false`).

---

_초기 컴파일: TODO_
