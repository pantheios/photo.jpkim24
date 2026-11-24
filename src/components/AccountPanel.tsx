"use client";

import { useState } from "react";

export function AccountPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ kind: "err", text: "새 비밀번호가 서로 일치하지 않습니다." });
      return;
    }
    if (next.length < 6) {
      setMsg({ kind: "err", text: "새 비밀번호는 6자 이상이어야 합니다." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || "변경에 실패했습니다." });
        return;
      }
      setMsg({ kind: "ok", text: "비밀번호를 변경했어요 ✓" });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setMsg({ kind: "err", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-primary";

  return (
    <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-line">
      <h2 className="mb-4 font-bold">🔑 비밀번호 변경</h2>
      <form onSubmit={changePassword} className="space-y-3">
        {/* 접근성·비밀번호 매니저용 숨은 username 필드 */}
        <input type="text" autoComplete="username" className="hidden" aria-hidden tabIndex={-1} />
        <div>
          <label className="mb-1 block text-sm font-medium">현재 비밀번호</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={input}
            placeholder="••••••"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">새 비밀번호</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={input}
            placeholder="6자 이상"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">새 비밀번호 확인</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={input}
            placeholder="다시 입력"
          />
        </div>

        {msg && (
          <p className={`text-sm ${msg.kind === "ok" ? "text-primary" : "text-red-500"}`}>
            {msg.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>
    </section>
  );
}
