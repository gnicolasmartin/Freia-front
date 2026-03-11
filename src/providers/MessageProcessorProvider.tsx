"use client";

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import type { ActiveConversation } from "@/lib/message-processor";
import { useChannels } from "@/providers/ChannelsProvider";

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

// ─── Provider ────────────────────────────────────────────────────────────────
//
// Message processing now happens server-side in the webhook after() callback.
// This provider is a lightweight shell that:
//   1. Keeps the backend warm (ping every 2 min to prevent Render cold starts)
//   2. Provides context values so consuming components don't break
//

export function MessageProcessorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { getChannelConfig } = useChannels();

  // ── Backend keep-alive (prevents Render free-tier cold starts) ──────────

  useEffect(() => {
    const KEEP_ALIVE_MS = 2 * 60 * 1000;
    const ping = () => {
      fetch("/api/cron/keep-alive").catch(() => {});
    };
    ping(); // immediate first ping
    const keepAliveInterval = setInterval(ping, KEEP_ALIVE_MS);
    return () => clearInterval(keepAliveInterval);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const contextValue: MessageProcessorContextType = {
    isActive:
      getChannelConfig("whatsapp")?.connectionStatus === "connected",
    processedCount: 0,
    activeConversations: new Map(),
    errors: [],
  };

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
