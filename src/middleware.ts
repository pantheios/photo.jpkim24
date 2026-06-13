import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!session && !isPublic) {
    // API/미디어 요청은 리다이렉트 대신 401
    if (pathname.startsWith("/api") || pathname.startsWith("/media")) {
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
    "/((?!api/auth|api/ingest|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)",
  ],
};
