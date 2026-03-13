import { SwVersion } from "./subscriptionStore";

export interface NotificationInput {
  title: string;
  body: string;
  url?: string;
  image?: string;
}

// ─── Per-version payload shapes ──────────────────────────────────────────────

/** v1 – Legacy flat format (backward-compatible with old service workers) */
interface V1Payload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  url: string;
}

/** v2 – Structured nested format with tag support */
interface V2Payload {
  version: 2;
  notification: { title: string; body: string; tag: string };
  meta: { icon: string; badge: string; url: string };
}

/** v3 – Rich format with image, notification actions, and vibration */
interface V3Payload {
  version: 3;
  notification: { title: string; body: string; image: string };
  actions: Array<{ action: string; title: string }>;
  meta: { icon: string; badge: string; url: string; tag: string; vibrate: number[] };
}

export type AnyPayload = V1Payload | V2Payload | V3Payload;

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Builds a version-specific notification payload JSON string.
 *
 *  v1 – flat    : { title, body, icon, badge, url }
 *  v2 – nested  : { version:2, notification:{…}, meta:{…} }
 *  v3 – rich    : { version:3, notification:{…}, actions:[…], meta:{…} }
 */
export function buildPayload(version: SwVersion, input: NotificationInput): string {
  const { title, body, url = "/", image = "/icon-512.png" } = input;

  switch (version) {
    case "v1": {
      const payload: V1Payload = {
        title: title + ' v1',
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        url,
      };
      return JSON.stringify(payload);
    }

    case "v2": {
      const payload: V2Payload = {
        version: 2,
        notification: {
          title: title + ' v1',
          body,
          tag: "web-push-v2"
        },
        meta: { icon: "/icon-192.png", badge: "/icon-192.png", url },
      };
      return JSON.stringify(payload);
    }

    case "v3": {
      const payload: V3Payload = {
        version: 3,
        notification: {
          title: title + ' v3',
          body,
          image },
        actions: [
          { action: "open", title: "📂 Open" },
          { action: "dismiss", title: "❌ Dismiss" },
        ],
        meta: {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          url,
          tag: "web-push-v3",
          vibrate: [200, 100, 200],
        },
      };
      return JSON.stringify(payload);
    }

    default:
      return JSON.stringify({ title, body, icon: "/icon-192.png", url });
  }
}

/** Human-readable description for each version (used in UI). */
export const VERSION_DESCRIPTIONS: Record<SwVersion, string> = {
  v1: "Flat — { title, body, icon, url }",
  v2: "Structured — { version:2, notification:{…}, meta:{…} }",
  v3: "Rich — { version:3, notification:{…}, actions:[…], meta:{…} }",
};

