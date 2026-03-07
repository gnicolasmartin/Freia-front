import type { Capability } from "@/types/tool-registry";

export type { Capability } from "@/types/tool-registry";

export type IntegrationType = "hubspot" | "salesforce" | "sap" | "custom";

export interface IntegrationCredential {
  key: string;
  label: string;
  value: string; // Encrypted in storage, plaintext in modal form
}

export interface FieldMapping {
  id: string;
  externalField: string;
  internalField: string;
}

export interface Integration {
  id: string;
  name: string;
  description?: string;
  type: IntegrationType;
  baseEndpoint: string;
  credentials: IntegrationCredential[];
  fieldMappings: FieldMapping[];
  active: boolean;
  supportedCapabilities: Capability[];
  webhookEnabled?: boolean;
  webhookSecret?: string;
  retryEnabled?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  lastTestedAt?: string;
  lastTestResult?: "success" | "error" | "unreachable";
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type IntegrationFormData = Omit<
  Integration,
  "id" | "createdAt" | "updatedAt" | "lastTestedAt" | "lastTestResult" | "lastTestMessage"
>;

// --- Display metadata per type ---

export const INTEGRATION_TYPES: Record<
  IntegrationType,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  hubspot: {
    label: "HubSpot",
    color: "text-orange-400",
    bg: "bg-orange-900/20",
    border: "border-orange-800/50",
    icon: "H",
  },
  salesforce: {
    label: "Salesforce",
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-800/50",
    icon: "S",
  },
  sap: {
    label: "SAP",
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
    border: "border-emerald-800/50",
    icon: "SAP",
  },
  custom: {
    label: "Custom API",
    color: "text-purple-400",
    bg: "bg-purple-900/20",
    border: "border-purple-800/50",
    icon: "API",
  },
};

// --- Credential fields required per integration type ---

export const CREDENTIAL_SCHEMAS: Record<
  IntegrationType,
  { key: string; label: string; placeholder: string; isSecret: boolean }[]
> = {
  hubspot: [
    { key: "api_key", label: "API Key", placeholder: "pat-na1-...", isSecret: true },
  ],
  salesforce: [
    { key: "client_id", label: "Client ID", placeholder: "3MVG9...", isSecret: false },
    { key: "client_secret", label: "Client Secret", placeholder: "", isSecret: true },
    { key: "username", label: "Usuario", placeholder: "user@dominio.com", isSecret: false },
    { key: "password", label: "Contraseña", placeholder: "", isSecret: true },
  ],
  sap: [
    { key: "client", label: "Client", placeholder: "100", isSecret: false },
    { key: "username", label: "Usuario", placeholder: "", isSecret: false },
    { key: "password", label: "Contraseña", placeholder: "", isSecret: true },
  ],
  custom: [
    { key: "api_key", label: "API Key", placeholder: "sk-...", isSecret: true },
    { key: "bearer_token", label: "Bearer Token (opcional)", placeholder: "eyJ...", isSecret: true },
  ],
};

// --- Field mapping catalog ---

export type FieldType = "string" | "number" | "boolean" | "date" | "email" | "phone";

export interface FreiaField {
  key: string;
  label: string;
  type: FieldType;
  namespace: "contact" | "lead" | "system";
}

export interface ExternalFieldDef {
  key: string;
  label: string;
  type: FieldType;
}

export const FIELD_TYPE_LABELS: Record<FieldType, { label: string; color: string }> = {
  string:  { label: "Texto",  color: "text-slate-400"   },
  number:  { label: "Número", color: "text-blue-400"    },
  boolean: { label: "Bool",   color: "text-amber-400"   },
  date:    { label: "Fecha",  color: "text-purple-400"  },
  email:   { label: "Email",  color: "text-sky-400"     },
  phone:   { label: "Tel.",   color: "text-emerald-400" },
};

export const FREIA_FIELD_NAMESPACES: Record<FreiaField["namespace"], { label: string }> = {
  contact: { label: "Contacto" },
  lead:    { label: "Lead" },
  system:  { label: "Sistema" },
};

export const FREIA_FIELDS: FreiaField[] = [
  { key: "contact.id",       label: "ID de contacto",     type: "string",  namespace: "contact" },
  { key: "contact.name",     label: "Nombre completo",    type: "string",  namespace: "contact" },
  { key: "contact.email",    label: "Email",              type: "email",   namespace: "contact" },
  { key: "contact.phone",    label: "Teléfono",           type: "phone",   namespace: "contact" },
  { key: "contact.company",  label: "Empresa",            type: "string",  namespace: "contact" },
  { key: "lead.status",      label: "Estado del lead",    type: "string",  namespace: "lead"    },
  { key: "lead.source",      label: "Fuente",             type: "string",  namespace: "lead"    },
  { key: "lead.score",       label: "Puntuación",         type: "number",  namespace: "lead"    },
  { key: "lead.createdAt",   label: "Fecha de creación",  type: "date",    namespace: "lead"    },
  { key: "system.flowId",    label: "ID de flujo",        type: "string",  namespace: "system"  },
  { key: "system.convId",    label: "ID de conversación", type: "string",  namespace: "system"  },
  { key: "system.timestamp", label: "Timestamp",          type: "date",    namespace: "system"  },
];

export const EXTERNAL_FIELDS: Record<IntegrationType, ExternalFieldDef[]> = {
  hubspot: [
    { key: "firstname",      label: "First Name",      type: "string" },
    { key: "lastname",       label: "Last Name",       type: "string" },
    { key: "email",          label: "Email",           type: "email"  },
    { key: "phone",          label: "Phone",           type: "phone"  },
    { key: "company",        label: "Company",         type: "string" },
    { key: "hs_lead_status", label: "Lead Status",     type: "string" },
    { key: "lifecyclestage", label: "Lifecycle Stage", type: "string" },
    { key: "createdate",     label: "Create Date",     type: "date"   },
  ],
  salesforce: [
    { key: "FirstName",   label: "First Name",   type: "string" },
    { key: "LastName",    label: "Last Name",    type: "string" },
    { key: "Email",       label: "Email",        type: "email"  },
    { key: "Phone",       label: "Phone",        type: "phone"  },
    { key: "Company",     label: "Company",      type: "string" },
    { key: "Status",      label: "Status",       type: "string" },
    { key: "LeadSource",  label: "Lead Source",  type: "string" },
    { key: "Rating",      label: "Rating",       type: "string" },
    { key: "CreatedDate", label: "Created Date", type: "date"   },
  ],
  sap: [
    { key: "KUNNR",     label: "Customer No.",  type: "string" },
    { key: "NAME1",     label: "Name",          type: "string" },
    { key: "SMTP_ADDR", label: "Email",         type: "email"  },
    { key: "TELF1",     label: "Phone",         type: "phone"  },
    { key: "ORT01",     label: "City",          type: "string" },
    { key: "LAND1",     label: "Country",       type: "string" },
    { key: "ERDAT",     label: "Create Date",   type: "date"   },
  ],
  custom: [],
};

const TYPE_COMPAT: Record<FieldType, FieldType[]> = {
  string:  ["string", "email", "phone"],
  number:  ["number"],
  boolean: ["boolean"],
  date:    ["date", "string"],
  email:   ["email", "string"],
  phone:   ["phone", "string"],
};

export function areFieldTypesCompatible(freiaType: FieldType, externalType: FieldType): boolean {
  return TYPE_COMPAT[freiaType]?.includes(externalType) ?? false;
}

export const DEFAULT_CAPABILITIES_BY_TYPE: Record<IntegrationType, Capability[]> = {
  hubspot:    ["createLead", "updateLead"],
  salesforce: ["createLead", "updateLead", "createBooking", "createTicket"],
  sap:        ["getStock", "reserveStock"],
  custom:     [],
};

export const EMPTY_INTEGRATION_FORM: IntegrationFormData = {
  name: "",
  type: "custom",
  baseEndpoint: "",
  credentials: [],
  fieldMappings: [],
  active: true,
  supportedCapabilities: [],
  webhookEnabled: false,
  retryEnabled: false,
  maxRetries: 3,
  retryDelayMs: 30000,
};

// --- Webhook incoming ---

export interface WebhookSyncLog {
  id: string;
  integrationId: string;
  receivedAt: string;
  eventType: string;
  status: "processed" | "error" | "ignored";
  message?: string;
  mappedFields?: { freiaField: string; externalField: string; value: unknown }[];
  payloadPreview?: string;
}

export interface WebhookEventSample {
  eventType: string;
  label: string;
  payload: Record<string, unknown>;
}

export const WEBHOOK_EVENT_SAMPLES: Record<IntegrationType, WebhookEventSample[]> = {
  hubspot: [
    {
      eventType: "lead.updated",
      label: "Lead actualizado",
      payload: { objectId: "12345", properties: { hs_lead_status: "IN_PROGRESS", email: "contacto@empresa.com", firstname: "Juan", lifecyclestage: "lead" } },
    },
    {
      eventType: "contact.updated",
      label: "Contacto modificado",
      payload: { objectId: "67890", properties: { email: "nuevo@ejemplo.com", phone: "+54911234567", company: "ACME Corp" } },
    },
  ],
  salesforce: [
    {
      eventType: "lead.updated",
      label: "Lead actualizado",
      payload: { Id: "00Q001XYZ", Status: "Working - Contacted", Email: "lead@empresa.com", FirstName: "María", LastName: "García", LeadSource: "Web" },
    },
    {
      eventType: "order.status_changed",
      label: "Estado de pedido",
      payload: { Id: "001001ABC", Status: "Shipped", Amount: 15000 },
    },
  ],
  sap: [
    {
      eventType: "stock.updated",
      label: "Stock modificado",
      payload: { MATNR: "MAT-001", MENGE: 250, MEINS: "EA", WERKS: "1000" },
    },
    {
      eventType: "order.status_changed",
      label: "Estado de pedido",
      payload: { VBELN: "0000100001", STATUS: "C", KUNNR: "0000001234" },
    },
  ],
  custom: [
    {
      eventType: "data.updated",
      label: "Actualización genérica",
      payload: { id: "ext-001", type: "update", data: { status: "active", value: 500 } },
    },
  ],
};

export function getWebhookUrl(integrationId: string): string {
  return `https://app.freia.io/api/webhooks/${integrationId}`;
}

function flattenPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  function recurse(o: Record<string, unknown>) {
    for (const [key, value] of Object.entries(o)) {
      result[key] = value;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        recurse(value as Record<string, unknown>);
      }
    }
  }
  recurse(obj);
  return result;
}

export function processWebhookPayload(
  payload: Record<string, unknown>,
  fieldMappings: FieldMapping[]
): {
  status: "processed" | "ignored";
  mappedFields: { freiaField: string; externalField: string; value: unknown }[];
  message: string;
} {
  const flat = flattenPayload(payload);
  const mappedFields = fieldMappings
    .filter((m) => m.externalField && m.internalField)
    .flatMap((m) => {
      const value = flat[m.externalField];
      return value !== undefined
        ? [{ freiaField: m.internalField, externalField: m.externalField, value }]
        : [];
    });

  if (mappedFields.length > 0) {
    return { status: "processed", mappedFields, message: `${mappedFields.length} campo(s) actualizados` };
  }
  return {
    status: "ignored",
    mappedFields: [],
    message:
      fieldMappings.length === 0
        ? "Sin mapeos configurados — evento recibido pero ignorado"
        : "Ningún campo del payload coincide con los mapeos configurados",
  };
}

// --- Resiliencia: Retry queue / DLQ / Notifications ---

export interface RetryQueueEntry {
  id: string;
  integrationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadPreview?: string;
  attempts: number;
  maxRetries: number;
  nextRetryAt: string;
  createdAt: string;
  lastError: string;
}

export interface DLQEntry {
  id: string;
  integrationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadPreview?: string;
  attempts: number;
  failedAt: string;
  lastError: string;
}

export interface AdminNotification {
  id: string;
  integrationId: string;
  integrationName: string;
  eventType: string;
  failedAt: string;
  read: boolean;
  message: string;
}
