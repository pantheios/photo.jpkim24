// 설치형(PWA) 최소 서비스워커.
// 앱 셸 정도만 캐시하고, 사진/API 등 동적 요청은 항상 네트워크로 보낸다.
const CACHE = "album-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // GET 외 / 사진·API는 캐시하지 않고 네트워크 우선
  if (
    request.method !== "GET" ||
    new URL(request.url).pathname.startsWith("/media") ||
    new URL(request.url).pathname.startsWith("/api")
  ) {
    return; // 기본 네트워크 처리
  }
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/"))),
  );
});
