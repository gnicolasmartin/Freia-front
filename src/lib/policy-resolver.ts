// Policy resolution for agents — pure function, no React dependency.
// Resolves applicable policies for a given agent from all tenant policies.
//
// Priority hierarchy:
//   1. Global policies  (always applied to every agent)
//   2. Flow-scoped policies  (associated with the agent's flow)
//   3. Channel-scoped policies  (matching the agent's channelScope)
//
// All three layers are merged and deduplicated. Inactive policies are excluded.

import type { Policy } from "@/types/policy";
import type { Agent } from "@/types/agent";
import type { Flow } from "@/types/flow";

export interface PolicyResolution {
  /** Merged, deduplicated, active-only policies applicable to this agent */
  policies: Policy[];
  /** Counts by source layer for debugging / UI display */
  globalCount: number;
  flowCount: number;
  channelCount: number;
}

/**
 * Resolve which policies apply to an agent.
 *
 * @param agent       The agent whose policies are being resolved
 * @param allPolicies Full list of tenant policies (from PoliciesProvider)
 * @param flows       Full list of flows (from FlowsProvider) — used to look up flow.policyIds
 */
export function resolveAgentPolicies(
  agent: Agent,
  allPolicies: Policy[],
  flows: Flow[]
): PolicyResolution {
  const activePolicies = allPolicies.filter((p) => p.active);

  // 1. Global — always applied
  const globalPolicies = activePolicies.filter((p) => p.scope === "global");

  // 2. Flow-scoped — from the policyIds declared on the agent's flow
  const agentFlow = flows.find((f) => f.id === agent.flowId);
  const flowPolicyIds = agentFlow?.policyIds ?? [];
  const flowPolicies = activePolicies.filter(
    (p) => p.scope === "flow" && flowPolicyIds.includes(p.id)
  );

  // 3. Channel-scoped — matching agent.channelScope
  const channelPolicies = activePolicies.filter(
    (p) =>
      p.scope === "channel" &&
      (p.channelIds ?? []).includes(agent.channelScope)
  );

  // Merge with deduplication (first occurrence wins, preserving global → flow → channel order)
  const seen = new Set<string>();
  const policies: Policy[] = [];

  for (const p of [...globalPolicies, ...flowPolicies, ...channelPolicies]) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      policies.push(p);
    }
  }

  return {
    policies,
    globalCount: globalPolicies.length,
    flowCount: flowPolicies.length,
    channelCount: channelPolicies.length,
  };
}

/**
 * Split resolved policies into the specialist buckets expected by SimulationOptions.
 * Use after calling resolveAgentPolicies().
 */
export function splitPoliciesByRole(policies: Policy[]): {
  responsePolicies: Policy[];
  authorityPolicies: Policy[];
  escalationPolicies: Policy[];
  inputClassificationPolicies: Policy[];
} {
  return {
    responsePolicies: policies.filter(
      (p) =>
        (p.forbiddenResponseCategories?.length ?? 0) > 0 ||
        (p.forbiddenResponseKeywords?.length ?? 0) > 0
    ),
    authorityPolicies: policies.filter(
      (p) => (p.authorityRules?.length ?? 0) > 0
    ),
    escalationPolicies: policies.filter(
      (p) =>
        (p.escalationTriggerCategories?.length ?? 0) > 0 ||
        (p.escalationTriggerKeywords?.length ?? 0) > 0 ||
        (p.escalationTriggerRules?.length ?? 0) > 0
    ),
    inputClassificationPolicies: policies.filter(
      (p) =>
        (p.inputClassificationCategories?.length ?? 0) > 0 ||
        (p.inputClassificationKeywords?.length ?? 0) > 0
    ),
  };
}
