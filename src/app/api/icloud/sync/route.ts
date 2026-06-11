import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncICloud } from "@/lib/sync";
import { ROLES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 300; // 첫 동기화는 사진이 많을 수 있음

// 수동 동기화 (관리자)
export async function POST() {
  const user = await getCurrentUser();
  if (user?.role !== ROLES.ADMIN) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const result = await syncICloud();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
