/**
 * conversation-window.ts
 *
 * Pure utilities for WhatsApp 24-hour conversation window management.
 * No React dependencies — safe to call from any provider or API route.
 * Reads/writes localStorage directly so WhatsAppMessagesProvider can check
 * the window status without a circular dependency on WhatsAppTemplatesProvider.
 */

import type { ContactWindow, ConversationWindowStatus } from "@/types/whatsapp-template";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Duration of the WhatsApp 24-hour conversation window in milliseconds. */
export const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000;

/** localStorage key shared between this lib and WhatsAppTemplatesProvider. */
export const WINDOWS_STORAGE_KEY = "freia_wa_contact_windows";

// ─── Core window status ───────────────────────────────────────────────────────

/**
 * Returns the window status based on the timestamp of the last inbound user message.
 *
 * @param lastUserMessageAt ISO timestamp or null
 */
export function getWindowStatus(
  lastUserMessageAt: string | null
): ConversationWindowStatus {
  if (!lastUserMessageAt) return "unknown";
  const elapsed = Date.now() - new Date(lastUserMessageAt).getTime();
  return elapsed < WINDOW_DURATION_MS ? "open" : "closed";
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readWindows(): ContactWindow[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WINDOWS_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeWindows(windows: ContactWindow[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WINDOWS_STORAGE_KEY, JSON.stringify(windows));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the window status for a specific phone number by reading localStorage.
 * Call this from WhatsAppMessagesProvider before each free-form send.
 */
export function getContactWindowStatus(
  phoneNumber: string
): ConversationWindowStatus {
  const windows = readWindows();
  const entry = windows.find((w) => w.phoneNumber === phoneNumber);
  return getWindowStatus(entry?.lastUserMessageAt ?? null);
}

/**
 * Records an inbound user message for a phone number, opening (or renewing) the window.
 * Upserts the entry in localStorage.
 */
export function recordUserMessageInWindow(phoneNumber: string): void {
  const windows = readWindows();
  const now = new Date().toISOString();
  const existing = windows.findIndex((w) => w.phoneNumber === phoneNumber);
  if (existing >= 0) {
    windows[existing] = { phoneNumber, lastUserMessageAt: now };
  } else {
    windows.unshift({ phoneNumber, lastUserMessageAt: now });
  }
  writeWindows(windows);
}

/**
 * Returns all tracked contact windows, sorted by most recent activity first.
 */
export function getAllContactWindows(): ContactWindow[] {
  return readWindows().sort((a, b) => {
    if (!a.lastUserMessageAt) return 1;
    if (!b.lastUserMessageAt) return -1;
    return (
      new Date(b.lastUserMessageAt).getTime() -
      new Date(a.lastUserMessageAt).getTime()
    );
  });
}

/**
 * Ensures a phone number exists in the windows list (with null timestamp if new).
 * Used when an admin manually adds a contact in the UI.
 */
export function ensureContactWindow(phoneNumber: string): void {
  const windows = readWindows();
  if (!windows.find((w) => w.phoneNumber === phoneNumber)) {
    windows.unshift({ phoneNumber, lastUserMessageAt: null });
    writeWindows(windows);
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Returns a human-readable string describing when the window closes or closed.
 *
 * Examples:
 *   "cierra en 2h 30 min"
 *   "cerrada hace 1 día"
 *   "cerrada hace 3 horas"
 */
export function formatWindowTime(lastUserMessageAt: string): string {
  const elapsed = Date.now() - new Date(lastUserMessageAt).getTime();

  if (elapsed < WINDOW_DURATION_MS) {
    // Window still open — show time until it closes
    const remaining = WINDOW_DURATION_MS - elapsed;
    return `cierra en ${formatDuration(remaining)}`;
  } else {
    // Window closed — show time since it closed
    const ago = elapsed - WINDOW_DURATION_MS;
    return `cerrada hace ${formatDuration(ago)}`;
  }
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} día${days !== 1 ? "s" : ""}`;
  }
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} hora${hours !== 1 ? "s" : ""}`;
  }
  return `${minutes} min`;
}
