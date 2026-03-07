// Risk score computation module — pure functions, no React dependency.
// Computes a dynamic risk score from simulation messages.

import type { SimulationMessage } from "./flow-simulator";
import type { Policy } from "@/types/policy";
import { resolveEnforcementActions } from "@/types/policy";

// --- Breakdown ---

export interface RiskScoreBreakdown {
  policyViolations: number;
  authorityViolations: number;
  escalationTriggers: number;
  inputClassifications: number;
  lowConfidenceIntents: number;
  simulationErrors: number;
  total: number;
}

const WEIGHTS = {
  policyViolation: 20,
  authorityViolation: 25,
  escalationTrigger: 15,
  inputClassification: 18,
  lowConfidenceIntent: 8,
  simulationError: 10,
} as const;

export function computeRiskScore(messages: SimulationMessage[]): RiskScoreBreakdown {
  let policyViolations = 0;
  let authorityViolations = 0;
  let escalationTriggers = 0;
  let inputClassifications = 0;
  let lowConfidenceIntents = 0;
  let simulationErrors = 0;

  for (const msg of messages) {
    switch (msg.type) {
      case "policy_violation":
        policyViolations++;
        break;
      case "authority_violation":
        authorityViolations++;
        break;
      case "escalation_trigger":
        escalationTriggers++;
        break;
      case "input_classification":
        inputClassifications++;
        break;
      case "error":
        simulationErrors++;
        break;
      case "ai_reasoning":
        if (msg.aiReasoning?.intent && msg.aiReasoning.intent.confidence < 0.5) {
          lowConfidenceIntents++;
        }
        break;
    }
  }

  const total = Math.min(
    100,
    policyViolations * WEIGHTS.policyViolation +
      authorityViolations * WEIGHTS.authorityViolation +
      escalationTriggers * WEIGHTS.escalationTrigger +
      inputClassifications * WEIGHTS.inputClassification +
      lowConfidenceIntents * WEIGHTS.lowConfidenceIntent +
      simulationErrors * WEIGHTS.simulationError
  );

  return {
    policyViolations,
    authorityViolations,
    escalationTriggers,
    inputClassifications,
    lowConfidenceIntents,
    simulationErrors,
    total,
  };
}

// --- Risk level ---

export type RiskLevel = "low" | "medium" | "high";

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 33) return "low";
  if (score <= 66) return "medium";
  return "high";
}

export const RISK_LEVEL_COLORS: Record<RiskLevel, { text: string; bg: string }> = {
  low: { text: "text-emerald-400", bg: "bg-emerald-500/20" },
  medium: { text: "text-amber-400", bg: "bg-amber-500/20" },
  high: { text: "text-red-400", bg: "bg-red-500/20" },
};

// --- Threshold check ---

export interface RiskThresholdBreach {
  policyId: string;
  policyName: string;
  threshold: number;
  currentScore: number;
  action: "warn" | "escalate";
}

export function checkRiskThresholds(
  score: number,
  policies: Policy[],
  alreadyBreachedIds: Set<string>
): RiskThresholdBreach | null {
  for (const policy of policies) {
    if (!policy.active) continue;
    if ((policy.riskScoreThreshold ?? 0) <= 0) continue;
    if (alreadyBreachedIds.has(policy.id)) continue;
    if (score >= policy.riskScoreThreshold) {
      return {
        policyId: policy.id,
        policyName: policy.name,
        threshold: policy.riskScoreThreshold,
        currentScore: score,
        action: resolveEnforcementActions(policy.enforcementMode).riskScoreAction,
      };
    }
  }
  return null;
}
