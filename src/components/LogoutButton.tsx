"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
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
