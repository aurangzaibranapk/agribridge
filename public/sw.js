const SHELL_CACHE = "agribridge-shell-v2";
const STATIC_CACHE = "agribridge-static-v2";
const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE];

const PRECACHE_URLS = ["/", "/manifest.json", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Next.js static chunks have content hashes — cache-first is safe and fast
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, res.clone())).catch(() => {});
          return res;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // Supabase API / auth calls — network only (never cache tokens/data)
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }

  // Pages and everything else — network-first, fall back to cache, then /offline
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/offline"))
      )
  );
});
