import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, getSubscriptionCount, webpush } from "@/lib/subscriptionStore";

export async function POST(req: NextRequest) {
  try {
    const { title, body, url } = await req.json();

    const subs = getAllSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ error: "No subscribers" }, { status: 400 });
    }

    const payload = JSON.stringify({
      title: title || "Web Push Demo",
      body: body || "Hello from the server!",
      icon: "/icon-192.png",
      url: url || "/",
    });

    const results = await Promise.allSettled(
      subs.map(({ subscription }) => webpush.sendNotification(subscription, payload))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ sent, failed, total: subs.length });
  } catch {
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ count: getSubscriptionCount() });
}
