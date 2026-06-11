import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export const runtime = "nodejs";

// 단일 아기 프로필 (가장 최근 1개를 사용)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const child = await prisma.child.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ child });
}

// 아기 프로필 생성/수정 — 관리자만
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const birthRaw = String(body.birthDate || "");
  const birthDate = new Date(birthRaw);
  if (!name) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  if (Number.isNaN(birthDate.getTime()))
    return NextResponse.json({ error: "생일을 올바르게 입력해주세요." }, { status: 400 });

  const existing = await prisma.child.findFirst({ orderBy: { createdAt: "desc" } });
  const child = existing
    ? await prisma.child.update({ where: { id: existing.id }, data: { name, birthDate } })
    : await prisma.child.create({ data: { name, birthDate } });

  return NextResponse.json({ child });
}
