import { NextRequest, NextResponse } from "next/server";
import {
  updateSubscriptionVersion,
  updateSubscriptionVersionByEndpoint,
  VALID_SW_VERSIONS,
  SwVersion,
} from "@/lib/subscriptionStore";

/**
 * PATCH /api/sw-version
 *
 * Update the stored SW version for a subscription so the server sends
 * the matching payload format on the next push notification.
 *
 * Accepts either:
 *   { id: string, version: SwVersion }       – lookup by subscription id
 *   { endpoint: string, version: SwVersion } – lookup by push endpoint
 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, endpoint, version } = await req.json();

    if (!version || !VALID_SW_VERSIONS.includes(version as SwVersion)) {
      return NextResponse.json(
        { error: `Invalid version. Valid values: ${VALID_SW_VERSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!id && !endpoint) {
      return NextResponse.json({ error: "'id' or 'endpoint' is required" }, { status: 400 });
    }

    const updated = id
      ? updateSubscriptionVersion(id, version as SwVersion)
      : updateSubscriptionVersionByEndpoint(endpoint, version as SwVersion);

    if (!updated) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: updated.id, swVersion: updated.swVersion });
  } catch {
    return NextResponse.json({ error: "Failed to update SW version" }, { status: 500 });
  }
}

