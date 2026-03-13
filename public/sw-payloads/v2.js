/**
 * v2 – Structured nested format
 * Payload shape: { version:2, notification:{ title, body, tag }, meta:{ icon, badge, url } }
 */
export function decode(data) {
  const { notification = {}, meta = {} } = data;
  return {
    title: notification.title || "Notification",
    options: {
      body: notification.body || "",
      icon: meta.icon || "/icon-192.png",
      badge: meta.badge || "/icon-192.png",
      tag: notification.tag,
      data: { url: meta.url || "/" },
    },
  };
}

