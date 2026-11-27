const CACHE = "p6-peter-leap-ch6-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/content.js",
  "./js/game.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./assets/vocab/turn_into.png",
  "./assets/vocab/find_out.png",
  "./assets/vocab/get_away.png",
  "./assets/vocab/get_into.png",
  "./assets/vocab/give_up.png",
  "./assets/vocab/look_for.png",
  "./assets/vocab/make_up.png",
  "./assets/vocab/set_off.png",
  "./assets/vocab/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
