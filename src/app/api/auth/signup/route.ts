import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { setSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const inviteCode = String(body.inviteCode || "").trim();

  if (!email || !name || !password) {
    return NextResponse.json({ error: "이름, 이메일, 비밀번호를 모두 입력해주세요." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  let invite: { id: string } | null = null;
  if (!isFirstUser) {
    if (!inviteCode) {
      return NextResponse.json({ error: "초대코드가 필요합니다." }, { status: 400 });
    }
    const found = await prisma.invite.findUnique({ where: { code: inviteCode } });
    if (!found) {
      return NextResponse.json({ error: "유효하지 않은 초대코드입니다." }, { status: 400 });
    }
    if (found.usedById) {
      return NextResponse.json({ error: "이미 사용된 초대코드입니다." }, { status: 400 });
    }
    if (found.expiresAt && found.expiresAt < new Date()) {
      return NextResponse.json({ error: "만료된 초대코드입니다." }, { status: 400 });
    }
    invite = found;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role: isFirstUser ? ROLES.ADMIN : ROLES.MEMBER,
    },
  });

  if (invite) {
    await prisma.invite.update({ where: { id: invite.id }, data: { usedById: user.id } });
  }

  await setSession({ userId: user.id, role: user.role });
  return NextResponse.json({ ok: true, isFirstUser });
}
