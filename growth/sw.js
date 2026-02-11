self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("growth-v1").then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./data.js"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
