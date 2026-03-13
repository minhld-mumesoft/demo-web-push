/**
 * v1 – Legacy flat format
 * Payload shape: { title, body, icon, badge, url }
 */
export function decode(data) {
  return {
    title: data.title || "Notification",
    options: {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      data: { url: data.url || "/" },
    },
  };
}

