/**
 * email-webhook.ts
 *
 * Pure functions for inbound email webhook processing.
 * Supports SendGrid Inbound Parse, Mailgun, and generic JSON payloads.
 * No React dependencies — safe for API routes.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { EmailWebhookPayload, EmailWebhookProvider } from "@/types/email";
import type {
  EmailMessageReceivedEvent,
  ChannelEvent,
} from "@/types/webhook-event";

// ─── Signature verification ──────────────────────────────────────────────────

export function verifyEmailWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const sig = signatureHeader.replace(/^sha256=/, "");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Provider detection ──────────────────────────────────────────────────────

interface SendGridPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  envelope?: string;
  headers?: string;
  dkim?: string;
  SPF?: string;
  [key: string]: unknown;
}

interface MailgunPayload {
  sender?: string;
  from?: string;
  recipient?: string;
  To?: string;
  subject?: string;
  "body-plain"?: string;
  "body-html"?: string;
  "Message-Id"?: string;
  "In-Reply-To"?: string;
  [key: string]: unknown;
}

export function detectProvider(payload: unknown): EmailWebhookProvider {
  if (!payload || typeof payload !== "object") return "generic";
  const obj = payload as Record<string, unknown>;
  // SendGrid sends envelope, dkim, SPF fields
  if ("envelope" in obj || "dkim" in obj || "SPF" in obj) return "sendgrid";
  // Mailgun sends body-plain, body-html, sender fields
  if ("body-plain" in obj || "body-html" in obj || "sender" in obj) return "mailgun";
  return "generic";
}

// ─── Payload parsers ─────────────────────────────────────────────────────────

function parseSendGrid(payload: SendGridPayload): EmailWebhookPayload | null {
  const from = payload.from;
  if (!from) return null;
  const nameMatch = from.match(/^"?([^"<]+)"?\s*<(.+)>/);
  return {
    provider: "sendgrid",
    from: nameMatch ? nameMatch[2] : from,
    fromName: nameMatch ? nameMatch[1].trim() : undefined,
    to: payload.to ?? "",
    subject: payload.subject ?? "",
    text: payload.text,
    html: payload.html,
    raw: payload,
  };
}

function parseMailgun(payload: MailgunPayload): EmailWebhookPayload | null {
  const from = payload.from ?? payload.sender;
  if (!from) return null;
  const nameMatch = from.match(/^"?([^"<]+)"?\s*<(.+)>/);
  return {
    provider: "mailgun",
    from: nameMatch ? nameMatch[2] : from,
    fromName: nameMatch ? nameMatch[1].trim() : undefined,
    to: payload.recipient ?? payload.To ?? "",
    subject: payload.subject ?? "",
    text: payload["body-plain"],
    html: payload["body-html"],
    messageId: payload["Message-Id"] as string | undefined,
    inReplyTo: payload["In-Reply-To"] as string | undefined,
    raw: payload,
  };
}

function parseGeneric(payload: Record<string, unknown>): EmailWebhookPayload | null {
  const from = (payload.from ?? payload.sender ?? "") as string;
  if (!from) return null;
  return {
    provider: "generic",
    from,
    fromName: payload.fromName as string | undefined,
    to: (payload.to ?? payload.recipient ?? "") as string,
    subject: (payload.subject ?? "") as string,
    text: payload.text as string | undefined,
    html: payload.html as string | undefined,
    messageId: payload.messageId as string | undefined,
    inReplyTo: payload.inReplyTo as string | undefined,
    raw: payload,
  };
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseEmailWebhookPayload(
  payload: unknown
): EmailWebhookPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const provider = detectProvider(payload);
  switch (provider) {
    case "sendgrid":
      return parseSendGrid(payload as SendGridPayload);
    case "mailgun":
      return parseMailgun(payload as MailgunPayload);
    default:
      return parseGeneric(payload as Record<string, unknown>);
  }
}

// ─── Normalize to ChannelEvent ───────────────────────────────────────────────

export function normalizeEmailToChannelEvents(
  parsed: EmailWebhookPayload
): ChannelEvent[] {
  const event: EmailMessageReceivedEvent = {
    type: "channel.message.received",
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    channel: "email",
    messageId: parsed.messageId ?? crypto.randomUUID(),
    from: parsed.from,
    fromName: parsed.fromName,
    to: parsed.to,
    subject: parsed.subject,
    bodyText: parsed.text,
    bodyHtml: parsed.html,
    inReplyTo: parsed.inReplyTo,
    attachments: parsed.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
    raw: parsed.raw,
  };
  return [event];
}
