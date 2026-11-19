// Service worker: maakt de app installeerbaar en laat hem openen zonder verbinding.
// Gemaakt door scripts/build.mjs uit app/sw.js. Het versienummer verandert vanzelf bij elke wijziging, zodat telefoons de nieuwe versie ophalen.
const VERSIE = "{{versie}}";
const BESTANDEN = {{bestanden}};

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSIE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIE && k.startsWith("{{id}}-")).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// (alleen oude versies van deze club opruimen: andere clubs op hetzelfde adres houden hun eigen opslag)
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // koppeling, lettertypes en clubsite: gewoon via het netwerk
  // Eerst het netwerk (altijd de nieuwste versie, langs de browsercache heen), anders de opgeslagen kopie
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const kopie = r.clone(); caches.open(VERSIE).then(c => c.put(e.request, kopie)); return r; }).catch(() => caches.match(e.request)));
});
