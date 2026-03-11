"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useRouting } from "@/providers/RoutingProvider";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { useProducts } from "@/providers/ProductsProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import {
  syncConfigToBackend,
  resetSyncHash,
  type ProcessingConfigBlob,
} from "@/lib/config-sync";
import { getBusinessHoursConfig } from "@/lib/business-hours";
import { getSessionCompanyId } from "@/lib/get-session-company";

const DEBOUNCE_MS = 5_000;

export function ConfigSyncProvider({ children }: { children: ReactNode }) {
  const { agents } = useAgents();
  const { flows } = useFlows();
  const { config: routingConfig } = useRouting();
  const { policies } = usePolicies();
  const { tools } = useToolRegistry();
  const { products, variantTypes, discounts } = useProducts();
  const { getRawKey } = useLLMConfig();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCompanyRef = useRef<string | undefined>(undefined);

  const doSync = useCallback(async () => {
    const companyId = getSessionCompanyId();
    if (!companyId) return;

    // Reset hash if company changed
    if (companyId !== lastCompanyRef.current) {
      resetSyncHash();
      lastCompanyRef.current = companyId;
    }

    const blob: ProcessingConfigBlob = {
      agents,
      flows,
      policies,
      tools,
      products,
      variantTypes,
      discounts,
      routingConfig,
      businessHoursConfig: getBusinessHoursConfig(),
      openaiApiKey: getRawKey("openai") ?? undefined,
    };

    const result = await syncConfigToBackend(companyId, blob);
    if (result.synced) {
      console.info("[ConfigSync] Synced processing config to backend");
    } else if (result.error) {
      console.warn("[ConfigSync] Sync failed:", result.error);
    }
  }, [agents, flows, routingConfig, policies, tools, products, variantTypes, discounts, getRawKey]);

  // Debounced sync on any config change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doSync();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doSync]);

  // Immediate sync on mount
  useEffect(() => {
    doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
