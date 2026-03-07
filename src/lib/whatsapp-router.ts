/**
 * whatsapp-router.ts
 *
 * Pure, side-effect-free routing engine for inbound WhatsApp messages.
 * No React, no side effects — safe to call from any context including backend.
 *
 * localStorage key: "freia_wa_routing"
 */

import type { Agent } from "@/types/agent";
import type { BusinessHoursConfig } from "@/types/business-hours";
import type {
  RoutingCondition,
  RoutingConditionType,
  RoutingConfig,
  RoutingDecision,
  RoutingReasonCode,
  RoutingRule,
  InboundMessageContext,
} from "@/types/routing";
import { isCurrentlyBusinessHours } from "./business-hours";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "freia_wa_routing";

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  rules: [],
  defaultAgentId: "",
  updatedAt: new Date().toISOString(),
};

/** Human-readable labels for the UI. */
export const CONDITION_TYPE_LABELS: Record<RoutingConditionType, string> = {
  phone_number_id: "Phone Number ID",
  keyword:         "Palabra clave",
  template_name:   "Nombre de template",
  business_hours:  "Horario de atención",
};

export const OPERATOR_LABELS: Record<string, string> = {
  equals:      "es igual a",
  contains:    "contiene",
  starts_with: "empieza con",
  is_open:     "está abierto",
  is_closed:   "está cerrado",
};

/** Operators valid for text-based condition types. */
export const TEXT_OPERATORS = ["equals", "contains", "starts_with"] as const;

/** Operators valid for business_hours condition type. */
export const HOURS_OPERATORS = ["is_open", "is_closed"] as const;

// ─── localStorage helpers ──────────────────────────────────────────────────────

export function getRoutingConfig(): RoutingConfig {
  if (typeof window === "undefined") return DEFAULT_ROUTING_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROUTING_CONFIG;
    const parsed = JSON.parse(raw) as Partial<RoutingConfig>;
    return {
      ...DEFAULT_ROUTING_CONFIG,
      ...parsed,
      rules: parsed.rules ?? [],
    };
  } catch {
    return DEFAULT_ROUTING_CONFIG;
  }
}

export function saveRoutingConfig(config: RoutingConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ─── Matching helpers ──────────────────────────────────────────────────────────

function matchText(
  actual: string,
  operator: string,
  expected: string
): boolean {
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  switch (operator) {
    case "equals":
      return a === e;
    case "contains":
      return a.includes(e);
    case "starts_with":
      return a.startsWith(e);
    default:
      return false;
  }
}

function matchesCondition(
  cond: RoutingCondition,
  msg: InboundMessageContext,
  bhConfig?: BusinessHoursConfig
): boolean {
  switch (cond.type) {
    case "phone_number_id":
      return matchText(msg.phoneNumberId, cond.operator, cond.value);

    case "keyword":
      return matchText(msg.text, cond.operator, cond.value);

    case "template_name":
      return matchText(msg.templateName ?? "", cond.operator, cond.value);

    case "business_hours": {
      const isOpen = isCurrentlyBusinessHours(bhConfig);
      return cond.operator === "is_open" ? isOpen : !isOpen;
    }

    default:
      return false;
  }
}

function allConditionsMatch(
  conditions: RoutingCondition[],
  msg: InboundMessageContext,
  bhConfig?: BusinessHoursConfig
): boolean {
  if (conditions.length === 0) return false; // empty rule never matches
  return conditions.every((c) => matchesCondition(c, msg, bhConfig));
}

/**
 * Derive a reason code from the set of matched conditions.
 * When a rule has conditions of multiple types, returns "multi_condition_match".
 */
function deriveReasonCode(conditions: RoutingCondition[]): RoutingReasonCode {
  const types = new Set(conditions.map((c) => c.type));

  if (types.size > 1) return "multi_condition_match";

  const [type] = types;
  switch (type) {
    case "phone_number_id":
      return "phone_number_match";
    case "keyword":
      return "keyword_match";
    case "template_name":
      return "template_match";
    case "business_hours":
      return "business_hours_match";
    default:
      return "multi_condition_match";
  }
}

// ─── Routing engine ───────────────────────────────────────────────────────────

/**
 * Evaluate routing rules and return the RoutingDecision for an inbound message.
 *
 * Algorithm:
 *  1. Filter to enabled rules, sort by ascending priority.
 *  2. Return the first rule whose every condition matches.
 *  3. If no rule matches, use defaultAgentId.
 *  4. If no defaultAgentId, return reasonCode = "no_agents_configured".
 */
export function resolveRoute(
  msg: InboundMessageContext,
  config: RoutingConfig,
  agents: Agent[],
  bhConfig?: BusinessHoursConfig
): RoutingDecision {
  const activeRules: RoutingRule[] = [...config.rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    if (allConditionsMatch(rule.conditions, msg, bhConfig)) {
      const agent = agents.find((a) => a.id === rule.agentId);
      return {
        agentId: rule.agentId,
        flowId: agent?.flowId ?? null,
        agentName: agent?.name,
        ruleId: rule.id,
        ruleName: rule.name,
        reasonCode: deriveReasonCode(rule.conditions),
        matchedConditions: rule.conditions.map((c) => ({
          type: c.type,
          operator: c.operator,
          value: c.value,
        })),
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Default fallback
  if (config.defaultAgentId) {
    const agent = agents.find((a) => a.id === config.defaultAgentId);
    return {
      agentId: config.defaultAgentId,
      flowId: agent?.flowId ?? null,
      agentName: agent?.name,
      reasonCode: "default_fallback",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    agentId: null,
    flowId: null,
    reasonCode: "no_agents_configured",
    timestamp: new Date().toISOString(),
  };
}
