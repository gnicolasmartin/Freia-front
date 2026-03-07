// Input classifier — pre-engine content moderation.
// Pure function, no React dependency.

import type { Policy } from "@/types/policy";
import { INPUT_CLASSIFICATION_CATEGORIES, getEffectiveClassificationKeywords, resolveEnforcementActions } from "@/types/policy";
import type { InputClassificationDetail } from "./flow-simulator";

export function classifyInput(
  input: string,
  policies: Policy[]
): InputClassificationDetail | null {
  const inputLower = input.toLowerCase();

  for (const policy of policies) {
    if (!policy.active) continue;
    const keywords = getEffectiveClassificationKeywords(policy);
    for (const kw of keywords) {
      if (inputLower.includes(kw.toLowerCase())) {
        const matchedCategory = (policy.inputClassificationCategories ?? []).find(cat => {
          const catDef = INPUT_CLASSIFICATION_CATEGORIES.find(c => c.value === cat);
          return catDef?.keywords.some(k => inputLower.includes(k.toLowerCase()));
        });
        return {
          policyName: policy.name,
          category: matchedCategory,
          keyword: kw,
          action: resolveEnforcementActions(policy.enforcementMode).inputClassificationAction,
        };
      }
    }
  }
  return null;
}
