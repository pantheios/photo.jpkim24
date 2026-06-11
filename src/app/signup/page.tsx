"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "가입에 실패했습니다.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">🍼</div>
          <h1 className="text-2xl font-bold">가입하기</h1>
          <p className="mt-1 text-sm text-muted">
            초대코드로 가족 사진첩에 참여하세요
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-card bg-surface p-6 shadow-sm ring-1 ring-line"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">이름</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-primary"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">이메일</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">비밀번호</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-primary"
              placeholder="6자 이상"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              초대코드{" "}
              <span className="font-normal text-muted">(최초 관리자는 불필요)</span>
            </label>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 font-mono tracking-widest outline-none focus:border-primary"
              placeholder="ABCD2345"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {loading ? "가입 중…" : "가입하기"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-semibold text-primary">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
