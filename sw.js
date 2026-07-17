const CACHE_NAME = "convertze-7199473c";
const APP_SHELL = [
  "/",
  "/images",
  "/pdf",
  "/dev",
  "/text",
  "/calc",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/assets/site.css",
  "/assets/app.js",
  "/assets/tools-image.js",
  "/assets/tools-pdf.js",
  "/assets/tools-dev.js",
  "/assets/tools-text.js",
  "/assets/tools-calc.js"
];

const CDN_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/sql-formatter/15.3.2/sql-formatter.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/piexifjs/1.0.6/piexif.min.js"
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
          // Optional precache; ignore failures.
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

  // Pages: network-first so deployed updates reach returning visitors; cache is the offline fallback.
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
          return response;
        } catch (e) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // Assets: cache-first, with runtime caching for same-origin files, listed CDNs and fonts.
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        const url = event.request.url;
        const cacheable =
          url.startsWith(self.location.origin) ||
          CDN_ASSETS.includes(url) ||
          url.startsWith("https://fonts.googleapis.com") ||
          url.startsWith("https://fonts.gstatic.com");
        if (cacheable) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (e) {
        return Response.error();
      }
    })()
  );
});
