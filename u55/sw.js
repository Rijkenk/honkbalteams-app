// Service worker: maakt de app installeerbaar en laat hem openen zonder verbinding.
// Bij elke wijziging aan de app dit versienummer ophogen, zodat telefoons de nieuwe versie ophalen.
const VERSIE = "u55-v1";
const BESTANDEN = ["./", "index.html", "style.css", "config.js", "app.js", "manifest.webmanifest", "icons/logo.jpg", "icons/icon-192.png", "data/wedstrijden-voorbeeld.json"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSIE).then(c => c.addAll(BESTANDEN)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSIE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // koppeling, lettertypes en clubsite: gewoon via het netwerk
  // Eerst het netwerk (altijd de nieuwste versie), anders de opgeslagen kopie
  e.respondWith(fetch(e.request).then(r => { const kopie = r.clone(); caches.open(VERSIE).then(c => c.put(e.request, kopie)); return r; }).catch(() => caches.match(e.request)));
});
