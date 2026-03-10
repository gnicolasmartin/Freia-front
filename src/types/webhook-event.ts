/**
 * webhook-event.ts
 *
 * Normalized internal channel event types.
 * These are the canonical representations used throughout Freia
 * regardless of the originating channel provider.
 *
 * Event naming convention: channel.<entity>.<verb>
 */

// ─── Message content ────────────────────────────────────────────────────────

export type WhatsAppMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "interactive"
  | "button"
  | "sticker"
  | "reaction"
  | "unsupported";

export type WhatsAppMessageStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface MessageContent {
  type: WhatsAppMessageType;
  /** Plain text body (text messages). */
  text?: string;
  /** Media identifier returned by the WhatsApp Cloud API. */
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  /** For location messages. */
  latitude?: number;
  longitude?: number;
  /** For interactive / button replies — stringified payload. */
  interactivePayload?: string;
}

// ─── Normalized events ──────────────────────────────────────────────────────

/**
 * A new inbound message from a WhatsApp user.
 * Triggers conversation initiation or continuation.
 */
export interface MessageReceivedEvent {
  type: "channel.message.received";
  /** Internal UUID assigned at normalization time. */
  id: string;
  /** ISO timestamp of when Freia received the event. */
  receivedAt: string;

  channel: "whatsapp";
  /** WhatsApp message ID (wamid.xxx). */
  messageId: string;
  /** Sender's phone number (E.164, e.g. 5491112345678). */
  from: string;
  /** Receiving phone_number_id configured in the channel. */
  phoneNumberId: string;
  /** WhatsApp Business Account ID. */
  wabaId: string;
  /** Original message timestamp from WhatsApp (ISO). */
  timestamp: string;
  /** Company that owns this phone number (resolved via multi-tenant lookup). */
  companyId?: string;

  content: MessageContent;
  /** Display name from the WhatsApp contact profile, if available. */
  contactName?: string;
  /** Original payload — kept for debugging; never logged in production. */
  raw: unknown;
}

/**
 * Delivery / read receipt for a message previously sent by Freia.
 */
export interface MessageStatusUpdatedEvent {
  type: "channel.message.status.updated";
  id: string;
  receivedAt: string;

  channel: "whatsapp";
  /** WhatsApp message ID of the sent message. */
  messageId: string;
  status: WhatsAppMessageStatus;
  timestamp: string;
  /** Phone number of the recipient. */
  recipientId: string;
  /** Company that owns this phone number (resolved via multi-tenant lookup). */
  companyId?: string;
  /** Present when status === "failed". */
  error?: {
    code: number;
    title: string;
    message?: string;
  };
  raw: unknown;
}

// ─── Email channel events ────────────────────────────────────────────────────

export type EmailMessageStatus = "sent" | "delivered" | "bounced" | "failed";

export interface EmailMessageReceivedEvent {
  type: "channel.message.received";
  id: string;
  receivedAt: string;
  channel: "email";
  messageId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  attachments?: { filename: string; contentType: string; size: number }[];
  raw: unknown;
}

export interface EmailStatusUpdatedEvent {
  type: "channel.message.status.updated";
  id: string;
  receivedAt: string;
  channel: "email";
  messageId: string;
  status: EmailMessageStatus;
  timestamp: string;
  recipientId: string;
  error?: { code: number; title: string; message?: string };
  raw: unknown;
}

export type ChannelEvent =
  | MessageReceivedEvent
  | MessageStatusUpdatedEvent
  | EmailMessageReceivedEvent
  | EmailStatusUpdatedEvent;

// ─── Internal queue item ────────────────────────────────────────────────────

export interface QueuedEvent {
  event: ChannelEvent;
  /** Number of processing attempts. */
  attempts: number;
  enqueuedAt: string;
}
