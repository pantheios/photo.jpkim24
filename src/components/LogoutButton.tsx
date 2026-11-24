"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    // 자동 로그인 기기(할머니 폰 등)에서 실수로 누르면 다시 승인받아야 하므로 한 번 확인
    if (!confirm("로그아웃할까요?\n자동 로그인되던 기기라면 다시 요청·승인을 받아야 해요.")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-sm text-muted hover:text-ink"
      aria-label="로그아웃"
    >
      로그아웃
    </button>
  );
}
