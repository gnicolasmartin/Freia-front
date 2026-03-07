"use client";

/**
 * WhatsAppAuditProvider
 *
 * React context wrapper around the WhatsApp audit log.
 * Provides live-updating entries to UI components (audit page).
 *
 * Writes happen via the pure addWhatsAppAuditEntry() helper
 * (callable from any context, no hook needed).
 *
 * localStorage key: "freia_whatsapp_audit"
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getWhatsAppAuditLog,
  addWhatsAppAuditEntry,
  clearWhatsAppAuditLog,
} from "@/lib/whatsapp-audit";
import type { WhatsAppAuditEntry } from "@/types/whatsapp-audit";

// ─── Context ──────────────────────────────────────────────────────────────────

interface WhatsAppAuditContextValue {
  entries: WhatsAppAuditEntry[];
  addEntry(data: Omit<WhatsAppAuditEntry, "id" | "timestamp">): void;
  clearLog(): void;
}

const WhatsAppAuditContext = createContext<WhatsAppAuditContextValue | null>(
  null
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WhatsAppAuditProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entries, setEntries] = useState<WhatsAppAuditEntry[]>(() =>
    getWhatsAppAuditLog()
  );

  // Sync with cross-tab writes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "freia_whatsapp_audit") {
        setEntries(getWhatsAppAuditLog());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const addEntry = useCallback(
    (data: Omit<WhatsAppAuditEntry, "id" | "timestamp">) => {
      addWhatsAppAuditEntry(data);
      // Re-read to stay in sync with the pure function's write
      setEntries(getWhatsAppAuditLog());
    },
    []
  );

  const clearLog = useCallback(() => {
    clearWhatsAppAuditLog();
    setEntries([]);
  }, []);

  return (
    <WhatsAppAuditContext.Provider value={{ entries, addEntry, clearLog }}>
      {children}
    </WhatsAppAuditContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsAppAudit(): WhatsAppAuditContextValue {
  const ctx = useContext(WhatsAppAuditContext);
  if (!ctx) {
    throw new Error(
      "useWhatsAppAudit must be used inside WhatsAppAuditProvider"
    );
  }
  return ctx;
}
