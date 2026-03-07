// Audit log types — policy violation records, agent status changes, and tool execution history.

import type { AgentStatus } from "@/types/agent";
import type { ToolCategory } from "@/types/tool-registry";
import type { FrontPublishAction } from "@/types/front";

export type AuditViolationType =
  | "policy_violation"
  | "authority_violation"
  | "escalation_trigger"
  | "risk_threshold"
  | "input_classification";

// --- Entry variants ---

interface AuditLogEntryBase {
  id: string;
  timestamp: string;
  flowId: string;
  flowName: string;
  simulationSource: string;
}

export interface PolicyViolationEntry extends AuditLogEntryBase {
  type: "policy_violation";
  policyName: string;
  action: string;
  detail: {
    keyword: string;
    originalContent: string;
  };
}

export interface AuthorityViolationEntry extends AuditLogEntryBase {
  type: "authority_violation";
  policyName: string;
  action: string;
  detail: {
    ruleName: string;
    ruleType: "forbidden" | "limit";
    toolName: string;
    paramName?: string;
    maxValue?: number;
    actualValue?: number;
  };
}

export interface EscalationTriggerEntry extends AuditLogEntryBase {
  type: "escalation_trigger";
  policyName: string;
  action: string;
  detail: {
    triggerType: "keyword" | "intent" | "confidence";
    triggerDescription: string;
    detectedIntent?: string;
    confidence?: number;
  };
}

export interface RiskThresholdEntry extends AuditLogEntryBase {
  type: "risk_threshold";
  policyName: string;
  action: string;
  detail: {
    threshold: number;
    currentScore: number;
  };
}

export interface InputClassificationEntry extends AuditLogEntryBase {
  type: "input_classification";
  policyName: string;
  action: string;
  detail: {
    category?: string;
    keyword: string;
  };
}

/** Audit record for every agent status transition performed by an admin. */
export interface AgentStatusChangeEntry {
  id: string;
  timestamp: string;
  type: "agent_status_change";
  agentId: string;
  agentName: string;
  previousStatus: AgentStatus;
  newStatus: AgentStatus;
}

/** Audit record for front publish / unpublish actions. */
export interface FrontPublishEntry {
  id: string;
  timestamp: string;
  type: FrontPublishAction;
  frontId: string;
  frontName: string;
  subdomain: string;
  version: number;
  performedBy: string;
}

export type AuditLogEntry =
  | PolicyViolationEntry
  | AuthorityViolationEntry
  | EscalationTriggerEntry
  | RiskThresholdEntry
  | InputClassificationEntry
  | AgentStatusChangeEntry
  | FrontPublishEntry;

// --- Constants ---

export const VIOLATION_TYPE_LABELS: Record<AuditViolationType, string> = {
  policy_violation: "Violación de respuesta",
  authority_violation: "Violación de autoridad",
  escalation_trigger: "Trigger de escalamiento",
  risk_threshold: "Umbral de riesgo",
  input_classification: "Clasificación de entrada",
};

export const VIOLATION_TYPE_CONFIG: Record<
  AuditViolationType,
  { colorClass: string; bgClass: string; borderClass: string }
> = {
  policy_violation: {
    colorClass: "text-amber-400",
    bgClass: "bg-amber-900/20",
    borderClass: "border-amber-800/50",
  },
  authority_violation: {
    colorClass: "text-violet-400",
    bgClass: "bg-violet-900/20",
    borderClass: "border-violet-800/50",
  },
  escalation_trigger: {
    colorClass: "text-rose-400",
    bgClass: "bg-rose-900/20",
    borderClass: "border-rose-800/50",
  },
  risk_threshold: {
    colorClass: "text-cyan-400",
    bgClass: "bg-cyan-900/20",
    borderClass: "border-cyan-800/50",
  },
  input_classification: {
    colorClass: "text-orange-400",
    bgClass: "bg-orange-900/20",
    borderClass: "border-orange-800/50",
  },
};

// --- Tool execution history ---

export type ToolExecutionResult = "success" | "error";

export interface ToolExecutionEntry {
  id: string;
  timestamp: string;
  toolId: string;
  toolName: string;
  toolCategory: ToolCategory;
  flowId: string;
  flowName: string;
  simulationSource: string;
  nodeId: string;
  userId: string;
  userName: string;
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  result: ToolExecutionResult;
}

export const TOOL_EXECUTION_RESULT_CONFIG: Record<
  ToolExecutionResult,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  success: {
    label: "Exitoso",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-900/20",
    borderClass: "border-emerald-800/50",
  },
  error: {
    label: "Error",
    colorClass: "text-red-400",
    bgClass: "bg-red-900/20",
    borderClass: "border-red-800/50",
  },
};
