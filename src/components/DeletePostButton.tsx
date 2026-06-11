"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("이 게시물을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setBusy(false);
      alert("삭제에 실패했습니다.");
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-sm text-muted hover:text-red-500 disabled:opacity-50"
    >
      {busy ? "삭제 중…" : "삭제"}
    </button>
  );
}
