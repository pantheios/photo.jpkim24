import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

const genToken = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  40,
);

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === ROLES.ADMIN ? user : null;
}

// 토큰 목록 (토큰 값은 생성 직후 한 번만 노출)
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const tokens = await prisma.ingestToken.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json({ tokens });
}

// 새 에이전트 토큰 발급
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim() || "맥 동기화";
  const created = await prisma.ingestToken.create({
    data: { token: genToken(), name },
  });
  // token 값은 이 응답에서만 내려준다
  return NextResponse.json({
    token: { id: created.id, name: created.name, value: created.token },
  });
}

// 토큰 폐기
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  await prisma.ingestToken.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
