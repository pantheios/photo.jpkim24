import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: postId } = await params;
  const body = await req.json().catch(() => ({}));
  const text = String(body.body || "").trim();
  if (!text) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
  if (text.length > 1000)
    return NextResponse.json({ error: "댓글이 너무 깁니다." }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });

  const comment = await prisma.comment.create({
    data: { postId, authorId: user.id, body: text },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return NextResponse.json({ comment });
}
