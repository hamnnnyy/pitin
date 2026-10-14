// Service worker: shows pushed notifications and opens the app where they point.
self.addEventListener("push", (event) => {
  const msg = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(msg.title || "PITIN", {
      body: msg.body,
      tag: msg.tag,
      icon: "/icon-192.png",
      data: { url: msg.url || "/home" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (wins) => {
      const win = wins[0];
      if (!win) return self.clients.openWindow(url);
      await win.focus();
      return win.navigate(url);
    }),
  );
});
