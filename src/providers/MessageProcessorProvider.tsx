"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { MessageReceivedEvent } from "@/types/webhook-event";
import type { ConversationState } from "@/types/flow";
import type { ActiveConversation, ProcessMessageResult } from "@/lib/message-processor";
import { processInboundMessage } from "@/lib/message-processor";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useRouting } from "@/providers/RoutingProvider";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import { useChannels } from "@/providers/ChannelsProvider";
import { useProducts } from "@/providers/ProductsProvider";
import { useConversations } from "@/providers/ConversationsProvider";

// ─── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3_000;
const CONVERSATIONS_STORAGE_KEY = "freia_wa_conversations";
const STALE_CONVERSATION_MS = 24 * 60 * 60 * 1000; // 24h
const PROCESSING_LOCK_TIMEOUT_MS = 60_000; // Force-reset lock after 60s

// Dedup: prevent processing the same WhatsApp message twice
const processedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 200;

// ─── Context ─────────────────────────────────────────────────────────────────

interface MessageProcessorContextType {
  /** Whether the processor is currently polling and processing messages. */
  isActive: boolean;
  /** Number of messages successfully processed since page load. */
  processedCount: number;
  /** Active conversations indexed by contact phone. */
  activeConversations: Map<string, ActiveConversation>;
  /** Recent errors. */
  errors: string[];
}

const MessageProcessorContext = createContext<
  MessageProcessorContextType | undefined
>(undefined);

// ─── Persistence helpers ─────────────────────────────────────────────────────

function loadConversations(): Map<string, ActiveConversation> {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [string, ActiveConversation][];
    const map = new Map(entries);
    // Expire stale conversations
    const now = Date.now();
    for (const [phone, conv] of map) {
      if (now - new Date(conv.lastActivityAt).getTime() > STALE_CONVERSATION_MS) {
        map.delete(phone);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveConversations(map: Map<string, ActiveConversation>): void {
  try {
    localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(Array.from(map.entries()))
    );
  } catch {
    // localStorage full — ignore
  }
}

// ─── Conversation sync helper ─────────────────────────────────────────────────

/** Deterministic conversation ID based on contact phone + flow, so we upsert the same record. */
function waConversationId(contactPhone: string, flowId: string): string {
  return `wa_${contactPhone}_${flowId}`;
}

function buildConversationRecord(
  event: MessageReceivedEvent,
  result: ProcessMessageResult,
  activeConv: ActiveConversation | undefined
): ConversationState {
  const id = waConversationId(event.from, result.flowId!);
  const now = new Date().toISOString();

  const simState = activeConv?.simulationState;
  const status: ConversationState["status"] = result.conversationEnded
    ? "completed"
    : "active";

  return {
    id,
    flowId: result.flowId!,
    versionId: "", // WhatsApp conversations don't pin a specific version
    agentId: result.agentId,
    currentNodeId: simState?.currentNodeId ?? "",
    vars: {
      ...(simState?.vars ?? {}),
      "contact.phone": event.from,
      "contact.name": event.contactName ?? "",
      "channel": "whatsapp",
    },
    varTimestamps: {},
    status,
    startedAt: activeConv?.startedAt ?? now,
    lastActivityAt: now,
    retryCount: {},
    toolExecutionLogs: simState?.toolExecutionLogs ?? [],
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function MessageProcessorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { agents } = useAgents();
  const { flows } = useFlows();
  const { config: routingConfig } = useRouting();
  const { policies } = usePolicies();
  const { tools } = useToolRegistry();
  const { getRawKey } = useLLMConfig();
  const { getChannelConfig } = useChannels();
  const { products } = useProducts();
  const { upsertConversation, endConversation: endConvRecord } = useConversations();

  // Stable refs for conversation sync (avoid re-creating pollAndProcess)
  const upsertConversationRef = useRef(upsertConversation);
  upsertConversationRef.current = upsertConversation;
  const endConvRecordRef = useRef(endConvRecord);
  endConvRecordRef.current = endConvRecord;

  const [processedCount, setProcessedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const conversationsRef = useRef<Map<string, ActiveConversation>>(
    loadConversations()
  );
  // Trigger re-render when conversations change
  const [conversationsVersion, setConversationsVersion] = useState(0);

  const processingRef = useRef(false);
  const processingStartedAtRef = useRef<number>(0);

  // Stable reference to latest provider values
  const dataRef = useRef({
    agents,
    flows,
    routingConfig,
    policies,
    tools,
    products,
  });
  dataRef.current = { agents, flows, routingConfig, policies, tools, products };

  const getWACredentials = useCallback(() => {
    const waConfig = getChannelConfig("whatsapp");
    if (
      waConfig?.connectionStatus === "connected" &&
      waConfig.metadata?.phone_number_id &&
      waConfig.metadata?.access_token
    ) {
      return {
        phoneNumberId: waConfig.metadata.phone_number_id,
        accessToken: waConfig.metadata.access_token,
      };
    }
    return null;
  }, [getChannelConfig]);

  const pollAndProcess = useCallback(async () => {
    // Force-reset stuck lock after timeout (e.g. fetch hung, tab was suspended)
    if (processingRef.current) {
      const elapsed = Date.now() - processingStartedAtRef.current;
      if (elapsed < PROCESSING_LOCK_TIMEOUT_MS) return;
      console.warn(`[MessageProcessor] Processing lock stuck for ${Math.round(elapsed / 1000)}s — force-resetting`);
    }
    processingRef.current = true;
    processingStartedAtRef.current = Date.now();

    try {
      // Fetch events from queue
      const res = await fetch("/api/webhooks/whatsapp/events");
      if (!res.ok) {
        processingRef.current = false;
        return;
      }

      const data = (await res.json()) as {
        count: number;
        events: MessageReceivedEvent[];
      };

      if (data.count === 0) {
        processingRef.current = false;
        return;
      }

      // Filter to message received events only
      const messageEvents = data.events.filter(
        (e) => e.type === "channel.message.received"
      );

      if (messageEvents.length === 0) {
        processingRef.current = false;
        return;
      }

      console.info(
        `[MessageProcessor] Processing ${messageEvents.length} inbound message(s)`
      );

      const { agents: currentAgents, flows: currentFlows, routingConfig: currentRouting, policies: currentPolicies, tools: currentTools, products: currentProducts } = dataRef.current;
      const openaiApiKey = getRawKey("openai") ?? undefined;
      const localWACredentials = getWACredentials();
      const testMode = localStorage.getItem("freia_wa_test_mode") === "true";

      for (const event of messageEvents) {
        // Dedup: skip already-processed messages
        if (processedMessageIds.has(event.messageId)) {
          console.info(`[MessageProcessor] Skipping duplicate messageId: ${event.messageId.slice(0, 12)}`);
          continue;
        }
        processedMessageIds.add(event.messageId);
        if (processedMessageIds.size > MAX_PROCESSED_IDS) {
          const entries = [...processedMessageIds];
          processedMessageIds.clear();
          for (const id of entries.slice(-100)) processedMessageIds.add(id);
        }

        // Multi-tenant: if event has companyId, use it for credential resolution
        // The send route will lookup credentials from the backend DB
        const waCredentials = event.companyId
          ? { phoneNumberId: event.phoneNumberId, accessToken: "", companyId: event.companyId }
          : localWACredentials;

        try {
          const result = await processInboundMessage({
            event,
            activeConversations: conversationsRef.current,
            routingConfig: currentRouting,
            agents: currentAgents,
            flows: currentFlows,
            policies: currentPolicies,
            tools: currentTools,
            products: currentProducts,
            openaiApiKey,
            waCredentials,
            testMode,
          });

          if (result.success) {
            setProcessedCount((c) => c + 1);

            // Update conversation map
            if (result.updatedConversation) {
              conversationsRef.current.set(
                event.from,
                result.updatedConversation
              );
            } else if (result.conversationEnded) {
              conversationsRef.current.delete(event.from);
            }

            saveConversations(conversationsRef.current);
            setConversationsVersion((v) => v + 1);

            // Sync to ConversationsProvider for the Conversations page
            if (result.flowId) {
              const convRecord = buildConversationRecord(
                event,
                result,
                result.updatedConversation ?? undefined
              );
              upsertConversationRef.current(convRecord);
            }

            console.info(
              `[MessageProcessor] Processed message from ${event.from}: ` +
                `agent=${result.agentName ?? "none"}, ` +
                `responses=${result.responseTexts.length}, ` +
                `ended=${result.conversationEnded ?? false}`
            );
          } else {
            console.warn(
              `[MessageProcessor] Failed: ${result.error}`
            );
            setErrors((prev) =>
              [...prev, `${event.from}: ${result.error}`].slice(-20)
            );
          }
        } catch (err) {
          console.error("[MessageProcessor] Error processing event:", err);
          setErrors((prev) =>
            [...prev, `${event.from}: ${String(err)}`].slice(-20)
          );
        }
      }
    } catch (err) {
      // Network error fetching events — silent, will retry on next poll
      console.warn("[MessageProcessor] Poll error:", err);
    } finally {
      processingRef.current = false;
    }
  }, [getRawKey, getWACredentials]);

  // ── Polling interval ─────────────────────────────────────────────────────

  useEffect(() => {
    // Only start polling when WhatsApp channel is connected
    const waConfig = getChannelConfig("whatsapp");
    const isConnected = waConfig?.connectionStatus === "connected";

    if (!isConnected) return;

    console.info("[MessageProcessor] Starting polling (every 3s)");

    // Initial poll
    pollAndProcess();

    const interval = setInterval(pollAndProcess, POLL_INTERVAL_MS);

    // Re-trigger poll immediately when tab regains focus (browser throttles
    // background-tab timers aggressively, so messages pile up unprocessed)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.info("[MessageProcessor] Tab regained focus — polling immediately");
        processingRef.current = false; // Reset lock in case it was stuck
        pollAndProcess();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      console.info("[MessageProcessor] Stopping polling");
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pollAndProcess, getChannelConfig]);

  // ── Context value ──────────────────────────────────────────────────────────

  const contextValue: MessageProcessorContextType = {
    isActive:
      getChannelConfig("whatsapp")?.connectionStatus === "connected",
    processedCount,
    activeConversations: conversationsRef.current,
    errors,
  };

  // Force use of conversationsVersion to avoid unused warning
  void conversationsVersion;

  return (
    <MessageProcessorContext.Provider value={contextValue}>
      {children}
    </MessageProcessorContext.Provider>
  );
}

export function useMessageProcessor() {
  const context = useContext(MessageProcessorContext);
  if (context === undefined) {
    throw new Error(
      "useMessageProcessor must be used inside MessageProcessorProvider"
    );
  }
  return context;
}
