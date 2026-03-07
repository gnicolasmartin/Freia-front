/**
 * Types for WhatsApp template messaging and 24-hour conversation window management.
 */

// ─── Template types ───────────────────────────────────────────────────────────

/** Meta-defined template category — determines when and how the template can be sent. */
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

/** Simulated Meta approval status. New templates start as "pending" and auto-approve. */
export type TemplateStatus = "approved" | "pending" | "rejected";

/**
 * A single variable slot in a template body (e.g. {{1}}, {{2}}).
 * Variables are 1-indexed and must all be filled when sending.
 */
export interface TemplateVariable {
  /** 1-based position matching {{n}} in the template body */
  index: number;
  /** Human-readable label shown in the UI (e.g. "Nombre del cliente") */
  label: string;
  /** Example value used for preview rendering */
  example: string;
}

/** A WhatsApp message template registered in Freia. */
export interface WhatsAppTemplate {
  id: string;
  /** snake_case name used in the WhatsApp Cloud API (e.g. "follow_up_lead") */
  name: string;
  /** BCP-47 language code (e.g. "es", "en_US", "pt_BR") */
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  /** Optional header line above the body */
  headerText?: string;
  /** Main message body with optional {{1}}, {{2}}, … variable placeholders */
  bodyText: string;
  /** Optional footer line below the body */
  footerText?: string;
  /** Variable definitions — auto-derived from bodyText {{n}} occurrences */
  variables: TemplateVariable[];
  createdAt: string;
  updatedAt: string;
}

// ─── Use case mapping ─────────────────────────────────────────────────────────

/**
 * Maps a template to a business use case.
 * Makes it easy for agents/flows to select the right template by intent.
 */
export interface TemplateUseCase {
  id: string;
  /** Human-readable use case name (e.g. "Follow-up de lead", "Confirmación de reserva") */
  name: string;
  description?: string;
  /** ID of the linked WhatsAppTemplate */
  templateId: string;
}

// ─── Conversation window ──────────────────────────────────────────────────────

/**
 * WhatsApp 24-hour conversation window status.
 * - "open"    — a user message was received within the last 24 hours
 * - "closed"  — last user message was more than 24 hours ago
 * - "unknown" — no inbound message has been recorded for this contact
 */
export type ConversationWindowStatus = "open" | "closed" | "unknown";

/** Per-contact 24-hour window tracking record. */
export interface ContactWindow {
  phoneNumber: string;
  /** ISO timestamp of the most recent inbound user message, or null if none */
  lastUserMessageAt: string | null;
}
