/**
 * /api/channels/email/send
 *
 * POST — Send an email via SMTP.
 *
 * Credential resolution:
 *   1. Environment variables (EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, etc.)
 *   2. Request body fields (development fallback)
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { sendEmailWithRetry, deriveSecure, EmailSendError } from "@/lib/email-sender";

interface SendEmailRequestBody {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  // Optional credentials (dev mode — production uses env vars)
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromAddress?: string;
  senderName?: string;
  maxRetries?: number;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: SendEmailRequestBody;
  try {
    body = (await request.json()) as SendEmailRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { to, subject, text, html, replyTo, maxRetries } = body;

  if (!to || !subject) {
    return NextResponse.json(
      { error: "Missing required fields: to, subject" },
      { status: 400 }
    );
  }

  if (!text && !html) {
    return NextResponse.json(
      { error: "At least one of text or html must be provided" },
      { status: 400 }
    );
  }

  // Credential resolution: env vars > request body
  const host = process.env.EMAIL_SMTP_HOST ?? body.host;
  const portStr = process.env.EMAIL_SMTP_PORT ?? String(body.port ?? "");
  const username = process.env.EMAIL_SMTP_USER ?? body.username;
  const password = process.env.EMAIL_SMTP_PASS ?? body.password;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? body.fromAddress;
  const senderName = process.env.EMAIL_SENDER_NAME ?? body.senderName ?? "Freia";

  if (!host || !portStr || !username || !password || !fromAddress) {
    return NextResponse.json(
      {
        error:
          "SMTP credentials not configured. Set EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS, EMAIL_FROM_ADDRESS environment variables or pass them in the request body.",
      },
      { status: 400 }
    );
  }

  const port = parseInt(portStr, 10);
  const secure = body.secure ?? deriveSecure(port);

  try {
    const result = await sendEmailWithRetry(
      {
        to,
        subject,
        text,
        html,
        replyTo,
        host,
        port,
        secure,
        username,
        password,
        fromAddress,
        senderName,
      },
      maxRetries ?? 3
    );

    return NextResponse.json({
      messageId: result.messageId,
      status: "sent",
      attempts: result.attempts,
    });
  } catch (err) {
    const isKnown = err instanceof EmailSendError;
    const code = isKnown ? err.code : "unknown";
    const message = err instanceof Error ? err.message : "Unknown error";
    const statusCode =
      code === "rate_limited" ? 429 : code === "auth_error" ? 401 : 500;

    return NextResponse.json(
      { error: message, code, attempts: isKnown ? err.attempts : 0 },
      { status: statusCode }
    );
  }
}
