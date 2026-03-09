/**
 * /api/webhooks/whatsapp/events
 *
 * GET — Returns all pending events from the backend persistent queue.
 *
 * Used by the Freia frontend to poll for new incoming channel events.
 * Events are fetched from the backend PostgreSQL database and marked
 * as processed atomically.
 */

import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${API_URL}/events/pending`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[WhatsApp Events] Backend returned ${res.status}`);
      return NextResponse.json({ count: 0, remaining: 0, events: [] });
    }

    const data = (await res.json()) as { count: number; events: unknown[] };

    return NextResponse.json({
      count: data.count,
      remaining: 0,
      events: data.events,
    });
  } catch (err) {
    console.warn("[WhatsApp Events] Failed to fetch from backend:", err);
    return NextResponse.json({ count: 0, remaining: 0, events: [] });
  }
}
