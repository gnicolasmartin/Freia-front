/**
 * /api/webhooks/email
 *
 * POST — Inbound email webhook receiver.
 * Supports SendGrid Inbound Parse, Mailgun, and generic JSON payloads.
 *
 * Optional environment variables:
 *   EMAIL_WEBHOOK_SECRET — HMAC secret for signature validation
 *   BACKEND_API_URL      — Backend URL to forward normalized events
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  verifyEmailWebhookSignature,
  parseEmailWebhookPayload,
  normalizeEmailToChannelEvents,
} from "@/lib/email-webhook";

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();

  // Optional signature validation
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const signature =
      request.headers.get("x-webhook-signature") ??
      request.headers.get("x-mailgun-signature") ??
      "";
    if (!verifyEmailWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  }

  // Parse payload
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = parseEmailWebhookPayload(payload);
  if (!parsed) {
    // Return 200 anyway to prevent webhook retries for unrecognized formats
    return NextResponse.json({ status: "ignored" });
  }

  const events = normalizeEmailToChannelEvents(parsed);

  // Forward to backend if configured
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    for (const event of events) {
      try {
        await fetch(`${backendUrl}/api/events/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
      } catch (err) {
        console.error("[Email Webhook] Failed to forward event to backend:", err);
      }
    }
  }

  return NextResponse.json({
    status: "ok",
    eventsProcessed: events.length,
  });
}
