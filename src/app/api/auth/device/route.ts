import { NextRequest, NextResponse } from "next/server";
import { DEVICE_COOKIE, loginWithDeviceToken, publicOrigin, safeNextPath } from "@/lib/device";

// 세션이 없고 기기 쿠키만 있을 때 미들웨어가 이리로 보낸다 → 세션 재발급 후 원래 페이지로
export async function GET(req: NextRequest) {
  const token = req.cookies.get(DEVICE_COOKIE)?.value ?? "";
  const from = req.nextUrl.searchParams.get("from");
  const ok = await loginWithDeviceToken(token);
  // 터널 뒤에서는 req.nextUrl 호스트가 localhost:3000 이라 실제 접속 주소로 리다이렉트한다
  const origin = publicOrigin(req);

  if (ok) return NextResponse.redirect(new URL(safeNextPath(from), origin));
  const url = new URL("/login", origin);
  if (from) url.searchParams.set("from", safeNextPath(from));
  return NextResponse.redirect(url);
}
