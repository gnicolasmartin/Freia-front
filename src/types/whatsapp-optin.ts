/**
 * Types for WhatsApp opt-in compliance management.
 *
 * WhatsApp Business Policy and GDPR require explicit consent before a business
 * can proactively message a user. These types track that consent per contact.
 */

// ─── Opt-in status ────────────────────────────────────────────────────────────

/**
 * The opt-in status of a contact.
 * - "confirmed" — contact explicitly opted in to receive messages
 * - "pending"   — opt-in was requested or a message was received; awaiting confirmation
 * - "revoked"   — contact opted out (e.g. replied STOP); must not be proactively messaged
 * - "none"      — no record exists for this contact
 */
export type OptInStatus = "confirmed" | "pending" | "revoked" | "none";

// ─── Opt-in record ────────────────────────────────────────────────────────────

/**
 * A per-contact opt-in record with full evidence trail.
 */
export interface OptInRecord {
  phoneNumber: string;
  status: OptInStatus;
  /**
   * Human-readable origin of the opt-in action.
   * Examples: "Formulario web", "Manual (admin)", "WhatsApp flow", "Importación", "API"
   */
  source?: string;
  /** ISO timestamp when status became "confirmed" */
  confirmedAt?: string;
  /** ISO timestamp when status became "revoked" */
  revokedAt?: string;
  /** ISO timestamp when status became "pending" */
  pendingSince?: string;
  /** ISO timestamp of last status change */
  updatedAt: string;
  /** Optional admin notes (e.g. "Opted in via landing page Black Friday") */
  notes?: string;
}

// ─── Opt-in policy ───────────────────────────────────────────────────────────

/**
 * Admin-configurable policy governing how opt-in status affects message sending.
 */
export interface OptInPolicy {
  /**
   * If true (default), business-initiated messages (including templates) require
   * the contact to have "confirmed" opt-in. Without it, sends are blocked.
   */
  requireConfirmedForBusinessInitiated: boolean;
  /**
   * If true (default), free-form replies to an active 24h conversation window
   * are allowed even if the contact's opt-in is not "confirmed".
   * This reflects WhatsApp's rule that you can always reply to an inbound message.
   */
  allowRepliesInOpenWindow: boolean;
  /**
   * If true (default), automatically create a "pending" opt-in record when
   * the first inbound message is received from an unknown contact.
   */
  autoCreatePendingOnInbound: boolean;
}

// ─── Enforcement result ───────────────────────────────────────────────────────

/** Result of an opt-in enforcement check. */
export interface OptInCheckResult {
  allowed: boolean;
  /** Human-readable reason when not allowed. */
  reason?: string;
}
