import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, getSubscriptionCount, webpush } from "@/lib/subscriptionStore";
import { buildPayload } from "@/lib/payloadBuilder";

export async function POST(req: NextRequest) {
  try {
    const { title, body, url, image } = await req.json();

    const subs = getAllSubscriptions();
    if (subs.length === 0) {
      return NextResponse.json({ error: "No subscribers" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      subs.map(({ subscription, swVersion }) => {
        const payload = buildPayload(swVersion, {
          title: title || "Web Push Demo",
          body: body || "Hello from the server!",
          url: url || "/",
          image,
        });
        return webpush.sendNotification(subscription, payload);
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Version breakdown for debugging
    const versionBreakdown = subs.reduce<Record<string, number>>((acc, s) => {
      acc[s.swVersion] = (acc[s.swVersion] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({ sent, failed, total: subs.length, versionBreakdown });
  } catch {
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ count: getSubscriptionCount() });
}
