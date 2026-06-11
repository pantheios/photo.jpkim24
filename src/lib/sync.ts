import "server-only";
import { prisma } from "./prisma";
import { processBuffer } from "./media";
import { fetchStream, fetchAssetUrls, bestDerivative, type ICloudPhoto } from "./icloud";
import { ROLES } from "./constants";

export type SyncResult =
  | { ok: true; added: number; skipped: number; albumName: string | null }
  | { ok: false; error: string };

// 동시 실행 방지 (주기 실행 + 수동 실행이 겹칠 수 있음)
let syncing = false;

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // en-CA → "yyyy-mm-dd"

function extFromUrl(url: string, isVideo: boolean): string {
  const m = new URL(url).pathname.match(/\.([A-Za-z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : isVideo ? "mp4" : "jpg";
}

async function importPhoto(
  photo: ICloudPhoto,
  url: string,
  sourceId: string,
  authorId: string,
): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());

  const processed = await processBuffer(buf, {
    isVideo: photo.isVideo,
    ext: extFromUrl(url, photo.isVideo),
  });

  // 촬영일: EXIF 우선, 없으면 iCloud 메타데이터, 그래도 없으면 현재
  const takenAt = processed.takenAt ?? photo.dateCreated ?? new Date();
  const syncKey = `${sourceId}:${KST_DATE.format(takenAt)}`;

  // 같은 촬영일(KST) 게시물에 합치고, 없으면 생성
  const post =
    (await prisma.post.findUnique({ where: { syncKey } })) ??
    (await prisma.post.create({
      data: {
        authorId,
        source: "icloud",
        syncKey,
        takenAt,
        caption: photo.caption,
      },
    }));

  // 게시물 takenAt은 그날 가장 이른 사진 시각으로 유지
  if (takenAt < post.takenAt) {
    await prisma.post.update({ where: { id: post.id }, data: { takenAt } });
  }

  const order = await prisma.media.count({ where: { postId: post.id } });
  await prisma.media.create({
    data: {
      postId: post.id,
      type: processed.type,
      path: processed.path,
      thumbPath: processed.thumbPath,
      width: processed.width,
      height: processed.height,
      order,
      icloudGuid: photo.photoGuid,
    },
  });
}

export async function syncICloud(): Promise<SyncResult> {
  if (syncing) return { ok: false, error: "이미 동기화가 진행 중입니다." };
  syncing = true;
  try {
    const source = await prisma.albumSource.findFirst();
    if (!source) return { ok: false, error: "연동된 공유앨범이 없습니다." };

    const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN } });
    if (!admin) return { ok: false, error: "관리자 계정이 없습니다." };

    const stream = await fetchStream(source.token);

    // 이미 가져온 사진 제외
    const existing = await prisma.media.findMany({
      where: { icloudGuid: { not: null } },
      select: { icloudGuid: true },
    });
    const seen = new Set(existing.map((m) => m.icloudGuid));
    const fresh = stream.photos.filter((p) => !seen.has(p.photoGuid));

    let added = 0;
    let skipped = 0;

    if (fresh.length > 0) {
      const urls = await fetchAssetUrls(
        stream.host,
        source.token,
        fresh.map((p) => p.photoGuid),
      );

      for (const photo of fresh) {
        const url = urls.get(bestDerivative(photo).checksum);
        if (!url) {
          skipped++;
          continue;
        }
        try {
          await importPhoto(photo, url, source.id, admin.id);
          added++;
        } catch (err) {
          console.error(`[sync] 사진 임포트 실패 (${photo.photoGuid}):`, err);
          skipped++;
        }
      }
    }

    await prisma.albumSource.update({
      where: { id: source.id },
      data: { lastSyncAt: new Date(), name: stream.name ?? source.name },
    });

    if (added > 0 || skipped > 0) {
      console.log(`[sync] iCloud 동기화: +${added}장, 건너뜀 ${skipped}장`);
    }
    return { ok: true, added, skipped, albumName: stream.name };
  } catch (err) {
    console.error("[sync] iCloud 동기화 실패:", err);
    return { ok: false, error: err instanceof Error ? err.message : "동기화에 실패했습니다." };
  } finally {
    syncing = false;
  }
}
