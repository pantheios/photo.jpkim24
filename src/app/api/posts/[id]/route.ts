import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteMediaFiles } from "@/lib/media";
import { ROLES } from "@/lib/constants";

export const runtime = "nodejs";

// 게시물 삭제 — 작성자 본인 또는 관리자만
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { media: true },
  });
  if (!post) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });

  if (post.authorId !== user.id && user.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await deleteMediaFiles(post.media.flatMap((m) => [m.path, m.thumbPath]));
  await prisma.post.delete({ where: { id } }); // 댓글/반응/미디어는 cascade

  return NextResponse.json({ ok: true });
}
