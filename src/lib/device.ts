import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { customAlphabet } from "nanoid";
import { prisma } from "./prisma";
import { setSession } from "./auth";

// 기기 자동 로그인 — 폰에 심어둔 기기 쿠키로 세션이 만료돼도 자동 재로그인
// (쿠키 존재 여부는 미들웨어가 보고, DB 확인·세션 발급은 여기서)

export const DEVICE_COOKIE = "device";
// 브라우저 쿠키 수명 상한(크롬 400일). 자동 로그인할 때마다 갱신되므로 쓰는 동안은 만료되지 않음
const DEVICE_MAX_AGE = 60 * 60 * 24 * 400;

export const genDeviceToken = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  40,
);

// 토큰이 유효하면 세션을 발급하고 기기 쿠키 수명을 연장한다. 실패 시 기기 쿠키 삭제.
export async function loginWithDeviceToken(token: string): Promise<boolean> {
  const store = await cookies();
  const device = token
    ? await prisma.deviceLogin.findUnique({
        where: { token },
        include: { user: { select: { id: true, role: true } } },
      })
    : null;

  if (!device) {
    store.delete(DEVICE_COOKIE);
    return false;
  }

  await prisma.deviceLogin.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  });
  await setSession({ userId: device.user.id, role: device.user.role });
  store.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DEVICE_MAX_AGE,
    path: "/",
  });
  return true;
}

// 오픈 리다이렉트 방지 — 같은 사이트 경로만 허용
export function safeNextPath(from: string | null): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return "/";
  if (from === "/login" || from.startsWith("/login?") || from.startsWith("/signup")) return "/";
  return from;
}

// Cloudflare 터널 뒤에서도 실제 접속 주소(https://photo…)로 링크를 만든다
export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

// ── 기기 로그인 요청 (페어링) ──────────────────────────────

export const DEVICE_REQUEST_COOKIE = "device_req";
export const DEVICE_REQUEST_TTL_SEC = 10 * 60; // 요청은 10분간 유효

export function requestCutoff(): Date {
  return new Date(Date.now() - DEVICE_REQUEST_TTL_SEC * 1000);
}

// 관리자가 알아볼 수 있는 기기 설명 ("아이폰 · 사파리")
export function describeDevice(ua: string | null): string {
  if (!ua) return "알 수 없는 기기";
  const os = /iPhone/.test(ua)
    ? "아이폰"
    : /iPad/.test(ua)
      ? "아이패드"
      : /Android/.test(ua)
        ? /SM-|Samsung/i.test(ua)
          ? "갤럭시"
          : "안드로이드"
        : /Macintosh/.test(ua)
          ? "맥"
          : /Windows/.test(ua)
            ? "윈도우 PC"
            : "기타";
  const browser = /KAKAOTALK/i.test(ua)
    ? "카카오톡"
    : /SamsungBrowser/.test(ua)
      ? "삼성 인터넷"
      : /NAVER/.test(ua)
        ? "네이버앱"
        : /CriOS|Chrome/.test(ua)
          ? "크롬"
          : /Safari/.test(ua)
            ? "사파리"
            : "브라우저";
  return `${os} · ${browser}`;
}
