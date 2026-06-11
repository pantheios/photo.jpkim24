import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { stat } from "node:fs/promises";
import { resolveUpload } from "@/lib/storage";
import { contentTypeForPath } from "@/lib/mime";

export const runtime = "nodejs";

// 인증은 미들웨어에서 강제됨(/media 는 로그인 필요). 여기서는 파일만 안전하게 서빙.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const rel = parts.map(decodeURIComponent).join("/");
  const full = resolveUpload(rel);
  if (!full) return new NextResponse("Bad request", { status: 400 });

  let info;
  try {
    info = await stat(full);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const type = contentTypeForPath(full);
  const range = req.headers.get("range");

  // 동영상 탐색(seek)을 위한 Range 요청 지원
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : info.size - 1;
      if (start >= info.size || end >= info.size || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${info.size}` },
        });
      }
      const stream = fs.createReadStream(full, { start, end });
      return new NextResponse(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }
  }

  const stream = fs.createReadStream(full);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
