const CACHE_NAME = "convertze-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.webmanifest"
];

const CDN_ASSETS = [
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js",
  "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      for (const url of CDN_ASSETS) {
        try {
          const response = await fetch(url, { mode: "no-cors" });
          await cache.put(url, response);
        } catch (e) {
          // Ignore failed precache for optional CDN assets.
        }
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        if (event.request.url.startsWith(self.location.origin) || CDN_ASSETS.includes(event.request.url)) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (e) {
        const fallback = await caches.match("/index.html");
        return fallback || Response.error();
      }
    })()
  );
});
