import webpush, { PushSubscription } from "web-push";

// Configure VAPID details once at module load
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type StoredSubscription = {
  id: string;
  subscription: PushSubscription;
  createdAt: Date;
};

// In-memory store — lives as long as the Node.js process
const subscriptions = new Map<string, StoredSubscription>();

export function addSubscription(subscription: PushSubscription): StoredSubscription {
  const id = Buffer.from(subscription.endpoint).toString("base64url").slice(0, 16);
  const stored: StoredSubscription = { id, subscription, createdAt: new Date() };
  subscriptions.set(id, stored);
  return stored;
}

export function removeSubscription(endpoint: string): boolean {
  const id = Buffer.from(endpoint).toString("base64url").slice(0, 16);
  return subscriptions.delete(id);
}

export function getAllSubscriptions(): StoredSubscription[] {
  return Array.from(subscriptions.values());
}

export function getSubscriptionCount(): number {
  return subscriptions.size;
}

export { webpush };
