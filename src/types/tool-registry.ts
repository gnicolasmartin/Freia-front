import type { ToolParamDef } from "@/types/flow";

// --- Capabilities ---

export type Capability =
  | "createLead"
  | "updateLead"
  | "getStock"
  | "reserveStock"
  | "createBooking"
  | "checkCalendar"
  | "searchResources"
  | "createTicket";

export const CAPABILITY_LABELS: Record<
  Capability,
  { label: string; description: string; color: string }
> = {
  createLead:    { label: "Create Lead",    description: "Crear un nuevo lead en el CRM",         color: "text-blue-400"    },
  updateLead:    { label: "Update Lead",    description: "Actualizar un lead existente en el CRM", color: "text-sky-400"     },
  getStock:      { label: "Get Stock",      description: "Consultar disponibilidad de stock",      color: "text-emerald-400" },
  reserveStock:  { label: "Reserve Stock",  description: "Reservar unidades de un producto",       color: "text-amber-400"   },
  createBooking:   { label: "Create Booking",   description: "Crear una reserva o cita",               color: "text-purple-400"  },
  checkCalendar:   { label: "Check Calendar",   description: "Consultar disponibilidad en calendario", color: "text-amber-400"   },
  searchResources: { label: "Search Resources", description: "Buscar recursos por especificaciones",   color: "text-teal-400"    },
  createTicket:    { label: "Create Ticket",    description: "Crear un ticket de soporte",             color: "text-red-400"     },
};

// --- Categories ---

export const TOOL_CATEGORIES = [
  { value: "crm", label: "CRM" },
  { value: "stock", label: "Stock" },
  { value: "booking", label: "Booking" },
  { value: "support", label: "Support" },
] as const;

export type ToolCategory = typeof TOOL_CATEGORIES[number]["value"];

export const CATEGORY_COLORS: Record<ToolCategory, { text: string; bg: string; border: string }> = {
  crm: { text: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-800/50" },
  stock: { text: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-800/50" },
  booking: { text: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-800/50" },
  support: { text: "text-violet-400", bg: "bg-violet-900/20", border: "border-violet-800/50" },
};

// --- Output schema ---

export type ToolOutputFieldType = "string" | "number" | "boolean" | "date" | "object" | "array";

export interface ToolOutputField {
  name: string;
  label: string;
  type: ToolOutputFieldType;
}

// --- Versioning ---

export interface ToolVersion {
  id: string;
  toolId: string;
  version: number;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: ToolParamDef[];
  outputSchema: ToolOutputField[];
  requiresConfirmation: boolean;
  supportsSimulation: boolean;
  publishedAt: string;
}

// --- Tool definition ---

export interface ToolDefinition {
  id: string;
  companyId?: string;
  name: string;
  description: string;
  category: ToolCategory;
  capability?: Capability;
  inputSchema: ToolParamDef[];
  outputSchema: ToolOutputField[];
  requiresConfirmation: boolean;
  supportsSimulation: boolean;
  createdAt: string;
  updatedAt: string;
  versions: ToolVersion[];
}

export type ToolFormData = Omit<ToolDefinition, "createdAt" | "updatedAt" | "versions">;

export const EMPTY_TOOL_FORM: ToolFormData = {
  id: "",
  name: "",
  description: "",
  category: "support",
  inputSchema: [],
  outputSchema: [],
  requiresConfirmation: false,
  supportsSimulation: true,
};

// --- Seed data (matches existing hardcoded tools) ---

const now = "2025-01-01T00:00:00.000Z";

export const DEFAULT_TOOLS: ToolDefinition[] = [
  {
    id: "crm_lookup",
    name: "Buscar en CRM",
    description: "Busca información de contactos y clientes en el sistema CRM",
    category: "crm",
    inputSchema: [
      { name: "query", label: "Búsqueda", type: "string", required: true },
      { name: "email", label: "Email", type: "string" },
      { name: "phone", label: "Teléfono", type: "string" },
    ],
    outputSchema: [
      { name: "id", label: "ID de contacto", type: "string" },
      { name: "name", label: "Nombre", type: "string" },
      { name: "email", label: "Email", type: "string" },
      { name: "phone", label: "Teléfono", type: "string" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "send_email",
    name: "Enviar email",
    description: "Envía un email a un destinatario especificado",
    category: "support",
    inputSchema: [
      { name: "to", label: "Destinatario", type: "string", required: true },
      { name: "subject", label: "Asunto", type: "string", required: true },
      { name: "body", label: "Cuerpo", type: "string", required: true },
    ],
    outputSchema: [
      { name: "messageId", label: "ID de mensaje", type: "string" },
      { name: "deliveredAt", label: "Fecha de envío", type: "date" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "create_ticket",
    name: "Crear ticket",
    description: "Crea un ticket de soporte para seguimiento del caso",
    category: "support",
    capability: "createTicket",
    inputSchema: [
      { name: "title", label: "Título", type: "string", required: true },
      { name: "description", label: "Descripción", type: "string" },
      { name: "priority", label: "Prioridad", type: "enum" },
      { name: "assignee", label: "Asignado a", type: "string" },
    ],
    outputSchema: [
      { name: "ticketId", label: "ID de ticket", type: "string" },
      { name: "url", label: "URL del ticket", type: "string" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "calendar_check",
    name: "Consultar calendario",
    description: "Consulta disponibilidad de turnos/días en un calendario. Soporta fechas puntuales o rangos (startDate+endDate). Para rangos como 'en febrero' usar startDate=2026-02-01 y endDate=2026-02-28. Con findNearest=true busca las fechas más cercanas con disponibilidad a partir de startDate (útil cuando el cliente pregunta 'qué es lo más cercano que tenés').",
    category: "booking",
    capability: "checkCalendar",
    inputSchema: [
      { name: "calendarId", label: "ID Calendario", type: "string" },
      { name: "startDate", label: "Fecha inicio", type: "date" },
      { name: "endDate", label: "Fecha fin (rango)", type: "date" },
      { name: "date", label: "Fecha (alias de startDate)", type: "date" },
      { name: "findNearest", label: "Buscar disponibilidad más cercana", type: "boolean" },
      { name: "duration", label: "Duración (min)", type: "number" },
      { name: "resourceId", label: "ID Recurso", type: "string" },
    ],
    outputSchema: [
      { name: "slots", label: "Horarios disponibles", type: "array" },
      { name: "availableDates", label: "Fechas disponibles por recurso", type: "array" },
      { name: "nearestAvailability", label: "Disponibilidad más cercana por recurso", type: "array" },
      { name: "date", label: "Fecha consultada", type: "date" },
      { name: "calendarName", label: "Calendario", type: "string" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "knowledge_search",
    name: "Base de conocimiento",
    description: "Busca en la base de conocimiento para responder consultas",
    category: "support",
    inputSchema: [
      { name: "query", label: "Consulta", type: "string", required: true },
      { name: "limit", label: "Máx. resultados", type: "number" },
    ],
    outputSchema: [
      { name: "results", label: "Resultados", type: "array" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "apply_discount",
    name: "Aplicar descuento",
    description: "Aplica un descuento porcentual a un pedido",
    category: "stock",
    inputSchema: [
      { name: "percentage", label: "Porcentaje", type: "number", required: true },
      { name: "orderNumber", label: "Nro. de pedido", type: "string", required: true },
      { name: "reason", label: "Motivo", type: "string" },
    ],
    outputSchema: [
      { name: "discountId", label: "ID de descuento", type: "string" },
      { name: "percentage", label: "Porcentaje aplicado", type: "number" },
      { name: "orderNumber", label: "Nro. de pedido", type: "string" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "cancel_order",
    name: "Cancelar pedido",
    description: "Cancela un pedido existente por solicitud del cliente",
    category: "stock",
    inputSchema: [
      { name: "orderNumber", label: "Nro. de pedido", type: "string", required: true },
      { name: "reason", label: "Motivo", type: "string", required: true },
    ],
    outputSchema: [
      { name: "orderNumber", label: "Nro. de pedido", type: "string" },
      { name: "cancelledAt", label: "Fecha de cancelación", type: "date" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "create_refund",
    name: "Crear reembolso",
    description: "Procesa un reembolso por solicitud del cliente",
    category: "stock",
    inputSchema: [
      { name: "orderNumber", label: "Nro. de pedido", type: "string", required: true },
      { name: "amount", label: "Monto", type: "number", required: true },
      { name: "reason", label: "Motivo", type: "string" },
    ],
    outputSchema: [
      { name: "refundId", label: "ID de reembolso", type: "string" },
      { name: "amount", label: "Monto reembolsado", type: "number" },
      { name: "estimatedDate", label: "Fecha estimada", type: "date" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  // --- Capability-backed tools ---
  {
    id: "create_lead",
    name: "Create Lead",
    description: "Crear un nuevo lead en el CRM conectado",
    category: "crm",
    capability: "createLead",
    inputSchema: [
      { name: "firstName", label: "Nombre",   type: "string", required: true },
      { name: "lastName",  label: "Apellido", type: "string" },
      { name: "email",     label: "Email",    type: "string", required: true },
      { name: "phone",     label: "Teléfono", type: "string" },
      { name: "company",   label: "Empresa",  type: "string" },
    ],
    outputSchema: [
      { name: "leadId", label: "ID del Lead", type: "string" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "update_lead",
    name: "Update Lead",
    description: "Actualizar un lead existente en el CRM conectado",
    category: "crm",
    capability: "updateLead",
    inputSchema: [
      { name: "leadId", label: "ID del Lead", type: "string", required: true },
      { name: "email",  label: "Email",       type: "string" },
      { name: "phone",  label: "Teléfono",    type: "string" },
      { name: "status", label: "Estado",      type: "enum" },
    ],
    outputSchema: [
      { name: "leadId", label: "ID del Lead", type: "string" },
      { name: "updatedAt", label: "Actualizado", type: "date" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "get_stock",
    name: "Get Stock",
    description: "Consultar disponibilidad de stock en el ERP conectado",
    category: "stock",
    capability: "getStock",
    inputSchema: [
      { name: "productId", label: "ID Producto", type: "string", required: true },
      { name: "warehouse", label: "Depósito",    type: "string" },
    ],
    outputSchema: [
      { name: "available", label: "Disponible", type: "number" },
      { name: "reserved",  label: "Reservado",  type: "number" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "reserve_stock",
    name: "Reserve Stock",
    description: "Reservar unidades de un producto en el ERP conectado",
    category: "stock",
    capability: "reserveStock",
    inputSchema: [
      { name: "productId", label: "ID Producto", type: "string", required: true },
      { name: "quantity",  label: "Cantidad",    type: "number", required: true },
      { name: "orderId",   label: "ID Orden",    type: "string", required: true },
    ],
    outputSchema: [
      { name: "reservationId", label: "ID Reserva", type: "string" },
    ],
    requiresConfirmation: true,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "search_resources",
    name: "Buscar quintas/recursos",
    description: "Busca recursos disponibles según especificaciones del cliente (capacidad, amenities, ubicación, fechas). Útil cuando el cliente describe lo que busca sin especificar un recurso concreto.",
    category: "booking",
    capability: "searchResources",
    inputSchema: [
      { name: "calendarId",       label: "ID Calendario",     type: "string" },
      { name: "query",            label: "Búsqueda",          type: "string", required: true },
      { name: "minCapacity",      label: "Capacidad mínima",  type: "number" },
      { name: "startDate",        label: "Fecha inicio",      type: "date" },
      { name: "endDate",          label: "Fecha fin",         type: "date" },
      { name: "requiredFeatures", label: "Features requeridos (coma-separados)", type: "string" },
    ],
    outputSchema: [
      { name: "matches",     label: "Recursos que coinciden",    type: "array" },
      { name: "suggestions", label: "Alternativas sugeridas",    type: "array" },
      { name: "reasoning",   label: "Explicación",               type: "string" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
  {
    id: "create_booking",
    name: "Crear reserva",
    description: "Crear una reserva en un calendario configurado",
    category: "booking",
    capability: "createBooking",
    inputSchema: [
      { name: "calendarId",   label: "ID Calendario",    type: "string", required: true },
      { name: "resourceId",   label: "ID Recurso",       type: "string", required: true },
      { name: "date",         label: "Fecha",            type: "date",   required: true },
      { name: "time",         label: "Hora",             type: "string" },
      { name: "endDate",      label: "Fecha fin",        type: "date" },
      { name: "contactName",  label: "Nombre contacto",  type: "string", required: true },
      { name: "contactPhone", label: "Teléfono",         type: "string" },
      { name: "notes",        label: "Notas",            type: "string" },
    ],
    outputSchema: [
      { name: "bookingId",        label: "ID Reserva",         type: "string" },
      { name: "confirmationCode", label: "Código confirmación", type: "string" },
      { name: "confirmedAt",      label: "Confirmada",          type: "date" },
    ],
    requiresConfirmation: false,
    supportsSimulation: true,
    createdAt: now,
    updatedAt: now,
    versions: [],
  },
];
