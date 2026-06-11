"use client";

import { useState } from "react";
import { REACTION_EMOJIS } from "@/lib/constants";

export function ReactionBar({
  postId,
  initialCounts,
  initialMine,
}: {
  postId: string;
  initialCounts: Record<string, number>;
  initialMine: string[];
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [mine, setMine] = useState<Set<string>>(new Set(initialMine));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(emoji);
    const had = mine.has(emoji);

    // 낙관적 업데이트
    applyLocal(emoji, !had);

    try {
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // 서버 결과와 동기화
      setMine((prev) => {
        const next = new Set(prev);
        if (data.active) next.add(emoji);
        else next.delete(emoji);
        return next;
      });
    } catch {
      applyLocal(emoji, had); // 롤백
    } finally {
      setBusy(null);
    }
  }

  function applyLocal(emoji: string, active: boolean) {
    setMine((prev) => {
      const next = new Set(prev);
      if (active) next.add(emoji);
      else next.delete(emoji);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] || 0) + (active ? 1 : -1)),
    }));
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {REACTION_EMOJIS.map((e) => {
        const count = counts[e] || 0;
        const active = mine.has(e);
        return (
          <button
            key={e}
            onClick={() => toggle(e)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition active:scale-95 ${
              active ? "border-primary bg-soft" : "border-line bg-white"
            }`}
          >
            <span>{e}</span>
            {count > 0 && <span className="text-xs text-muted">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
