import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { requestCutoff } from "@/lib/device";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === ROLES.ADMIN ? user : null;
}

// 기기 요청 승인 — 요청 토큰 그대로 기기로 등록 (요청한 브라우저가 다음 확인 때 로그인됨)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const userId = String(body.userId || "");

  const request = id ? await prisma.deviceRequest.findUnique({ where: { id } }) : null;
  if (!request || request.createdAt < requestCutoff()) {
    return NextResponse.json({ error: "요청이 만료됐어요. 다시 요청해달라고 해주세요." }, { status: 404 });
  }
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) return NextResponse.json({ error: "계정을 선택해주세요." }, { status: 400 });

  const name = String(body.name || "").trim() || `${user.name} 폰`;
  await prisma.$transaction([
    prisma.deviceLogin.create({ data: { token: request.token, name, userId: user.id } }),
    prisma.deviceRequest.delete({ where: { id: request.id } }),
  ]);
  return NextResponse.json({ ok: true });
}

// 요청 거절
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  await prisma.deviceRequest.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
