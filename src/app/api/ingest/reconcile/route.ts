import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteMediaFiles } from "@/lib/media";

export const runtime = "nodejs";

// 맥 에이전트가 보낸 "현재 라이브러리에 살아있는 (아이 인물) UUID"와 사진첩을 대조해,
// iCloud/사진 앱에서 삭제된 사진을 사진첩에서도 제거한다.
// (osxphotos로 올라온 사진만 대상. 직접 업로드·iCloud 공유앨범 사진은 건드리지 않음)
//
// 안전장치:
//  - liveUuids가 비어 있으면 거부 (라이브러리 미마운트/조회 실패로 인한 전삭제 방지)
//  - 삭제 후보가 사진첩의 30%를 넘으면 force 없이는 보류 (글리치 방지)

const MAX_DELETE_RATIO = 0.3;
const CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });
  }
  const ingestToken = await prisma.ingestToken.findUnique({ where: { token } });
  if (!ingestToken) {
    return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const liveUuids: string[] = Array.isArray(body.liveUuids) ? body.liveUuids.map(String) : [];
  const force = body.force === true;
  const dryRun = body.dryRun === true;

  if (liveUuids.length === 0) {
    return NextResponse.json(
      { error: "빈 라이브러리 목록 — 삭제 안전장치 발동" },
      { status: 400 },
    );
  }
  const live = new Set(liveUuids);

  // osxphotos 출처 사진만 대상
  const albumMedia = await prisma.media.findMany({
    where: { externalId: { not: null }, post: { source: "osxphotos" } },
    select: { id: true, externalId: true, path: true, thumbPath: true, postId: true },
  });

  const toDelete = albumMedia.filter((m) => m.externalId && !live.has(m.externalId));

  // 과다 삭제 방지
  if (
    !force &&
    albumMedia.length > 50 &&
    toDelete.length > albumMedia.length * MAX_DELETE_RATIO
  ) {
    return NextResponse.json({
      aborted: true,
      wouldDelete: toDelete.length,
      album: albumMedia.length,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldDelete: toDelete.length,
      album: albumMedia.length,
    });
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ ok: true, deleted: [] });
  }

  const postIds = [...new Set(toDelete.map((m) => m.postId))];

  // 미디어 삭제 (MediaChild는 cascade) + 파일 정리 — 큰 목록은 나눠서 처리
  for (const part of chunk(toDelete, CHUNK)) {
    await prisma.media.deleteMany({ where: { id: { in: part.map((m) => m.id) } } });
    await deleteMediaFiles(part.flatMap((m) => [m.path, m.thumbPath]));
  }

  // 사진이 모두 사라진 게시물 정리
  let removedPosts = 0;
  for (const part of chunk(postIds, CHUNK)) {
    const empty = await prisma.post.findMany({
      where: { id: { in: part }, media: { none: {} } },
      select: { id: true },
    });
    if (empty.length) {
      await prisma.post.deleteMany({ where: { id: { in: empty.map((p) => p.id) } } });
      removedPosts += empty.length;
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: toDelete.map((m) => m.externalId),
    removedPosts,
  });
}
