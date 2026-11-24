import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { describeDevice, genDeviceToken, publicOrigin, requestCutoff } from "@/lib/device";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === ROLES.ADMIN ? user : null;
}

// 기기 목록 + 승인 대기 요청 + 연결할 수 있는 계정 목록 (링크는 발급 직후 한 번만 노출)
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const [devices, users, pending] = await Promise.all([
    prisma.deviceLogin.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.deviceRequest.findMany({
      where: { createdAt: { gte: requestCutoff() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const requests = pending.map((r) => ({
    id: r.id,
    code: r.code,
    device: describeDevice(r.userAgent),
    createdAt: r.createdAt,
  }));
  return NextResponse.json({ devices, users, requests });
}

// 새 기기 자동 로그인 링크 발급
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const name = String(body.name || "").trim() || "가족 폰";
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) return NextResponse.json({ error: "계정을 선택해주세요." }, { status: 400 });

  const created = await prisma.deviceLogin.create({
    data: { token: genDeviceToken(), name, userId: user.id },
  });
  // 링크(토큰)는 이 응답에서만 내려준다
  return NextResponse.json({
    device: {
      id: created.id,
      name: created.name,
      url: `${publicOrigin(req)}/device/${created.token}`,
    },
  });
}

// 기기 해제 — 이후 자동 재로그인 안 됨 (이미 발급된 세션은 만료(최대 30일)까지 유지)
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  await prisma.deviceLogin.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
