import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { REACTION_EMOJIS } from "@/lib/constants";

export const runtime = "nodejs";

// 이모지 반응 토글 — 같은 이모지를 다시 누르면 취소
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: postId } = await params;
  const body = await req.json().catch(() => ({}));
  const emoji = String(body.emoji || "");
  if (!REACTION_EMOJIS.includes(emoji as (typeof REACTION_EMOJIS)[number])) {
    return NextResponse.json({ error: "허용되지 않은 이모지입니다." }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });

  const existing = await prisma.reaction.findUnique({
    where: { postId_userId_emoji: { postId, userId: user.id, emoji } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ active: false });
  }

  await prisma.reaction.create({ data: { postId, userId: user.id, emoji } });
  return NextResponse.json({ active: true });
}
