const CACHE = "unv-v4";
const SHELL = ["/", "/skills", "/games", "/missions", "/achievements", "/skills/me"];
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put("/", clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return cached || new Response("<!doctype html><meta charset=utf-8><title>UniVerse</title><p>أنت أوفلاين</p>", {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        })
    );
    return;
  }

    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request)
            .then((res) => {
              if (res.ok && res.type === "basic") {
                const clone = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, clone));
              }
              return res;
            })
            .catch(() => Response.error())
      )
    );
  });

  self.addEventListener("push", (e) => {
    const data = e.data?.json() ?? { title: "UniVerse", body: "إشعار جديد" };
    e.waitUntil(
      self.registration.showNotification(data.title ?? "UniVerse", {
        body: data.body ?? "",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        data: { url: data.url ?? "/" },
        dir: "rtl",
        lang: "ar",
      })
    );
  });

  self.addEventListener("notificationclick", (e) => {
    e.notification.close();
    const url = e.notification.data?.url ?? "/";
    e.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const c of list) {
          if ("focus" in c) return c.navigate(url), c.focus();
        }
        return clients.openWindow(url);
      })
    );
  });