"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AgentDecisionEntry } from "@/types/agent-decision";

interface AgentDecisionLogContextType {
  entries: AgentDecisionEntry[];
  isLoading: boolean;
  addEntry: (data: Omit<AgentDecisionEntry, "id" | "timestamp">) => void;
  clearLog: () => void;
}

const AgentDecisionLogContext = createContext<AgentDecisionLogContextType | undefined>(
  undefined
);

const STORAGE_KEY = "freia_agent_decisions";
const MAX_ENTRIES = 2000;

export function AgentDecisionLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<AgentDecisionEntry[]>([]);
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
    (data: Omit<AgentDecisionEntry, "id" | "timestamp">) => {
      const entry: AgentDecisionEntry = {
        ...data,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
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
    <AgentDecisionLogContext.Provider value={{ entries, isLoading, addEntry, clearLog }}>
      {children}
    </AgentDecisionLogContext.Provider>
  );
}

export function useAgentDecisionLog() {
  const context = useContext(AgentDecisionLogContext);
  if (context === undefined) {
    throw new Error(
      "useAgentDecisionLog debe ser usado dentro de AgentDecisionLogProvider"
    );
  }
  return context;
}
