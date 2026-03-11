/**
 * Proxy to sync channel companyId to the backend.
 * Called by ConfigSyncProvider when WA credentials are present.
 */

import { type NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const { channel, phoneNumberId, companyId } = await request.json();

    if (!channel || !companyId) {
      return NextResponse.json({ error: "Missing channel or companyId" }, { status: 400 });
    }

    // Look up the channel config by phone_number_id to find its backend ID
    const listRes = await fetch(`${API_URL}/channels?companyId=${encodeURIComponent(companyId)}`, {
      cache: "no-store",
    });

    if (!listRes.ok) {
      // Try updating by well-known ID (ch_whatsapp)
      const channelId = `ch_${channel}`;
      const updateRes = await fetch(`${API_URL}/channels/${channelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await updateRes.json();
      return NextResponse.json(data, { status: updateRes.status });
    }

    const channels = await listRes.json();
    // Find the channel with matching phone_number_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = channels.find((c: any) => {
      if (c.channel !== channel) return false;
      if (phoneNumberId && c.metadata?.phone_number_id) {
        return c.metadata.phone_number_id === phoneNumberId;
      }
      return true;
    });

    if (!target) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Update companyId if it differs
    if (target.companyId === companyId) {
      return NextResponse.json({ updated: false, reason: "already_correct" });
    }

    const updateRes = await fetch(`${API_URL}/channels/${target.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    const data = await updateRes.json();
    return NextResponse.json(data, { status: updateRes.status });
  } catch (err) {
    console.error("[ChannelSync] Error:", err);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
