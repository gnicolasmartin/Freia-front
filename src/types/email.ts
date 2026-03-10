/**
 * email.ts
 *
 * Types for the Email channel: SMTP credentials, outbound/inbound messages,
 * and audit log entries.
 */

// ─── SMTP credentials ───────────────────────────────────────────────────────

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromAddress: string;
  senderName: string;
}

// ─── Outbound email ──────────────────────────────────────────────────────────

export type OutboundEmailStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed";

export interface OutboundEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  isHtml: boolean;
  replyTo?: string;
  /** SMTP Message-ID after successful send. */
  messageId?: string;
  status: OutboundEmailStatus;
  attempts: number;
  createdAt: string;
  sentAt?: string;
  error?: string;
  statusUpdatedAt?: string;
}

// ─── Inbound email ───────────────────────────────────────────────────────────

export interface EmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
}

export interface InboundEmail {
  id: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: string;
  messageId?: string;
  inReplyTo?: string;
  attachments?: EmailAttachmentMeta[];
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type EmailAuditEventType =
  | "outbound_sent"
  | "outbound_failed"
  | "inbound_received"
  | "status_update"
  | "connection_test";

export interface EmailAuditEntry {
  id: string;
  timestamp: string;
  eventType: EmailAuditEventType;
  direction: "inbound" | "outbound" | "status" | "system";
  emailAddress: string;
  messageId?: string;
  localId?: string;
  subject?: string;
  contentPreview?: string;
  newStatus?: string;
  errorMessage?: string;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export type EmailWebhookProvider = "sendgrid" | "mailgun" | "generic";

export interface EmailWebhookPayload {
  provider: EmailWebhookProvider;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  attachments?: { filename: string; contentType: string; size: number }[];
  raw?: unknown;
}
