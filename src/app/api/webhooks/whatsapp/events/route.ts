/**
 * /api/webhooks/whatsapp/events
 *
 * GET — Returns all pending events from the in-memory queue and drains them.
 *
 * Used by the Freia frontend to poll for new incoming channel events.
 * In production this would be replaced by a WebSocket or server-sent events
 * stream backed by a durable message broker.
 */

import { NextResponse } from "next/server";
import { drain, depth } from "@/lib/webhook-event-queue";

export async function GET(): Promise<Response> {
  const queued = drain();

  return NextResponse.json({
    count: queued.length,
    remaining: depth(), // should be 0 after drain, but good for diagnostics
    events: queued.map((q) => ({
      ...q.event,
      // Strip raw payload to avoid leaking sensitive data to the frontend
      raw: undefined,
    })),
  });
}
