import { NextResponse } from "next/server";
import { getAllSubscriptions } from "@/lib/subscriptionStore";

export async function GET() {
  const subs = getAllSubscriptions().map(({ id, createdAt }) => ({ id, createdAt }));
  return NextResponse.json({ count: subs.length, subscriptions: subs });
}
