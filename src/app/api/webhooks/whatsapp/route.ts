/**
 * /api/webhooks/whatsapp
 *
 * Handles the two sides of the WhatsApp Cloud API webhook contract:
 *
 *  GET  — Verification handshake (Meta calls this once when you register the webhook).
 *  POST — Incoming events (messages, status updates). Must respond 200 within 5 s.
 *
 * Environment variables required:
 *   WHATSAPP_VERIFY_TOKEN   — Must match the token configured in Meta Business Manager.
 *   WHATSAPP_APP_SECRET     — Used to validate X-Hub-Signature-256 on POST requests.
 *                             Optional: if not set, signature validation is skipped
 *                             (not recommended for production).
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  verifyHandshake,
  verifySignature,
  parseWhatsAppPayload,
} from "@/lib/whatsapp-webhook";
import { enqueue } from "@/lib/webhook-event-queue";

// ─── GET — Webhook verification handshake ───────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error(
      "[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not configured."
    );
    return new NextResponse("Webhook not configured", { status: 503 });
  }

  const challengeResponse = verifyHandshake(mode, token, challenge, expectedToken);

  if (challengeResponse !== null) {
    // Meta requires the challenge echoed as plain text with 200
    return new NextResponse(challengeResponse, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WhatsApp Webhook] Handshake failed — token mismatch or missing params.", {
    mode,
    tokenMatch: token === expectedToken,
    hasChallenge: !!challenge,
  });
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — Incoming events ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // Read raw body — must happen before any JSON parsing so signature is valid
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Signature validation (skip if app secret not configured)
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signatureHeader =
      request.headers.get("X-Hub-Signature-256") ?? "";

    if (!verifySignature(rawBody, signatureHeader, appSecret)) {
      console.warn(
        "[WhatsApp Webhook] Signature validation failed — possible spoofed request."
      );
      return new NextResponse("Unauthorized", { status: 401 });
    }
  } else {
    // Log once so operators know to configure it
    console.warn(
      "[WhatsApp Webhook] WHATSAPP_APP_SECRET not set — skipping signature validation."
    );
  }

  // Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request: invalid JSON", { status: 400 });
  }

  // Normalize to internal channel events
  const events = parseWhatsAppPayload(payload);

  // Enqueue each event
  for (const event of events) {
    enqueue(event);
  }

  if (events.length > 0) {
    console.info(
      `[WhatsApp Webhook] Enqueued ${events.length} event(s):`,
      events.map((e) => `${e.type}(${e.id.slice(0, 8)})`).join(", ")
    );
  }

  // Meta requires 200 quickly, regardless of processing outcome
  return new NextResponse("OK", { status: 200 });
}
