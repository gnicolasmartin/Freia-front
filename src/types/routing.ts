/**
 * routing.ts
 *
 * Types for the WhatsApp message routing system.
 * Rules are evaluated in priority order (ascending); first match wins.
 * All conditions within a rule are evaluated with AND logic.
 */

// ─── Condition types ──────────────────────────────────────────────────────────

/** What aspect of the inbound message to match against. */
export type RoutingConditionType =
  | "phone_number_id" // matches the receiving phoneNumberId
  | "keyword"         // matches message text (starts_with / contains / equals)
  | "template_name"   // matches the name of a template the user replied to
  | "business_hours"; // evaluates current time against business hours config

/** How to compare the condition value against the actual message field. */
export type RoutingOperator =
  | "equals"
  | "contains"
  | "starts_with"
  | "is_open"   // business_hours: matches when currently open
  | "is_closed"; // business_hours: matches when currently closed

export interface RoutingCondition {
  id: string;
  type: RoutingConditionType;
  operator: RoutingOperator;
  /** The value to match against. Empty string for is_open / is_closed. */
  value: string;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  /**
   * Evaluation order — lower number = higher priority.
   * First matching enabled rule wins.
   */
  priority: number;
  /** All conditions must match (AND logic). */
  conditions: RoutingCondition[];
  /** ID of the target Agent. The flow is derived from agent.flowId. */
  agentId: string;
  updatedAt: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface RoutingConfig {
  rules: RoutingRule[];
  /** Fallback agent ID when no rule matches. Empty string = no fallback. */
  defaultAgentId: string;
  updatedAt: string;
}

// ─── Decision ────────────────────────────────────────────────────────────────

export type RoutingReasonCode =
  | "phone_number_match"
  | "keyword_match"
  | "template_match"
  | "business_hours_match"
  /** More than one condition type contributed to the match. */
  | "multi_condition_match"
  | "default_fallback"
  | "no_agents_configured";

export interface RoutingDecision {
  agentId: string | null;
  flowId: string | null;
  agentName?: string;
  /** ID of the matched rule. Undefined when using the default fallback. */
  ruleId?: string;
  ruleName?: string;
  reasonCode: RoutingReasonCode;
  matchedConditions?: Array<{
    type: string;
    operator: string;
    value: string;
  }>;
  timestamp: string;
}

// ─── Inbound context ─────────────────────────────────────────────────────────

/**
 * Minimal representation of an inbound message used by the routing engine.
 * Derived from MessageReceivedEvent (src/types/webhook-event.ts).
 */
export interface InboundMessageContext {
  /** Sender phone number in E.164 format. */
  from: string;
  /** The phone_number_id of the receiving WhatsApp number. */
  phoneNumberId: string;
  /** Normalised plain-text body of the message. */
  text: string;
  /** Template name if this message is a reply to an outbound template. */
  templateName?: string;
}
