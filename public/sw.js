/* Shortly service worker, offline app shell.
   API calls (spoo.me / tinyurl / fonts / favicons) are cross-origin
   and always go to the network; only same-origin GETs are cached. */

const CACHE = "shortly-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/components.css",
  "./assets/css/app.css",
  "./assets/js/boot.js",
  "./assets/js/main.js",
  "./assets/js/api.js",
  "./assets/js/store.js",
  "./assets/js/qr.js",
  "./assets/js/ui.js",
  "./assets/vendor/qrcode.js",
  "./assets/vendor/confetti.min.js",
  "./assets/fonts/poppins-400.woff2",
  "./assets/fonts/poppins-500.woff2",
  "./assets/fonts/poppins-600.woff2",
  "./assets/fonts/poppins-700.woff2",
  "./assets/fonts/poppins-800.woff2",
  "./images/logo.svg",
  "./images/illustration-hero.svg",
  "./images/icon-brand-recognition.svg",
  "./images/icon-detailed-records.svg",
  "./images/icon-fully-customizable.svg",
  "./images/bg-boost-desktop.svg",
  "./images/favicon-32x32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return; // never touch POSTs (spoo.me)
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // API/fonts/favicons use the network

  // Stale-while-revalidate: serve cache fast, refresh it in the background so a
  // same-version redeploy still picks up changed assets.
  e.respondWith(
    caches.match(request).then((cached) => {
      // no-cache forces a real revalidation; without it the 'immutable' header on
      // /assets/* would satisfy this fetch from the HTTP cache and never refresh.
      const network = fetch(request, { cache: "no-cache" })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          // Only fall back to the app shell for page navigations, never for
          // failed sub-resource GETs (which should surface as real errors).
          cached || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())
        );
      if (cached) e.waitUntil(network.catch(() => {})); // keep SW alive for the revalidation
      return cached || network;
    })
  );
});
