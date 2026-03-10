"use client";

/**
 * EmailAuditProvider
 *
 * React context wrapper around the Email audit log.
 * Provides live-updating entries to UI components.
 *
 * Writes happen via the pure addEmailAuditEntry() helper
 * (callable from any context, no hook needed).
 *
 * localStorage key: "freia_email_audit"
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getEmailAuditLog,
  addEmailAuditEntry,
  clearEmailAuditLog,
} from "@/lib/email-audit";
import type { EmailAuditEntry } from "@/types/email";

// ─── Context ─────────────────────────────────────────────────────────────────

interface EmailAuditContextValue {
  entries: EmailAuditEntry[];
  addEntry(data: Omit<EmailAuditEntry, "id" | "timestamp">): void;
  clearLog(): void;
}

const EmailAuditContext = createContext<EmailAuditContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function EmailAuditProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entries, setEntries] = useState<EmailAuditEntry[]>(() =>
    getEmailAuditLog()
  );

  // Cross-tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "freia_email_audit") {
        setEntries(getEmailAuditLog());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const addEntry = useCallback(
    (data: Omit<EmailAuditEntry, "id" | "timestamp">) => {
      addEmailAuditEntry(data);
      setEntries(getEmailAuditLog());
    },
    []
  );

  const clearLog = useCallback(() => {
    clearEmailAuditLog();
    setEntries([]);
  }, []);

  return (
    <EmailAuditContext.Provider value={{ entries, addEntry, clearLog }}>
      {children}
    </EmailAuditContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEmailAudit(): EmailAuditContextValue {
  const ctx = useContext(EmailAuditContext);
  if (!ctx) {
    throw new Error(
      "useEmailAudit must be used inside EmailAuditProvider"
    );
  }
  return ctx;
}
