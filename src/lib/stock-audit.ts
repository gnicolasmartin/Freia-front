/**
 * stock-audit.ts
 *
 * Pure, side-effect-free localStorage CRUD for the stock/catalog audit log.
 * No React dependency — safe to call from any context including providers.
 *
 * localStorage key: "freia_stock_audit"
 */

import type { StockAuditEntry } from "@/types/stock-audit";

const STORAGE_KEY = "freia_stock_audit";
const MAX_ENTRIES = 2000;

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getStockAuditLog(): StockAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StockAuditEntry[];
  } catch {
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function addStockAuditEntry(
  data: Omit<StockAuditEntry, "id" | "timestamp">
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: StockAuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...data,
    };
    const existing = getStockAuditLog();
    // Newest first; evict oldest when over limit
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently ignore storage errors (e.g. quota exceeded)
  }
}

// ─── Clear ────────────────────────────────────────────────────────────────────

export function clearStockAuditLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
