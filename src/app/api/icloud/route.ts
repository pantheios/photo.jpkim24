import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tokenFromUrl, fetchStream } from "@/lib/icloud";
import { ROLES } from "@/lib/constants";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) return null;
  return user;
}

// 연동된 공유앨범 조회
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const source = await prisma.albumSource.findFirst();
  return NextResponse.json({ source });
}

// 공유앨범 링크 등록 (기존 연동은 교체)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const token = tokenFromUrl(String(body.url || ""));
  if (!token) {
    return NextResponse.json(
      { error: "공유앨범 링크 형식이 아닙니다. icloud.com/sharedalbum/#B0… 링크를 붙여넣어주세요." },
      { status: 400 },
    );
  }

  // 링크 검증: 실제로 앨범을 읽을 수 있는지 확인
  let albumName: string | null = null;
  let photoCount = 0;
  try {
    const stream = await fetchStream(token);
    albumName = stream.name;
    photoCount = stream.photos.length;
  } catch {
    return NextResponse.json(
      { error: "앨범을 읽을 수 없습니다. 공유앨범에서 '공개 웹사이트'가 켜져 있는지 확인해주세요." },
      { status: 400 },
    );
  }

  await prisma.albumSource.deleteMany({});
  const source = await prisma.albumSource.create({
    data: { token, name: albumName },
  });

  return NextResponse.json({ source, photoCount });
}

// 연동 해제 (이미 가져온 사진은 그대로 둠)
export async function DELETE() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  await prisma.albumSource.deleteMany({});
  return NextResponse.json({ ok: true });
}
