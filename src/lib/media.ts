import "server-only";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import exifr from "exifr";
import { nanoid } from "nanoid";
import { ensureUploadDir, dateShard, uploadDir } from "./storage";
import { extFromType } from "./mime";
import { MEDIA } from "./constants";

const execFileAsync = promisify(execFile);

const THUMB_WIDTH = 800;
const FULL_MAX_WIDTH = 2400; // 표시용 최대 가로폭

// 아이폰 HEIC 중 보조 이미지(HDR gain map 등) 참조가 많은 파일은 sharp 내장 libheif의
// 보안 제한(iref 16개)에 걸려 디코딩이 거부된다. 맥 네이티브 sips로 우회 변환한다.
// (서버가 macOS에서만 동작하므로 sips는 항상 존재)
async function heicToJpegBuffer(buf: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "heic-"));
  const src = path.join(dir, "in.heic");
  const out = path.join(dir, "out.jpg");
  try {
    await fs.writeFile(src, buf);
    await execFileAsync("sips", ["-s", "format", "jpeg", src, "--out", out]);
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export type ProcessedMedia = {
  type: string;
  path: string; // 업로드 루트 기준 상대경로
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  takenAt: Date | null;
};

// 미디어 버퍼 1개를 저장하고, 이미지면 썸네일·EXIF 촬영일까지 처리한다.
// 직접 업로드와 iCloud 동기화가 공유하는 핵심 파이프라인.
export async function processBuffer(
  buf: Buffer,
  opts: { isVideo: boolean; ext: string },
): Promise<ProcessedMedia> {
  const root = uploadDir();
  const shard = dateShard(new Date());
  await ensureUploadDir(shard);
  const id = nanoid(16);

  if (opts.isVideo) {
    const rel = `${shard}/${id}.${opts.ext || "mp4"}`;
    await fs.writeFile(path.join(root, rel), buf);
    return { type: MEDIA.VIDEO, path: rel, thumbPath: null, width: null, height: null, takenAt: null };
  }

  // EXIF 촬영일 추출
  let takenAt: Date | null = null;
  try {
    const exif = await exifr.parse(buf, ["DateTimeOriginal", "CreateDate"]).catch(() => null);
    const dt = exif?.DateTimeOriginal || exif?.CreateDate;
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) takenAt = dt;
  } catch {
    // EXIF 없음 — 무시
  }

  const fullRel = `${shard}/${id}.jpg`;
  const thumbRel = `${shard}/${id}_thumb.webp`;
  const isHeic = opts.ext === "heic" || opts.ext === "heif";

  // 원본 EXIF 방향을 적용(rotate)하고 표시용 JPEG로 정규화 (HEIC 등도 브라우저 호환)
  async function renderFrom(src: Buffer) {
    await sharp(src, { failOn: "none" })
      .rotate()
      .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(path.join(root, fullRel));

    await sharp(src, { failOn: "none" })
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(root, thumbRel));

    const meta = await sharp(path.join(root, fullRel)).metadata();
    return {
      type: MEDIA.IMAGE,
      path: fullRel,
      thumbPath: thumbRel,
      width: meta.width ?? null,
      height: meta.height ?? null,
      takenAt,
    };
  }

  try {
    return await renderFrom(buf);
  } catch (err) {
    // HEIC가 libheif 제한에 걸리면 맥 네이티브 sips로 변환해 한 번 더 시도
    if (isHeic) {
      try {
        return await renderFrom(await heicToJpegBuffer(buf));
      } catch (sipsErr) {
        console.error("[media] sips 폴백도 실패:", sipsErr);
      }
    } else {
      console.error("[media] sharp 처리 실패, 원본 저장:", err);
    }
    const rel = `${shard}/${id}.${opts.ext || "jpg"}`;
    await fs.writeFile(path.join(root, rel), buf);
    return { type: MEDIA.IMAGE, path: rel, thumbPath: null, width: null, height: null, takenAt };
  }
}

// 직접 업로드된 File 처리
export async function processUpload(file: File): Promise<ProcessedMedia> {
  const buf = Buffer.from(await file.arrayBuffer());
  const isVideo = file.type.startsWith("video/");
  const ext = extFromType(file.type) || (isVideo ? "mp4" : "jpg");
  return processBuffer(buf, { isVideo, ext });
}

// 게시물 삭제 시 연결된 파일들을 디스크에서 제거 (실패해도 무시).
export async function deleteMediaFiles(paths: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    paths.filter(Boolean).map(async (rel) => {
      try {
        await fs.unlink(path.join(uploadDir(), rel as string));
      } catch {
        // 이미 없음 — 무시
      }
    }),
  );
}
