/**
 * whatsapp-audit.ts
 *
 * Pure, side-effect-free localStorage CRUD for the WhatsApp audit log.
 * No React dependency — safe to call from any context including providers.
 *
 * localStorage key: "freia_whatsapp_audit"
 */

import type { WhatsAppAuditEntry } from "@/types/whatsapp-audit";

const STORAGE_KEY = "freia_whatsapp_audit";
const MAX_ENTRIES = 2000;

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getWhatsAppAuditLog(): WhatsAppAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WhatsAppAuditEntry[];
  } catch {
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function addWhatsAppAuditEntry(
  data: Omit<WhatsAppAuditEntry, "id" | "timestamp">
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: WhatsAppAuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    };
    const existing = getWhatsAppAuditLog();
    // Newest first; evict oldest when over limit
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded)
  }
}

// ─── Clear ────────────────────────────────────────────────────────────────────

export function clearWhatsAppAuditLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
