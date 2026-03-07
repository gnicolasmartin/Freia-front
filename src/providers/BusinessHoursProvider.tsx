"use client";

/**
 * BusinessHoursProvider
 *
 * Manages the business hours configuration used by the Settings UI and
 * read at conversation / simulation start to populate system.isBusinessHours,
 * system.outOfHoursMessage, and system.bookingUrl flow variables.
 *
 * Delegates reads/writes to the pure lib (business-hours.ts) so that
 * flow-simulator.ts and conversation-state.ts can access the data without
 * a React-context dependency.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getBusinessHoursConfig,
  saveBusinessHoursConfig,
  isCurrentlyBusinessHours,
} from "@/lib/business-hours";
import type { BusinessHoursConfig } from "@/types/business-hours";

// ─── Context ──────────────────────────────────────────────────────────────────

interface BusinessHoursContextValue {
  config: BusinessHoursConfig;
  /**
   * Merge a partial update into the current config.
   * Sets updatedAt automatically and persists to localStorage.
   */
  updateConfig(
    partial: Partial<Omit<BusinessHoursConfig, "updatedAt">>
  ): void;
  /** Returns true when the current moment is within business hours. */
  isOpen(): boolean;
}

const BusinessHoursContext =
  createContext<BusinessHoursContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BusinessHoursProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<BusinessHoursConfig>(() =>
    getBusinessHoursConfig()
  );

  // Sync with cross-tab changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "freia_business_hours") {
        setConfig(getBusinessHoursConfig());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateConfig = useCallback(
    (partial: Partial<Omit<BusinessHoursConfig, "updatedAt">>) => {
      setConfig((prev) => {
        const next: BusinessHoursConfig = {
          ...prev,
          ...partial,
          schedule: {
            ...prev.schedule,
            ...(partial.schedule ?? {}),
          },
          updatedAt: new Date().toISOString(),
        };
        saveBusinessHoursConfig(next);
        return next;
      });
    },
    []
  );

  const isOpen = useCallback(() => isCurrentlyBusinessHours(config), [config]);

  return (
    <BusinessHoursContext.Provider value={{ config, updateConfig, isOpen }}>
      {children}
    </BusinessHoursContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBusinessHours(): BusinessHoursContextValue {
  const ctx = useContext(BusinessHoursContext);
  if (!ctx) {
    throw new Error(
      "useBusinessHours must be used inside BusinessHoursProvider"
    );
  }
  return ctx;
}
