import { NextRequest, NextResponse } from "next/server";
import { addSubscription, removeSubscription } from "@/lib/subscriptionStore";
import { PushSubscription } from "web-push";

export async function POST(req: NextRequest) {
  try {
    const subscription: PushSubscription = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    const stored = addSubscription(subscription);
    return NextResponse.json({ id: stored.id, createdAt: stored.createdAt }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }
    const removed = removeSubscription(endpoint);
    if (!removed) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
