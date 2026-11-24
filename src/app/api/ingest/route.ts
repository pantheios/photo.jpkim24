import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processBuffer } from "@/lib/media";
import { ROLES, INGEST_MAX_FILE_BYTES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

// 맥 동기화 에이전트(osxphotos) 전용 업로드 엔드포인트.
// 세션 쿠키 대신 Bearer 토큰으로 인증한다 (미들웨어에서 제외됨).
//
// multipart/form-data:
//   file    — 사진/동영상 1개
//   uuid    — Photos 라이브러리 UUID (중복 임포트 방지)
//   takenAt — ISO 촬영시각 (선택; EXIF가 없을 때 폴백)
//   isVideo — "1"이면 동영상

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm"]);

// 에이전트가 보낸 인물 목록(JSON 배열) 파싱 — 빈 값/형식 오류는 빈 배열
function parsePersons(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// 상세정보 JSON 문자열을 검증해 그대로 저장 (형식 오류면 null)
function normalizeMeta(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && Object.keys(obj).length > 0) {
      return JSON.stringify(obj);
    }
  } catch {
    // 형식 오류 — 저장 안 함
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });
  }
  const ingestToken = await prisma.ingestToken.findUnique({ where: { token } });
  if (!ingestToken) {
    return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const uuid = String(form.get("uuid") || "").trim();
  if (!(file instanceof File) || !uuid) {
    return NextResponse.json({ error: "file과 uuid가 필요합니다." }, { status: 400 });
  }
  if (file.size > INGEST_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "파일이 너무 큽니다." }, { status: 413 });
  }

  // 이미 가져온 사진이면 그대로 성공 처리 (에이전트 재실행에 안전)
  const dup = await prisma.media.findUnique({ where: { externalId: uuid } });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  const admin = await prisma.user.findFirst({
    where: { role: ROLES.ADMIN },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    return NextResponse.json({ error: "관리자 계정이 없습니다." }, { status: 409 });
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isVideo = form.get("isVideo") === "1" || VIDEO_EXTS.has(ext);

  const buf = Buffer.from(await file.arrayBuffer());
  const processed = await processBuffer(buf, { isVideo, ext: ext || (isVideo ? "mp4" : "jpg") });

  // 촬영시각: EXIF > 에이전트가 보낸 값 > 현재
  let takenAt = processed.takenAt;
  if (!takenAt) {
    const sent = new Date(String(form.get("takenAt") || ""));
    takenAt = Number.isNaN(sent.getTime()) ? new Date() : sent;
  }

  // 같은 촬영일(KST)끼리 한 게시물로 묶음
  const syncKey = `osx:${KST_DATE.format(takenAt)}`;
  const post =
    (await prisma.post.findUnique({ where: { syncKey } })) ??
    (await prisma.post.create({
      data: { authorId: admin.id, source: "osxphotos", syncKey, takenAt },
    }));

  // 게시물 takenAt은 그날 가장 이른 사진 시각으로 유지
  if (takenAt < post.takenAt) {
    await prisma.post.update({ where: { id: post.id }, data: { takenAt } });
  }

  const order = await prisma.media.count({ where: { postId: post.id } });
  const media = await prisma.media.create({
    data: {
      postId: post.id,
      type: processed.type,
      path: processed.path,
      thumbPath: processed.thumbPath,
      width: processed.width,
      height: processed.height,
      order,
      takenAt,
      externalId: uuid,
      meta: normalizeMeta(form.get("meta")),
    },
  });

  // 사진에 찍힌 인물 → 등록된 아이와 이름이 일치하면 태깅 (아이별 필터용)
  const personNames = parsePersons(form.get("persons"));
  if (personNames.length > 0) {
    const matched = await prisma.child.findMany({
      where: { name: { in: personNames } },
      select: { id: true },
    });
    if (matched.length > 0) {
      await prisma.mediaChild.createMany({
        data: matched.map((c) => ({ mediaId: media.id, childId: c.id })),
      });
    }
  }

  await prisma.ingestToken.update({
    where: { id: ingestToken.id },
    data: { lastUsedAt: new Date() },
  });

  return NextResponse.json({ ok: true, postId: post.id });
}
