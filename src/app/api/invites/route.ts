import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// 헷갈리는 글자(0/O, 1/I) 제외한 코드
const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    include: { usedBy: { select: { name: true, email: true } } },
  });
  return NextResponse.json({ invites });
}

export async function POST() {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const invite = await prisma.invite.create({
    data: { code: genCode(), createdById: user.id },
  });
  return NextResponse.json({ invite });
}
