// 서버 시작 시 1회 실행. Node 전용 코드는 조건부 import로 분리해
// edge 번들에 네이티브 모듈이 끌려 들어가지 않게 한다.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncTimer } = await import("./instrumentation-node");
    await startSyncTimer();
  }
}
