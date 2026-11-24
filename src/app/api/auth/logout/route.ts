import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSession } from "@/lib/auth";
import { DEVICE_COOKIE } from "@/lib/device";

export async function POST() {
  await clearSession();
  // 직접 로그아웃하면 이 기기의 자동 로그인도 해제 (안 그러면 바로 다시 로그인됨)
  (await cookies()).delete(DEVICE_COOKIE);
  return NextResponse.json({ ok: true });
}
