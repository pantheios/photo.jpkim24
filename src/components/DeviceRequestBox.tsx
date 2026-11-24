"use client";

import { useEffect, useState } from "react";

// 로그인 화면 하단 — 비밀번호 없이 가족(관리자) 승인으로 이 기기를 등록
type State =
  | { kind: "idle" }
  | { kind: "pending"; code: string }
  | { kind: "expired" }
  | { kind: "error"; message: string };

export function DeviceRequestBox() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  // 새로고침해도 대기 중이던 요청을 이어서 보여준다
  useEffect(() => {
    fetch("/api/auth/device-request")
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "approved") window.location.href = "/";
        else if (d.status === "pending") setState({ kind: "pending", code: d.code });
      })
      .catch(() => {});
  }, []);

  // 대기 중이면 3초마다 승인됐는지 확인
  const pending = state.kind === "pending";
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(async () => {
      const d = await fetch("/api/auth/device-request")
        .then((r) => r.json())
        .catch(() => null);
      if (!d) return;
      if (d.status === "approved") window.location.href = "/";
      else if (d.status === "expired" || d.status === "none") setState({ kind: "expired" });
    }, 3000);
    return () => clearInterval(timer);
  }, [pending]);

  async function request() {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/device-request", { method: "POST" });
      const d = await res.json();
      if (res.ok) setState({ kind: "pending", code: d.code });
      else setState({ kind: "error", message: d.error ?? "요청에 실패했어요." });
    } catch {
      setState({ kind: "error", message: "네트워크 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    await fetch("/api/auth/device-request", { method: "DELETE" }).catch(() => {});
    setState({ kind: "idle" });
  }

  if (state.kind === "pending") {
    return (
      <div className="mt-5 rounded-card bg-surface p-6 text-center shadow-sm ring-1 ring-primary/40">
        <p className="text-sm text-muted">가족에게 이 번호를 알려주세요</p>
        <div className="my-3 text-5xl font-bold tracking-[0.2em] text-primary">{state.code}</div>
        <p className="text-base">
          가족이 승인하면
          <br />
          <b>자동으로 사진첩이 열려요</b> 🙂
        </p>
        <p className="mt-3 animate-pulse text-xs text-muted">승인 기다리는 중… (10분간 유효)</p>
        <button onClick={cancel} className="mt-4 text-xs text-muted underline">
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 text-center">
      {state.kind === "expired" && (
        <p className="mb-2 text-sm text-red-500">시간이 지났어요. 다시 눌러주세요.</p>
      )}
      {state.kind === "error" && <p className="mb-2 text-sm text-red-500">{state.message}</p>}
      <button
        onClick={request}
        disabled={busy}
        className="w-full rounded-card border-2 border-primary bg-white px-4 py-4 text-lg font-bold text-primary disabled:opacity-60"
      >
        📱 가족에게 들어가게 해달라고 요청하기
      </button>
      <p className="mt-2 text-xs text-muted">비밀번호가 기억나지 않으면 눌러주세요</p>
    </div>
  );
}
