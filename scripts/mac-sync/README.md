# 맥 동기화 에이전트 (osxphotos)

맥 사진 앱에서 **특정 인물로 인식된 사진**을 자동으로 찾아 사진첩 서버로 올립니다.
공유앨범·공개링크가 필요 없고, 원본 화질 그대로 올라갑니다.

## 동작 방식

```
사진 앱 (인물 인식) → osxphotos export → /api/ingest 업로드 → 촬영일별 게시물
```

- 업로드된 사진 UUID는 `~/.photo-album-sync-state.txt`에 기록 → 다음 실행에서 건너뜀
- 서버도 UUID로 중복을 거르므로 state 파일을 지워도 사진이 중복되지 않음
- iCloud 최적화로 원본이 맥에 없는 사진은 자동으로 내려받음 (`--download-missing`)
- 보정한 사진은 보정본을 올림
- 서버 용량 제한(기본 300MB)을 넘는 파일은 업로드 없이 건너뛰고 기록함
  (설정의 `max_file_mb`로 조정 — 서버 `INGEST_MAX_FILE_BYTES`와 맞출 것)

## 설치

```bash
# 1. osxphotos 설치
brew install pipx && pipx install osxphotos

# 2. 서버 관리 페이지(/admin)에서 동기화 토큰 발급 후 설정 파일 작성
cat > ~/.photo-album-sync.json <<'EOF'
{
  "server_url": "http://localhost:3000",
  "token": "발급받은_토큰",
  "persons": ["첫째이름", "둘째이름"],
  "include_videos": true
}
EOF

# 3. 첫 실행 (전체 사진 1회 동기화 — 사진이 많으면 오래 걸립니다)
python3 sync.py
```

> 첫 실행 시 터미널에 **사진 라이브러리 접근 권한**(전체 디스크 접근 권한)을 허용해야 합니다.
> 시스템 설정 → 개인정보 보호 및 보안 → 전체 디스크 접근 권한 → 터미널 추가.

## 자동 실행 (1시간마다)

```bash
# plist의 YOUR_USERNAME과 스크립트 경로를 실제 값으로 수정한 뒤:
cp com.family.photo-sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.family.photo-sync.plist

# 로그 확인
tail -f /tmp/photo-sync.log
```

맥이 잠들어 있으면 실행되지 않고, 깨어났을 때 다음 주기에 실행됩니다.

## 인물 이름 확인

사진 앱 → 사이드바 **인물** 에 표시되는 이름과 정확히 일치해야 합니다.
이름을 지정하지 않은 인물은 먼저 사진 앱에서 이름을 붙여주세요.

```bash
# 라이브러리의 인물 목록 확인
osxphotos persons
```
