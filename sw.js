// sw.js （最小：オフライン起動用）
// 目的：一度開いたファイルをキャッシュして、Wi-Fi OFFでも起動できるようにする

const CACHE_NAME = "app-cache-v1";
const CORE_URLS = ["./", "./index.html", "./manifest.json"]; // 最低限。その他はアクセス時に自動でキャッシュします。
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
  "./icon-192.png",
  "./icon-512.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_URLS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 古いキャッシュがあれば削除
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k)))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET以外は触らない
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      // 1) まずキャッシュがあれば返す（オフラインでも動く）
      if (cached) return cached;

      // 2) なければネットから取る → 成功したらキャッシュする
      try {
        const res = await fetch(req);
        // 同一オリジンの通常リソースだけキャッシュ
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        // 3) オフラインで初回アクセスなどはここに来る
        // ナビゲーション（ページ遷移）ならトップに戻す
        if (req.mode === "navigate") {
          const fallback = await cache.match("./");
          if (fallback) return fallback;
        }
        // それ以外はエラー（何も返せない）
        return new Response("OFFLINE", { status: 503, statusText: "OFFLINE" });
      }
    })()
  );
});
