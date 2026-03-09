/**
 * /api/channels/whatsapp/send
 *
 * POST — Send a WhatsApp message via the Cloud API.
 *
 * Supports three modes:
 *   1. Text message:        { to, text }
 *   2. Button interactive:  { to, text, interactive: { type: "buttons", buttons: [{id, title}] } }
 *   3. List interactive:    { to, text, interactive: { type: "list", buttonTitle, rows: [{id, title, description?}] } }
 *
 * Credentials resolution:
 *   1. WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN env vars (production)
 *   2. phoneNumberId / accessToken from request body (dev only)
 *
 * Success response (200):
 *   { messageId: string, status: "sent", attempts: number }
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  sendWhatsAppTextWithRetry,
  sendWhatsAppButtons,
  sendWhatsAppList,
  WhatsAppSendError,
} from "@/lib/whatsapp-sender";
import type { InteractiveButton, InteractiveListRow } from "@/lib/whatsapp-sender";
import { lookupByCompanyId } from "@/lib/credential-lookup";

interface SendRequestBody {
  to: string;
  text: string;
  phoneNumberId?: string;
  accessToken?: string;
  companyId?: string;
  maxRetries?: number;
  interactive?: {
    type: "buttons" | "list";
    buttons?: InteractiveButton[];
    buttonTitle?: string;
    rows?: InteractiveListRow[];
  };
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

  // Credentials resolution (multi-tenant):
  // 1. If companyId provided → lookup from backend DB
  // 2. Fallback to env vars
  // 3. Fallback to request body (dev)
  let phoneNumberId: string | undefined;
  let accessToken: string | undefined;

  if (body.companyId) {
    const credentials = await lookupByCompanyId(body.companyId);
    if (credentials) {
      phoneNumberId = credentials.phoneNumberId;
      accessToken = credentials.accessToken;
    }
  }

  if (!phoneNumberId || !accessToken) {
    phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? body.phoneNumberId;
    accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? body.accessToken;
  }

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      {
        error:
          "No WhatsApp credentials configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN, or provide companyId.",
      },
      { status: 401 }
    );
  }

  try {
    let messageId: string;
    let attempts = 1;

    if (body.interactive?.type === "buttons" && body.interactive.buttons?.length) {
      const res = await sendWhatsAppButtons(to, text, body.interactive.buttons, phoneNumberId, accessToken);
      messageId = res.messageId;
    } else if (body.interactive?.type === "list" && body.interactive.rows?.length) {
      const res = await sendWhatsAppList(
        to, text, body.interactive.buttonTitle ?? "Ver opciones", body.interactive.rows, phoneNumberId, accessToken
      );
      messageId = res.messageId;
    } else {
      const res = await sendWhatsAppTextWithRetry(to, text, phoneNumberId, accessToken, maxRetries);
      messageId = res.messageId;
      attempts = res.attempts;
    }

    console.info(
      `[WhatsApp Send] Sent to ${to}: ${messageId} (${attempts} attempt(s))`
    );

    return NextResponse.json({
      messageId,
      status: "sent",
      attempts,
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
