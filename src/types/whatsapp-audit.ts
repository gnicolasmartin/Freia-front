/**
 * whatsapp-audit.ts
 *
 * Types for the WhatsApp channel activity audit log.
 * Covers inbound/outbound messages, status updates, template usage, and errors.
 */

export type WhatsAppAuditEventType =
  | "outbound_sent"     // free-form text message sent successfully to API
  | "outbound_failed"   // free-form text message rejected (window, opt-in, API error)
  | "template_sent"     // template message sent successfully
  | "template_failed"   // template message send failed
  | "status_update"     // delivery/read/failed receipt from webhook
  | "inbound_received"; // inbound message received from a WhatsApp user

export interface WhatsAppAuditEntry {
  id: string;
  /** ISO timestamp when the event was recorded. */
  timestamp: string;
  eventType: WhatsAppAuditEventType;
  /** Message flow direction. "status" is used for webhook receipts. */
  direction: "inbound" | "outbound" | "status";
  /** E.164 phone number of the contact (recipient for outbound, sender for inbound). */
  phoneNumber: string;
  /** WhatsApp message ID (wamid.xxx) — available after API confirmation. */
  messageId?: string;
  /** Local OutboundMessage UUID (correlates with the messages panel). */
  localId?: string;
  /** First 100 chars of the message text. */
  contentPreview?: string;
  /** Template name when event involves a template. */
  templateName?: string;
  templateLanguage?: string;
  /** New status value for status_update events (sent|delivered|read|failed). */
  newStatus?: string;
  /** WhatsApp error code (e.g. 131047). */
  errorCode?: number;
  /** WhatsApp error title. */
  errorTitle?: string;
  /** Full error message or description. */
  errorMessage?: string;
  /** Receiving phone_number_id — populated for inbound_received events. */
  fromPhoneNumberId?: string;
  /** WhatsApp message type for inbound events (text, image, audio…). */
  inboundMessageType?: string;
}
