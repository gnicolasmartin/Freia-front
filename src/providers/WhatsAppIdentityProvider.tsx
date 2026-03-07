"use client";

/**
 * WhatsAppIdentityProvider
 *
 * Manages the WhatsApp channel identity configuration: business name,
 * message signature, welcome / out-of-hours messages, default language,
 * conversation tone, and emoji usage.
 *
 * Delegates reads/writes to the pure localStorage lib (whatsapp-identity.ts)
 * so that WhatsAppMessagesProvider can access identity data without a
 * circular React-context dependency.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getChannelIdentity,
  saveChannelIdentity,
  resolveSignature,
  applyIdentityToMessage,
} from "@/lib/whatsapp-identity";
import type { ChannelIdentity } from "@/types/whatsapp-identity";

// ─── Context ──────────────────────────────────────────────────────────────────

interface WhatsAppIdentityContextValue {
  identity: ChannelIdentity;
  /**
   * Merge a partial update into the current identity.
   * Sets `updatedAt` automatically and persists to localStorage.
   */
  updateIdentity(
    partial: Partial<Omit<ChannelIdentity, "updatedAt">>
  ): void;
  /** Returns the resolved signature string ({{brandName}} replaced). */
  resolveSignature(): string;
  /** Appends the resolved signature to `text` if one is configured. */
  applySignature(text: string): string;
}

const WhatsAppIdentityContext =
  createContext<WhatsAppIdentityContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WhatsAppIdentityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [identity, setIdentity] = useState<ChannelIdentity>(() =>
    getChannelIdentity()
  );

  // Sync with cross-tab changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "freia_wa_identity") {
        setIdentity(getChannelIdentity());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateIdentity = useCallback(
    (partial: Partial<Omit<ChannelIdentity, "updatedAt">>) => {
      setIdentity((prev) => {
        const next: ChannelIdentity = {
          ...prev,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        saveChannelIdentity(next);
        return next;
      });
    },
    []
  );

  const resolveSignatureCtx = useCallback(
    () => resolveSignature(identity),
    [identity]
  );

  const applySignatureCtx = useCallback(
    (text: string) => applyIdentityToMessage(text, identity),
    [identity]
  );

  return (
    <WhatsAppIdentityContext.Provider
      value={{
        identity,
        updateIdentity,
        resolveSignature: resolveSignatureCtx,
        applySignature: applySignatureCtx,
      }}
    >
      {children}
    </WhatsAppIdentityContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsAppIdentity(): WhatsAppIdentityContextValue {
  const ctx = useContext(WhatsAppIdentityContext);
  if (!ctx) {
    throw new Error(
      "useWhatsAppIdentity must be used inside WhatsAppIdentityProvider"
    );
  }
  return ctx;
}
