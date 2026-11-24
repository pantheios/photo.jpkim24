import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// lib/device.ts 와 같은 값 (미들웨어에서 prisma 의존성을 끌어오지 않도록 따로 둠)
const DEVICE_COOKIE = "device";

const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isApi = pathname.startsWith("/api") || pathname.startsWith("/media");

  // 세션은 없지만 자동 로그인 등록된 기기 → 세션 재발급 라우트로 보냈다가 원래 페이지로 복귀
  if (!session && !isApi && req.cookies.has(DEVICE_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/auth/device";
    url.search = "";
    url.searchParams.set("from", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (!session && !isPublic) {
    // API/미디어 요청은 리다이렉트 대신 401
    if (isApi) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // 이미 로그인했는데 로그인/가입 페이지로 가면 홈으로
  if (session && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 인증 API와 정적 자원은 미들웨어 제외
  matcher: [
    "/((?!api/auth|api/ingest|device/|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)",
  ],
};
