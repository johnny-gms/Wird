// WIRD — service worker : fonctionnement hors connexion + notifications Web Push
const V = "wird-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
// Réseau d'abord (toujours la dernière version), cache en secours hors connexion. Les requêtes vers d'autres origines (API, polices) ne sont pas interceptées.
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match("index.html")))
  );
});

// Chaque push DOIT afficher une notification (exigence iOS / userVisibleOnly)
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || "WIRD", {
    body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    tag: "wird", data: { ack: d.ack || "" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const ack = e.notification.data && e.notification.data.ack;
  e.waitUntil((async () => {
    if (ack) { try { await fetch(ack, { method: "POST" }); } catch (_) {} } // sert à réduire la fréquence si les rappels sont ignorés
    const cs = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return clients.openWindow("./");
  })());
});
