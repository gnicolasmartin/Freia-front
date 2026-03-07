/**
 * Types for WhatsApp channel identity and brand configuration.
 *
 * Allows admins to personalise the voice, signature, and automatic messages
 * sent through the WhatsApp channel without modifying flows or agents.
 */

// ─── Tone ─────────────────────────────────────────────────────────────────────

/**
 * Conversation tone used when composing free-form messages.
 * - "formal"  — professional language, usted, no colloquialisms
 * - "cercano" — friendly, vos/tú, conversational
 */
export type MessageTone = "formal" | "cercano";

// ─── Language ─────────────────────────────────────────────────────────────────

/**
 * Default language/locale for outbound messages.
 * BCP-47 codes matching WhatsApp's supported locales.
 */
export type DefaultLanguage = "es-AR" | "pt-BR" | "en-US";

// ─── Identity ─────────────────────────────────────────────────────────────────

/**
 * Per-channel identity and brand configuration.
 * Stored as a single object in localStorage.
 */
export interface ChannelIdentity {
  /**
   * Internal business display name.
   * Used as the replacement for {{brandName}} in the signature template.
   * Example: "Acme Corp"
   */
  businessName: string;

  /**
   * Optional signature appended to every free-form outbound message.
   * Supports the {{brandName}} placeholder.
   * Example: "— Equipo {{brandName}}"
   * Leave undefined or empty to disable.
   */
  signature?: string;

  /**
   * Message sent automatically to first-time contacts.
   * Informational — displayed in the UI for copy-paste or flow reference.
   */
  welcomeMessage?: string;

  /**
   * Message sent outside business hours.
   * Informational — displayed in the UI for copy-paste or flow reference.
   */
  outOfHoursMessage?: string;

  /**
   * Default language/locale for outbound messages.
   * Used as a hint for flows and agents; does not auto-translate.
   */
  defaultLanguage: DefaultLanguage;

  /**
   * Conversation tone for free-form messages.
   * Exposed to flows/agents as a style hint.
   */
  tone: MessageTone;

  /**
   * Whether to include emojis in messages.
   * Overrides the agent-level setting for this channel.
   */
  useEmojis: boolean;

  /** ISO timestamp of the last configuration update. */
  updatedAt: string;
}
