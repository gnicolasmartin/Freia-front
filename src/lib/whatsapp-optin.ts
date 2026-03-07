/**
 * whatsapp-optin.ts
 *
 * Pure opt-in enforcement utilities for WhatsApp compliance.
 * No React dependencies — safe to import from any provider or API route.
 * Reads/writes localStorage directly so WhatsAppMessagesProvider can check
 * opt-in without depending on WhatsAppOptInProvider context (avoids circular deps).
 *
 * localStorage keys:
 *   freia_wa_optin        — OptInRecord[]
 *   freia_wa_optin_policy — OptInPolicy
 */

import type {
  OptInCheckResult,
  OptInPolicy,
  OptInRecord,
  OptInStatus,
} from "@/types/whatsapp-optin";
import type { ConversationWindowStatus } from "@/types/whatsapp-template";

// ─── Storage keys ─────────────────────────────────────────────────────────────

export const OPTIN_STORAGE_KEY = "freia_wa_optin";
export const OPTIN_POLICY_KEY = "freia_wa_optin_policy";

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_OPTIN_POLICY: OptInPolicy = {
  requireConfirmedForBusinessInitiated: true,
  allowRepliesInOpenWindow: true,
  autoCreatePendingOnInbound: true,
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readRecords(): OptInRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OPTIN_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeRecords(records: OptInRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPTIN_STORAGE_KEY, JSON.stringify(records));
}

// ─── Policy ───────────────────────────────────────────────────────────────────

/**
 * Returns the current opt-in policy, merged with defaults.
 * Always returns a complete policy object even if localStorage is empty.
 */
export function getOptInPolicy(): OptInPolicy {
  if (typeof window === "undefined") return DEFAULT_OPTIN_POLICY;
  try {
    const stored = JSON.parse(
      localStorage.getItem(OPTIN_POLICY_KEY) ?? "{}"
    ) as Partial<OptInPolicy>;
    return { ...DEFAULT_OPTIN_POLICY, ...stored };
  } catch {
    return DEFAULT_OPTIN_POLICY;
  }
}

/** Persists an opt-in policy to localStorage. */
export function saveOptInPolicy(policy: OptInPolicy): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPTIN_POLICY_KEY, JSON.stringify(policy));
}

// ─── Record reads ─────────────────────────────────────────────────────────────

/** Returns the opt-in record for a phone number, or null if none exists. */
export function getOptInRecord(phoneNumber: string): OptInRecord | null {
  return readRecords().find((r) => r.phoneNumber === phoneNumber) ?? null;
}

/**
 * Returns the opt-in status for a phone number.
 * Returns "none" if no record exists.
 */
export function getOptInStatus(phoneNumber: string): OptInStatus {
  return getOptInRecord(phoneNumber)?.status ?? "none";
}

/**
 * Returns all opt-in records sorted by most recently updated first.
 */
export function getAllOptInRecords(): OptInRecord[] {
  return readRecords().sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ─── Record writes ────────────────────────────────────────────────────────────

/**
 * Creates or updates the opt-in record for a phone number.
 * Sets the appropriate timestamp fields based on the new status.
 */
export function setOptInRecord(
  phoneNumber: string,
  status: OptInStatus,
  source?: string,
  notes?: string
): void {
  const records = readRecords();
  const now = new Date().toISOString();
  const existing = records.find((r) => r.phoneNumber === phoneNumber);

  const updated: OptInRecord = {
    phoneNumber,
    status,
    source: source ?? existing?.source,
    notes: notes ?? existing?.notes,
    updatedAt: now,
    // Preserve existing timestamps; set new ones based on status transition
    confirmedAt:
      status === "confirmed"
        ? (existing?.confirmedAt ?? now)
        : existing?.confirmedAt,
    revokedAt:
      status === "revoked"
        ? (existing?.revokedAt ?? now)
        : existing?.revokedAt,
    pendingSince:
      status === "pending"
        ? (existing?.pendingSince ?? now)
        : existing?.pendingSince,
  };

  if (existing) {
    const idx = records.indexOf(existing);
    records[idx] = updated;
  } else {
    records.unshift(updated);
  }

  writeRecords(records);
}

/**
 * Creates a "pending" record if no record exists for the phone number.
 * Intended to be called when the first inbound message arrives (autoCreatePendingOnInbound).
 */
export function autoCreatePendingIfNeeded(
  phoneNumber: string,
  source = "Mensaje entrante"
): void {
  if (!getOptInRecord(phoneNumber)) {
    setOptInRecord(phoneNumber, "pending", source);
  }
}

/** Removes the opt-in record for a phone number. */
export function removeOptInRecord(phoneNumber: string): void {
  writeRecords(readRecords().filter((r) => r.phoneNumber !== phoneNumber));
}

// ─── Enforcement ──────────────────────────────────────────────────────────────

/**
 * Checks whether a business-initiated message (including templates) can be sent.
 *
 * Enforcement:
 * - "confirmed" → always allowed
 * - anything else + policy.requireConfirmedForBusinessInitiated → blocked
 * - anything else + !requireConfirmedForBusinessInitiated → allowed
 */
export function canSendBusinessInitiated(
  phoneNumber: string
): OptInCheckResult {
  const status = getOptInStatus(phoneNumber);

  if (status === "confirmed") {
    return { allowed: true };
  }

  const policy = getOptInPolicy();
  if (!policy.requireConfirmedForBusinessInitiated) {
    return { allowed: true };
  }

  const statusLabel: Record<Exclude<OptInStatus, "confirmed">, string> = {
    pending: "pendiente de confirmación",
    revoked: "revocado",
    none: "sin registrar",
  };

  return {
    allowed: false,
    reason: `Opt-in ${statusLabel[status as Exclude<OptInStatus, "confirmed">]} — el contacto no ha confirmado su suscripción`,
  };
}

/**
 * Checks whether a free-form reply can be sent to a contact.
 *
 * Enforcement:
 * - "confirmed" → always allowed (proceed to window check separately)
 * - pending/revoked/none + policy.allowRepliesInOpenWindow + window==="open" → allowed
 * - otherwise → blocked
 *
 * Note: This does NOT replace the window check for confirmed contacts.
 * The caller still needs to check the window before sending free-form text.
 */
export function canReply(
  phoneNumber: string,
  windowStatus: ConversationWindowStatus
): OptInCheckResult {
  const status = getOptInStatus(phoneNumber);

  if (status === "confirmed") {
    return { allowed: true };
  }

  const policy = getOptInPolicy();

  if (policy.allowRepliesInOpenWindow && windowStatus === "open") {
    return { allowed: true };
  }

  if (status === "revoked") {
    return {
      allowed: false,
      reason:
        "El contacto revocó su opt-in — no se pueden enviar mensajes. Respeta la baja.",
    };
  }

  if (windowStatus !== "open") {
    return {
      allowed: false,
      reason:
        "Ventana de 24h cerrada y opt-in no confirmado — usa un template con opt-in previo.",
    };
  }

  return {
    allowed: false,
    reason:
      "Opt-in no confirmado — registra el consentimiento antes de enviar mensajes.",
  };
}
