"use client";

/**
 * WhatsAppMessagesProvider
 *
 * Tracks outbound WhatsApp messages in localStorage.
 *
 * Two send methods:
 *  - sendMessage() — free-form text; checks the 24h conversation window first.
 *    If the window is closed or unknown, the send fails with onWindowClosed callback.
 *  - sendTemplate() — template message; bypasses the window check (templates are
 *    always allowed). On success, records the inbound event to reopen the window.
 *
 * Status lifecycle:
 *   pending → sent → delivered → read
 *             ↓
 *           failed
 *
 * External status updates (delivered/read) are applied via
 * `updateMessageStatus(messageId, status)`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getContactWindowStatus,
  recordUserMessageInWindow,
} from "@/lib/conversation-window";
import {
  canReply,
  canSendBusinessInitiated,
} from "@/lib/whatsapp-optin";
import {
  getChannelIdentity,
  applyIdentityToMessage,
} from "@/lib/whatsapp-identity";
import type { WATemplateComponent } from "@/lib/whatsapp-sender";
import { addWhatsAppAuditEntry } from "@/lib/whatsapp-audit";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutboundMessageStatus =
  | "pending"
  | "sent"
  | "failed"
  | "delivered"
  | "read";

export interface OutboundMessage {
  /** Local UUID generated before sending */
  id: string;
  /** Recipient phone number (E.164) */
  to: string;
  text: string;
  /** External WhatsApp message ID (wamid.xxx) — set after successful send */
  messageId?: string;
  status: OutboundMessageStatus;
  /** Number of API attempts made */
  attempts: number;
  createdAt: string;
  sentAt?: string;
  /** Error message when status === "failed" */
  error?: string;
  /** WhatsApp error code from the status webhook (e.g. 131047) */
  errorCode?: number;
  /** WhatsApp error title from the status webhook */
  errorTitle?: string;
  /** ISO timestamp of the last status change (set by updateMessageStatus) */
  statusUpdatedAt?: string;
  /** Set when the message was sent as a template (records compliance) */
  templateName?: string;
  templateLanguage?: string;
}

export interface SendMessageOptions {
  /**
   * Called when sending fails (after all retries).
   * Use in flow/agent code to route via the error edge:
   *   findNextNodeId(nodeId, edges, "error")
   */
  onError?: (errorMessage: string) => void;
  /**
   * Called specifically when the 24h window is closed.
   * Allows the caller to prompt the user to choose a template instead.
   */
  onWindowClosed?: () => void;
  /**
   * Called when an opt-in check blocks the send.
   * Use to prompt the user to obtain consent before messaging.
   */
  onOptInRequired?: () => void;
  /** Override the default retry count (3) */
  maxRetries?: number;
}

export interface SendTemplateOptions extends SendMessageOptions {
  /** ID of the WhatsAppTemplate entry in the local registry (for audit) */
  templateId?: string;
}

interface WhatsAppMessagesContextValue {
  messages: OutboundMessage[];

  /**
   * Send a free-form text message.
   * Checks the 24h conversation window — fails if closed (calls onWindowClosed).
   * In test mode, bypasses all API calls and returns a mock messageId.
   * @returns External messageId on success, null on failure.
   */
  sendMessage: (
    to: string,
    text: string,
    options?: SendMessageOptions
  ) => Promise<string | null>;

  /**
   * Send a pre-approved template message.
   * Bypasses the 24h window check — templates can always be sent.
   * On success, records the interaction to (re)open the window.
   * In test mode, bypasses all API calls and returns a mock messageId.
   * @returns External messageId on success, null on failure.
   */
  sendTemplate: (
    to: string,
    templateName: string,
    languageCode: string,
    /** Resolved variable values in {{1}}, {{2}}, … order */
    variables: string[],
    options?: SendTemplateOptions
  ) => Promise<string | null>;

  /**
   * Update the delivery/read status of a sent message.
   * Call when a channel.message.status.updated event is received.
   * Pass `error` when status === "failed" to record the WhatsApp error code and title.
   */
  updateMessageStatus: (
    messageId: string,
    status: OutboundMessageStatus,
    error?: { code: number; title: string; message?: string }
  ) => void;

  clearMessages: () => void;

  /** Whether test mode is active. When true, sends are simulated (no real API calls). */
  testMode: boolean;
  setTestMode: (enabled: boolean) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WhatsAppMessagesContext =
  createContext<WhatsAppMessagesContextValue | null>(null);

const STORAGE_KEY = "freia_whatsapp_outbound";
const TEST_MODE_KEY = "freia_wa_test_mode";
const MAX_STORED = 200;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WhatsAppMessagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, setMessages] = useState<OutboundMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  const [testMode, setTestModeState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(TEST_MODE_KEY) === "true";
  });

  const setTestMode = useCallback((enabled: boolean) => {
    setTestModeState(enabled);
    localStorage.setItem(TEST_MODE_KEY, enabled ? "true" : "false");
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // ── sendMessage ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      to: string,
      text: string,
      options: SendMessageOptions = {}
    ): Promise<string | null> => {
      // ── Test mode: bypass all checks and API calls ──────────────────────
      if (testMode) {
        const localId = crypto.randomUUID();
        const now = new Date().toISOString();
        const identity = getChannelIdentity();
        const finalText = applyIdentityToMessage(text, identity);
        const mockId = `wamid.test.${localId.slice(0, 8)}`;
        setMessages((prev) =>
          [
            {
              id: localId,
              to,
              text: finalText,
              messageId: mockId,
              status: "sent" as const,
              attempts: 1,
              createdAt: now,
              sentAt: now,
            },
            ...prev,
          ].slice(0, MAX_STORED)
        );
        addWhatsAppAuditEntry({ eventType: "outbound_sent", direction: "outbound", phoneNumber: to, messageId: mockId, localId, contentPreview: finalText.slice(0, 100) });
        return mockId;
      }

      // ── Opt-in + window enforcement ─────────────────────────────────────
      // canReply() checks opt-in status and, for non-confirmed contacts,
      // allows sends only if the window is open (user-initiated conversation).
      // For confirmed contacts it returns true and the window is checked below.
      const windowStatus = getContactWindowStatus(to);
      const optInCheck = canReply(to, windowStatus);

      if (!optInCheck.allowed) {
        const errorMessage = optInCheck.reason ?? "No autorizado para enviar mensajes";
        const localId = crypto.randomUUID();
        setMessages((prev) =>
          [
            {
              id: localId,
              to,
              text,
              status: "failed" as const,
              attempts: 0,
              createdAt: new Date().toISOString(),
              error: errorMessage,
            },
            ...prev,
          ].slice(0, MAX_STORED)
        );
        addWhatsAppAuditEntry({ eventType: "outbound_failed", direction: "outbound", phoneNumber: to, localId, contentPreview: text.slice(0, 100), errorMessage });
        console.warn(`[WhatsApp Messages] Blocked (opt-in/window) for ${to}: ${errorMessage}`);
        options.onError?.(errorMessage);
        options.onOptInRequired?.();
        options.onWindowClosed?.();
        return null;
      }

      // Confirmed opt-in: still gate on window (WhatsApp's 24h policy).
      // Non-confirmed contacts that reached here passed the open-window check above.
      if (windowStatus !== "open") {
        const errorMessage = "Ventana de 24h cerrada — usa un template para iniciar esta conversación";
        const localId = crypto.randomUUID();
        setMessages((prev) =>
          [
            {
              id: localId,
              to,
              text,
              status: "failed" as const,
              attempts: 0,
              createdAt: new Date().toISOString(),
              error: errorMessage,
            },
            ...prev,
          ].slice(0, MAX_STORED)
        );
        addWhatsAppAuditEntry({ eventType: "outbound_failed", direction: "outbound", phoneNumber: to, localId, contentPreview: text.slice(0, 100), errorMessage });
        console.warn(`[WhatsApp Messages] Window ${windowStatus} for ${to}`);
        options.onError?.(errorMessage);
        options.onWindowClosed?.();
        return null;
      }

      // ── Normal send ─────────────────────────────────────────────────────
      const identity = getChannelIdentity();
      const finalText = applyIdentityToMessage(text, identity);

      const localId = crypto.randomUUID();
      const now = new Date().toISOString();
      setMessages((prev) =>
        [
          {
            id: localId,
            to,
            text: finalText,
            status: "pending" as const,
            attempts: 0,
            createdAt: now,
          },
          ...prev,
        ].slice(0, MAX_STORED)
      );

      try {
        const response = await fetch("/api/channels/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, text: finalText, maxRetries: options.maxRetries }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          const errorMessage = errorData.error ?? `HTTP ${response.status}`;
          console.error(`[WhatsApp Messages] Send failed for ${to}: ${errorMessage}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === localId
                ? { ...m, status: "failed" as const, error: errorMessage }
                : m
            )
          );
          addWhatsAppAuditEntry({ eventType: "outbound_failed", direction: "outbound", phoneNumber: to, localId, contentPreview: finalText.slice(0, 100), errorMessage });
          options.onError?.(errorMessage);
          return null;
        }

        const data = (await response.json()) as {
          messageId: string;
          status: string;
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
        addWhatsAppAuditEntry({ eventType: "outbound_sent", direction: "outbound", phoneNumber: to, messageId: data.messageId, localId, contentPreview: finalText.slice(0, 100) });
        return data.messageId;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Network error";
        console.error(`[WhatsApp Messages] Unexpected error sending to ${to}:`, err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? { ...m, status: "failed" as const, error: errorMessage }
              : m
          )
        );
        addWhatsAppAuditEntry({ eventType: "outbound_failed", direction: "outbound", phoneNumber: to, localId, contentPreview: finalText.slice(0, 100), errorMessage });
        options.onError?.(errorMessage);
        return null;
      }
    },
    [testMode]
  );

  // ── sendTemplate ───────────────────────────────────────────────────────────

  const sendTemplate = useCallback(
    async (
      to: string,
      templateName: string,
      languageCode: string,
      variables: string[],
      options: SendTemplateOptions = {}
    ): Promise<string | null> => {
      // ── Test mode: bypass opt-in and API calls ──────────────────────────
      if (testMode) {
        const localId = crypto.randomUUID();
        const now = new Date().toISOString();
        const mockId = `wamid.test.${localId.slice(0, 8)}`;
        setMessages((prev) =>
          [
            {
              id: localId,
              to,
              text: `[Template: ${templateName}]`,
              templateName,
              templateLanguage: languageCode,
              messageId: mockId,
              status: "sent" as const,
              attempts: 1,
              createdAt: now,
              sentAt: now,
            },
            ...prev,
          ].slice(0, MAX_STORED)
        );
        addWhatsAppAuditEntry({ eventType: "template_sent", direction: "outbound", phoneNumber: to, messageId: mockId, localId, templateName, templateLanguage: languageCode });
        recordUserMessageInWindow(to);
        return mockId;
      }

      // ── Opt-in enforcement for business-initiated messages ──────────────
      const optInCheck = canSendBusinessInitiated(to);
      if (!optInCheck.allowed) {
        const errorMessage = optInCheck.reason ?? "Opt-in confirmado requerido para enviar templates";
        const localId = crypto.randomUUID();
        setMessages((prev) =>
          [
            {
              id: localId,
              to,
              text: `[Template: ${templateName}]`,
              templateName,
              templateLanguage: languageCode,
              status: "failed" as const,
              attempts: 0,
              createdAt: new Date().toISOString(),
              error: errorMessage,
            },
            ...prev,
          ].slice(0, MAX_STORED)
        );
        addWhatsAppAuditEntry({ eventType: "template_failed", direction: "outbound", phoneNumber: to, localId, templateName, templateLanguage: languageCode, errorMessage });
        console.warn(`[WhatsApp Messages] Template blocked (opt-in) for ${to}: ${errorMessage}`);
        options.onError?.(errorMessage);
        options.onOptInRequired?.();
        return null;
      }

      const localId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Build body components from variable array
      const components: WATemplateComponent[] =
        variables.length > 0
          ? [
              {
                type: "body",
                parameters: variables.map((v) => ({ type: "text" as const, text: v })),
              },
            ]
          : [];

      setMessages((prev) =>
        [
          {
            id: localId,
            to,
            text: `[Template: ${templateName}]`,
            templateName,
            templateLanguage: languageCode,
            status: "pending" as const,
            attempts: 0,
            createdAt: now,
          },
          ...prev,
        ].slice(0, MAX_STORED)
      );

      try {
        const response = await fetch("/api/channels/whatsapp/send-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, templateName, languageCode, components }),
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          const errorMessage = errorData.error ?? `HTTP ${response.status}`;
          console.error(
            `[WhatsApp Messages] Template send failed for ${to}: ${errorMessage}`
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === localId
                ? { ...m, status: "failed" as const, error: errorMessage }
                : m
            )
          );
          addWhatsAppAuditEntry({ eventType: "template_failed", direction: "outbound", phoneNumber: to, localId, templateName, templateLanguage: languageCode, errorMessage });
          options.onError?.(errorMessage);
          return null;
        }

        const data = (await response.json()) as {
          messageId: string;
          status: string;
          templateName: string;
        };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? {
                  ...m,
                  messageId: data.messageId,
                  status: "sent" as const,
                  attempts: 1,
                  sentAt: new Date().toISOString(),
                }
              : m
          )
        );
        addWhatsAppAuditEntry({ eventType: "template_sent", direction: "outbound", phoneNumber: to, messageId: data.messageId, localId, templateName, templateLanguage: languageCode });

        // Sending a template to someone opens a new 24h window
        recordUserMessageInWindow(to);
        return data.messageId;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Network error";
        console.error(
          `[WhatsApp Messages] Unexpected error sending template to ${to}:`,
          err
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localId
              ? { ...m, status: "failed" as const, error: errorMessage }
              : m
          )
        );
        addWhatsAppAuditEntry({ eventType: "template_failed", direction: "outbound", phoneNumber: to, localId, templateName, templateLanguage: languageCode, errorMessage });
        options.onError?.(errorMessage);
        return null;
      }
    },
    [testMode]
  );

  // ── updateMessageStatus ────────────────────────────────────────────────────

  const updateMessageStatus = useCallback(
    (
      messageId: string,
      status: OutboundMessageStatus,
      error?: { code: number; title: string; message?: string }
    ) => {
      const now = new Date().toISOString();
      let recipientPhone = "";
      setMessages((prev) =>
        prev.map((m) => {
          if (m.messageId !== messageId) return m;
          recipientPhone = m.to;
          const patch: Partial<OutboundMessage> = { status, statusUpdatedAt: now };
          if (status === "failed" && error) {
            patch.errorCode = error.code;
            patch.errorTitle = error.title;
            patch.error = error.message ?? error.title;
          }
          return { ...m, ...patch };
        })
      );
      addWhatsAppAuditEntry({
        eventType: "status_update",
        direction: "status",
        phoneNumber: recipientPhone,
        messageId,
        newStatus: status,
        ...(status === "failed" && error
          ? { errorCode: error.code, errorTitle: error.title, errorMessage: error.message }
          : {}),
      });
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <WhatsAppMessagesContext.Provider
      value={{
        messages,
        sendMessage,
        sendTemplate,
        updateMessageStatus,
        clearMessages,
        testMode,
        setTestMode,
      }}
    >
      {children}
    </WhatsAppMessagesContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsAppMessages(): WhatsAppMessagesContextValue {
  const ctx = useContext(WhatsAppMessagesContext);
  if (!ctx) {
    throw new Error(
      "useWhatsAppMessages must be used inside WhatsAppMessagesProvider"
    );
  }
  return ctx;
}
