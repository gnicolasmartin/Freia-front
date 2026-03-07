"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Policy, PolicyFormData, PolicyVersion } from "@/types/policy";

interface PoliciesContextType {
  policies: Policy[];
  isLoading: boolean;
  createPolicy: (data: PolicyFormData) => Policy;
  updatePolicy: (id: string, data: Partial<PolicyFormData>) => Policy | null;
  deletePolicy: (id: string) => boolean;
  getPolicy: (id: string) => Policy | undefined;
}

const PoliciesContext = createContext<PoliciesContextType | undefined>(
  undefined
);

const STORAGE_KEY = "freia_policies";

export function PoliciesProvider({ children }: { children: ReactNode }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Policy[];
        const migrated = parsed.map((p) => {
          let policy = p;
          if (!policy.enforcementMode) {
            const isFlexible =
              policy.responseViolationAction === "reformulate" ||
              policy.escalationTriggerAction === "flag" ||
              policy.riskScoreAction === "warn";
            policy = { ...policy, enforcementMode: isFlexible ? "flexible" as const : "strict" as const };
          }
          if (!policy.channelIds) {
            policy = { ...policy, channelIds: [] };
          }
          if (!policy.inputClassificationCategories) {
            policy = { ...policy, inputClassificationCategories: [], inputClassificationKeywords: [], inputClassificationAction: "escalate" as const };
          }
          return policy;
        });
        setPolicies(migrated);
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
    }
  }, [policies, isLoading]);

  const createPolicy = (data: PolicyFormData): Policy => {
    const now = new Date().toISOString();
    const newPolicy: Policy = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    setPolicies((prev) => [...prev, newPolicy]);
    return newPolicy;
  };

  const updatePolicy = (
    id: string,
    data: Partial<PolicyFormData>
  ): Policy | null => {
    let updated: Policy | null = null;
    setPolicies((prev) =>
      prev.map((policy) => {
        if (policy.id === id) {
          // Create version snapshot of current state before updating
          const existingVersions = policy.versions ?? [];
          const nextVersion =
            existingVersions.length > 0
              ? Math.max(...existingVersions.map((v) => v.version)) + 1
              : 1;

          const versionSnapshot: PolicyVersion = {
            id: crypto.randomUUID(),
            policyId: id,
            version: nextVersion,
            name: policy.name,
            description: policy.description,
            scope: policy.scope,
            channelIds: [...(policy.channelIds ?? [])],
            active: policy.active,
            enforcementMode: policy.enforcementMode ?? "strict",
            forbiddenCategories: policy.forbiddenCategories ?? [],
            forbiddenKeywords: policy.forbiddenKeywords ?? [],
            forbiddenResponseCategories: policy.forbiddenResponseCategories ?? [],
            forbiddenResponseKeywords: policy.forbiddenResponseKeywords ?? [],
            responseViolationAction: policy.responseViolationAction ?? "block",
            authorityRules: policy.authorityRules ?? [],
            authorityViolationAction: policy.authorityViolationAction ?? "block",
            escalationTriggerCategories: policy.escalationTriggerCategories ?? [],
            escalationTriggerKeywords: policy.escalationTriggerKeywords ?? [],
            escalationTriggerRules: policy.escalationTriggerRules ?? [],
            escalationTriggerAction: policy.escalationTriggerAction ?? "escalate",
            riskScoreThreshold: policy.riskScoreThreshold ?? 0,
            riskScoreAction: policy.riskScoreAction ?? "warn",
            inputClassificationCategories: policy.inputClassificationCategories ?? [],
            inputClassificationKeywords: policy.inputClassificationKeywords ?? [],
            inputClassificationAction: policy.inputClassificationAction ?? "escalate",
            publishedAt: new Date().toISOString(),
          };

          updated = {
            ...policy,
            ...data,
            updatedAt: new Date().toISOString(),
            versions: [...existingVersions, versionSnapshot],
          };
          return updated;
        }
        return policy;
      })
    );
    return updated;
  };

  const deletePolicy = (id: string): boolean => {
    const exists = policies.some((p) => p.id === id);
    if (!exists) return false;
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    return true;
  };

  const getPolicy = (id: string) => policies.find((p) => p.id === id);

  return (
    <PoliciesContext.Provider
      value={{
        policies,
        isLoading,
        createPolicy,
        updatePolicy,
        deletePolicy,
        getPolicy,
      }}
    >
      {children}
    </PoliciesContext.Provider>
  );
}

export function usePolicies() {
  const context = useContext(PoliciesContext);
  if (context === undefined) {
    throw new Error("usePolicies debe ser usado dentro de PoliciesProvider");
  }
  return context;
}
