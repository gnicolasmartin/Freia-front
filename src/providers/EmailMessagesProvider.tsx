"use client";

/**
 * EmailMessagesProvider
 *
 * Tracks outbound emails in localStorage.
 *
 * Status lifecycle:
 *   pending → sent → delivered
 *              ↓         ↓
 *           failed    bounced
 *
 * localStorage key: "freia_email_outbound"
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { addEmailAuditEntry } from "@/lib/email-audit";
import type { OutboundEmail, OutboundEmailStatus } from "@/types/email";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendEmailOptions {
  isHtml?: boolean;
  replyTo?: string;
  onError?: (errorMessage: string) => void;
  maxRetries?: number;
}

interface EmailMessagesContextValue {
  messages: OutboundEmail[];

  /**
   * Send an email via the /api/channels/email/send endpoint.
   * In test mode, skips real API and returns a mock messageId.
   * @returns messageId on success, null on failure.
   */
  sendEmail: (
    to: string,
    subject: string,
    body: string,
    options?: SendEmailOptions
  ) => Promise<string | null>;

  updateEmailStatus: (
    messageId: string,
    status: OutboundEmailStatus,
    error?: { code: number; title: string; message?: string }
  ) => void;

  clearMessages: () => void;

  testMode: boolean;
  setTestMode: (enabled: boolean) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "freia_email_outbound";
const TEST_MODE_KEY = "freia_email_test_mode";
const MAX_STORED = 200;

// ─── Context ─────────────────────────────────────────────────────────────────

const EmailMessagesContext = createContext<EmailMessagesContextValue | null>(
  null
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadMessages(): OutboundEmail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OutboundEmail[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: OutboundEmail[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(msgs.slice(0, MAX_STORED))
    );
  } catch {
    /* quota exceeded */
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function EmailMessagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, setMessages] = useState<OutboundEmail[]>(() =>
    loadMessages()
  );
  const [testMode, setTestModeState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(TEST_MODE_KEY) === "true";
  });

  // Persist messages on change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Cross-tab sync
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMessages(loadMessages());
      if (e.key === TEST_MODE_KEY)
        setTestModeState(e.newValue === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTestMode = useCallback((enabled: boolean) => {
    setTestModeState(enabled);
    localStorage.setItem(TEST_MODE_KEY, String(enabled));
  }, []);

  const sendEmail = useCallback(
    async (
      to: string,
      subject: string,
      body: string,
      options?: SendEmailOptions
    ): Promise<string | null> => {
      const localId = crypto.randomUUID();
      const now = new Date().toISOString();
      const isHtml = options?.isHtml ?? false;

      const pending: OutboundEmail = {
        id: localId,
        to,
        subject,
        body,
        isHtml,
        replyTo: options?.replyTo,
        status: "pending",
        attempts: 0,
        createdAt: now,
      };

      setMessages((prev) => [pending, ...prev]);

      // Test mode — skip real API
      if (testMode) {
        const mockId = `<msgid.test.${localId.slice(0, 8)}@freia>`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? {
                  ...m,
                  messageId: mockId,
                  status: "sent" as const,
                  attempts: 1,
                  sentAt: new Date().toISOString(),
                }
              : m
          )
        );
        addEmailAuditEntry({
          eventType: "outbound_sent",
          direction: "outbound",
          emailAddress: to,
          messageId: mockId,
          localId,
          subject,
          contentPreview: body.slice(0, 100),
        });
        return mockId;
      }

      // Real API call
      try {
        const res = await fetch("/api/channels/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            subject,
            ...(isHtml ? { html: body } : { text: body }),
            replyTo: options?.replyTo,
            maxRetries: options?.maxRetries,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMsg =
            (errorData as { error?: string }).error ?? `HTTP ${res.status}`;
          throw new Error(errorMsg);
        }

        const data = (await res.json()) as {
          messageId: string;
          attempts: number;
        };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? {
                  ...m,
                  messageId: data.messageId,
                  status: "sent" as const,
                  attempts: data.attempts,
                  sentAt: new Date().toISOString(),
                }
              : m
          )
        );

        addEmailAuditEntry({
          eventType: "outbound_sent",
          direction: "outbound",
          emailAddress: to,
          messageId: data.messageId,
          localId,
          subject,
          contentPreview: body.slice(0, 100),
        });

        return data.messageId;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? {
                  ...m,
                  status: "failed" as const,
                  error: errorMsg,
                  attempts: (m.attempts || 0) + 1,
                }
              : m
          )
        );

        addEmailAuditEntry({
          eventType: "outbound_failed",
          direction: "outbound",
          emailAddress: to,
          localId,
          subject,
          contentPreview: body.slice(0, 100),
          errorMessage: errorMsg,
        });

        options?.onError?.(errorMsg);
        return null;
      }
    },
    [testMode]
  );

  const updateEmailStatus = useCallback(
    (
      messageId: string,
      status: OutboundEmailStatus,
      error?: { code: number; title: string; message?: string }
    ) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === messageId
            ? {
                ...m,
                status,
                statusUpdatedAt: new Date().toISOString(),
                ...(error ? { error: error.message ?? error.title } : {}),
              }
            : m
        )
      );

      const msg = messages.find((m) => m.messageId === messageId);
      addEmailAuditEntry({
        eventType: "status_update",
        direction: "status",
        emailAddress: msg?.to ?? "",
        messageId,
        localId: msg?.id,
        newStatus: status,
        errorMessage: error?.message,
      });
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <EmailMessagesContext.Provider
      value={{
        messages,
        sendEmail,
        updateEmailStatus,
        clearMessages,
        testMode,
        setTestMode,
      }}
    >
      {children}
    </EmailMessagesContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEmailMessages(): EmailMessagesContextValue {
  const ctx = useContext(EmailMessagesContext);
  if (!ctx) {
    throw new Error(
      "useEmailMessages must be used inside EmailMessagesProvider"
    );
  }
  return ctx;
}
