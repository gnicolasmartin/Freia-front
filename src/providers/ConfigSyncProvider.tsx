"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useRouting } from "@/providers/RoutingProvider";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { useProducts } from "@/providers/ProductsProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import { useChannels } from "@/providers/ChannelsProvider";
import { useCalendars } from "@/providers/CalendarsProvider";
import {
  syncConfigToBackend,
  resetSyncHash,
  fetchServerBookings,
  type ProcessingConfigBlob,
} from "@/lib/config-sync";
import { getBusinessHoursConfig } from "@/lib/business-hours";
import { getSessionCompanyId } from "@/lib/get-session-company";
import type { Booking } from "@/types/calendar";

const DEBOUNCE_MS = 5_000;
const REVERSE_SYNC_MS = 30_000; // Poll server bookings every 30s

export function ConfigSyncProvider({ children }: { children: ReactNode }) {
  const { agents } = useAgents();
  const { flows } = useFlows();
  const { config: routingConfig } = useRouting();
  const { policies } = usePolicies();
  const { tools } = useToolRegistry();
  const { products, variantTypes, discounts } = useProducts();
  const { getRawKey } = useLLMConfig();
  const { getChannelConfig } = useChannels();
  const { calendars, resources, bookings, blockedPeriods, minStayRules, mergeServerBookings } = useCalendars();

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

    // Include WA credentials for server-side sending (multi-tenant)
    const waConfig = getChannelConfig("whatsapp");
    const waCredentials =
      waConfig?.connectionStatus === "connected" &&
      waConfig.metadata?.phone_number_id &&
      waConfig.metadata?.access_token
        ? {
            phoneNumberId: waConfig.metadata.phone_number_id,
            accessToken: waConfig.metadata.access_token,
          }
        : undefined;

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
      waCredentials,
      calendarData: calendars.length > 0
        ? { calendars, resources, bookings, blocks: blockedPeriods, minStayRules }
        : undefined,
    };

    const result = await syncConfigToBackend(companyId, blob);
    if (result.synced) {
      console.info("[ConfigSync] Synced processing config to backend");

      // Also sync companyId to channel_configs so webhook routing resolves correctly
      if (waCredentials?.phoneNumberId) {
        try {
          await fetch("/api/channels/sync-company", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: "whatsapp",
              phoneNumberId: waCredentials.phoneNumberId,
              companyId,
            }),
          });
        } catch {
          // Non-critical — config blob is the primary sync
        }
      }
    } else if (result.error) {
      console.warn("[ConfigSync] Sync failed:", result.error);
    }
  }, [agents, flows, routingConfig, policies, tools, products, variantTypes, discounts, getRawKey, getChannelConfig, calendars, resources, bookings, blockedPeriods, minStayRules]);

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

  // Reverse sync: poll server for bookings created via WhatsApp flows
  useEffect(() => {
    const poll = async () => {
      const companyId = getSessionCompanyId();
      if (!companyId) return;
      const { bookings: serverBookings, error } = await fetchServerBookings(companyId);
      if (error) return;
      if (serverBookings.length > 0) {
        mergeServerBookings(serverBookings as Booking[]);
      }
    };

    const interval = setInterval(poll, REVERSE_SYNC_MS);
    // First poll after a short delay (let initial sync complete first)
    const initialTimeout = setTimeout(poll, 10_000);
    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [mergeServerBookings]);

  return <>{children}</>;
}
