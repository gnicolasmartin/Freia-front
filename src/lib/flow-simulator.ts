// Flow simulation engine — async, optionally agent-aware.
// Walks through draft nodes/edges simulating conversation flow.
// When an Agent + API key are provided via SimulationOptions, real LLM calls
// are made for message generation (all modes) and intent/tool reasoning (hybrid).

import type { FlowNode, FlowEdge, FlowVariable, ToolParamMapping, ToolParamDef, ToolExecutionLog } from "@/types/flow";
import type { Policy, ResponseViolationAction, AuthorityViolationAction, EscalationTriggerAction, InputClassificationAction } from "@/types/policy";
import { getEffectiveResponseKeywords, getEffectiveEscalationKeywords, getEffectiveClassificationKeywords, INPUT_CLASSIFICATION_CATEGORIES, resolveEnforcementActions } from "@/types/policy";
import type { AgentFormData } from "@/types/agent";
import type { ToolDefinition } from "@/types/tool-registry";
import type { AgentDecisionEntry } from "@/types/agent-decision";
import { renderTemplate } from "./template-engine";
import { BUILTIN_VARIABLES, getSampleValue } from "./template-variables";
import { getBusinessHoursConfig, isCurrentlyBusinessHours } from "./business-hours";
import { resolveToolParams, createToolExecutionLog, completeToolExecutionLog } from "./tool-runtime";
import {
  generateNodeMessage,
  detectIntentWithLLM,
  selectToolWithLLM,
  callLLMWithTool,
  finalizeToolWithLLM,
  buildConversationHistory,
} from "./agent-flow-coordinator";

// --- Types ---

export interface ConditionRuleEval {
  label: string;
  variable: string;
  operator: string;
  expectedValue: string;
  actualValue: string;
  result: boolean | null; // null = skipped (after a match)
}

export interface ConditionEvalMetadata {
  rules: ConditionRuleEval[];
  matchedIndex: number | null; // null = default route
  routeTaken: string;
}

// --- Tool mock types ---

export type ToolMockOutcome = "success" | "error" | "no_stock" | "cancelled";

export interface ToolCallDetail {
  tool: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  outcome: ToolMockOutcome;
  durationMs: number;
}

export interface SimulationOptions {
  toolMockOutcome?: ToolMockOutcome;
  responsePolicies?: Policy[];
  authorityPolicies?: Policy[];
  escalationPolicies?: Policy[];
  /** Policies evaluated on raw user input BEFORE the LLM produces a response */
  inputClassificationPolicies?: Policy[];
  toolSchemas?: Record<string, ToolParamDef[]>;
  allowedToolIds?: string[];
  /**
   * Agent driving this flow.
   * When provided alongside agentApiKey, real LLM calls replace mock logic:
   * - All modes: Message node text is reformulated in the agent's style
   * - Hybrid: intent detection and tool reasoning use the LLM instead of mocks
   */
  agent?: AgentFormData;
  /** Raw (deobfuscated) OpenAI API key. Required when `agent` is set. */
  agentApiKey?: string;
  /**
   * Full ToolDefinition objects from the registry.
   * When provided alongside agent + agentApiKey in hybrid mode, enables
   * real OpenAI function calling for Toolcall nodes (CA1–CA4).
   */
  toolDefinitions?: ToolDefinition[];
  /**
   * Callback fired after every LLM call made by the agent.
   * FlowTestChat enriches each entry with flow-level context before
   * persisting it to the AgentDecisionLogProvider.
   */
  onAgentDecision?: (entry: Omit<AgentDecisionEntry, "id" | "timestamp">) => void;
  /** Products catalogue — used by stocklookup nodes */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products?: Record<string, any>[];
}

// --- AI reasoning types ---

export interface IntentInfo {
  detected: string;
  label: string;
  confidence: number;
  alternatives?: { intent: string; label: string; confidence: number }[];
}

export interface EntityInfo {
  type: string;
  value: string;
  confidence: number;
  source: string;
}

export interface ToolSelectionInfo {
  reasoning: string;
  confidence: number;
  alternatives?: { tool: string; score: number }[];
}

export interface AIReasoningMetadata {
  intent?: IntentInfo;
  entities?: EntityInfo[];
  toolSelection?: ToolSelectionInfo;
}

export interface SimulationErrorDetail {
  code: string;
  nodeLabel?: string;
}

export interface PolicyViolationDetail {
  policyName: string;
  keyword: string;
  action: ResponseViolationAction;
  originalContent: string;
}

export interface AuthorityViolationDetail {
  policyName: string;
  ruleName: string;
  ruleType: "forbidden" | "limit";
  toolName: string;
  paramName?: string;
  maxValue?: number;
  actualValue?: number;
  action: AuthorityViolationAction;
}

export interface EscalationTriggerDetail {
  policyName: string;
  triggerType: "keyword" | "intent" | "confidence";
  triggerDescription: string;
  action: EscalationTriggerAction;
  detectedIntent?: string;
  confidence?: number;
}

export interface RiskThresholdDetail {
  policyName: string;
  threshold: number;
  currentScore: number;
  action: "warn" | "escalate";
}

export interface InputClassificationDetail {
  policyName: string;
  category?: string;
  keyword: string;
  action: InputClassificationAction;
}

export interface SimulationMessage {
  id: string;
  type: "bot" | "user" | "system" | "tool" | "condition" | "ai_reasoning" | "error" | "policy_violation" | "authority_violation" | "escalation_trigger" | "risk_threshold" | "input_classification";
  content: string;
  nodeId?: string;
  nodeType?: string;
  timestamp: string;
  /** True when the content was generated/reformulated by the agent's LLM */
  aiGenerated?: boolean;
  conditionEval?: ConditionEvalMetadata;
  toolCallDetail?: ToolCallDetail;
  aiReasoning?: AIReasoningMetadata;
  errorDetail?: SimulationErrorDetail;
  policyViolation?: PolicyViolationDetail;
  authorityViolation?: AuthorityViolationDetail;
  escalationTrigger?: EscalationTriggerDetail;
  riskThreshold?: RiskThresholdDetail;
  inputClassification?: InputClassificationDetail;
}

export interface SimulationState {
  currentNodeId: string | null;
  visitedNodeIds: string[];
  vars: Record<string, unknown>;
  messages: SimulationMessage[];
  status: "running" | "waiting_input" | "completed" | "error";
  waitingForInput?: {
    nodeId: string;
    responseType: string;
    variable: string;
    /** Only set when responseType === "interactive" */
    interactiveType?: "buttons" | "list";
    options?: Array<{ label: string; value: string }>;
  };
  toolExecutionLogs: ToolExecutionLog[];
}

interface ConditionRule {
  variable?: string;
  operator?: string;
  value?: string;
  label?: string;
}

// --- Tool mock responses ---

export const TOOL_MOCK_OUTCOME_LABELS: Record<ToolMockOutcome, string> = {
  success: "Exitoso",
  error: "Error",
  no_stock: "Sin stock",
  cancelled: "Cancelado",
};

const TOOL_MOCK_RESPONSES: Record<
  string,
  Record<ToolMockOutcome, { status: string; data: Record<string, unknown> }>
> = {
  crm_lookup: {
    success: { status: "ok", data: { id: "C-1234", name: "María López", email: "maria@ejemplo.com", phone: "+54 11 5555-0001" } },
    error: { status: "error", data: { message: "Timeout de conexión con CRM" } },
    no_stock: { status: "ok", data: { id: "C-1234", name: "María López", note: "Cliente sin productos activos" } },
    cancelled: { status: "cancelled", data: { message: "Búsqueda cancelada" } },
  },
  send_email: {
    success: { status: "sent", data: { messageId: "msg-abc123", deliveredAt: "2025-01-15T10:30:00Z" } },
    error: { status: "error", data: { message: "SMTP connection refused" } },
    no_stock: { status: "sent", data: { messageId: "msg-abc123", note: "Plantilla sin contenido disponible" } },
    cancelled: { status: "cancelled", data: { message: "Envío cancelado por política" } },
  },
  create_ticket: {
    success: { status: "created", data: { ticketId: "TK-5678", url: "https://support.ejemplo.com/tickets/5678" } },
    error: { status: "error", data: { message: "No se pudo crear el ticket: permisos insuficientes" } },
    no_stock: { status: "created", data: { ticketId: "TK-5678", note: "Asignación pendiente — sin agentes disponibles" } },
    cancelled: { status: "cancelled", data: { message: "Creación cancelada" } },
  },
  calendar_check: {
    success: { status: "available", data: { slots: ["09:00", "11:30", "14:00"], date: "2025-01-20" } },
    error: { status: "error", data: { message: "Servicio de calendario no disponible" } },
    no_stock: { status: "unavailable", data: { message: "Sin turnos disponibles para la fecha solicitada" } },
    cancelled: { status: "cancelled", data: { message: "Consulta cancelada" } },
  },
  knowledge_search: {
    success: { status: "ok", data: { results: [{ title: "Guía de devoluciones", score: 0.95 }, { title: "Política de reembolso", score: 0.87 }] } },
    error: { status: "error", data: { message: "Índice de búsqueda no disponible" } },
    no_stock: { status: "ok", data: { results: [], message: "Sin resultados relevantes" } },
    cancelled: { status: "cancelled", data: { message: "Búsqueda cancelada" } },
  },
  apply_discount: {
    success: { status: "applied", data: { discountId: "DSC-001", percentage: 10, orderNumber: "ORD-1234" } },
    error: { status: "error", data: { message: "No se pudo aplicar el descuento" } },
    no_stock: { status: "ok", data: { message: "Pedido no elegible para descuento" } },
    cancelled: { status: "cancelled", data: { message: "Descuento cancelado" } },
  },
  cancel_order: {
    success: { status: "cancelled", data: { orderNumber: "ORD-1234", cancelledAt: "2025-01-15T10:30:00Z" } },
    error: { status: "error", data: { message: "No se pudo cancelar el pedido" } },
    no_stock: { status: "ok", data: { message: "Pedido ya fue despachado" } },
    cancelled: { status: "cancelled", data: { message: "Cancelación abortada" } },
  },
  create_refund: {
    success: { status: "created", data: { refundId: "REF-001", amount: 5000, estimatedDate: "2025-01-20" } },
    error: { status: "error", data: { message: "No se pudo procesar el reembolso" } },
    no_stock: { status: "ok", data: { message: "Pedido fuera del período de devolución" } },
    cancelled: { status: "cancelled", data: { message: "Reembolso cancelado" } },
  },
};

function getToolMockResponse(
  tool: string,
  outcome: ToolMockOutcome
): { status: string; data: Record<string, unknown> } {
  const toolMocks = TOOL_MOCK_RESPONSES[tool];
  if (toolMocks) return toolMocks[outcome];

  // Generic fallback for unknown tools
  switch (outcome) {
    case "success":
      return { status: "ok", data: { result: "operación completada" } };
    case "error":
      return { status: "error", data: { message: "Error simulado" } };
    case "no_stock":
      return { status: "ok", data: { message: "Recurso no disponible" } };
    case "cancelled":
      return { status: "cancelled", data: { message: "Operación cancelada" } };
  }
}

// --- AI reasoning mock generators ---

export const INTENT_KEYWORDS: {
  intent: string;
  label: string;
  keywords: string[];
}[] = [
  { intent: "consulta_producto", label: "Consulta de producto", keywords: ["producto", "precio", "catálogo", "info", "información", "costo", "vale"] },
  { intent: "soporte_tecnico", label: "Soporte técnico", keywords: ["error", "problema", "ayuda", "no funciona", "falla", "bug", "roto"] },
  { intent: "agendar_cita", label: "Agendar cita", keywords: ["turno", "cita", "horario", "agendar", "reservar", "disponibilidad"] },
  { intent: "reclamo", label: "Reclamo o devolución", keywords: ["queja", "reclamo", "devolver", "reembolso", "devolución", "mal"] },
  { intent: "consulta_estado", label: "Consulta de estado", keywords: ["estado", "pedido", "seguimiento", "tracking", "dónde", "envío"] },
  { intent: "saludo", label: "Saludo", keywords: ["hola", "buenos días", "buenas", "buen día", "hey", "hi"] },
];

function mockDetectIntent(userInput: string): IntentInfo {
  const lower = userInput.toLowerCase();

  // Score each intent by keyword matches
  const scored = INTENT_KEYWORDS.map((entry) => {
    const matches = entry.keywords.filter((kw) => lower.includes(kw)).length;
    return { ...entry, matches };
  })
    .filter((e) => e.matches > 0)
    .sort((a, b) => b.matches - a.matches);

  if (scored.length === 0) {
    return {
      detected: "otro",
      label: "Otro",
      confidence: 0.4 + Math.random() * 0.2,
      alternatives: [
        { intent: "saludo", label: "Saludo", confidence: 0.1 + Math.random() * 0.15 },
      ],
    };
  }

  const best = scored[0];
  const confidence = Math.min(0.95, 0.75 + best.matches * 0.07 + Math.random() * 0.05);

  const alternatives = scored.slice(1, 3).map((s, i) => ({
    intent: s.intent,
    label: s.label,
    confidence: Math.max(0.1, confidence - 0.25 - i * 0.15 + Math.random() * 0.1),
  }));

  // Add a random unrelated intent if we have room
  if (alternatives.length < 2) {
    const unused = INTENT_KEYWORDS.find(
      (ik) => ik.intent !== best.intent && !alternatives.some((a) => a.intent === ik.intent)
    );
    if (unused) {
      alternatives.push({
        intent: unused.intent,
        label: unused.label,
        confidence: 0.05 + Math.random() * 0.12,
      });
    }
  }

  return {
    detected: best.intent,
    label: best.label,
    confidence,
    alternatives,
  };
}

function mockExtractEntities(userInput: string): EntityInfo[] {
  const entities: EntityInfo[] = [];

  // Email
  const emailMatch = userInput.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    entities.push({
      type: "email",
      value: emailMatch[0],
      confidence: 0.95 + Math.random() * 0.04,
      source: "input del usuario",
    });
  }

  // Phone
  const phoneMatch = userInput.match(/\+?\d[\d\s-]{6,}/);
  if (phoneMatch) {
    entities.push({
      type: "teléfono",
      value: phoneMatch[0].trim(),
      confidence: 0.85 + Math.random() * 0.1,
      source: "input del usuario",
    });
  }

  // Date keywords
  const dateKeywords = ["mañana", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo", "hoy", "próxima semana"];
  const lower = userInput.toLowerCase();
  for (const dk of dateKeywords) {
    if (lower.includes(dk)) {
      entities.push({
        type: "fecha",
        value: dk,
        confidence: 0.80 + Math.random() * 0.15,
        source: "input del usuario",
      });
      break;
    }
  }

  // Numbers (amounts, quantities)
  const numberMatches = userInput.match(/\b\d+([.,]\d+)?\b/g);
  if (numberMatches) {
    for (const nm of numberMatches.slice(0, 2)) {
      // Skip if already captured as phone
      if (phoneMatch && phoneMatch[0].includes(nm)) continue;
      entities.push({
        type: "número",
        value: nm,
        confidence: 0.88 + Math.random() * 0.1,
        source: "input del usuario",
      });
    }
  }

  return entities;
}

const TOOL_REASONING: Record<string, { reasoning: string; alternatives: { tool: string; score: number }[] }> = {
  crm_lookup: {
    reasoning: "Búsqueda en CRM necesaria para obtener datos del cliente",
    alternatives: [
      { tool: "knowledge_search", score: 0.35 },
      { tool: "create_ticket", score: 0.15 },
    ],
  },
  send_email: {
    reasoning: "Envío de email requerido como canal de notificación",
    alternatives: [
      { tool: "create_ticket", score: 0.30 },
      { tool: "crm_lookup", score: 0.12 },
    ],
  },
  create_ticket: {
    reasoning: "Creación de ticket para seguimiento del caso",
    alternatives: [
      { tool: "send_email", score: 0.28 },
      { tool: "crm_lookup", score: 0.18 },
    ],
  },
  calendar_check: {
    reasoning: "Consulta de disponibilidad para agendar turno",
    alternatives: [
      { tool: "crm_lookup", score: 0.22 },
      { tool: "create_ticket", score: 0.10 },
    ],
  },
  knowledge_search: {
    reasoning: "Búsqueda en base de conocimiento para responder consulta",
    alternatives: [
      { tool: "crm_lookup", score: 0.30 },
      { tool: "create_ticket", score: 0.12 },
    ],
  },
  apply_discount: {
    reasoning: "Aplicación de descuento solicitada por el cliente",
    alternatives: [{ tool: "create_ticket", score: 0.15 }],
  },
  cancel_order: {
    reasoning: "Cancelación de pedido por solicitud del cliente",
    alternatives: [{ tool: "create_ticket", score: 0.25 }],
  },
  create_refund: {
    reasoning: "Procesamiento de reembolso por solicitud del cliente",
    alternatives: [{ tool: "create_ticket", score: 0.20 }],
  },
};

function mockToolSelectionReasoning(tool: string): ToolSelectionInfo {
  const known = TOOL_REASONING[tool];
  const confidence = 0.82 + Math.random() * 0.14;

  if (known) {
    return {
      reasoning: known.reasoning,
      confidence,
      alternatives: known.alternatives.map((a) => ({
        ...a,
        score: a.score + Math.random() * 0.1,
      })),
    };
  }

  return {
    reasoning: `Herramienta "${tool}" seleccionada según configuración del flujo`,
    confidence,
  };
}

// --- Helpers ---

function makeMessage(
  type: SimulationMessage["type"],
  content: string,
  nodeId?: string,
  nodeType?: string
): SimulationMessage {
  return {
    id: crypto.randomUUID(),
    type,
    content,
    nodeId,
    nodeType,
    timestamp: new Date().toISOString(),
  };
}

function makeErrorMessage(
  content: string,
  code: string,
  nodeId?: string,
  nodeType?: string,
  nodeLabel?: string
): SimulationMessage {
  return {
    ...makeMessage("error", content, nodeId, nodeType),
    errorDetail: { code, nodeLabel },
  };
}

const VIOLATION_ACTION_LABELS: Record<ResponseViolationAction, string> = {
  block: "bloqueada",
  escalate: "escalada a humano",
  reformulate: "reformulada",
};

function checkResponsePolicies(
  content: string,
  policies?: Policy[]
): { policyName: string; keyword: string; action: ResponseViolationAction } | null {
  if (!policies || policies.length === 0) return null;
  const contentLower = content.toLowerCase();

  for (const policy of policies) {
    if (!policy.active) continue;
    const keywords = getEffectiveResponseKeywords(policy);
    for (const kw of keywords) {
      if (contentLower.includes(kw.toLowerCase())) {
        return {
          policyName: policy.name,
          keyword: kw,
          action: resolveEnforcementActions(policy.enforcementMode).responseViolationAction,
        };
      }
    }
  }
  return null;
}

function makePolicyViolationMessage(
  originalContent: string,
  violation: { policyName: string; keyword: string; action: ResponseViolationAction },
  nodeId?: string,
  nodeType?: string
): SimulationMessage {
  return {
    ...makeMessage(
      "policy_violation",
      `Respuesta ${VIOLATION_ACTION_LABELS[violation.action]} por política "${violation.policyName}"`,
      nodeId,
      nodeType
    ),
    policyViolation: {
      policyName: violation.policyName,
      keyword: violation.keyword,
      action: violation.action,
      originalContent,
    },
  };
}

function checkAuthorityRules(
  tool: string,
  params: Record<string, unknown>,
  policies?: Policy[]
): AuthorityViolationDetail | null {
  if (!policies) return null;
  for (const policy of policies) {
    if (!policy.active) continue;
    for (const rule of policy.authorityRules ?? []) {
      if (rule.toolName !== tool) continue;

      if (rule.type === "forbidden") {
        return {
          policyName: policy.name,
          ruleName: rule.description,
          ruleType: "forbidden",
          toolName: tool,
          action: resolveEnforcementActions(policy.enforcementMode).authorityViolationAction,
        };
      }

      if (rule.type === "limit" && rule.paramName && rule.maxValue !== undefined) {
        const actual = Number(params[rule.paramName]);
        if (!isNaN(actual) && actual > rule.maxValue) {
          return {
            policyName: policy.name,
            ruleName: rule.description,
            ruleType: "limit",
            toolName: tool,
            paramName: rule.paramName,
            maxValue: rule.maxValue,
            actualValue: actual,
            action: resolveEnforcementActions(policy.enforcementMode).authorityViolationAction,
          };
        }
      }
    }
  }
  return null;
}

function makeAuthorityViolationMessage(
  violation: AuthorityViolationDetail,
  nodeId?: string,
  nodeType?: string
): SimulationMessage {
  const actionLabel = violation.action === "escalate" ? "escalada a humano" : "bloqueada";
  const detail =
    violation.ruleType === "forbidden"
      ? `Herramienta "${violation.toolName}" prohibida`
      : `Parámetro "${violation.paramName}" excede límite: máx. ${violation.maxValue}, actual: ${violation.actualValue}`;
  return {
    ...makeMessage("authority_violation", `Acción ${actionLabel}: ${detail}`, nodeId, nodeType),
    authorityViolation: violation,
  };
}

function checkEscalationTriggers(
  userInput: string,
  intentInfo: IntentInfo,
  policies?: Policy[]
): EscalationTriggerDetail | null {
  if (!policies || policies.length === 0) return null;
  const inputLower = userInput.toLowerCase();

  for (const policy of policies) {
    if (!policy.active) continue;

    // 1. Keyword-based triggers
    const keywords = getEffectiveEscalationKeywords(policy);
    for (const kw of keywords) {
      if (inputLower.includes(kw.toLowerCase())) {
        return {
          policyName: policy.name,
          triggerType: "keyword",
          triggerDescription: `Palabra clave detectada: "${kw}"`,
          action: resolveEnforcementActions(policy.enforcementMode).escalationTriggerAction,
          detectedIntent: intentInfo.detected,
          confidence: intentInfo.confidence,
        };
      }
    }

    // 2. Intent-based triggers
    for (const rule of policy.escalationTriggerRules ?? []) {
      if (rule.type === "intent" && rule.intentName) {
        if (intentInfo.detected === rule.intentName) {
          return {
            policyName: policy.name,
            triggerType: "intent",
            triggerDescription: rule.description || `Intent detectado: "${rule.intentName}"`,
            action: resolveEnforcementActions(policy.enforcementMode).escalationTriggerAction,
            detectedIntent: intentInfo.detected,
            confidence: intentInfo.confidence,
          };
        }
      }
    }

    // 3. Confidence-based triggers
    for (const rule of policy.escalationTriggerRules ?? []) {
      if (rule.type === "confidence" && rule.confidenceThreshold !== undefined) {
        if (intentInfo.confidence < rule.confidenceThreshold) {
          return {
            policyName: policy.name,
            triggerType: "confidence",
            triggerDescription: rule.description || `Confianza (${(intentInfo.confidence * 100).toFixed(0)}%) por debajo del umbral (${(rule.confidenceThreshold * 100).toFixed(0)}%)`,
            action: resolveEnforcementActions(policy.enforcementMode).escalationTriggerAction,
            detectedIntent: intentInfo.detected,
            confidence: intentInfo.confidence,
          };
        }
      }
    }
  }
  return null;
}

function makeEscalationTriggerMessage(
  trigger: EscalationTriggerDetail,
  nodeId?: string,
  nodeType?: string
): SimulationMessage {
  return {
    ...makeMessage("escalation_trigger", `Trigger de escalamiento: ${trigger.triggerDescription}`, nodeId, nodeType),
    escalationTrigger: trigger,
  };
}

// --- PRE-LLM: Input classification (offensive language, illegal requests, manipulation) ---

function checkInputClassification(
  userInput: string,
  policies?: Policy[]
): InputClassificationDetail | null {
  if (!policies || policies.length === 0) return null;
  const inputLower = userInput.toLowerCase();

  for (const policy of policies) {
    if (!policy.active) continue;
    const keywords = getEffectiveClassificationKeywords(policy);
    for (const kw of keywords) {
      if (inputLower.includes(kw.toLowerCase())) {
        const category = INPUT_CLASSIFICATION_CATEGORIES.find(
          (cat) =>
            (policy.inputClassificationCategories ?? []).includes(cat.value) &&
            cat.keywords.some((k) => k.toLowerCase() === kw.toLowerCase())
        )?.value;
        return {
          policyName: policy.name,
          category,
          keyword: kw,
          action: resolveEnforcementActions(policy.enforcementMode).inputClassificationAction,
        };
      }
    }
  }
  return null;
}

function makeInputClassificationMessage(
  detail: InputClassificationDetail,
  nodeId?: string,
  nodeType?: string
): SimulationMessage {
  const actionLabel =
    detail.action === "escalate"
      ? "escalado a humano"
      : detail.action === "warn"
      ? "advertencia emitida"
      : "ignorado";
  return {
    ...makeMessage(
      "input_classification",
      `Entrada clasificada (${detail.action}): palabra clave "${detail.keyword}" detectada — ${actionLabel}`,
      nodeId,
      nodeType
    ),
    inputClassification: detail,
  };
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current !== null && current !== undefined && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function findNextNodeId(
  currentNodeId: string,
  edges: FlowEdge[],
  sourceHandle?: string
): string | null {
  if (sourceHandle) {
    // Try exact named handle first
    const exact = edges.find(
      (e) => e.source === currentNodeId && e.sourceHandle === sourceHandle
    );
    if (exact) return exact.target;
    // Backward compat: fall back to any unnamed edge from this node
    const fallback = edges.find(
      (e) => e.source === currentNodeId && !e.sourceHandle
    );
    return fallback?.target ?? null;
  }
  const edge = edges.find((e) => e.source === currentNodeId);
  return edge?.target ?? null;
}

function evaluateCondition(
  rule: ConditionRule,
  vars: Record<string, unknown>
): boolean {
  if (!rule.variable || !rule.operator) return false;
  const value = getNestedValue(vars, rule.variable);

  switch (rule.operator) {
    case "==":
    case "equals":
      return String(value ?? "") === (rule.value ?? "");
    case "!=":
    case "not_equals":
      return String(value ?? "") !== (rule.value ?? "");
    case "<":
    case "less_than":
      return Number(value) < Number(rule.value);
    case ">":
    case "greater_than":
      return Number(value) > Number(rule.value);
    case "contains":
      return String(value ?? "").includes(rule.value ?? "");
    case "in": {
      const options = (rule.value ?? "").split(",").map((s) => s.trim());
      return options.includes(String(value ?? ""));
    }
    case "exists":
      return value !== undefined && value !== null && value !== "";
    case "matches": {
      // Check if the value contains any of the pipe-separated keywords
      const keywords = (rule.value ?? "").split("|").map((s) => s.trim().toLowerCase());
      const actual = String(value ?? "").toLowerCase();
      return keywords.some((kw) => kw && actual.includes(kw));
    }
    default:
      return false;
  }
}

// --- Init ---

export function initSimulation(
  nodes: FlowNode[],
  edges: FlowEdge[],
  variables: FlowVariable[],
  initialVars?: Record<string, unknown>
): SimulationState {
  // Build initial vars: built-ins with sample values + flow vars as undefined
  const vars: Record<string, unknown> = {};
  for (const bv of BUILTIN_VARIABLES) {
    vars[bv.name] = getSampleValue(bv);
  }
  // Override business-hours system vars with real values
  const bhConfig = getBusinessHoursConfig();
  vars["system.isBusinessHours"]   = isCurrentlyBusinessHours(bhConfig);
  vars["system.outOfHoursMessage"] = bhConfig.outOfHoursMessage ?? "";
  vars["system.bookingUrl"]        = bhConfig.bookingUrl ?? "";
  for (const v of variables) {
    vars[v.name] = undefined;
  }
  // Apply preset overrides if provided
  if (initialVars) {
    Object.assign(vars, initialVars);
  }

  // Find start node and its first connected node
  const startNode = nodes.find((n) => n.type === "start");
  const firstNodeId = startNode
    ? findNextNodeId(startNode.id, edges)
    : null;

  const messages = [makeMessage("system", "Simulación iniciada")];

  if (!firstNodeId) {
    return {
      currentNodeId: null,
      visitedNodeIds: startNode ? [startNode.id] : [],
      vars,
      messages: [
        ...messages,
        makeErrorMessage("No se encontró nodo conectado al inicio", "NO_START_CONNECTION", startNode?.id, "start", "Inicio"),
      ],
      status: "error",
      toolExecutionLogs: [],
    };
  }

  return {
    currentNodeId: firstNodeId,
    visitedNodeIds: startNode ? [startNode.id] : [],
    vars,
    messages,
    status: "running",
    toolExecutionLogs: [],
  };
}

// --- Step ---

export async function stepSimulation(
  state: SimulationState,
  nodes: FlowNode[],
  edges: FlowEdge[],
  variables: FlowVariable[],
  userInput?: string,
  options?: SimulationOptions
): Promise<SimulationState> {
  if (state.status === "completed" || state.status === "error") return state;
  if (!state.currentNodeId) {
    return {
      ...state,
      messages: [
        ...state.messages,
        makeErrorMessage("Estado inválido: nodo actual es nulo", "NULL_NODE"),
      ],
      status: "error",
    };
  }

  const node = nodes.find((n) => n.id === state.currentNodeId);
  if (!node) {
    return {
      ...state,
      messages: [
        ...state.messages,
        makeErrorMessage(`Nodo "${state.currentNodeId}" no encontrado en el flujo`, "NODE_NOT_FOUND", state.currentNodeId ?? undefined),
      ],
      status: "error",
    };
  }

  // Track visited nodes (add current node if not already present)
  const visited = state.visitedNodeIds.includes(node.id)
    ? state.visitedNodeIds
    : [...state.visitedNodeIds, node.id];
  state = { ...state, visitedNodeIds: visited };

  const d = node.data as Record<string, unknown>;
  const label = (d.label as string) || node.type || "Nodo";

  switch (node.type) {
    // ---- Message ----
    case "message": {
      const interactiveType = (d.interactiveType as string) || "none";
      const rawOptions = (d.options as Array<{ id: string; key: string; value: string }>) || [];
      const saveToVariable = (d.saveToVariable as string) || "";

      // ── Phase 2: user already made a selection (interactive mode) ──────────
      if (interactiveType !== "none" && userInput !== undefined) {
        const newVars = { ...state.vars };
        if (saveToVariable) newVars[saveToVariable] = userInput;
        const nextId = findNextNodeId(node.id, edges);
        // Show label (not raw value) in the user message bubble
        const selectedLabel =
          rawOptions.find((o) => o.value === userInput)?.key ?? userInput;
        const msgs = [
          ...state.messages,
          makeMessage("user", selectedLabel, node.id, "message"),
        ];
        if (!nextId) {
          msgs.push(
            makeErrorMessage(
              `El nodo "${label}" no tiene conexión de salida`,
              "BROKEN_EDGE",
              node.id,
              node.type,
              label
            )
          );
        }
        return {
          ...state,
          currentNodeId: nextId,
          vars: newVars,
          messages: msgs,
          status: nextId ? "running" : "completed",
          waitingForInput: undefined,
        };
      }

      // ── Shared: render the bot message ─────────────────────────────────────
      const template = (d.message as string) || "";
      const rendered = renderTemplate(template, state.vars);
      const nextId = findNextNodeId(node.id, edges);

      // Agent coordination: reformulate in agent style (flow-driven + hybrid)
      let finalContent = rendered;
      let aiGenerated = false;
      if (options?.agent && options?.agentApiKey && rendered.trim()) {
        const history = buildConversationHistory(state.messages);
        const result = await generateNodeMessage(
          rendered,
          options.agent,
          history,
          options.agentApiKey,
          options.onAgentDecision
            ? (d) => options.onAgentDecision!({ ...d, nodeId: node.id, nodeType: node.type })
            : undefined
        );
        finalContent = result.content;
        aiGenerated = result.aiGenerated;
      }

      // Check response policies before sending
      const violation = checkResponsePolicies(finalContent, options?.responsePolicies);

      const msgs = [...state.messages];

      if (violation) {
        msgs.push(makePolicyViolationMessage(finalContent, violation, node.id, "message"));
        if (violation.action === "reformulate") {
          msgs.push(makeMessage("bot", "Disculpe, no tengo esa información disponible. ¿Puedo ayudarle con algo más?", node.id, "message"));
        }
      } else {
        const botMsg = makeMessage("bot", finalContent || "(mensaje vacío)", node.id, "message");
        botMsg.aiGenerated = aiGenerated;
        msgs.push(botMsg);
      }

      // ── Phase 1: interactive → wait for user selection ─────────────────────
      if (interactiveType !== "none") {
        return {
          ...state,
          currentNodeId: node.id, // stay on this node until selection
          messages: msgs,
          status: "waiting_input",
          waitingForInput: {
            nodeId: node.id,
            responseType: "interactive",
            variable: saveToVariable,
            interactiveType: interactiveType as "buttons" | "list",
            options: rawOptions.map((o) => ({ label: o.key, value: o.value })),
          },
        };
      }

      // ── Non-interactive: existing single-pass behavior ─────────────────────
      if (!nextId) {
        msgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
      }
      return {
        ...state,
        currentNodeId: nextId,
        messages: msgs,
        status: nextId ? "running" : "completed",
      };
    }

    // ---- Ask ----
    case "ask": {
      const variable = (d.variable as string) || "";
      const responseType = (d.responseType as string) || "text";
      const question = (d.question as string) || (d.message as string) || "";

      // First pass: show question and wait for input
      if (!userInput && state.status !== "waiting_input") {
        const rendered = question ? renderTemplate(question, state.vars) : "";
        const msgs = [...state.messages];
        if (rendered) {
          msgs.push(makeMessage("bot", rendered, node.id, "ask"));
        }
        return {
          ...state,
          messages: msgs,
          status: "waiting_input",
          waitingForInput: { nodeId: node.id, responseType, variable },
        };
      }

      // Already waiting and still no input
      if (!userInput) return state;

      // Got input — save variable, generate AI reasoning, and advance
      const newVars = { ...state.vars };
      if (variable) {
        newVars[variable] = responseType === "number" ? Number(userInput) : userInput;
      }
      const nextId = findNextNodeId(node.id, edges);

      const userMsg = makeMessage("user", userInput, node.id, "ask");

      // Hybrid mode + agent: use real LLM for intent detection
      const isHybrid = options?.agent?.mode === "hybrid";
      const intentInfo =
        isHybrid && options?.agent && options?.agentApiKey
          ? await detectIntentWithLLM(
              userInput,
              options.agent,
              options.agentApiKey,
              options.onAgentDecision
                ? (d) => options.onAgentDecision!({ ...d, nodeId: node.id, nodeType: node.type })
                : undefined
            )
          : mockDetectIntent(userInput);

      const aiMsg: SimulationMessage = {
        ...makeMessage("ai_reasoning", "", node.id, "ask"),
        aiReasoning: {
          intent: intentInfo,
          entities: mockExtractEntities(userInput),
        },
      };

      const askMsgs = [...state.messages, userMsg, aiMsg];

      // --- PRE-LLM: Input classification (offensive language, illegal requests, manipulation) ---
      const classificationResult = checkInputClassification(
        userInput,
        options?.inputClassificationPolicies
      );
      if (classificationResult) {
        askMsgs.push(makeInputClassificationMessage(classificationResult, node.id, "ask"));
        if (classificationResult.action === "escalate") {
          askMsgs.push(makeMessage("system", "Entrada bloqueada por clasificación de contenido", node.id, "ask"));
          return {
            ...state,
            currentNodeId: null,
            vars: newVars,
            messages: askMsgs,
            status: "completed",
            waitingForInput: undefined,
          };
        }
        // "warn": classification message added, flow continues normally
        // "ignore": message added for audit trail, flow continues normally
      }

      // --- PRE-LLM: Escalation triggers (aggressive language, legal threats, etc.) ---
      const escalationTrigger = intentInfo
        ? checkEscalationTriggers(userInput, intentInfo, options?.escalationPolicies)
        : null;

      if (escalationTrigger) {
        askMsgs.push(makeEscalationTriggerMessage(escalationTrigger, node.id, "ask"));

        if (escalationTrigger.action === "escalate") {
          // Force escalation: terminate flow (same as handoff node)
          askMsgs.push(makeMessage("system", "Escalamiento automático: transferido a supervisor", node.id, "ask"));
          return {
            ...state,
            currentNodeId: null,
            vars: newVars,
            messages: askMsgs,
            status: "completed",
            waitingForInput: undefined,
          };
        }
        // "flag" and "notify": message added, flow continues normally
      }

      if (!nextId) {
        askMsgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
      }

      return {
        ...state,
        currentNodeId: nextId,
        vars: newVars,
        messages: askMsgs,
        status: nextId ? "running" : "completed",
        waitingForInput: undefined,
      };
    }

    // ---- Condition ----
    case "condition": {
      const rules = (d.rules as ConditionRule[]) || [];
      let matchedIndex: number | null = null;
      let matchedHandle: string | null = null;

      // Evaluate all rules, recording results (skip after first match)
      const evalResults: ConditionRuleEval[] = rules.map((rule, i) => {
        const variable = rule.variable ?? "";
        const operator = rule.operator ?? "";
        const expectedValue = rule.value ?? "";
        const actualRaw = variable ? getNestedValue(state.vars, variable) : undefined;
        const actualValue =
          actualRaw === undefined ? "(undefined)" : String(actualRaw);

        // Skip evaluation if we already found a match
        if (matchedIndex !== null) {
          return {
            label: rule.label || `${variable} ${operator} ${expectedValue}`,
            variable,
            operator,
            expectedValue,
            actualValue,
            result: null,
          };
        }

        const result = evaluateCondition(rule, state.vars);
        if (result) {
          matchedIndex = i;
          matchedHandle = `rule-${i}`;
        }

        return {
          label: rule.label || `${variable} ${operator} ${expectedValue}`,
          variable,
          operator,
          expectedValue,
          actualValue,
          result,
        };
      });

      if (!matchedHandle) {
        matchedHandle = "default";
      }

      const routeTaken =
        matchedIndex !== null
          ? evalResults[matchedIndex].label
          : "Default";

      const conditionMsg: SimulationMessage = {
        id: crypto.randomUUID(),
        type: "condition",
        content: matchedIndex !== null
          ? `Condición: ${routeTaken} → verdadero`
          : "Condición: ninguna regla coincidió → ruta por defecto",
        nodeId: node.id,
        nodeType: "condition",
        timestamp: new Date().toISOString(),
        conditionEval: {
          rules: evalResults,
          matchedIndex,
          routeTaken,
        },
      };

      const nextId = findNextNodeId(node.id, edges, matchedHandle);
      return {
        ...state,
        currentNodeId: nextId,
        messages: [...state.messages, conditionMsg],
        status: nextId ? "running" : "completed",
      };
    }

    // ---- Tool Call ----
    case "toolcall": {
      const tool = (d.tool as string) || "unknown";
      const mappings = (d.parameterMapping as ToolParamMapping[]) || [];
      const toolSchema = options?.toolSchemas?.[tool];
      const { params, missing } = resolveToolParams(tool, mappings, state.vars, toolSchema);

      // Check flow tool authorization FIRST → route to error handle
      if (options?.allowedToolIds && options.allowedToolIds.length > 0 && !options.allowedToolIds.includes(tool)) {
        const msgs = [...state.messages, makeErrorMessage(
          `Herramienta "${tool}" no autorizada para este flujo`,
          "TOOL_NOT_AUTHORIZED",
          node.id,
          node.type,
          label
        )];
        const nextId = findNextNodeId(node.id, edges, "error");
        if (!nextId) {
          msgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
        }
        return {
          ...state,
          currentNodeId: nextId,
          messages: msgs,
          status: nextId ? "running" : "completed",
        };
      }

      // Check authority rules BEFORE executing → route to error handle
      const authViolation = checkAuthorityRules(tool, params, options?.authorityPolicies);
      if (authViolation) {
        const msgs = [...state.messages, makeAuthorityViolationMessage(authViolation, node.id, "toolcall")];
        const nextId = findNextNodeId(node.id, edges, "error");
        if (!nextId) {
          msgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
        }
        return {
          ...state,
          currentNodeId: nextId,
          messages: msgs,
          status: nextId ? "running" : "completed",
        };
      }

      // CA1: Schema validation — block execution if required params missing → route to error
      if (missing.length > 0) {
        const errMsg = `Parámetros requeridos faltantes: ${missing.join(", ")}`;
        const execLog = createToolExecutionLog(node.id, tool, params);
        const completedLog = completeToolExecutionLog(execLog, undefined, errMsg);
        const validationToolMsg: SimulationMessage = {
          id: crypto.randomUUID(),
          type: "tool",
          content: `Herramienta: ${tool}`,
          nodeId: node.id,
          nodeType: "toolcall",
          timestamp: completedLog.timestamp,
          toolCallDetail: {
            tool,
            request: params,
            response: { status: "error", message: errMsg },
            outcome: "error",
            durationMs: completedLog.durationMs ?? 0,
          },
        };
        const msgs = [
          ...state.messages,
          validationToolMsg,
          makeErrorMessage(errMsg, "MISSING_TOOL_PARAMS", node.id, node.type, label),
        ];
        const nextId = findNextNodeId(node.id, edges, "error");
        if (!nextId) {
          msgs.push(makeErrorMessage(`El nodo "${label}" sin ruta de error conectada`, "BROKEN_EDGE", node.id, node.type, label));
        }
        return {
          ...state,
          currentNodeId: nextId,
          messages: msgs,
          toolExecutionLogs: [...state.toolExecutionLogs, completedLog],
          status: nextId ? "running" : "completed",
        };
      }

      // --- Hybrid mode: real OpenAI function calling (CA1–CA4) ---
      const isHybridTool =
        options?.agent?.mode === "hybrid" &&
        options?.agent &&
        options?.agentApiKey &&
        options?.toolDefinitions;

      if (isHybridTool) {
        const toolDef = options!.toolDefinitions!.find((t) => t.id === tool);
        if (toolDef) {
          try {
            const conversationHistory = buildConversationHistory(state.messages);

            // CA1+CA2: Ask the LLM to call the tool; receive LLM-generated args
            const llmResult = await callLLMWithTool(
              toolDef,
              options!.agent!,
              conversationHistory,
              options!.agentApiKey!,
              options?.onAgentDecision
                ? (d) => options!.onAgentDecision!({ ...d, nodeId: node.id, nodeType: node.type })
                : undefined
            );

            if (llmResult.toolCalled && llmResult.toolCallId && llmResult.toolArgs) {
              const llmParams = llmResult.toolArgs;

              // CA5: Re-check authority on LLM-generated params before executing
              const llmAuthViolation = checkAuthorityRules(tool, llmParams, options?.authorityPolicies);
              if (llmAuthViolation) {
                const violMsgs = [
                  ...state.messages,
                  makeAuthorityViolationMessage(llmAuthViolation, node.id, "toolcall"),
                ];
                const errNextId = findNextNodeId(node.id, edges, "error");
                if (!errNextId) {
                  violMsgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
                }
                return {
                  ...state,
                  currentNodeId: errNextId,
                  messages: violMsgs,
                  status: errNextId ? "running" : "completed",
                };
              }

              // CA3: Simulate tool execution with LLM-generated params
              const llmOutcome = options?.toolMockOutcome ?? "success";
              const mockResponse = getToolMockResponse(tool, llmOutcome);
              const mockDuration = 120 + Math.floor(Math.random() * 380);
              const toolResult = { status: mockResponse.status, ...mockResponse.data };

              const execLog = createToolExecutionLog(node.id, tool, llmParams);
              const toolExecError = llmOutcome === "error"
                ? String((mockResponse.data as Record<string, unknown>).message ?? "Tool error")
                : undefined;
              const completedExecLog: ToolExecutionLog = {
                ...completeToolExecutionLog(execLog, toolResult, toolExecError),
                durationMs: mockDuration,
              };

              // CA4: Send tool result back to LLM, get natural language response
              const finalContent = await finalizeToolWithLLM(
                llmResult.toolCallId,
                llmResult.toolFunctionName ?? tool,
                llmParams,
                toolResult,
                options!.agent!,
                conversationHistory,
                options!.agentApiKey!,
                options?.onAgentDecision
                  ? (d) => options!.onAgentDecision!({ ...d, nodeId: node.id, nodeType: node.type })
                  : undefined
              );

              const llmToolMsg: SimulationMessage = {
                id: crypto.randomUUID(),
                type: "tool",
                content: `Herramienta: ${tool}`,
                nodeId: node.id,
                nodeType: "toolcall",
                timestamp: completedExecLog.timestamp,
                aiGenerated: true,
                toolCallDetail: {
                  tool,
                  request: llmParams,
                  response: toolResult,
                  outcome: llmOutcome,
                  durationMs: mockDuration,
                },
                aiReasoning: {
                  toolSelection: {
                    reasoning: `Herramienta "${toolDef.name}" invocada con parámetros generados por el modelo`,
                    confidence: 0.95,
                  },
                },
              };

              const routeHandleLLM = llmOutcome === "error" ? "error" : "success";
              const nextIdLLM = findNextNodeId(node.id, edges, routeHandleLLM);
              const llmMsgs = [...state.messages, llmToolMsg];

              // Append final natural language response as a bot message
              if (finalContent) {
                llmMsgs.push({
                  ...makeMessage("bot", finalContent, node.id, "toolcall"),
                  aiGenerated: true,
                });
              }

              if (!nextIdLLM) {
                llmMsgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
              }

              const llmNewVars = llmOutcome !== "error"
                ? { ...state.vars, [tool]: mockResponse.data }
                : state.vars;

              return {
                ...state,
                currentNodeId: nextIdLLM,
                messages: llmMsgs,
                vars: llmNewVars,
                toolExecutionLogs: [...state.toolExecutionLogs, completedExecLog],
                status: nextIdLLM ? "running" : "completed",
              };
            }

            // LLM declined to call the tool — show direct response as bot message
            if (llmResult.directContent) {
              const directNextId = findNextNodeId(node.id, edges, "success");
              const directMsgs = [
                ...state.messages,
                {
                  ...makeMessage("bot", llmResult.directContent, node.id, "toolcall"),
                  aiGenerated: true,
                },
              ];
              if (!directNextId) {
                directMsgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
              }
              return {
                ...state,
                currentNodeId: directNextId,
                messages: directMsgs,
                status: directNextId ? "running" : "completed",
              };
            }
          } catch {
            // Fall through to standard mock execution below
          }
        }
      }

      // --- Standard mock execution path (flow-driven or hybrid fallback) ---
      const outcome = options?.toolMockOutcome ?? "success";
      const mockResponse = getToolMockResponse(tool, outcome);
      const mockDuration = 120 + Math.floor(Math.random() * 380); // 120-500ms

      // CA3: Create and complete execution log
      const execLog = createToolExecutionLog(node.id, tool, params);
      const toolError = outcome === "error"
        ? String((mockResponse.data as Record<string, unknown>).message ?? "Tool error")
        : undefined;
      const completedLog: ToolExecutionLog = {
        ...completeToolExecutionLog(
          execLog,
          { status: mockResponse.status, ...mockResponse.data },
          toolError
        ),
        durationMs: mockDuration,
      };

      const toolMsg: SimulationMessage = {
        id: crypto.randomUUID(),
        type: "tool",
        content: `Herramienta: ${tool}`,
        nodeId: node.id,
        nodeType: "toolcall",
        timestamp: completedLog.timestamp,
        toolCallDetail: {
          tool,
          request: params,
          response: { status: mockResponse.status, ...mockResponse.data },
          outcome,
          durationMs: mockDuration,
        },
        aiReasoning: {
          toolSelection:
            options?.agent?.mode === "hybrid" && options?.agent && options?.agentApiKey
              ? await selectToolWithLLM(
                  tool,
                  state.messages
                    .filter((m) => m.type === "user")
                    .slice(-1)[0]?.content ?? "",
                  options.agent,
                  options.agentApiKey,
                  options.onAgentDecision
                    ? (d) => options!.onAgentDecision!({ ...d, nodeId: node.id, nodeType: node.type })
                    : undefined
                )
              : mockToolSelectionReasoning(tool),
        },
      };

      // CA2: Route by outcome
      const routeHandle = outcome === "error" ? "error" : "success";
      const nextId = findNextNodeId(node.id, edges, routeHandle);
      const toolMsgs = [...state.messages, toolMsg];
      if (!nextId) {
        toolMsgs.push(makeErrorMessage(`El nodo "${label}" no tiene conexión de salida`, "BROKEN_EDGE", node.id, node.type, label));
      }

      // CA1: Store tool response in vars so downstream nodes can reference {{tool.field}}
      const newVars = outcome !== "error"
        ? { ...state.vars, [tool]: mockResponse.data }
        : state.vars;

      return {
        ...state,
        currentNodeId: nextId,
        messages: toolMsgs,
        vars: newVars,
        toolExecutionLogs: [...state.toolExecutionLogs, completedLog],
        status: nextId ? "running" : "completed",
      };
    }

    // ---- Handoff ----
    case "handoff": {
      const target = (d.target as string) || "equipo";
      const handoffMessage = (d.handoffMessage as string) || "";
      const msgs = [...state.messages];
      if (handoffMessage) {
        msgs.push(
          makeMessage(
            "bot",
            renderTemplate(handoffMessage, state.vars),
            node.id,
            "handoff"
          )
        );
      }
      msgs.push(
        makeMessage("system", `Transferido a: ${target}`, node.id, "handoff")
      );
      return {
        ...state,
        currentNodeId: null,
        messages: msgs,
        status: "completed",
      };
    }

    // ---- Stock Lookup ----
    case "stocklookup": {
      const searchMode = (d.searchMode as string) || "variable";
      const searchVar = (d.searchVariable as string) || "";
      const searchLit = (d.searchLiteral as string) || "";
      const query =
        searchMode === "literal"
          ? searchLit
          : searchVar
            ? String(getNestedValue(state.vars, searchVar) ?? "")
            : "";

      const allProducts = options?.products ?? [];
      const q = query.toLowerCase().trim();

      // Stopwords: common filler words that don't help product matching
      const STOPWORDS = new Set([
        "cubierta", "cubiertas", "neumatico", "neumático", "neumaticos", "neumáticos",
        "llanta", "llantas", "goma", "gomas", "rueda", "ruedas",
        "quiero", "busco", "necesito", "tenés", "tenes", "tienen", "hay",
        "dame", "mostrame", "mostrá", "alguna", "alguno", "una", "uno", "un",
        "de", "del", "la", "el", "los", "las", "para", "con", "en", "por", "que", "me",
      ]);

      // Levenshtein distance for fuzzy matching
      const levenshtein = (a: string, b: string): number => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + cost
            );
          }
        }
        return matrix[b.length][a.length];
      };

      // Check if token fuzzy-matches any word in haystack
      // Threshold: allow ~30% character errors (min 1)
      const fuzzyContains = (haystack: string, token: string): boolean => {
        if (haystack.includes(token)) return true;
        const maxDist = Math.max(1, Math.floor(token.length * 0.3));
        const words = haystack.split(/\s+/);
        return words.some((w) => levenshtein(w, token) <= maxDist);
      };

      // ── Tire dimension parsing ──
      // Recognizes patterns like: 195/55/16, 195/55 16, 195 55 16, 195/55R16, 195/55 R16, R16, etc.
      interface TireDimension {
        width?: string;   // e.g. "195"
        profile?: string; // e.g. "55"
        rim?: string;     // e.g. "16"
      }

      function parseTireDimension(input: string): TireDimension | null {
        const s = input.replace(/\s+/g, " ").trim().toLowerCase();
        // Full: 195/55/16 or 195/55 16 or 195/55R16 or 195/55 R16
        let m = s.match(/(\d{3})\s*\/\s*(\d{2,3})\s*[\/\s]*r?\s*(\d{2})/i);
        if (m) return { width: m[1], profile: m[2], rim: m[3] };
        // Space-separated: 195 55 16
        m = s.match(/^(\d{3})\s+(\d{2,3})\s+(\d{2})$/);
        if (m) return { width: m[1], profile: m[2], rim: m[3] };
        // Partial: 195/55 (no rim)
        m = s.match(/(\d{3})\s*\/\s*(\d{2,3})$/);
        if (m) return { width: m[1], profile: m[2] };
        // Just rim: R16 or r16
        m = s.match(/^r(\d{2})$/i);
        if (m) return { rim: m[1] };
        return null;
      }

      // Extract dimension from product description: "185/65 R15 88H" → { width: "185", profile: "65", rim: "15" }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function extractProductDimension(p: Record<string, any>): TireDimension | null {
        const desc = String(p.description ?? "");
        const m = desc.match(/(\d{3})\/(\d{2,3})\s*R(\d{2})/i);
        if (m) return { width: m[1], profile: m[2], rim: m[3] };
        return null;
      }

      function dimensionMatches(productDim: TireDimension | null, queryDim: TireDimension): boolean {
        if (!productDim) return false;
        if (queryDim.width && productDim.width !== queryDim.width) return false;
        if (queryDim.profile && productDim.profile !== queryDim.profile) return false;
        if (queryDim.rim && productDim.rim !== queryDim.rim) return false;
        return true;
      }

      // Try to parse a dimension from the full query
      const queryDim = parseTireDimension(q);

      // Also try to extract dimension from individual parts of the query
      // e.g. "pirelli 195/55/16" → brand token "pirelli" + dimension
      let embeddedDim: TireDimension | null = null;
      if (!queryDim) {
        // Split query and try to find dimension pattern within tokens
        const parts = q.split(/\s+/);
        for (const part of parts) {
          const pd = parseTireDimension(part);
          if (pd && !embeddedDim) {
            embeddedDim = pd;
            break;
          }
        }
        // Also try joining consecutive numeric parts: "195 55 16"
        if (!embeddedDim) {
          const joined = q.replace(/[a-záéíóúñü]+/gi, "").trim();
          const jd = parseTireDimension(joined);
          if (jd) embeddedDim = jd;
        }
      }

      const activeDim = queryDim ?? embeddedDim;

      // Tokenize query: split into meaningful words, drop stopwords
      const baseTokens = q.split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
      // If we found a dimension, remove numeric/dimension tokens so they don't interfere with text search
      const tokens = activeDim
        ? baseTokens.filter((t) => !/^\d{2,3}$/.test(t) && !/^\d{3}\//.test(t) && !/^r\d+$/i.test(t))
        : baseTokens;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getHaystack = (p: Record<string, any>) =>
        [
          String(p.name ?? ""),
          String(p.sku ?? ""),
          String(p.brand ?? ""),
          String(p.model ?? ""),
          String(p.description ?? ""),
        ].join(" ").toLowerCase();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exactMatch = (p: Record<string, any>) => {
        const haystack = getHaystack(p);
        // Check dimension match first if applicable
        if (activeDim) {
          const pDim = extractProductDimension(p);
          if (!dimensionMatches(pDim, activeDim)) return false;
          // If only dimension was provided (no text tokens), dimension match is enough
          if (tokens.length === 0) return true;
        }
        if (tokens.length === 0) return haystack.includes(q);
        return tokens.every((t) => haystack.includes(t));
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fuzzyMatch = (p: Record<string, any>) => {
        const haystack = getHaystack(p);
        if (activeDim) {
          const pDim = extractProductDimension(p);
          if (!dimensionMatches(pDim, activeDim)) return false;
          if (tokens.length === 0) return true;
        }
        if (tokens.length === 0) return false;
        return tokens.every((t) => fuzzyContains(haystack, t));
      };

      // Try exact first, fall back to fuzzy
      let matches = q ? allProducts.filter(exactMatch) : [];
      if (matches.length === 0 && q) {
        matches = allProducts.filter(fuzzyMatch);
      }

      // ── Multiple matches → pause and let user pick ──
      if (matches.length > 1 && !userInput && state.status !== "waiting_input") {
        const optionsList = matches.map((p) => ({
          label: `${p.name} — $${Number(p.price).toLocaleString("es-AR")}`,
          value: String(p.id),
        }));
        return {
          ...state,
          messages: [
            ...state.messages,
            makeMessage(
              "bot",
              `Encontré ${matches.length} productos para "${query}". ¿Cuál te interesa?`,
              node.id,
              "stocklookup"
            ),
          ],
          status: "waiting_input",
          waitingForInput: {
            nodeId: node.id,
            responseType: "interactive",
            variable: "",
            interactiveType: matches.length <= 3 ? "buttons" : "list",
            options: optionsList,
          },
        };
      }

      // ── Resolve final match ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let match: Record<string, any> | undefined;
      if (userInput && state.status === "waiting_input") {
        // User picked from disambiguation list
        match = allProducts.find((p) => String(p.id) === userInput);
        // If not found by id, try matching by name (user may have typed text)
        if (!match) {
          const ui = userInput.toLowerCase();
          match = allProducts.find((p) =>
            String(p.name ?? "").toLowerCase().includes(ui) ||
            String(p.sku ?? "").toLowerCase().includes(ui)
          );
        }
      } else {
        match = matches[0];
      }

      const newVars = { ...state.vars };
      if (match) {
        // Always populate `product.*` so message templates like {{product.name}} work
        const discountIds = (match.discountIds as string[]) ?? [];
        const allDiscounts = (() => {
          try { return JSON.parse(localStorage.getItem("freia_discounts") ?? "[]"); } catch { return []; }
        })() as Array<{ id: string; name: string; percentage: number }>;
        const appliedDiscounts = allDiscounts.filter((dd) => discountIds.includes(dd.id));
        const discountText = appliedDiscounts.length > 0
          ? appliedDiscounts.map((dd) => `🏷️ ${dd.name} (-${dd.percentage}%)`).join("\n")
          : "";

        newVars["product"] = {
          id: match.id ?? "",
          name: match.name ?? "",
          sku: match.sku ?? "",
          brand: match.brand ?? "",
          model: match.model ?? "",
          price: Number(match.price ?? 0).toLocaleString("es-AR"),
          stock: match.stock ?? 0,
          description: match.description ?? "",
          discounts: discountText,
        };

        // Also populate explicit save-variable mappings from node config
        const saves: Record<string, string> = {
          saveProductId: "id",
          saveProductName: "name",
          saveVariantId: "variant_id",
          savePrice: "price",
          saveFinalPrice: "final_price",
          saveDiscounts: "discounts",
        };
        for (const [dataKey, prodField] of Object.entries(saves)) {
          const varName = d[dataKey] as string;
          if (varName) {
            newVars[varName] = match[prodField] ?? "";
          }
        }
      }

      const handle = match ? "found" : "not_found";
      const nextId = findNextNodeId(node.id, edges, handle);

      return {
        ...state,
        currentNodeId: nextId,
        vars: newVars,
        waitingForInput: undefined,
        messages: [
          ...state.messages,
          makeMessage(
            "system",
            match
              ? `🔍 Producto encontrado: ${match.name ?? query}`
              : `🔍 Producto no encontrado: "${query}"`,
            node.id,
            "stocklookup"
          ),
        ],
        status: nextId ? "running" : "completed",
      };
    }

    // ---- End ----
    case "end": {
      const outcome = (d.outcome as string) || "resolved";
      return {
        ...state,
        currentNodeId: null,
        messages: [
          ...state.messages,
          makeMessage(
            "system",
            `Flujo finalizado (${outcome})`,
            node.id,
            "end"
          ),
        ],
        status: "completed",
      };
    }

    default: {
      const nextId = findNextNodeId(node.id, edges);
      return {
        ...state,
        currentNodeId: nextId,
        messages: [
          ...state.messages,
          makeErrorMessage(`Tipo de nodo desconocido: ${node.type}`, "UNKNOWN_NODE_TYPE", node.id, node.type, label),
        ],
        status: nextId ? "running" : "completed",
      };
    }
  }
}
