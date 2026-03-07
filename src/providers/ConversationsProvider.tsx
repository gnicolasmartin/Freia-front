"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  ConversationState,
  FlowVersion,
  ToolExecutionLog,
} from "@/types/flow";
import { useFlows } from "./FlowsProvider";
import {
  createConversation,
  advanceNode as advanceNodePure,
  updateVars as updateVarsPure,
  incrementRetry as incrementRetryPure,
  endConversation as endConversationPure,
  expireVars as expireVarsPure,
  isStale,
  getActiveConversations as getActivePure,
} from "@/lib/conversation-state";
import { appendToolLog } from "@/lib/tool-runtime";

// --- Context type ---

interface ConversationsContextType {
  conversations: ConversationState[];
  isLoading: boolean;

  // Lifecycle
  startConversation: (flowId: string) => ConversationState | null;
  endConversation: (
    conversationId: string,
    status?: "completed" | "abandoned"
  ) => void;

  // State mutations
  advanceNode: (conversationId: string, nextNodeId: string) => void;
  updateVars: (
    conversationId: string,
    updates: Record<string, unknown>
  ) => void;
  incrementRetry: (conversationId: string, nodeId: string) => void;
  addToolLog: (conversationId: string, log: ToolExecutionLog) => void;

  // Queries
  getConversation: (conversationId: string) => ConversationState | undefined;
  getActiveConversations: () => ConversationState[];
  getConversationsForFlow: (flowId: string) => ConversationState[];

  // Version resolution
  resolvePinnedVersion: (conversationId: string) => FlowVersion | null;

  // Maintenance
  cleanupStale: () => number;
}

const ConversationsContext = createContext<
  ConversationsContextType | undefined
>(undefined);

const STORAGE_KEY = "freia_conversations";

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { flows } = useFlows();

  // --- Load from localStorage on mount ---
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setConversations(JSON.parse(stored));
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  // --- Persist to localStorage on change ---
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations, isLoading]);

  // --- Auto-cleanup stale conversations on mount ---
  useEffect(() => {
    if (!isLoading && conversations.length > 0) {
      const hasStale = conversations.some(
        (c) => c.status === "active" && isStale(c)
      );
      if (hasStale) {
        setConversations((prev) =>
          prev.map((c) =>
            c.status === "active" && isStale(c)
              ? endConversationPure(c, "abandoned")
              : c
          )
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // --- Helper: update a single conversation by id ---
  const updateConversation = useCallback(
    (id: string, updater: (c: ConversationState) => ConversationState) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updater(c) : c))
      );
    },
    []
  );

  // --- Lifecycle ---

  const startConversation = useCallback(
    (flowId: string): ConversationState | null => {
      const flow = flows.find((f) => f.id === flowId);
      if (!flow || !flow.publishedVersionId) return null;

      const version = (flow.versions ?? []).find(
        (v) => v.id === flow.publishedVersionId
      );
      if (!version) return null;

      const conversation = createConversation(flowId, version);
      setConversations((prev) => [...prev, conversation]);
      return conversation;
    },
    [flows]
  );

  const handleEndConversation = useCallback(
    (
      conversationId: string,
      status: "completed" | "abandoned" = "completed"
    ) => {
      updateConversation(conversationId, (c) =>
        endConversationPure(c, status)
      );
    },
    [updateConversation]
  );

  // --- State mutations ---

  const handleAdvanceNode = useCallback(
    (conversationId: string, nextNodeId: string) => {
      updateConversation(conversationId, (c) =>
        advanceNodePure(c, nextNodeId)
      );
    },
    [updateConversation]
  );

  const handleUpdateVars = useCallback(
    (conversationId: string, updates: Record<string, unknown>) => {
      updateConversation(conversationId, (c) =>
        updateVarsPure(c, updates)
      );
    },
    [updateConversation]
  );

  const handleIncrementRetry = useCallback(
    (conversationId: string, nodeId: string) => {
      updateConversation(conversationId, (c) =>
        incrementRetryPure(c, nodeId)
      );
    },
    [updateConversation]
  );

  const handleAddToolLog = useCallback(
    (conversationId: string, log: ToolExecutionLog) => {
      updateConversation(conversationId, (c) => appendToolLog(c, log));
    },
    [updateConversation]
  );

  // --- Queries ---

  const getConversation = useCallback(
    (conversationId: string): ConversationState | undefined => {
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation || conversation.status !== "active") return conversation;

      // Lazy expiration: resolve pinned version to get variable defs with TTL
      const flow = flows.find((f) => f.id === conversation.flowId);
      const version = flow
        ? (flow.versions ?? []).find((v) => v.id === conversation.versionId)
        : undefined;
      if (!version) return conversation;

      const expired = expireVarsPure(conversation, version.variables);
      if (expired !== conversation) {
        // Persist the expiration
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? expired : c))
        );
      }
      return expired;
    },
    [conversations, flows]
  );

  const handleGetActiveConversations = useCallback(
    () => getActivePure(conversations),
    [conversations]
  );

  const handleGetConversationsForFlow = useCallback(
    (flowId: string) => conversations.filter((c) => c.flowId === flowId),
    [conversations]
  );

  // --- Version resolution ---

  const resolvePinnedVersion = useCallback(
    (conversationId: string): FlowVersion | null => {
      const conversation = conversations.find(
        (c) => c.id === conversationId
      );
      if (!conversation) return null;

      const flow = flows.find((f) => f.id === conversation.flowId);
      if (!flow) return null;

      return (
        (flow.versions ?? []).find(
          (v) => v.id === conversation.versionId
        ) ?? null
      );
    },
    [conversations, flows]
  );

  // --- Maintenance ---

  const cleanupStale = useCallback((): number => {
    let cleaned = 0;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.status === "active" && isStale(c)) {
          cleaned++;
          return endConversationPure(c, "abandoned");
        }
        return c;
      })
    );
    return cleaned;
  }, []);

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        isLoading,
        startConversation,
        endConversation: handleEndConversation,
        advanceNode: handleAdvanceNode,
        updateVars: handleUpdateVars,
        incrementRetry: handleIncrementRetry,
        addToolLog: handleAddToolLog,
        getConversation,
        getActiveConversations: handleGetActiveConversations,
        getConversationsForFlow: handleGetConversationsForFlow,
        resolvePinnedVersion,
        cleanupStale,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error(
      "useConversations debe ser usado dentro de ConversationsProvider"
    );
  }
  return context;
}
