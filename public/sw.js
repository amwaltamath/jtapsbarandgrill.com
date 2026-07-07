self.addEventListener("push", (event) => {
  let data = {
    title: "JTAPS Bar and Grill",
    body: "You have a new update.",
    url: "/dashboard",
    tag: "jtaps-push"
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        ...data,
        ...parsed
      };
    }
  } catch {
    // Ignore malformed payloads and use defaults.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/images/jtaps-logo.png",
      badge: "/images/jtaps-logo.png",
      tag: data.tag,
      data: {
        url: data.url || "/dashboard"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return Promise.resolve();
    })
  );
});
