/**
 * front-audit.ts
 *
 * Pure localStorage CRUD for front user-management audit log.
 * No React dependency — safe to call from providers and event handlers.
 *
 * localStorage key: "freia_front_audit"
 */

import type { FrontAuditEntry } from "@/types/front-audit";

const STORAGE_KEY = "freia_front_audit";
const MAX_ENTRIES = 2000;

export function getFrontAuditLog(): FrontAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FrontAuditEntry[];
  } catch {
    return [];
  }
}

export function addFrontAuditEntry(
  data: Omit<FrontAuditEntry, "id" | "timestamp">
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: FrontAuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    };
    const existing = getFrontAuditLog();
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently ignore storage errors
  }
}

export function clearFrontAuditLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
