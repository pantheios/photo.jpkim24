"use client";

import { useEffect, useState } from "react";
import { ageLabel } from "@/lib/age";

type Invite = {
  id: string;
  code: string;
  createdAt: string;
  usedBy: { name: string; email: string } | null;
};

type AlbumSource = {
  id: string;
  name: string | null;
  lastSyncAt: string | null;
};

export function AdminPanel({
  initialChild,
}: {
  initialChild: { name: string; birthDate: string } | null;
}) {
  // 아기 프로필
  const [name, setName] = useState(initialChild?.name ?? "");
  const [birthDate, setBirthDate] = useState(initialChild?.birthDate.slice(0, 10) ?? "");
  const [childMsg, setChildMsg] = useState("");
  const [savingChild, setSavingChild] = useState(false);

  // 초대
  const [invites, setInvites] = useState<Invite[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");

  // iCloud 공유앨범
  const [source, setSource] = useState<AlbumSource | null>(null);
  const [albumUrl, setAlbumUrl] = useState("");
  const [icloudMsg, setIcloudMsg] = useState("");
  const [icloudBusy, setIcloudBusy] = useState(false);

  useEffect(() => {
    fetch("/api/invites")
      .then((r) => r.json())
      .then((d) => setInvites(d.invites ?? []))
      .catch(() => {});
    fetch("/api/icloud")
      .then((r) => r.json())
      .then((d) => setSource(d.source ?? null))
      .catch(() => {});
  }, []);

  async function connectAlbum(e: React.FormEvent) {
    e.preventDefault();
    setIcloudBusy(true);
    setIcloudMsg("");
    try {
      const res = await fetch("/api/icloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: albumUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIcloudMsg(data.error || "연동에 실패했습니다.");
        return;
      }
      setSource(data.source);
      setAlbumUrl("");
      setIcloudMsg(`연동 완료 — 앨범에 사진 ${data.photoCount}장이 있어요. 곧 자동으로 가져옵니다.`);
    } finally {
      setIcloudBusy(false);
    }
  }

  async function syncNow() {
    setIcloudBusy(true);
    setIcloudMsg("동기화 중… 사진이 많으면 시간이 걸릴 수 있어요.");
    try {
      const res = await fetch("/api/icloud/sync", { method: "POST" });
      const data = await res.json();
      setIcloudMsg(
        res.ok
          ? `동기화 완료 — 새 사진 ${data.added}장 추가${data.skipped ? `, ${data.skipped}장 건너뜀` : ""}`
          : data.error || "동기화에 실패했습니다.",
      );
      if (res.ok) {
        const s = await fetch("/api/icloud").then((r) => r.json());
        setSource(s.source ?? null);
      }
    } finally {
      setIcloudBusy(false);
    }
  }

  async function disconnectAlbum() {
    if (!confirm("공유앨범 연동을 해제할까요? 이미 가져온 사진은 그대로 남습니다.")) return;
    await fetch("/api/icloud", { method: "DELETE" });
    setSource(null);
    setIcloudMsg("연동을 해제했어요.");
  }

  async function saveChild(e: React.FormEvent) {
    e.preventDefault();
    setSavingChild(true);
    setChildMsg("");
    const res = await fetch("/api/child", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birthDate }),
    });
    const data = await res.json();
    setSavingChild(false);
    setChildMsg(res.ok ? "저장했어요 ✓" : data.error || "저장 실패");
  }

  async function createInvite() {
    setCreating(true);
    const res = await fetch("/api/invites", { method: "POST" });
    const data = await res.json();
    setCreating(false);
    if (res.ok) setInvites((prev) => [{ ...data.invite, usedBy: null }, ...prev]);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // 클립보드 사용 불가 — 무시
    }
  }

  const birthPreview =
    birthDate && !Number.isNaN(new Date(birthDate).getTime())
      ? ageLabel(new Date(birthDate))
      : null;

  return (
    <div className="space-y-8">
      {/* 아기 프로필 */}
      <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-line">
        <h2 className="mb-4 font-bold">👶 아기 프로필</h2>
        <form onSubmit={saveChild} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">이름</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-primary"
              placeholder="아기 이름"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">생일</label>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-primary"
            />
            {birthPreview && (
              <p className="mt-1 text-sm text-primary">오늘 기준 {birthPreview}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingChild}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingChild ? "저장 중…" : "저장"}
            </button>
            {childMsg && <span className="text-sm text-muted">{childMsg}</span>}
          </div>
        </form>
      </section>

      {/* iCloud 공유앨범 */}
      <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-line">
        <h2 className="mb-2 font-bold">☁️ iCloud 공유앨범 연동</h2>

        {source ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-line px-3 py-2.5">
              <div className="font-semibold">{source.name || "공유앨범"}</div>
              <div className="text-xs text-muted">
                {source.lastSyncAt
                  ? `마지막 동기화: ${new Date(source.lastSyncAt).toLocaleString("ko-KR")}`
                  : "아직 동기화 전"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={syncNow}
                disabled={icloudBusy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {icloudBusy ? "동기화 중…" : "지금 동기화"}
              </button>
              <button
                onClick={disconnectAlbum}
                disabled={icloudBusy}
                className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-red-500"
              >
                연동 해제
              </button>
            </div>
            <p className="text-xs text-muted">
              새 사진은 30분마다 자동으로 가져와 촬영일별 게시물로 묶입니다.
            </p>
          </div>
        ) : (
          <form onSubmit={connectAlbum} className="space-y-3">
            <p className="text-sm text-muted">
              아이폰 사진 앱 → 공유 앨범 → <b>공개 웹사이트</b>를 켜고 생긴 링크를
              붙여넣으세요. 앨범에 사진을 추가하면 자동으로 이곳에 올라와요.
            </p>
            <input
              value={albumUrl}
              onChange={(e) => setAlbumUrl(e.target.value)}
              placeholder="https://www.icloud.com/sharedalbum/#B0..."
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={icloudBusy || !albumUrl.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {icloudBusy ? "확인 중…" : "연동하기"}
            </button>
          </form>
        )}

        {icloudMsg && <p className="mt-3 text-sm text-muted">{icloudMsg}</p>}
      </section>

      {/* 초대 */}
      <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-line">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">✉️ 가족 초대</h2>
          <button
            onClick={createInvite}
            disabled={creating}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {creating ? "생성 중…" : "+ 초대코드 만들기"}
          </button>
        </div>

        <p className="mb-3 text-sm text-muted">
          초대코드를 가족에게 전달하면 가입 화면에서 입력해 참여할 수 있어요.
        </p>

        <ul className="space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
            >
              <div>
                <span className="font-mono text-lg font-bold tracking-widest">
                  {inv.code}
                </span>
                <div className="text-xs text-muted">
                  {inv.usedBy
                    ? `${inv.usedBy.name} 님이 사용함`
                    : "미사용"}
                </div>
              </div>
              {!inv.usedBy && (
                <button
                  onClick={() => copyCode(inv.code)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-soft"
                >
                  {copied === inv.code ? "복사됨 ✓" : "복사"}
                </button>
              )}
            </li>
          ))}
          {invites.length === 0 && (
            <li className="py-4 text-center text-sm text-muted">
              아직 초대코드가 없어요.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
