"use client";

/**
 * WhatsAppOptInProvider
 *
 * Manages opt-in consent records and enforcement policy for WhatsApp contacts.
 * Provides React state + CRUD backed by localStorage.
 *
 * The underlying lib (src/lib/whatsapp-optin.ts) is also importable directly
 * for use in WhatsAppMessagesProvider without creating a circular dependency.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { OptInPolicy, OptInRecord, OptInStatus } from "@/types/whatsapp-optin";
import {
  getAllOptInRecords,
  getOptInPolicy,
  getOptInStatus as libGetOptInStatus,
  removeOptInRecord,
  saveOptInPolicy,
  setOptInRecord,
  OPTIN_STORAGE_KEY,
  OPTIN_POLICY_KEY,
} from "@/lib/whatsapp-optin";

// ─── Context type ─────────────────────────────────────────────────────────────

interface WhatsAppOptInContextValue {
  optInRecords: OptInRecord[];
  policy: OptInPolicy;

  /** Set or update the opt-in status for a contact. Evidence is auto-timestamped. */
  setOptInStatus: (
    phoneNumber: string,
    status: OptInStatus,
    source?: string,
    notes?: string
  ) => void;

  /** Remove the opt-in record for a contact. */
  removeRecord: (phoneNumber: string) => void;

  /** Update one or more policy fields. */
  updatePolicy: (partial: Partial<OptInPolicy>) => void;

  /** Returns the current opt-in status for a phone number ("none" if no record). */
  getOptInStatus: (phoneNumber: string) => OptInStatus;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WhatsAppOptInContext = createContext<WhatsAppOptInContextValue | null>(
  null
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WhatsAppOptInProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [optInRecords, setOptInRecords] = useState<OptInRecord[]>(() =>
    getAllOptInRecords()
  );
  const [policy, setPolicy] = useState<OptInPolicy>(() => getOptInPolicy());

  // Re-sync state when localStorage changes externally (e.g. from the lib)
  const refreshRecords = useCallback(() => {
    setOptInRecords(getAllOptInRecords());
  }, []);

  const refreshPolicy = useCallback(() => {
    setPolicy(getOptInPolicy());
  }, []);

  // Listen for storage events from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === OPTIN_STORAGE_KEY) refreshRecords();
      if (e.key === OPTIN_POLICY_KEY) refreshPolicy();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshRecords, refreshPolicy]);

  // ── Methods ───────────────────────────────────────────────────────────────

  const setOptInStatus = useCallback(
    (
      phoneNumber: string,
      status: OptInStatus,
      source?: string,
      notes?: string
    ) => {
      setOptInRecord(phoneNumber, status, source, notes);
      refreshRecords();
    },
    [refreshRecords]
  );

  const removeRecord = useCallback(
    (phoneNumber: string) => {
      removeOptInRecord(phoneNumber);
      refreshRecords();
    },
    [refreshRecords]
  );

  const updatePolicy = useCallback(
    (partial: Partial<OptInPolicy>) => {
      const next = { ...policy, ...partial };
      saveOptInPolicy(next);
      setPolicy(next);
    },
    [policy]
  );

  const getOptInStatus = useCallback(
    (phoneNumber: string): OptInStatus => libGetOptInStatus(phoneNumber),
    []
  );

  return (
    <WhatsAppOptInContext.Provider
      value={{
        optInRecords,
        policy,
        setOptInStatus,
        removeRecord,
        updatePolicy,
        getOptInStatus,
      }}
    >
      {children}
    </WhatsAppOptInContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsAppOptIn(): WhatsAppOptInContextValue {
  const ctx = useContext(WhatsAppOptInContext);
  if (!ctx) {
    throw new Error(
      "useWhatsAppOptIn must be used inside WhatsAppOptInProvider"
    );
  }
  return ctx;
}
