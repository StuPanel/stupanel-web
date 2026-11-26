/* StuPanel phone notifications (Web Push). Shows the notice and opens the right page when it is tapped. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = {}; }
  const title = typeof d.title === "string" && d.title ? d.title : "StuPanel";
  const path = typeof d.path === "string" && d.path.charAt(0) === "/" && d.path.charAt(1) !== "/" ? d.path : "/notifications";
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof d.body === "string" ? d.body : "",
    tag: typeof d.tag === "string" && d.tag ? d.tag : undefined,
    renotify: !!d.tag,
    icon: "/brand/stupanel-icon-256.png",
    badge: "/brand/stupanel-icon-128.png",
    data: { path },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/notifications";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(url); } catch (_) { /* the page stays where it is */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
