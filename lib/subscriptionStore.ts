import webpush, { PushSubscription } from "web-push";

// Configure VAPID details once at module load
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type SwVersion = "v1" | "v2" | "v3";
export const VALID_SW_VERSIONS: SwVersion[] = ["v1", "v2", "v3"];

export type StoredSubscription = {
  id: string;
  subscription: PushSubscription;
  createdAt: Date;
  swVersion: SwVersion;
};

// In-memory store — lives as long as the Node.js process
const subscriptions = new Map<string, StoredSubscription>();

function endpointToId(endpoint: string): string {
  return Buffer.from(endpoint).toString("base64url").slice(0, 16);
}

export function addSubscription(
  subscription: PushSubscription,
  swVersion: SwVersion = "v1"
): StoredSubscription {
  console.log('add', subscriptions.entries());
  const id = endpointToId(subscription.endpoint);
  const stored: StoredSubscription = { id, subscription, createdAt: new Date(), swVersion };
  subscriptions.set(id, stored);
  return stored;
}

export function removeSubscription(endpoint: string): boolean {
  return subscriptions.delete(endpointToId(endpoint));
}

export function updateSubscriptionVersion(
  id: string,
  version: SwVersion
): StoredSubscription | null {
  console.log('patch', subscriptions.entries());
  const stored = subscriptions.get(id);
  if (!stored) return null;
  stored.swVersion = version;
  return stored;
}

/** Also supports lookup by endpoint (converts to id internally). */
export function updateSubscriptionVersionByEndpoint(
  endpoint: string,
  version: SwVersion
): StoredSubscription | null {
  return updateSubscriptionVersion(endpointToId(endpoint), version);
}

export function getSubscriptionById(id: string): StoredSubscription | undefined {
  return subscriptions.get(id);
}

export function getAllSubscriptions(): StoredSubscription[] {
  return Array.from(subscriptions.values());
}

export function getSubscriptionCount(): number {
  return subscriptions.size;
}

export { webpush };
