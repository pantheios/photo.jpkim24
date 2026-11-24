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
  "max_file_mb": 300,
  "delete_removed": true
}

max_file_mb는 서버의 INGEST_MAX_FILE_BYTES와 맞춘다 (기본 300).
초과 파일은 업로드 시도 없이 건너뛰고 state에 기록한다.

delete_removed(기본 true): 사진 앱/iCloud에서 완전히 삭제된 사진을 사진첩에서도
제거한다. 라이브러리의 현재 인물(아이) UUID와 대조해 사라진 것만 지우며, 삭제 후보가
사진첩의 30%를 넘으면(마운트 실패 등) 안전상 보류한다. 끄려면 false.
(주의: 사진 앱에서 아이 얼굴 태그가 제거된 사진도 삭제 후보가 될 수 있다. 단 원본은
Photos/iCloud에 그대로 남고, 다시 태그되면 재업로드된다.)

(아이가 한 명이면 "persons": ["이름"] 또는 예전 형식 "person": "이름"도 동작.
두 아이가 같이 나온 사진은 한 번만 올라간다 — UUID로 중복 제거.)

필요: pipx install osxphotos  (또는 pip3 install osxphotos)
"""

from __future__ import annotations  # 타입 표기 지연 평가 — 시스템 python 3.9에서도 'list | None' 동작

import json
import re
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


def remove_from_state(uuids: list) -> None:
    """삭제된 UUID를 state에서 제거 → 나중에 사진 앱에서 복원되면 재업로드된다."""
    if not STATE_PATH.exists() or not uuids:
        return
    drop = set(uuids)
    kept = sorted(u for u in load_state() if u not in drop)
    STATE_PATH.write_text("\n".join(kept) + ("\n" if kept else ""))


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


def _build_meta(info: dict) -> dict:
    """photoinfo JSON → 서버에 저장할 상세정보(카메라·렌즈·촬영설정·위치)."""
    exif = info.get("exif_info") or {}
    place = info.get("place")
    meta = {
        "camera": exif.get("camera_model"),
        "make": exif.get("camera_make"),
        "lens": exif.get("lens_model"),
        "aperture": exif.get("aperture"),
        "focalLength": exif.get("focal_length"),
        "iso": exif.get("iso"),
        "shutter": exif.get("shutter_speed"),
        "latitude": info.get("latitude"),
        "longitude": info.get("longitude"),
        "place": place.get("address_str") if isinstance(place, dict) else None,
    }
    return {k: v for k, v in meta.items() if v not in (None, "", [])}


def load_photoinfo_by_uuid(export_dir: Path) -> dict:
    """export 결과 DB(.osxphotos_export.db)에서 사진별 인물·상세정보를 읽는다.

    인물은 등록된 아이와 매칭해 태깅에, 메타는 상세정보 표시에 쓰인다.
    DB가 없거나 읽기 실패해도 동기화 자체는 계속된다(태깅/상세정보만 생략)."""
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
        for uid, info_json in con.execute("SELECT uuid, photoinfo FROM photoinfo"):
            try:
                info = json.loads(info_json)
                persons = info.get("persons") or []
                names = sorted({p for p in persons if p and p != "_UNKNOWN_"})
                result[uid] = {"persons": names, "meta": _build_meta(info)}
            except Exception:  # noqa: BLE001
                continue
        con.close()
        tmp_path.unlink(missing_ok=True)
    except Exception as e:  # noqa: BLE001
        log(f"사진 메타 로드 실패(태깅/상세정보 생략): {e}")
        return {}
    return result


def upload(cfg: dict, path: Path, persons: list | None = None, meta: dict | None = None) -> dict:
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
    if meta:
        field("meta", json.dumps(meta, ensure_ascii=False))
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


_UUID_RE = re.compile(r"^[0-9A-Fa-f-]{36}$")


def load_live_uuids(persons: list) -> list:
    """현재 라이브러리에서 해당 인물(아이)로 살아있는 사진 UUID (휴지통 제외).

    사진첩에 올라온 것과 동일한 인물 범위로 조회한다. 여기 없는데 사진첩엔 있는
    사진 = 삭제됐거나 인물 태그가 빠진 것 → 삭제 후보.
    (전체 라이브러리 조회는 1.5GB DB 사본 생성으로 너무 느려 인물 범위로 한정.)

    2필드를 주는 건 osxphotos 일부 버전에서 단일 --field 출력이 비는 문제를 피하려는 것.
    Photos 앱이 라이브러리를 점유하면(얼굴 인식 등) 느려질 수 있어 타임아웃 시 빈 목록 반환."""
    cmd = ["osxphotos", "query", "--field", "uuid", "{uuid}", "--field", "y", "{created.year}"]
    for person in persons:
        cmd += ["--person", person]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except Exception as e:  # noqa: BLE001
        log(f"라이브러리 UUID 조회 실패(삭제 반영 생략): {e}")
        return []
    if result.returncode != 0:
        log("라이브러리 UUID 조회 실패(삭제 반영 생략)")
        return []
    uuids = []
    for line in result.stdout.splitlines():
        first = line.strip().split(",")[0].strip('"')
        if _UUID_RE.match(first):
            uuids.append(first)
    return uuids


def reconcile_deletions(cfg: dict) -> None:
    """사진 앱/iCloud에서 삭제된 사진을 사진첩에서도 제거."""
    if not cfg.get("delete_removed", True):
        return
    live = load_live_uuids(cfg["persons"])
    if not live:
        log("삭제 반영: 라이브러리 UUID 0개 — 안전상 건너뜀")
        return

    body = json.dumps({"liveUuids": live}).encode()
    req = urllib.request.Request(
        cfg["server_url"] + "/api/ingest/reconcile",
        data=body,
        headers={
            "Authorization": f"Bearer {cfg['token']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            data = json.loads(res.read().decode())
    except Exception as e:  # noqa: BLE001
        log(f"삭제 반영 요청 실패: {e}")
        return

    if data.get("aborted"):
        log(
            f"삭제 반영 보류: 삭제 후보 {data.get('wouldDelete')}/{data.get('album')}장이 "
            "안전 한도(30%) 초과 — 라이브러리 상태 확인 필요. 정말 삭제하려면 수동 실행."
        )
        return
    deleted = data.get("deleted") or []
    if deleted:
        remove_from_state(deleted)
        log(f"삭제 반영: 사진첩에서 {len(deleted)}장 삭제 (게시물 {data.get('removedPosts', 0)}개 정리)")
    else:
        log("삭제 반영: 삭제할 사진 없음")


def main() -> None:
    cfg = load_config()
    state = load_state()
    log(f"기존 업로드 기록: {len(state)}장")

    files = export_new_photos(cfg, cfg["export_dir"])
    if not files:
        log("새 사진 없음.")
        reconcile_deletions(cfg)  # 새 사진이 없어도 삭제는 반영
        return

    info_by_uuid = load_photoinfo_by_uuid(cfg["export_dir"])
    if info_by_uuid:
        log(f"인물·상세정보 확보: {len(info_by_uuid)}장")

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
            pinfo = info_by_uuid.get(photo_uuid) or {}
            res = upload(cfg, f, pinfo.get("persons"), pinfo.get("meta"))
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

    reconcile_deletions(cfg)  # 삭제된 사진 반영

    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
