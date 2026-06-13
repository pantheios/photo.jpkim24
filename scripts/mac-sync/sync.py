#!/usr/bin/env python3
"""맥 사진 라이브러리 → 우리집 사진첩 동기화 에이전트.

osxphotos로 특정 인물로 인식된 사진을 export한 뒤 서버 /api/ingest로 업로드한다.
업로드된 사진의 UUID는 state 파일에 기록되어 다음 실행에서 export 자체를 건너뛴다.
서버도 UUID로 중복을 걸러주므로 state 파일이 사라져도 사진이 중복되지는 않는다.

설정: ~/.photo-album-sync.json
{
  "server_url": "http://localhost:3000",
  "token": "<관리 페이지에서 발급한 토큰>",
  "persons": ["첫째이름", "둘째이름"],
  "include_videos": true,
  "max_file_mb": 300
}

max_file_mb는 서버의 INGEST_MAX_FILE_BYTES와 맞춘다 (기본 300).
초과 파일은 업로드 시도 없이 건너뛰고 state에 기록한다.

(아이가 한 명이면 "persons": ["이름"] 또는 예전 형식 "person": "이름"도 동작.
두 아이가 같이 나온 사진은 한 번만 올라간다 — UUID로 중복 제거.)

필요: pipx install osxphotos  (또는 pip3 install osxphotos)
"""

import json
import subprocess
import sys
import urllib.error
import urllib.request
import uuid as uuid_mod
from datetime import datetime
from pathlib import Path

CONFIG_PATH = Path.home() / ".photo-album-sync.json"
STATE_PATH = Path.home() / ".photo-album-sync-state.txt"  # 업로드 완료 UUID 목록
DEFAULT_EXPORT_DIR = Path.home() / ".photo-album-sync-export"
LOG_PREFIX = f"[photo-sync {datetime.now():%Y-%m-%d %H:%M:%S}]"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif", ".tiff"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm"}

# 서버 src/lib/constants.ts의 INGEST_MAX_FILE_BYTES와 동일하게 유지
DEFAULT_MAX_FILE_MB = 300


def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {msg}", flush=True)


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        log(f"설정 파일이 없습니다: {CONFIG_PATH}")
        log('예시: {"server_url": "http://nas.local:3000", "token": "...", "person": "아기이름"}')
        sys.exit(1)
    cfg = json.loads(CONFIG_PATH.read_text())
    # "persons" 또는 "person" 키, 문자열·배열 모두 허용
    persons = cfg.get("persons") or cfg.get("person") or []
    if isinstance(persons, str):
        persons = [persons]
    cfg["persons"] = [str(p).strip() for p in persons if p and str(p).strip()]
    for key in ("server_url", "token"):
        if not cfg.get(key):
            log(f"설정에 {key}가 없습니다.")
            sys.exit(1)
    if not cfg["persons"]:
        log("설정에 persons(인물 이름 목록)가 없습니다.")
        sys.exit(1)
    cfg["server_url"] = cfg["server_url"].rstrip("/")
    cfg["max_file_bytes"] = int(cfg.get("max_file_mb") or DEFAULT_MAX_FILE_MB) * 1024 * 1024
    # export 작업 폴더 — 용량 큰 라이브러리면 외장디스크 경로 권장
    cfg["export_dir"] = Path(cfg.get("export_dir") or DEFAULT_EXPORT_DIR)
    return cfg


def load_state() -> set:
    if STATE_PATH.exists():
        return {line.strip() for line in STATE_PATH.read_text().splitlines() if line.strip()}
    return set()


def append_state(photo_uuid: str) -> None:
    with STATE_PATH.open("a") as f:
        f.write(photo_uuid + "\n")


def export_new_photos(cfg: dict, export_dir: Path) -> list:
    """state에 없는 인물 사진을 export. 파일명 = <uuid>.<ext>

    영구 폴더 + --update라 중단돼도 다음 실행에서 이어서 진행된다.
    진행 표시는 osxphotos가 직접 출력한다."""
    export_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "osxphotos", "export", str(export_dir),
        "--filename", "{uuid}",
        "--edited-suffix", "",    # 보정본도 순수 UUID 파일명으로 (기본값은 _edited 접미사)
        "--update",               # 이미 export된 파일은 건너뜀 (이어하기)
        "--touch-file",           # 파일 mtime = 촬영시각 → 업로드 시 takenAt으로 전송
        "--download-missing",     # iCloud 최적화로 원본이 맥에 없으면 내려받기
        "--skip-raw",
        "--skip-original-if-edited",  # 보정본이 있으면 보정본만
    ]
    for person in cfg["persons"]:  # 여러 명이면 OR 조건
        cmd += ["--person", person]
    if STATE_PATH.exists():
        cmd += ["--skip-uuid-from-file", str(STATE_PATH)]
    if not cfg.get("include_videos", True):
        cmd += ["--only-photos"]

    log(f"osxphotos export 실행 (인물: {', '.join(cfg['persons'])}) → {export_dir}")
    result = subprocess.run(cmd)  # 출력을 가로채지 않음 — 진행 표시가 그대로 보임
    if result.returncode != 0:
        log("osxphotos 실행 실패 (위 출력 참고)")
        sys.exit(1)

    files = [
        p for p in export_dir.iterdir()
        if p.is_file() and p.suffix.lower() in (IMAGE_EXTS | VIDEO_EXTS)
    ]
    log(f"업로드 대기 파일: {len(files)}개")
    return sorted(files)


def photo_uuid_of(path: Path) -> str:
    """파일명에서 UUID 추출: '<uuid>.jpg', '<uuid> (1).jpg', '<uuid>_edited.jpg' 모두 대응"""
    return path.stem.split(" ")[0].removesuffix("_edited")


def load_persons_by_uuid(export_dir: Path) -> dict:
    """export 결과 DB(.osxphotos_export.db)에서 사진별 인물 목록을 읽는다.

    서버가 인물 이름을 등록된 아이와 매칭해 아이별 태깅에 사용한다.
    DB가 없거나 읽기 실패해도 동기화 자체는 계속된다(태깅만 생략)."""
    import shutil
    import sqlite3
    import tempfile

    src = export_dir / ".osxphotos_export.db"
    if not src.exists():
        return {}
    result: dict = {}
    try:
        # export 직후 잠겨 있을 수 있어 임시 복사본을 읽는다
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        shutil.copy2(src, tmp_path)
        con = sqlite3.connect(tmp_path)
        for uid, info in con.execute("SELECT uuid, photoinfo FROM photoinfo"):
            try:
                persons = json.loads(info).get("persons") or []
                names = sorted({p for p in persons if p and p != "_UNKNOWN_"})
                if names:
                    result[uid] = names
            except Exception:  # noqa: BLE001
                continue
        con.close()
        tmp_path.unlink(missing_ok=True)
    except Exception as e:  # noqa: BLE001
        log(f"인물 정보 로드 실패(태깅 생략): {e}")
        return {}
    return result


def upload(cfg: dict, path: Path, persons: list | None = None) -> dict:
    """multipart/form-data 업로드 (표준 라이브러리만 사용)"""
    photo_uuid = photo_uuid_of(path)
    is_video = path.suffix.lower() in VIDEO_EXTS

    boundary = uuid_mod.uuid4().hex
    parts = []

    def field(name: str, value: str) -> None:
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
        )

    field("uuid", photo_uuid)
    field("isVideo", "1" if is_video else "0")
    if persons:
        field("persons", json.dumps(persons, ensure_ascii=False))
    # --touch-file로 mtime = 촬영시각. EXIF가 없는 사진·동영상의 날짜 폴백으로 쓰인다.
    taken_at = datetime.fromtimestamp(path.stat().st_mtime).astimezone()
    field("takenAt", taken_at.isoformat())

    file_bytes = path.read_bytes()
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
        f"filename=\"{path.name}\"\r\nContent-Type: application/octet-stream\r\n\r\n".encode()
        + file_bytes
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        cfg["server_url"] + "/api/ingest",
        data=body,
        headers={
            "Authorization": f"Bearer {cfg['token']}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        return json.loads(res.read().decode())


def main() -> None:
    cfg = load_config()
    state = load_state()
    log(f"기존 업로드 기록: {len(state)}장")

    files = export_new_photos(cfg, cfg["export_dir"])
    if not files:
        log("새 사진 없음. 종료.")
        return

    persons_by_uuid = load_persons_by_uuid(cfg["export_dir"])
    if persons_by_uuid:
        log(f"인물 정보 확보: {len(persons_by_uuid)}장")

    ok = dup = skip = fail = 0
    total = len(files)
    for i, f in enumerate(files, 1):
        photo_uuid = photo_uuid_of(f)
        if photo_uuid in state:
            f.unlink(missing_ok=True)  # 이미 올라간 파일 — 정리만
            continue
        size = f.stat().st_size
        if size > cfg["max_file_bytes"]:
            # 서버 제한 초과 — 업로드해봐야 413이고, 2GB 이상은 macOS 소켓 한계로
            # 전송 자체가 EINVAL로 실패하므로 시도 없이 건너뛰기로 기록
            log(f"용량 초과로 건너뜀 ({f.name}, {size // 1024 // 1024}MB)")
            append_state(photo_uuid)
            state.add(photo_uuid)
            f.unlink(missing_ok=True)
            skip += 1
            continue
        try:
            res = upload(cfg, f, persons_by_uuid.get(photo_uuid))
            if res.get("duplicate"):
                dup += 1
            else:
                ok += 1
            append_state(photo_uuid)
            state.add(photo_uuid)
            f.unlink(missing_ok=True)  # 업로드 완료 → 디스크 정리
        except urllib.error.HTTPError as e:
            if e.code == 413:
                # 서버 용량 제한 초과 — 재시도해도 소용없으니 건너뛰기로 기록
                log(f"용량 초과로 건너뜀 ({f.name}, {f.stat().st_size // 1024 // 1024}MB)")
                append_state(photo_uuid)
                state.add(photo_uuid)
                f.unlink(missing_ok=True)
                skip += 1
            else:
                fail += 1
                log(f"업로드 실패 ({f.name}): HTTP {e.code}")
        except Exception as e:  # noqa: BLE001 — 한 장 실패해도 계속
            fail += 1
            log(f"업로드 실패 ({f.name}): {e}")

        if i % 10 == 0 or i == total:
            log(f"업로드 진행: {i}/{total} (성공 {ok}, 중복 {dup}, 건너뜀 {skip}, 실패 {fail})")

    log(f"완료: 업로드 {ok}장, 서버 중복 {dup}장, 용량 초과 건너뜀 {skip}장, 실패 {fail}장")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
