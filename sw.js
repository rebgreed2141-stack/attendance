const CACHE_NAME = "attendance-cache-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./children.json",
  "./teachers.json",
  "./manifest.json",
  "./sw.js",
  "./jszip.min.js",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(handleRequest(req));
});

async function handleRequest(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) {
    return cached;
  }

  try {
    const networkRes = await fetch(req);
    if (networkRes && networkRes.ok && new URL(req.url).origin === self.location.origin) {
      cache.put(req, networkRes.clone());
    }
    return networkRes;
  } catch (_error) {
    if (req.mode === "navigate") {
      return (await cache.match("./index.html")) || (await cache.match("./"));
    }

    const url = new URL(req.url);
    if (url.origin === self.location.origin) {
      const pathname = url.pathname.replace(self.location.origin, "");
      return (
        (await cache.match(pathname, { ignoreSearch: true })) ||
        (await cache.match("./index.html")) ||
        new Response("OFFLINE", { status: 503, statusText: "OFFLINE" })
      );
    }

    return new Response("OFFLINE", { status: 503, statusText: "OFFLINE" });
  }
}