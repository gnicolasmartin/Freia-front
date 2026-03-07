/**
 * /api/channels/whatsapp/send
 *
 * POST — Send a WhatsApp text message via the Cloud API.
 *
 * Request body:
 *   {
 *     to: string          — recipient phone number (E.164 format, e.g. "+5491112345678")
 *     text: string        — message body
 *     phoneNumberId?: string  — override env var (dev / testing only)
 *     accessToken?: string    — override env var (dev / testing only)
 *     maxRetries?: number     — default 3
 *   }
 *
 * Credentials resolution:
 *   1. WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN env vars (production)
 *   2. phoneNumberId / accessToken from request body (dev only)
 *
 * Success response (200):
 *   { messageId: string, status: "sent", attempts: number }
 *
 * Error responses:
 *   400 { error: "..." }               — missing or malformed request
 *   401 { error: "..." }               — no credentials available
 *   429 { error: "...", code: "rate_limited" }
 *   5xx { error: "...", code, attempts, httpStatus }
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  sendWhatsAppTextWithRetry,
  WhatsAppSendError,
} from "@/lib/whatsapp-sender";

interface SendRequestBody {
  to: string;
  text: string;
  phoneNumberId?: string;
  accessToken?: string;
  maxRetries?: number;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: SendRequestBody;
  try {
    body = (await request.json()) as SendRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, text, maxRetries = 3 } = body;

  if (!to || typeof to !== "string") {
    return NextResponse.json(
      { error: "Missing required field: to" },
      { status: 400 }
    );
  }

  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { error: "Missing required field: text" },
      { status: 400 }
    );
  }

  // Credentials: env vars take precedence over request body
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID ?? body.phoneNumberId;
  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN ?? body.accessToken;

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      {
        error:
          "No WhatsApp credentials configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.",
      },
      { status: 401 }
    );
  }

  try {
    const result = await sendWhatsAppTextWithRetry(
      to,
      text,
      phoneNumberId,
      accessToken,
      maxRetries
    );

    console.info(
      `[WhatsApp Send] Sent to ${to}: ${result.messageId} (${result.attempts} attempt(s))`
    );

    return NextResponse.json({
      messageId: result.messageId,
      status: "sent",
      attempts: result.attempts,
    });
  } catch (err) {
    if (err instanceof WhatsAppSendError) {
      console.error(
        `[WhatsApp Send] Failed to send to ${to}: ${err.message} (code=${err.code}, attempts=${err.attempts})`
      );

      if (err.code === "rate_limited") {
        return NextResponse.json(
          { error: "Rate limited — try again later", code: err.code },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          httpStatus: err.httpStatus,
          attempts: err.attempts,
        },
        { status: err.httpStatus && err.httpStatus >= 400 ? err.httpStatus : 500 }
      );
    }

    console.error("[WhatsApp Send] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
