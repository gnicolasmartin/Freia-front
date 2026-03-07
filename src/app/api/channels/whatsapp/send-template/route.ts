/**
 * /api/channels/whatsapp/send-template
 *
 * POST — Send a WhatsApp template message via the Cloud API.
 *
 * Use this endpoint for conversations that are outside the 24-hour window.
 * The template must be pre-approved by Meta before it can be sent.
 *
 * Request body:
 *   {
 *     to: string               — recipient phone (E.164, e.g. "+5491112345678")
 *     templateName: string     — snake_case template name approved by Meta
 *     languageCode: string     — BCP-47 language code (e.g. "es", "en_US")
 *     components: WATemplateComponent[]  — resolved parameter values
 *     phoneNumberId?: string   — dev fallback (env var takes precedence)
 *     accessToken?: string     — dev fallback (env var takes precedence)
 *   }
 *
 * Success (200):
 *   { messageId: string, status: "sent", templateName: string }
 *
 * Errors:
 *   400 — missing fields or bad JSON
 *   401 — no credentials configured
 *   429 — rate limited
 *   5xx — API / network error
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  sendWhatsAppTemplate,
  WhatsAppSendError,
  type WATemplateComponent,
} from "@/lib/whatsapp-sender";

interface SendTemplateBody {
  to: string;
  templateName: string;
  languageCode: string;
  components: WATemplateComponent[];
  phoneNumberId?: string;
  accessToken?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: SendTemplateBody;
  try {
    body = (await request.json()) as SendTemplateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, templateName, languageCode, components } = body;

  if (!to || typeof to !== "string") {
    return NextResponse.json(
      { error: "Missing required field: to" },
      { status: 400 }
    );
  }
  if (!templateName || typeof templateName !== "string") {
    return NextResponse.json(
      { error: "Missing required field: templateName" },
      { status: 400 }
    );
  }
  if (!languageCode || typeof languageCode !== "string") {
    return NextResponse.json(
      { error: "Missing required field: languageCode" },
      { status: 400 }
    );
  }
  if (!Array.isArray(components)) {
    return NextResponse.json(
      { error: "Missing required field: components (must be an array)" },
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
    const result = await sendWhatsAppTemplate(
      to,
      templateName,
      languageCode,
      components,
      phoneNumberId,
      accessToken
    );

    console.info(
      `[WhatsApp Template] Sent "${templateName}" (${languageCode}) to ${to}: ${result.messageId}`
    );

    return NextResponse.json({
      messageId: result.messageId,
      status: "sent",
      templateName,
    });
  } catch (err) {
    if (err instanceof WhatsAppSendError) {
      console.error(
        `[WhatsApp Template] Failed to send "${templateName}" to ${to}: ${err.message} (code=${err.code})`
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
        },
        { status: err.httpStatus && err.httpStatus >= 400 ? err.httpStatus : 500 }
      );
    }

    console.error("[WhatsApp Template] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
