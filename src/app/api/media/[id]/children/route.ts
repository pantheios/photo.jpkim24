import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export const runtime = "nodejs";

// 사진 1장에 찍힌 아이 태그를 통째로 교체 — 관리자만.
// 얼굴 인식이 틀렸을 때 직접 바로잡는 용도.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const childIds: string[] = Array.isArray(body.childIds)
    ? [...new Set<string>(body.childIds.map((x: unknown) => String(x)))]
    : [];

  const media = await prisma.media.findUnique({ where: { id }, select: { id: true } });
  if (!media) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });

  // 실제 존재하는 아이만 반영 (잘못된 id 무시)
  const valid = childIds.length
    ? await prisma.child.findMany({ where: { id: { in: childIds } }, select: { id: true } })
    : [];

  await prisma.$transaction([
    prisma.mediaChild.deleteMany({ where: { mediaId: id } }),
    ...(valid.length
      ? [
          prisma.mediaChild.createMany({
            data: valid.map((c) => ({ mediaId: id, childId: c.id })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, childIds: valid.map((c) => c.id) });
}
