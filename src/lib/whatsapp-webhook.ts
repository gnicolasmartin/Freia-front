/**
 * whatsapp-webhook.ts
 *
 * Pure functions for WhatsApp Cloud API webhook processing.
 * No side effects, no I/O — safe to unit-test in isolation.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ChannelEvent,
  MessageContent,
  MessageReceivedEvent,
  MessageStatusUpdatedEvent,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from "@/types/webhook-event";

// ─── Verification handshake ─────────────────────────────────────────────────

/**
 * Validates the Meta webhook verification handshake.
 *
 * Meta sends:
 *   GET /webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=NONCE
 *
 * Returns the challenge string to echo back, or null if validation fails.
 */
export function verifyHandshake(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  expectedToken: string
): string | null {
  if (mode === "subscribe" && token === expectedToken && challenge) {
    return challenge;
  }
  return null;
}

// ─── Signature validation ───────────────────────────────────────────────────

/**
 * Validates the HMAC-SHA256 signature on incoming POST payloads.
 *
 * Meta sends: X-Hub-Signature-256: sha256=<hex>
 * Computed  : HMAC-SHA256(appSecret, rawBody)
 *
 * Uses constant-time comparison (timingSafeEqual) to prevent timing attacks.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
): boolean {
  const [algorithm, receivedHex] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !receivedHex) return false;

  try {
    const expectedHex = createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    const expectedBuf = Buffer.from(expectedHex, "hex");
    const receivedBuf = Buffer.from(receivedHex, "hex");

    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ─── Payload parsing & normalization ────────────────────────────────────────

// --- Internal Meta payload shape ---

interface WAContactProfile {
  name: string;
}
interface WAContact {
  profile: WAContactProfile;
  wa_id: string;
}
interface WAMetadata {
  display_phone_number: string;
  phone_number_id: string;
}
interface WATextMessage {
  body: string;
}
interface WAMediaMessage {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
}
interface WALocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}
interface WAInteractiveMessage {
  type: string;
  list_reply?: { id: string; title: string; description?: string };
  button_reply?: { id: string; title: string };
}
interface WAButtonMessage {
  text: string;
  payload: string;
}
interface WAReactionMessage {
  message_id: string;
  emoji: string;
}
interface WAMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: WATextMessage;
  image?: WAMediaMessage;
  audio?: WAMediaMessage;
  video?: WAMediaMessage;
  document?: WAMediaMessage;
  location?: WALocationMessage;
  interactive?: WAInteractiveMessage;
  button?: WAButtonMessage;
  reaction?: WAReactionMessage;
  sticker?: WAMediaMessage;
  context?: { from: string; id: string };
  errors?: Array<{ code: number; title: string; message?: string }>;
}
interface WAStatusError {
  code: number;
  title: string;
  message?: string;
}
interface WAStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: WAStatusError[];
  conversation?: unknown;
  pricing?: unknown;
}
interface WAChangeValue {
  messaging_product: string;
  metadata: WAMetadata;
  contacts?: WAContact[];
  messages?: WAMessage[];
  statuses?: WAStatus[];
}
interface WAChange {
  value: WAChangeValue;
  field: string;
}
interface WAEntry {
  id: string;
  changes: WAChange[];
}
interface WAPayload {
  object: string;
  entry: WAEntry[];
}

// --- Content extractor ---

function extractContent(msg: WAMessage): MessageContent {
  const type = msg.type as WhatsAppMessageType;

  switch (type) {
    case "text":
      return { type: "text", text: msg.text?.body };

    case "image":
      return {
        type: "image",
        mediaId: msg.image?.id,
        mimeType: msg.image?.mime_type,
      };

    case "audio":
      return {
        type: "audio",
        mediaId: msg.audio?.id,
        mimeType: msg.audio?.mime_type,
      };

    case "video":
      return {
        type: "video",
        mediaId: msg.video?.id,
        mimeType: msg.video?.mime_type,
      };

    case "document":
      return {
        type: "document",
        mediaId: msg.document?.id,
        mimeType: msg.document?.mime_type,
        filename: msg.document?.filename,
      };

    case "location":
      return {
        type: "location",
        latitude: msg.location?.latitude,
        longitude: msg.location?.longitude,
      };

    case "interactive": {
      const ir = msg.interactive;
      const payload = ir?.list_reply ?? ir?.button_reply;
      return {
        type: "interactive",
        interactivePayload: payload ? JSON.stringify(payload) : undefined,
      };
    }

    case "button":
      return {
        type: "button",
        text: msg.button?.text,
        interactivePayload: msg.button?.payload,
      };

    case "sticker":
      return { type: "sticker", mediaId: msg.sticker?.id };

    case "reaction":
      return { type: "reaction", text: msg.reaction?.emoji };

    default:
      return { type: "unsupported" };
  }
}

// --- Status normalizer ---

const VALID_STATUSES: WhatsAppMessageStatus[] = [
  "sent",
  "delivered",
  "read",
  "failed",
];

function normalizeStatus(raw: string): WhatsAppMessageStatus {
  return VALID_STATUSES.includes(raw as WhatsAppMessageStatus)
    ? (raw as WhatsAppMessageStatus)
    : "failed";
}

// --- Unix timestamp → ISO ---

function tsToISO(unixSeconds: string | number): string {
  const ms =
    typeof unixSeconds === "string"
      ? parseInt(unixSeconds, 10) * 1000
      : unixSeconds * 1000;
  return new Date(ms).toISOString();
}

/**
 * Parses and normalizes a raw WhatsApp Cloud API webhook payload into
 * a list of typed ChannelEvent objects.
 *
 * Unknown or malformed payloads return an empty array — callers should
 * always respond 200 to Meta regardless of parse result.
 */
export function parseWhatsAppPayload(payload: unknown): ChannelEvent[] {
  const events: ChannelEvent[] = [];
  const now = new Date().toISOString();

  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as WAPayload).object !== "whatsapp_business_account"
  ) {
    return events;
  }

  const body = payload as WAPayload;

  for (const entry of body.entry ?? []) {
    const wabaId = entry.id;

    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id ?? "";

      // Build a contact name lookup: wa_id → display name
      const contactNames: Record<string, string> = {};
      for (const c of value.contacts ?? []) {
        if (c.wa_id && c.profile?.name) {
          contactNames[c.wa_id] = c.profile.name;
        }
      }

      // --- Inbound messages ---
      for (const msg of value.messages ?? []) {
        const event: MessageReceivedEvent = {
          type: "channel.message.received",
          id: crypto.randomUUID(),
          receivedAt: now,
          channel: "whatsapp",
          messageId: msg.id,
          from: msg.from,
          phoneNumberId,
          wabaId,
          timestamp: tsToISO(msg.timestamp),
          content: extractContent(msg),
          contactName: contactNames[msg.from],
          raw: msg,
        };
        events.push(event);
      }

      // --- Delivery / read statuses ---
      for (const status of value.statuses ?? []) {
        const firstError = status.errors?.[0];
        const event: MessageStatusUpdatedEvent = {
          type: "channel.message.status.updated",
          id: crypto.randomUUID(),
          receivedAt: now,
          channel: "whatsapp",
          messageId: status.id,
          status: normalizeStatus(status.status),
          timestamp: tsToISO(status.timestamp),
          recipientId: status.recipient_id,
          error: firstError
            ? {
                code: firstError.code,
                title: firstError.title,
                message: firstError.message,
              }
            : undefined,
          raw: status,
        };
        events.push(event);
      }
    }
  }

  return events;
}
