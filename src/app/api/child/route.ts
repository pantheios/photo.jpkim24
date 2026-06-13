import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export const runtime = "nodejs";

// 아이 프로필 목록 (생일 빠른 순 = 첫째부터)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const children = await prisma.child.findMany({ orderBy: { birthDate: "asc" } });
  return NextResponse.json({ children });
}

// 아이 추가 — 관리자만
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const birthDate = new Date(String(body.birthDate || ""));
  if (!name) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  if (Number.isNaN(birthDate.getTime()))
    return NextResponse.json({ error: "생일을 올바르게 입력해주세요." }, { status: 400 });

  const child = await prisma.child.create({ data: { name, birthDate } });
  return NextResponse.json({ child });
}

// 아이 삭제 — 관리자만 (게시물에는 영향 없음)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  await prisma.child.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
