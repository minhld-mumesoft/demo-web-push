/**
 * v3 – Rich format with image, notification actions, and vibration
 * Payload shape:
 *   { version:3, notification:{ title, body, image },
 *     actions:[{ action, title }…],
 *     meta:{ icon, badge, url, tag, vibrate } }
 */
export function decode(data) {
  const { notification = {}, actions = [], meta = {} } = data;
  return {
    title: notification.title || "Notification",
    options: {
      body: notification.body || "",
      image: notification.image,
      icon: meta.icon || "/icon-192.png",
      badge: meta.badge || "/icon-192.png",
      tag: meta.tag,
      vibrate: meta.vibrate,
      actions,
      data: { url: meta.url || "/" },
    },
  };
}

