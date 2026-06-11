// Node 런타임 전용 — iCloud 공유앨범 주기 동기화 타이머.
// 간격: ICLOUD_SYNC_INTERVAL_MIN (기본 30분), ICLOUD_SYNC_DISABLED=1 이면 비활성.
export async function startSyncTimer() {
  if (process.env.ICLOUD_SYNC_DISABLED === "1") return;

  const g = globalThis as unknown as { __icloudSyncTimer?: ReturnType<typeof setInterval> };
  if (g.__icloudSyncTimer) return;

  const minutes = Math.max(5, Number(process.env.ICLOUD_SYNC_INTERVAL_MIN) || 30);
  const { syncICloud } = await import("@/lib/sync");

  const run = () =>
    syncICloud().catch((err) => console.error("[sync] 주기 동기화 오류:", err));

  g.__icloudSyncTimer = setInterval(run, minutes * 60_000);
  setTimeout(run, 15_000); // 시작 직후 1회

  console.log(`[sync] iCloud 주기 동기화 활성 (${minutes}분 간격)`);
}
