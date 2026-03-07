"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  AuditLogEntry,
  PolicyViolationEntry,
  AuthorityViolationEntry,
  EscalationTriggerEntry,
  RiskThresholdEntry,
  InputClassificationEntry,
  AgentStatusChangeEntry,
  FrontPublishEntry,
} from "@/types/audit";

type AddEntryData =
  | Omit<PolicyViolationEntry, "id" | "timestamp">
  | Omit<AuthorityViolationEntry, "id" | "timestamp">
  | Omit<EscalationTriggerEntry, "id" | "timestamp">
  | Omit<RiskThresholdEntry, "id" | "timestamp">
  | Omit<InputClassificationEntry, "id" | "timestamp">
  | Omit<AgentStatusChangeEntry, "id" | "timestamp">
  | Omit<FrontPublishEntry, "id" | "timestamp">;

interface AuditLogContextType {
  entries: AuditLogEntry[];
  isLoading: boolean;
  addEntry: (data: AddEntryData) => void;
  clearLog: () => void;
}

const AuditLogContext = createContext<AuditLogContextType | undefined>(
  undefined
);

const STORAGE_KEY = "freia_audit_log";
const MAX_ENTRIES = 5000;

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setEntries(JSON.parse(stored));
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoading]);

  const addEntry = useCallback(
    (data: AddEntryData) => {
      const entry = {
        ...data,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      } as AuditLogEntry;
      setEntries((prev) => {
        const next = [entry, ...prev];
        return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
      });
    },
    []
  );

  const clearLog = useCallback(() => {
    setEntries([]);
  }, []);

  return (
    <AuditLogContext.Provider
      value={{ entries, isLoading, addEntry, clearLog }}
    >
      {children}
    </AuditLogContext.Provider>
  );
}

export function useAuditLog() {
  const context = useContext(AuditLogContext);
  if (context === undefined) {
    throw new Error(
      "useAuditLog debe ser usado dentro de AuditLogProvider"
    );
  }
  return context;
}
