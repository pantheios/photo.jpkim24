import { NextRequest, NextResponse } from "next/server";
import { loginWithDeviceToken, publicOrigin } from "@/lib/device";

// 관리자가 보낸 기기 등록 링크 — 폰에서 한 번 열면 이후 자동 로그인
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  // 터널 뒤에서는 req.nextUrl 호스트가 localhost:3000 이라 실제 접속 주소로 리다이렉트한다
  const origin = publicOrigin(req);

  // 카카오톡 인앱 브라우저는 쿠키 저장소가 따로라 여기서 등록하면 기본 브라우저엔 적용되지 않는다.
  // 기본 브라우저(크롬/사파리)로 다시 열도록 넘긴다.
  if (/KAKAOTALK/i.test(req.headers.get("user-agent") ?? "")) {
    return NextResponse.redirect(
      `kakaotalk://web/openExternal?url=${encodeURIComponent(`${origin}/device/${token}`)}`,
    );
  }

  const ok = await loginWithDeviceToken(token);
  return NextResponse.redirect(new URL(ok ? "/" : "/login?device=invalid", origin));
}
