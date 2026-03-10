import type { Node, Edge } from "@xyflow/react";

export type FlowNode = Node;
export type FlowEdge = Edge;

export type FlowVariableType = "string" | "number" | "boolean" | "date" | "enum";

export interface FlowVariable {
  id: string;
  name: string;
  type: FlowVariableType;
  description?: string;
  enumValues?: string[];
  ttlSeconds?: number;
}

export const RESERVED_PREFIXES = ["system.", "contact.", "lead."] as const;

export interface TestPreset {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, unknown>;
  toolMockOutcome: "success" | "error" | "no_stock" | "cancelled";
  createdAt: string;
}

export interface FlowVersion {
  id: string;
  flowId: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  policyIds: string[];
  allowedToolIds: string[];
  publishedAt: string;
  restoredFrom?: number;
}

export interface Flow {
  id: string;
  companyId?: string;
  name: string;
  description?: string;
  status: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  policyIds: string[];
  allowedToolIds: string[];
  useStock?: boolean;
  createdAt: string;
  updatedAt: string;
  publishedVersionId?: string;
  versions: FlowVersion[];
  testPresets?: TestPreset[];
}

export type FlowFormData = Omit<Flow, "id" | "createdAt" | "updatedAt" | "nodes" | "edges" | "variables" | "policyIds" | "allowedToolIds" | "versions" | "publishedVersionId">;

export const DEFAULT_START_NODE: FlowNode = {
  id: "start",
  type: "start",
  position: { x: 250, y: 50 },
  data: { label: "Inicio" },
  deletable: false,
};

export const EMPTY_FLOW_FORM: FlowFormData = {
  name: "",
  description: "",
  status: "draft",
};

export const FLOW_STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
] as const;

// --- Tool parameter definitions ---

export interface ToolParamDef {
  name: string;
  label: string;
  type: FlowVariableType;
  required?: boolean;
}

export interface ToolParamMapping {
  id: string;
  paramName: string;
  variableName: string;
}

export const TOOL_PARAM_SCHEMAS: Record<string, ToolParamDef[]> = {
  crm_lookup: [
    { name: "query", label: "Búsqueda", type: "string", required: true },
    { name: "email", label: "Email", type: "string" },
    { name: "phone", label: "Teléfono", type: "string" },
  ],
  send_email: [
    { name: "to", label: "Destinatario", type: "string", required: true },
    { name: "subject", label: "Asunto", type: "string", required: true },
    { name: "body", label: "Cuerpo", type: "string", required: true },
  ],
  create_ticket: [
    { name: "title", label: "Título", type: "string", required: true },
    { name: "description", label: "Descripción", type: "string" },
    { name: "priority", label: "Prioridad", type: "enum" },
    { name: "assignee", label: "Asignado a", type: "string" },
  ],
  calendar_check: [
    { name: "calendarId", label: "ID Calendario", type: "string" },
    { name: "startDate", label: "Fecha inicio", type: "date" },
    { name: "endDate", label: "Fecha fin (rango)", type: "date" },
    { name: "date", label: "Fecha (alias)", type: "date" },
    { name: "findNearest", label: "Buscar más cercana", type: "boolean" },
    { name: "duration", label: "Duración (min)", type: "number" },
    { name: "resourceId", label: "ID Recurso", type: "string" },
  ],
  search_resources: [
    { name: "calendarId", label: "ID Calendario", type: "string" },
    { name: "query", label: "Búsqueda", type: "string" },
    { name: "minCapacity", label: "Capacidad mínima", type: "number" },
    { name: "startDate", label: "Fecha inicio", type: "date" },
    { name: "endDate", label: "Fecha fin", type: "date" },
    { name: "requiredFeatures", label: "Features requeridos", type: "string" },
  ],
  knowledge_search: [
    { name: "query", label: "Consulta", type: "string", required: true },
    { name: "limit", label: "Máx. resultados", type: "number" },
  ],
  apply_discount: [
    { name: "percentage", label: "Porcentaje", type: "number", required: true },
    { name: "orderNumber", label: "Nro. de pedido", type: "string", required: true },
    { name: "reason", label: "Motivo", type: "string" },
  ],
  cancel_order: [
    { name: "orderNumber", label: "Nro. de pedido", type: "string", required: true },
    { name: "reason", label: "Motivo", type: "string", required: true },
  ],
  create_refund: [
    { name: "orderNumber", label: "Nro. de pedido", type: "string", required: true },
    { name: "amount", label: "Monto", type: "number", required: true },
    { name: "reason", label: "Motivo", type: "string" },
  ],
  create_booking: [
    { name: "calendarId", label: "ID Calendario", type: "string" },
    { name: "resourceId", label: "ID Recurso", type: "string" },
    { name: "date", label: "Fecha inicio", type: "date" },
    { name: "endDate", label: "Fecha fin", type: "date" },
    { name: "time", label: "Hora", type: "string" },
    { name: "contactName", label: "Nombre contacto", type: "string" },
    { name: "contactPhone", label: "Teléfono", type: "string" },
    { name: "notes", label: "Notas", type: "string" },
  ],
};

export interface ToolExecutionLog {
  nodeId: string;
  tool: string;
  timestamp: string;
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

// --- Runtime conversation state ---

export type ConversationStatus = "active" | "completed" | "abandoned";

export interface ConversationState {
  id: string;
  flowId: string;
  versionId: string;
  /** Agent driving this conversation, if any. Determines policy inheritance. */
  agentId?: string;
  currentNodeId: string;
  vars: Record<string, unknown>;
  varTimestamps: Record<string, string>;
  status: ConversationStatus;
  startedAt: string;
  lastActivityAt: string;
  retryCount: Record<string, number>;
  toolExecutionLogs: ToolExecutionLog[];
}
