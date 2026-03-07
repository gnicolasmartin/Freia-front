/**
 * whatsapp-identity
 *
 * Pure localStorage utility for WhatsApp channel identity configuration.
 * No React dependencies — safe to import from providers, API routes, or other libs.
 *
 * Consumers:
 *  - WhatsAppIdentityProvider (React UI layer)
 *  - WhatsAppMessagesProvider (applies signature before sending)
 */

import type { ChannelIdentity } from "@/types/whatsapp-identity";

// ─── Storage key ──────────────────────────────────────────────────────────────

const IDENTITY_KEY = "freia_wa_identity";

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_IDENTITY: ChannelIdentity = {
  businessName: "",
  defaultLanguage: "es-AR",
  tone: "cercano",
  useEmojis: true,
  updatedAt: new Date().toISOString(),
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the stored channel identity, merged with defaults for any missing fields.
 * Returns DEFAULT_IDENTITY when running server-side or when no record exists.
 */
export function getChannelIdentity(): ChannelIdentity {
  if (typeof window === "undefined") return { ...DEFAULT_IDENTITY };
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return { ...DEFAULT_IDENTITY };
    const stored = JSON.parse(raw) as Partial<ChannelIdentity>;
    return { ...DEFAULT_IDENTITY, ...stored };
  } catch {
    return { ...DEFAULT_IDENTITY };
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Persists the given identity to localStorage.
 */
export function saveChannelIdentity(identity: ChannelIdentity): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

// ─── Signature helpers ────────────────────────────────────────────────────────

/**
 * Resolves the signature template by replacing {{brandName}} with the
 * identity's businessName. Returns an empty string if no signature is set.
 */
export function resolveSignature(identity: ChannelIdentity): string {
  if (!identity.signature) return "";
  const brand = identity.businessName || "";
  return identity.signature.replace(/\{\{brandName\}\}/g, brand);
}

/**
 * Appends the resolved signature to `text` if a non-empty signature is configured.
 * Returns the original text unchanged when no signature is set.
 *
 * Used by WhatsAppMessagesProvider.sendMessage() before calling the send API.
 * Templates are NOT processed through this function.
 */
export function applyIdentityToMessage(
  text: string,
  identity: ChannelIdentity
): string {
  const sig = resolveSignature(identity);
  if (!sig) return text;
  return `${text}\n${sig}`;
}
