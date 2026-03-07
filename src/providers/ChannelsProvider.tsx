"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { ChannelScope } from "@/types/agent";
import type { ChannelConfig } from "@/types/channel";
import { DEFAULT_CHANNEL_CONFIGS } from "@/types/channel";

interface ChannelsContextType {
  channels: ChannelConfig[];
  isLoading: boolean;
  enableChannel: (channel: ChannelScope) => void;
  disableChannel: (channel: ChannelScope) => void;
  /** Marks the channel as connected and optionally stores metadata (phone, account name…). */
  connectChannel: (channel: ChannelScope, metadata?: Record<string, string>) => void;
  disconnectChannel: (channel: ChannelScope) => void;
  getChannelConfig: (channel: ChannelScope) => ChannelConfig | undefined;
  /**
   * Returns true when the channel is enabled AND either does not require a
   * connection or is already connected. This is the gate used by agent
   * activation checks.
   */
  isChannelAvailable: (channel: ChannelScope) => boolean;
}

const ChannelsContext = createContext<ChannelsContextType | undefined>(
  undefined
);

const STORAGE_KEY = "freia_channels";

export function ChannelsProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<ChannelConfig[]>(
    DEFAULT_CHANNEL_CONFIGS
  );
  const [isLoading, setIsLoading] = useState(true);

  // --- Load ---
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: ChannelConfig[] = JSON.parse(stored);
        // Merge saved state with defaults so new channels added in future are
        // included.
        const merged = DEFAULT_CHANNEL_CONFIGS.map((def) => {
          const saved = parsed.find((c) => c.channel === def.channel);
          return saved ?? def;
        });
        setChannels(merged);
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  // --- Persist ---
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
    }
  }, [channels, isLoading]);

  // --- Helpers ---
  const updateChannel = useCallback(
    (channel: ChannelScope, updater: (c: ChannelConfig) => ChannelConfig) => {
      setChannels((prev) =>
        prev.map((c) => (c.channel === channel ? updater(c) : c))
      );
    },
    []
  );

  const enableChannel = useCallback(
    (channel: ChannelScope) => {
      updateChannel(channel, (c) => ({ ...c, enabled: true }));
    },
    [updateChannel]
  );

  const disableChannel = useCallback(
    (channel: ChannelScope) => {
      updateChannel(channel, (c) => ({ ...c, enabled: false }));
    },
    [updateChannel]
  );

  const connectChannel = useCallback(
    (channel: ChannelScope, metadata?: Record<string, string>) => {
      updateChannel(channel, (c) => ({
        ...c,
        enabled: true,
        connectionStatus: "connected",
        connectedAt: new Date().toISOString(),
        metadata: metadata ?? c.metadata,
      }));
    },
    [updateChannel]
  );

  const disconnectChannel = useCallback(
    (channel: ChannelScope) => {
      updateChannel(channel, (c) => ({
        ...c,
        connectionStatus: "disconnected",
        connectedAt: undefined,
        metadata: undefined,
      }));
    },
    [updateChannel]
  );

  const getChannelConfig = useCallback(
    (channel: ChannelScope): ChannelConfig | undefined => {
      return channels.find((c) => c.channel === channel);
    },
    [channels]
  );

  const isChannelAvailable = useCallback(
    (channel: ChannelScope): boolean => {
      const config = channels.find((c) => c.channel === channel);
      if (!config || !config.enabled) return false;
      if (
        config.requiresConnection &&
        config.connectionStatus !== "connected"
      )
        return false;
      return true;
    },
    [channels]
  );

  return (
    <ChannelsContext.Provider
      value={{
        channels,
        isLoading,
        enableChannel,
        disableChannel,
        connectChannel,
        disconnectChannel,
        getChannelConfig,
        isChannelAvailable,
      }}
    >
      {children}
    </ChannelsContext.Provider>
  );
}

export function useChannels() {
  const context = useContext(ChannelsContext);
  if (context === undefined) {
    throw new Error(
      "useChannels debe ser usado dentro de ChannelsProvider"
    );
  }
  return context;
}
