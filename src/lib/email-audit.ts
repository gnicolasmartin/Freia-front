/**
 * email-audit.ts
 *
 * Pure, side-effect-free localStorage CRUD for the Email audit log.
 * No React dependency — safe to call from any context including providers.
 *
 * localStorage key: "freia_email_audit"
 */

import type { EmailAuditEntry } from "@/types/email";

const STORAGE_KEY = "freia_email_audit";
const MAX_ENTRIES = 2000;

// ─── Read ────────────────────────────────────────────────────────────────────

export function getEmailAuditLog(): EmailAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmailAuditEntry[];
  } catch {
    return [];
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

export function addEmailAuditEntry(
  data: Omit<EmailAuditEntry, "id" | "timestamp">
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: EmailAuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    };
    const existing = getEmailAuditLog();
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded)
  }
}

// ─── Clear ───────────────────────────────────────────────────────────────────

export function clearEmailAuditLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
