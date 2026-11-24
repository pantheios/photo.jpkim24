import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  DEVICE_REQUEST_COOKIE,
  DEVICE_REQUEST_TTL_SEC,
  genDeviceToken,
  loginWithDeviceToken,
  requestCutoff,
} from "@/lib/device";

// 로그인 화면의 "가족에게 요청하기" — 로그인 없이 호출됨 (미들웨어 제외 경로)

const MAX_PENDING = 20; // 대기 요청이 이만큼 쌓이면 새 요청 거부 (스팸 방지)

function genCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// 요청 생성 (이미 대기 중이면 그대로 돌려줌)
export async function POST(req: NextRequest) {
  const store = await cookies();
  await prisma.deviceRequest.deleteMany({ where: { createdAt: { lt: requestCutoff() } } });

  const existingToken = store.get(DEVICE_REQUEST_COOKIE)?.value;
  if (existingToken) {
    const existing = await prisma.deviceRequest.findUnique({ where: { token: existingToken } });
    if (existing) return NextResponse.json({ code: existing.code });
  }

  const active = await prisma.deviceRequest.findMany({ select: { code: true } });
  if (active.length >= MAX_PENDING) {
    return NextResponse.json(
      { error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." },
      { status: 429 },
    );
  }
  const used = new Set(active.map((r) => r.code));
  let code = genCode();
  while (used.has(code)) code = genCode();

  const token = genDeviceToken();
  await prisma.deviceRequest.create({
    data: { token, code, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null },
  });
  store.set(DEVICE_REQUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DEVICE_REQUEST_TTL_SEC,
    path: "/",
  });
  return NextResponse.json({ code });
}

// 대기 상태 확인 — 승인됐으면 이 브라우저를 기기로 등록하고 로그인시킨다
export async function GET() {
  const store = await cookies();
  const token = store.get(DEVICE_REQUEST_COOKIE)?.value;
  if (!token) return NextResponse.json({ status: "none" });

  const approved = await prisma.deviceLogin.findUnique({ where: { token }, select: { id: true } });
  if (approved) {
    store.delete(DEVICE_REQUEST_COOKIE);
    await loginWithDeviceToken(token);
    return NextResponse.json({ status: "approved" });
  }

  const pending = await prisma.deviceRequest.findUnique({ where: { token } });
  if (pending && pending.createdAt >= requestCutoff()) {
    return NextResponse.json({ status: "pending", code: pending.code });
  }

  store.delete(DEVICE_REQUEST_COOKIE);
  return NextResponse.json({ status: "expired" });
}

// 요청 취소
export async function DELETE() {
  const store = await cookies();
  const token = store.get(DEVICE_REQUEST_COOKIE)?.value;
  if (token) await prisma.deviceRequest.deleteMany({ where: { token } });
  store.delete(DEVICE_REQUEST_COOKIE);
  return NextResponse.json({ ok: true });
}
