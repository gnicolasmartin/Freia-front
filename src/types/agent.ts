// Agent entity — modular architecture v2

// --- Enums ---

export type AgentStatus = "draft" | "active" | "paused" | "archived";
export type AgentMode = "flow-driven" | "hybrid" | "ai-guided";
export type ChannelScope = "whatsapp" | "web" | "instagram" | "facebook" | "email";
export type LLMProvider = "openai";
export type PolicyScope = "inherited";

// --- Core entity ---

export interface Agent {
  id: string;

  // Identidad
  name: string;
  description: string;
  status: AgentStatus;

  // Alcance operativo
  channelScope: ChannelScope;
  flowId: string;
  mode: AgentMode;

  // Objetivo
  primaryObjective: string;
  kpiType: string;
  kpiTarget?: number;

  // Configuración AI
  llmProvider: LLMProvider;
  modelName: string;
  temperature: number;      // 0 – 2
  maxTokens: number;        // 256 – 4096
  topP: number;             // 0 – 1
  frequencyPenalty: number; // -2 – 2
  presencePenalty: number;  // -2 – 2

  // Estilo
  tone: string;
  responseLength: string;
  emojiUsage: string;
  language: string;

  // Políticas
  policyScope: PolicyScope;
  allowOverride: boolean;

  // WhatsApp-specific
  /** When true, agent may send business-initiated messages (templates required) */
  whatsappOutbound?: boolean;

  // Multi-tenant
  companyId?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export type AgentFormData = Omit<Agent, "id" | "createdAt" | "updatedAt">;

export const EMPTY_AGENT_FORM: AgentFormData = {
  name: "",
  description: "",
  status: "draft",
  channelScope: "web",
  flowId: "",
  mode: "flow-driven",
  primaryObjective: "",
  kpiType: "",
  kpiTarget: undefined,
  llmProvider: "openai",
  modelName: "gpt-4o",
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  tone: "cercano",
  responseLength: "media",
  emojiUsage: "moderado",
  language: "es_ar",
  policyScope: "inherited",
  allowOverride: false,
  whatsappOutbound: false,
};

// --- Display constants ---

export const AGENT_STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  draft: {
    label: "Borrador",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-700/40",
    borderClass: "border-slate-600",
  },
  active: {
    label: "Activo",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-900/20",
    borderClass: "border-emerald-800/50",
  },
  paused: {
    label: "Pausado",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-900/20",
    borderClass: "border-amber-800/50",
  },
  archived: {
    label: "Archivado",
    colorClass: "text-slate-500",
    bgClass: "bg-slate-800/60",
    borderClass: "border-slate-700",
  },
};

/**
 * Valid status transitions.
 * Key = current status, value = allowed next statuses.
 * draft/paused → active requires external validation (published flow + API key).
 * archived → only draft (restore); no direct re-activation.
 */
export const AGENT_STATUS_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  draft:    ["active", "archived"],
  active:   ["paused", "archived"],
  paused:   ["active", "draft", "archived"],
  archived: ["draft"],
};

export const AGENT_MODE_CONFIG: Record<
  AgentMode,
  { label: string; description: string; colorClass: string }
> = {
  "flow-driven": {
    label: "Flow-driven",
    description: "Sigue el flujo estrictamente",
    colorClass: "text-sky-400",
  },
  hybrid: {
    label: "Híbrido",
    description: "Flujo + razonamiento IA",
    colorClass: "text-violet-400",
  },
  "ai-guided": {
    label: "AI-guided",
    description: "Razonamiento autónomo (futuro)",
    colorClass: "text-orange-400",
  },
};

export const CHANNEL_SCOPES: { value: ChannelScope; label: string }[] = [
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "web",       label: "Web Chat" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook",  label: "Facebook Messenger" },
  { value: "email",     label: "Email" },
];

export const OBJECTIVES = [
  { value: "generar_lead",      label: "Generar lead" },
  { value: "cerrar_venta",      label: "Cerrar venta" },
  { value: "agendar_cita",      label: "Agendar cita" },
  { value: "resolver_consulta", label: "Resolver consulta" },
  { value: "derivar_humano",    label: "Derivar a humano" },
] as const;

export const KPI_TYPES = [
  { value: "conversion",          label: "Conversión (%)" },
  { value: "tiempo_respuesta",    label: "Tiempo de respuesta (seg)" },
  { value: "tiempo_conversacion", label: "Duración promedio (min)" },
  { value: "escalamiento",        label: "% de escalamiento" },
  { value: "satisfaccion",        label: "Satisfacción (CSAT)" },
] as const;

export const LLM_MODELS: { value: string; label: string; contextK: number }[] = [
  { value: "gpt-4.1",       label: "GPT-4.1",        contextK: 1047 },
  { value: "gpt-4.1-mini",  label: "GPT-4.1 mini",   contextK: 1047 },
  { value: "gpt-4.1-nano",  label: "GPT-4.1 nano",   contextK: 1047 },
  { value: "gpt-4o",        label: "GPT-4o",          contextK: 128  },
  { value: "gpt-4o-mini",   label: "GPT-4o mini",     contextK: 128  },
  { value: "gpt-4-turbo",   label: "GPT-4 Turbo",     contextK: 128  },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo",   contextK: 16   },
];

export const TONES = [
  { value: "formal",      label: "Formal" },
  { value: "cercano",     label: "Cercano" },
  { value: "tecnico",     label: "Técnico" },
  { value: "vendedor",    label: "Vendedor" },
  { value: "minimalista", label: "Minimalista" },
] as const;

export const RESPONSE_LENGTHS = [
  { value: "corta",     label: "Corta" },
  { value: "media",     label: "Media" },
  { value: "detallada", label: "Detallada" },
] as const;

export const EMOJI_LEVELS = [
  { value: "no",       label: "Sin emojis" },
  { value: "moderado", label: "Moderado" },
  { value: "alto",     label: "Alto" },
] as const;

export const LANGUAGES = [
  { value: "es_ar", label: "Español (Argentina)" },
  { value: "es_mx", label: "Español (México)" },
  { value: "es_es", label: "Español (España)" },
  { value: "en_us", label: "Inglés (EEUU)" },
  { value: "pt_br", label: "Portugués (Brasil)" },
] as const;
