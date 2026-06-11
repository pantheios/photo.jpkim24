import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { processUpload } from "@/lib/media";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_FILE_BYTES,
} from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const caption = String(form.get("caption") || "").trim();

  if (files.length === 0) {
    return NextResponse.json({ error: "사진이나 동영상을 선택해주세요." }, { status: 400 });
  }

  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB): ${f.name}` },
        { status: 400 },
      );
    }
    const ok =
      ACCEPTED_IMAGE_TYPES.includes(f.type) || ACCEPTED_VIDEO_TYPES.includes(f.type);
    if (!ok) {
      return NextResponse.json(
        { error: `지원하지 않는 형식입니다: ${f.name} (${f.type})` },
        { status: 400 },
      );
    }
  }

  const processed = await Promise.all(files.map(processUpload));

  // 촬영일: 이미지 EXIF 중 가장 이른 날짜, 없으면 현재 시각
  const dates = processed
    .map((p) => p.takenAt)
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const takenAt = dates[0] ?? new Date();

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      caption: caption || null,
      takenAt,
      media: {
        create: processed.map((p, i) => ({
          type: p.type,
          path: p.path,
          thumbPath: p.thumbPath,
          width: p.width,
          height: p.height,
          order: i,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, postId: post.id });
}
