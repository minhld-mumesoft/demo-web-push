// ─────────────────────────────────────────────────────────────────────────────
// SW version — change this to simulate a version upgrade on the client side.
// Valid values: "v1" | "v2" | "v3"
// ─────────────────────────────────────────────────────────────────────────────
const SW_VERSION = "v3";

// ─── IndexedDB helpers (persist synced version across SW restarts) ────────────

const _DB_NAME = "sw-meta";
const _DB_STORE = "kv";

import { decode as decodeV1 } from "./sw-payloads/v1.js";
import { decode as decodeV2 } from "./sw-payloads/v2.js";
import { decode as decodeV3 } from "./sw-payloads/v3.js";


function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(_DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _dbGet(key) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_DB_STORE, "readonly").objectStore(_DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function _dbSet(key, value) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_DB_STORE, "readwrite").objectStore(_DB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener("install", () => {
  // Take control immediately without waiting for old SW to be released.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    clients.claim().then(async () => {
      // 1. Only sync version to server when it has actually changed.
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) {
          const persistedVersion = await _dbGet("swVersion");
          if (persistedVersion !== SW_VERSION) {
            await fetch("/api/sw-version", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: sub.endpoint, version: SW_VERSION }),
            });
            await _dbSet("swVersion", SW_VERSION);
            console.log(`[SW] Version updated ${persistedVersion ?? "none"} → ${SW_VERSION}.`);
          } else {
            console.log(`[SW] Version ${SW_VERSION} already synced — skipping server update.`);
          }
        }
      } catch (err) {
        console.warn("[SW] Failed to sync version to server:", err);
      }

      // 2. Notify open clients so the UI badge updates immediately.
      const allClients = await clients.matchAll({ includeUncontrolled: true, type: "window" });
      allClients.forEach((client) => {
        client.postMessage({ type: "SW_ACTIVATED", version: SW_VERSION });
      });
    })
  );
});

// ─── Message handler ─────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_SW_VERSION") {
    // Reply through MessageChannel port when available (targeted, no broadcast).
    if (event.ports?.[0]) {
      event.ports[0].postMessage({ type: "SW_VERSION", version: SW_VERSION });
    } else {
      event.source?.postMessage({ type: "SW_VERSION", version: SW_VERSION });
    }
  }
});

// ─── Payload decoder — lazy-loads the version-specific module ────────────────

async function decodePayload(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      title: "Notification",
      options: { body: raw, icon: "/icon-192.png", data: { url: "/" } },
    };
  }

  if (data.version === 3) {
    return decodeV1(data);
  }
  if (data.version === 2) {
    return decodeV2(data);
  }
  // v1 or unknown — flat format
  return decodeV3(data);
}

// ─── Push handler ─────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  event.waitUntil(
    decodePayload(event.data.text()).then(({ title, options }) =>
      self.registration.showNotification(title, options)
    )
  );
});

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // "dismiss" action — just close, no navigation.
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
