"use client";

/**
 * RoutingProvider
 *
 * Manages the WhatsApp routing configuration (rules + default agent).
 * Delegates reads/writes to the pure lib (whatsapp-router.ts) so that
 * the routing engine can be called without a React-context dependency.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getRoutingConfig,
  saveRoutingConfig,
} from "@/lib/whatsapp-router";
import type { RoutingConfig } from "@/types/routing";

// ─── Context ──────────────────────────────────────────────────────────────────

interface RoutingContextValue {
  config: RoutingConfig;
  /**
   * Merge a partial update into the current config.
   * Sets updatedAt automatically and persists to localStorage.
   */
  updateConfig(
    partial: Partial<Omit<RoutingConfig, "updatedAt">>
  ): void;
}

const RoutingContext = createContext<RoutingContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RoutingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<RoutingConfig>(() =>
    getRoutingConfig()
  );

  // Sync with cross-tab changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "freia_wa_routing") {
        setConfig(getRoutingConfig());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateConfig = useCallback(
    (partial: Partial<Omit<RoutingConfig, "updatedAt">>) => {
      setConfig((prev) => {
        const next: RoutingConfig = {
          ...prev,
          ...partial,
          rules: partial.rules ?? prev.rules,
          updatedAt: new Date().toISOString(),
        };
        saveRoutingConfig(next);
        return next;
      });
    },
    []
  );

  return (
    <RoutingContext.Provider value={{ config, updateConfig }}>
      {children}
    </RoutingContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRouting(): RoutingContextValue {
  const ctx = useContext(RoutingContext);
  if (!ctx) {
    throw new Error("useRouting must be used inside RoutingProvider");
  }
  return ctx;
}
