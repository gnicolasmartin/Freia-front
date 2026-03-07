"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { ToolExecutionEntry } from "@/types/audit";

interface ToolExecutionHistoryContextType {
  entries: ToolExecutionEntry[];
  isLoading: boolean;
  addEntry: (data: Omit<ToolExecutionEntry, "id">) => void;
  clearHistory: () => void;
}

const ToolExecutionHistoryContext = createContext<
  ToolExecutionHistoryContextType | undefined
>(undefined);

const STORAGE_KEY = "freia_tool_exec_history";
const MAX_ENTRIES = 2000;

// --- Seed data ---

const SEED_ENTRIES: ToolExecutionEntry[] = [
  {
    id: "seed-1",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    toolId: "create_lead",
    toolName: "Create Lead",
    toolCategory: "crm",
    flowId: "flow-demo-1",
    flowName: "Flujo de ventas B2B",
    simulationSource: "Draft",
    nodeId: "node-tool-1",
    userId: "1",
    userName: "Usuario Demo",
    request: { firstName: "Juan", lastName: "Pérez", email: "juan@empresa.com", company: "ACME Corp" },
    response: { leadId: "HS-001234" },
    durationMs: 312,
    result: "success",
  },
  {
    id: "seed-2",
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    toolId: "get_stock",
    toolName: "Get Stock",
    toolCategory: "stock",
    flowId: "flow-demo-2",
    flowName: "Consulta de disponibilidad",
    simulationSource: "v1",
    nodeId: "node-tool-2",
    userId: "2",
    userName: "Administrador",
    request: { productId: "SKU-8821", warehouse: "CABA" },
    response: { available: 145, reserved: 30 },
    durationMs: 88,
    result: "success",
  },
  {
    id: "seed-3",
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    toolId: "create_ticket",
    toolName: "Crear ticket",
    toolCategory: "support",
    flowId: "flow-demo-3",
    flowName: "Atención al cliente",
    simulationSource: "Draft",
    nodeId: "node-tool-3",
    userId: "1",
    userName: "Usuario Demo",
    request: { title: "Problema con entrega", priority: "high", description: "El pedido #4521 no llegó" },
    response: { ticketId: "TKT-0089", url: "https://support.freia.io/TKT-0089" },
    durationMs: 205,
    result: "success",
  },
  {
    id: "seed-4",
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    toolId: "apply_discount",
    toolName: "Aplicar descuento",
    toolCategory: "stock",
    flowId: "flow-demo-1",
    flowName: "Flujo de ventas B2B",
    simulationSource: "Draft",
    nodeId: "node-tool-4",
    userId: "1",
    userName: "Usuario Demo",
    request: { percentage: 15, orderNumber: "ORD-7721", reason: "Cliente VIP" },
    error: "Authority policy violation: descuento supera límite autorizado (10%)",
    durationMs: 14,
    result: "error",
  },
  {
    id: "seed-5",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    toolId: "reserve_stock",
    toolName: "Reserve Stock",
    toolCategory: "stock",
    flowId: "flow-demo-2",
    flowName: "Consulta de disponibilidad",
    simulationSource: "v1",
    nodeId: "node-tool-5",
    userId: "3",
    userName: "Usuario Estándar",
    request: { productId: "SKU-0042", quantity: 5, orderId: "ORD-9010" },
    response: { reservationId: "RES-2241" },
    durationMs: 441,
    result: "success",
  },
  {
    id: "seed-6",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    toolId: "crm_lookup",
    toolName: "Buscar en CRM",
    toolCategory: "crm",
    flowId: "flow-demo-3",
    flowName: "Atención al cliente",
    simulationSource: "Draft",
    nodeId: "node-tool-6",
    userId: "2",
    userName: "Administrador",
    request: { query: "García", email: "maria@cliente.com" },
    response: { id: "CRM-4412", name: "María García", email: "maria@cliente.com", phone: "+5491155554444" },
    durationMs: 157,
    result: "success",
  },
  {
    id: "seed-7",
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    toolId: "create_booking",
    toolName: "Create Booking",
    toolCategory: "booking",
    flowId: "flow-demo-4",
    flowName: "Reserva de turnos",
    simulationSource: "Draft",
    nodeId: "node-tool-7",
    userId: "1",
    userName: "Usuario Demo",
    request: { date: "2026-03-10", time: "10:00", contactId: "CRM-4412", notes: "Primera consulta" },
    response: { bookingId: "BKG-0091", confirmedAt: "2026-03-10T10:00:00Z" },
    durationMs: 289,
    result: "success",
  },
  {
    id: "seed-8",
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    toolId: "cancel_order",
    toolName: "Cancelar pedido",
    toolCategory: "stock",
    flowId: "flow-demo-1",
    flowName: "Flujo de ventas B2B",
    simulationSource: "v2",
    nodeId: "node-tool-8",
    userId: "3",
    userName: "Usuario Estándar",
    request: { orderNumber: "ORD-6612", reason: "Solicitud del cliente" },
    error: "Timeout: el servicio externo no respondió en 5000ms",
    durationMs: 5001,
    result: "error",
  },
  {
    id: "seed-9",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    toolId: "update_lead",
    toolName: "Update Lead",
    toolCategory: "crm",
    flowId: "flow-demo-1",
    flowName: "Flujo de ventas B2B",
    simulationSource: "Draft",
    nodeId: "node-tool-9",
    userId: "2",
    userName: "Administrador",
    request: { leadId: "HS-000871", status: "qualified", phone: "+5491155559999" },
    response: { leadId: "HS-000871", updatedAt: "2026-03-03T09:14:00Z" },
    durationMs: 198,
    result: "success",
  },
  {
    id: "seed-10",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    toolId: "create_refund",
    toolName: "Crear reembolso",
    toolCategory: "stock",
    flowId: "flow-demo-3",
    flowName: "Atención al cliente",
    simulationSource: "v1",
    nodeId: "node-tool-10",
    userId: "1",
    userName: "Usuario Demo",
    request: { orderNumber: "ORD-5501", amount: 3200, reason: "Producto defectuoso" },
    response: { refundId: "REF-0041", amount: 3200, estimatedDate: "2026-03-07" },
    durationMs: 512,
    result: "success",
  },
];

export function ToolExecutionHistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToolExecutionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ToolExecutionEntry[];
        setEntries(parsed.length > 0 ? parsed : SEED_ENTRIES);
      } catch {
        setEntries(SEED_ENTRIES);
      }
    } else {
      setEntries(SEED_ENTRIES);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoading]);

  const addEntry = useCallback((data: Omit<ToolExecutionEntry, "id">) => {
    const entry: ToolExecutionEntry = { ...data, id: crypto.randomUUID() };
    setEntries((prev) => {
      const next = [entry, ...prev];
      return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
  }, []);

  return (
    <ToolExecutionHistoryContext.Provider
      value={{ entries, isLoading, addEntry, clearHistory }}
    >
      {children}
    </ToolExecutionHistoryContext.Provider>
  );
}

export function useToolExecutionHistory() {
  const context = useContext(ToolExecutionHistoryContext);
  if (context === undefined) {
    throw new Error(
      "useToolExecutionHistory debe ser usado dentro de ToolExecutionHistoryProvider"
    );
  }
  return context;
}
