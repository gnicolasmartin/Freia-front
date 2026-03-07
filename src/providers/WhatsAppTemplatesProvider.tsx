"use client";

/**
 * WhatsAppTemplatesProvider
 *
 * Manages:
 *  - WhatsApp message templates (CRUD, simulated Meta approval)
 *  - Template use case mappings (template ↔ business scenario)
 *  - Contact conversation windows (24h window open/closed status)
 *
 * All state is persisted to localStorage.
 * Contact window state is also readable directly via src/lib/conversation-window.ts
 * (no React context needed) to allow WhatsAppMessagesProvider to check windows
 * without creating a circular provider dependency.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  ContactWindow,
  ConversationWindowStatus,
  TemplateUseCase,
  WhatsAppTemplate,
} from "@/types/whatsapp-template";
import {
  getAllContactWindows,
  getContactWindowStatus,
  recordUserMessageInWindow,
  ensureContactWindow,
  WINDOWS_STORAGE_KEY,
} from "@/lib/conversation-window";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const TEMPLATES_KEY = "freia_wa_templates";
const USE_CASES_KEY = "freia_wa_use_cases";
// Contact windows use WINDOWS_STORAGE_KEY from conversation-window.ts (shared)

// ─── Context type ─────────────────────────────────────────────────────────────

interface WhatsAppTemplatesContextValue {
  templates: WhatsAppTemplate[];
  useCases: TemplateUseCase[];
  contactWindows: ContactWindow[];

  // Templates
  addTemplate: (
    data: Omit<WhatsAppTemplate, "id" | "createdAt" | "updatedAt" | "status">
  ) => void;
  updateTemplate: (id: string, data: Partial<WhatsAppTemplate>) => void;
  deleteTemplate: (id: string) => void;

  // Use cases
  addUseCase: (data: Omit<TemplateUseCase, "id">) => void;
  updateUseCase: (id: string, data: Partial<TemplateUseCase>) => void;
  deleteUseCase: (id: string) => void;

  // Contact windows
  /** Record an inbound user message, opening (or renewing) the 24h window. */
  recordUserMessage: (phoneNumber: string) => void;
  /** Ensure a phone number appears in the contact windows list. */
  addContact: (phoneNumber: string) => void;
  getWindowStatus: (phoneNumber: string) => ConversationWindowStatus;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WhatsAppTemplatesContext =
  createContext<WhatsAppTemplatesContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return fallback;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WhatsAppTemplatesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(() =>
    loadFromStorage<WhatsAppTemplate>(TEMPLATES_KEY, [])
  );
  const [useCases, setUseCases] = useState<TemplateUseCase[]>(() =>
    loadFromStorage<TemplateUseCase>(USE_CASES_KEY, [])
  );
  const [contactWindows, setContactWindows] = useState<ContactWindow[]>(() =>
    getAllContactWindows()
  );

  // Persist templates and use cases
  useEffect(() => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem(USE_CASES_KEY, JSON.stringify(useCases));
  }, [useCases]);

  // Sync contactWindows from localStorage when window storage key changes
  // (written by recordUserMessageInWindow in the lib)
  const refreshContactWindows = useCallback(() => {
    setContactWindows(getAllContactWindows());
  }, []);

  // ── Templates ──────────────────────────────────────────────────────────────

  const addTemplate = useCallback(
    (
      data: Omit<WhatsAppTemplate, "id" | "createdAt" | "updatedAt" | "status">
    ) => {
      const now = new Date().toISOString();
      const newTemplate: WhatsAppTemplate = {
        ...data,
        id: crypto.randomUUID(),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      setTemplates((prev) => [newTemplate, ...prev]);

      // Simulate Meta review — auto-approve after 800ms
      setTimeout(() => {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === newTemplate.id
              ? { ...t, status: "approved", updatedAt: new Date().toISOString() }
              : t
          )
        );
      }, 800);
    },
    []
  );

  const updateTemplate = useCallback(
    (id: string, data: Partial<WhatsAppTemplate>) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, ...data, id, updatedAt: new Date().toISOString() }
            : t
        )
      );
    },
    []
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    // Also remove use cases that reference this template
    setUseCases((prev) => prev.filter((uc) => uc.templateId !== id));
  }, []);

  // ── Use cases ──────────────────────────────────────────────────────────────

  const addUseCase = useCallback((data: Omit<TemplateUseCase, "id">) => {
    const newUseCase: TemplateUseCase = {
      ...data,
      id: crypto.randomUUID(),
    };
    setUseCases((prev) => [newUseCase, ...prev]);
  }, []);

  const updateUseCase = useCallback(
    (id: string, data: Partial<TemplateUseCase>) => {
      setUseCases((prev) =>
        prev.map((uc) => (uc.id === id ? { ...uc, ...data, id } : uc))
      );
    },
    []
  );

  const deleteUseCase = useCallback((id: string) => {
    setUseCases((prev) => prev.filter((uc) => uc.id !== id));
  }, []);

  // ── Contact windows ────────────────────────────────────────────────────────

  const recordUserMessage = useCallback(
    (phoneNumber: string) => {
      recordUserMessageInWindow(phoneNumber);
      refreshContactWindows();
    },
    [refreshContactWindows]
  );

  const addContact = useCallback(
    (phoneNumber: string) => {
      ensureContactWindow(phoneNumber);
      refreshContactWindows();
    },
    [refreshContactWindows]
  );

  const getWindowStatus = useCallback(
    (phoneNumber: string): ConversationWindowStatus => {
      return getContactWindowStatus(phoneNumber);
    },
    []
  );

  return (
    <WhatsAppTemplatesContext.Provider
      value={{
        templates,
        useCases,
        contactWindows,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        addUseCase,
        updateUseCase,
        deleteUseCase,
        recordUserMessage,
        addContact,
        getWindowStatus,
      }}
    >
      {children}
    </WhatsAppTemplatesContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsAppTemplates(): WhatsAppTemplatesContextValue {
  const ctx = useContext(WhatsAppTemplatesContext);
  if (!ctx) {
    throw new Error(
      "useWhatsAppTemplates must be used inside WhatsAppTemplatesProvider"
    );
  }
  return ctx;
}
