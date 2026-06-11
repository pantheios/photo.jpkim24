import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import exifr from "exifr";
import { nanoid } from "nanoid";
import { ensureUploadDir, dateShard, uploadDir } from "./storage";
import { extFromType } from "./mime";
import { MEDIA } from "./constants";

const THUMB_WIDTH = 800;
const FULL_MAX_WIDTH = 2400; // 표시용 최대 가로폭

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

  try {
    const fullRel = `${shard}/${id}.jpg`;
    const thumbRel = `${shard}/${id}_thumb.webp`;

    // 원본 EXIF 방향을 적용(rotate)하고 표시용 JPEG로 정규화 (HEIC 등도 브라우저 호환)
    await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(path.join(root, fullRel));

    await sharp(buf, { failOn: "none" })
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
  } catch (err) {
    console.error("[media] sharp 처리 실패, 원본 저장:", err);
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
