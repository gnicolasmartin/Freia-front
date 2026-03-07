"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useFlows } from "./FlowsProvider";
import type { Flow, FlowVariable } from "@/types/flow";

// --- Types ---

interface VariableData {
  current: unknown;
  history: { timestamp: string; value: unknown }[];
}

/** flowId → variableName → VariableData */
type SimulatedStore = Record<string, Record<string, VariableData>>;

interface FrontDataContextType {
  getVariableValue: (flowId: string, variableName: string) => unknown | undefined;
  getVariableHistory: (flowId: string, variableName: string) => { timestamp: string; value: unknown }[];
  isLoading: boolean;
  lastUpdated: string | null;
  refreshData: () => void;
}

const FrontDataContext = createContext<FrontDataContextType | null>(null);

// --- Data generation ---

function randomNumber(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generateVariableData(variable: FlowVariable): VariableData {
  const now = Date.now();
  switch (variable.type) {
    case "number": {
      const base = randomNumber(100, 10000);
      const history = Array.from({ length: 6 }, (_, i) => ({
        timestamp: new Date(now - (5 - i) * 60000).toISOString(),
        value: Math.round(base * (0.8 + Math.random() * 0.4)),
      }));
      return { current: history[history.length - 1].value, history };
    }
    case "string":
      return {
        current: `Valor de ${variable.name}`,
        history: [{ timestamp: new Date(now).toISOString(), value: `Valor de ${variable.name}` }],
      };
    case "boolean":
      return {
        current: Math.random() > 0.5,
        history: [{ timestamp: new Date(now).toISOString(), value: Math.random() > 0.5 }],
      };
    case "date":
      return {
        current: new Date(now - Math.random() * 86400000 * 7).toISOString(),
        history: [{ timestamp: new Date(now).toISOString(), value: new Date(now).toISOString() }],
      };
    case "enum": {
      const values = variable.enumValues ?? ["opción_1", "opción_2"];
      const val = values[Math.floor(Math.random() * values.length)];
      return {
        current: val,
        history: [{ timestamp: new Date(now).toISOString(), value: val }],
      };
    }
    default:
      return { current: null, history: [] };
  }
}

function generateAllData(flows: Flow[], flowIds: string[]): SimulatedStore {
  const store: SimulatedStore = {};
  for (const flow of flows) {
    if (!flowIds.includes(flow.id)) continue;
    store[flow.id] = {};
    for (const v of flow.variables) {
      store[flow.id][v.name] = generateVariableData(v);
    }
  }
  return store;
}

function refreshNumericData(store: SimulatedStore, flows: Flow[], flowIds: string[]): SimulatedStore {
  const now = new Date().toISOString();
  const updated = { ...store };
  for (const flow of flows) {
    if (!flowIds.includes(flow.id)) continue;
    if (!updated[flow.id]) {
      updated[flow.id] = {};
      for (const v of flow.variables) {
        updated[flow.id][v.name] = generateVariableData(v);
      }
      continue;
    }
    for (const v of flow.variables) {
      const existing = updated[flow.id][v.name];
      if (!existing) {
        updated[flow.id][v.name] = generateVariableData(v);
        continue;
      }
      if (v.type === "number") {
        const prev = existing.current as number;
        const variation = prev * (0.9 + Math.random() * 0.2);
        const newVal = Math.round(variation);
        const newHistory = [
          ...existing.history.slice(-5),
          { timestamp: now, value: newVal },
        ];
        updated[flow.id][v.name] = { current: newVal, history: newHistory };
      }
    }
  }
  return updated;
}

// --- Provider ---

const STORAGE_PREFIX = "freia_front_data_";

interface FrontDataProviderProps {
  frontId: string;
  flowIds: string[];
  children: React.ReactNode;
}

export function FrontDataProvider({ frontId, flowIds, children }: FrontDataProviderProps) {
  const { flows } = useFlows();
  const [store, setStore] = useState<SimulatedStore>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const flowIdsRef = useRef(flowIds);
  flowIdsRef.current = flowIds;

  // Initial load
  useEffect(() => {
    const key = `${STORAGE_PREFIX}${frontId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as { store: SimulatedStore; lastUpdated: string };
        setStore(parsed.store);
        setLastUpdated(parsed.lastUpdated);
        setIsLoading(false);
        return;
      }
    } catch { /* ignore */ }

    // Generate fresh data
    const assignedFlows = flows.filter((f) => flowIdsRef.current.includes(f.id));
    const data = generateAllData(assignedFlows, flowIdsRef.current);
    const now = new Date().toISOString();
    setStore(data);
    setLastUpdated(now);
    setIsLoading(false);
    try {
      localStorage.setItem(key, JSON.stringify({ store: data, lastUpdated: now }));
    } catch { /* ignore */ }
  }, [frontId, flows]);

  const refreshData = useCallback(() => {
    const assignedFlows = flows.filter((f) => flowIdsRef.current.includes(f.id));
    const updated = refreshNumericData(store, assignedFlows, flowIdsRef.current);
    const now = new Date().toISOString();
    setStore(updated);
    setLastUpdated(now);
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${frontId}`,
        JSON.stringify({ store: updated, lastUpdated: now })
      );
    } catch { /* ignore */ }
  }, [store, flows, frontId]);

  const getVariableValue = useCallback(
    (flowId: string, variableName: string): unknown | undefined => {
      return store[flowId]?.[variableName]?.current;
    },
    [store]
  );

  const getVariableHistory = useCallback(
    (flowId: string, variableName: string): { timestamp: string; value: unknown }[] => {
      return store[flowId]?.[variableName]?.history ?? [];
    },
    [store]
  );

  return (
    <FrontDataContext.Provider
      value={{ getVariableValue, getVariableHistory, isLoading, lastUpdated, refreshData }}
    >
      {children}
    </FrontDataContext.Provider>
  );
}

export function useFrontData(): FrontDataContextType {
  const ctx = useContext(FrontDataContext);
  if (!ctx) throw new Error("useFrontData must be used within FrontDataProvider");
  return ctx;
}
