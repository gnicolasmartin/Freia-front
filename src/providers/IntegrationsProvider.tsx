"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Integration, IntegrationFormData, WebhookSyncLog, RetryQueueEntry, DLQEntry, AdminNotification } from "@/types/integration";
import { DEFAULT_CAPABILITIES_BY_TYPE, processWebhookPayload } from "@/types/integration";
import { encryptCredential } from "@/lib/crypto-utils";
import { getSessionCompanyId } from "@/lib/get-session-company";

interface IntegrationsContextType {
  integrations: Integration[];
  isLoading: boolean;
  createIntegration: (data: IntegrationFormData) => Promise<Integration>;
  updateIntegration: (id: string, data: Partial<IntegrationFormData>) => Promise<Integration | null>;
  deleteIntegration: (id: string) => boolean;
  getIntegration: (id: string) => Integration | undefined;
  updateTestResult: (
    id: string,
    result: "success" | "error" | "unreachable",
    message: string
  ) => void;
  syncLogs: WebhookSyncLog[];
  addSyncLog: (log: Omit<WebhookSyncLog, "id" | "receivedAt">) => WebhookSyncLog;
  clearSyncLogs: (integrationId?: string) => void;
  retryQueue: RetryQueueEntry[];
  dlq: DLQEntry[];
  notifications: AdminNotification[];
  enqueueRetry: (entry: Omit<RetryQueueEntry, "id" | "createdAt">) => void;
  processRetry: (entryId: string, integration: Integration) => "success" | "retry" | "dlq";
  clearDLQ: (integrationId?: string) => void;
  dismissNotification: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const IntegrationsContext = createContext<IntegrationsContextType | undefined>(undefined);

const STORAGE_KEY = "freia_integrations";
const SYNC_LOGS_KEY = "freia_webhook_logs";
const RETRY_QUEUE_KEY = "freia_retry_queue";
const DLQ_KEY = "freia_dlq";
const NOTIFICATIONS_KEY = "freia_notifications";

async function encryptCredentials(
  credentials: IntegrationFormData["credentials"]
): Promise<Integration["credentials"]> {
  return Promise.all(
    credentials.map(async (c) => ({
      ...c,
      value: c.value ? await encryptCredential(c.value) : c.value,
    }))
  );
}

export function IntegrationsProvider({ children }: { children: ReactNode }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<WebhookSyncLog[]>([]);
  const [retryQueue, setRetryQueue] = useState<RetryQueueEntry[]>([]);
  const [dlq, setDlq] = useState<DLQEntry[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Integration[];
        const migrated = parsed.map((i) => ({
          ...i,
          credentials: i.credentials ?? [],
          fieldMappings: i.fieldMappings ?? [],
          active: i.active ?? true,
          supportedCapabilities: i.supportedCapabilities ?? [],
          webhookEnabled: i.webhookEnabled ?? false,
          retryEnabled: i.retryEnabled ?? false,
          maxRetries: i.maxRetries ?? 3,
          retryDelayMs: i.retryDelayMs ?? 30000,
        }));
        setIntegrations(migrated);
      } catch {
        // ignore corrupted data
      }
    }
    const storedLogs = localStorage.getItem(SYNC_LOGS_KEY);
    if (storedLogs) {
      try { setSyncLogs(JSON.parse(storedLogs)); } catch { /* ignore */ }
    }
    const storedRetry = localStorage.getItem(RETRY_QUEUE_KEY);
    if (storedRetry) {
      try { setRetryQueue(JSON.parse(storedRetry)); } catch { /* ignore */ }
    }
    const storedDlq = localStorage.getItem(DLQ_KEY);
    if (storedDlq) {
      try { setDlq(JSON.parse(storedDlq)); } catch { /* ignore */ }
    }
    const storedNotifs = localStorage.getItem(NOTIFICATIONS_KEY);
    if (storedNotifs) {
      try { setNotifications(JSON.parse(storedNotifs)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(integrations));
    }
  }, [integrations, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(syncLogs));
    }
  }, [syncLogs, isLoading]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(retryQueue));
  }, [retryQueue, isLoading]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(DLQ_KEY, JSON.stringify(dlq));
  }, [dlq, isLoading]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }, [notifications, isLoading]);

  const createIntegration = async (data: IntegrationFormData): Promise<Integration> => {
    const now = new Date().toISOString();
    const encryptedCredentials = await encryptCredentials(data.credentials);
    const supportedCapabilities =
      data.supportedCapabilities.length > 0
        ? data.supportedCapabilities
        : (DEFAULT_CAPABILITIES_BY_TYPE[data.type] ?? []);
    const newIntegration: Integration = {
      id: crypto.randomUUID(),
      ...data,
      companyId: data.companyId ?? getSessionCompanyId(),
      credentials: encryptedCredentials,
      supportedCapabilities,
      createdAt: now,
      updatedAt: now,
    };
    setIntegrations((prev) => [...prev, newIntegration]);
    return newIntegration;
  };

  const updateIntegration = async (
    id: string,
    data: Partial<IntegrationFormData>
  ): Promise<Integration | null> => {
    const encryptedCredentials = data.credentials
      ? await encryptCredentials(data.credentials)
      : undefined;

    let updated: Integration | null = null;
    setIntegrations((prev) =>
      prev.map((integration) => {
        if (integration.id === id) {
          updated = {
            ...integration,
            ...data,
            ...(encryptedCredentials ? { credentials: encryptedCredentials } : {}),
            updatedAt: new Date().toISOString(),
          };
          return updated;
        }
        return integration;
      })
    );
    return updated;
  };

  const deleteIntegration = (id: string): boolean => {
    const exists = integrations.some((i) => i.id === id);
    if (!exists) return false;
    setIntegrations((prev) => prev.filter((i) => i.id !== id));
    return true;
  };

  const getIntegration = (id: string) => integrations.find((i) => i.id === id);

  const addSyncLog = (log: Omit<WebhookSyncLog, "id" | "receivedAt">): WebhookSyncLog => {
    const full: WebhookSyncLog = {
      ...log,
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
    };
    setSyncLogs((prev) => [full, ...prev].slice(0, 200));
    return full;
  };

  const clearSyncLogs = (integrationId?: string) => {
    setSyncLogs((prev) =>
      integrationId ? prev.filter((l) => l.integrationId !== integrationId) : []
    );
  };

  const enqueueRetry = (entry: Omit<RetryQueueEntry, "id" | "createdAt">) => {
    const full: RetryQueueEntry = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setRetryQueue((prev) => [full, ...prev].slice(0, 200));
  };

  const processRetry = (entryId: string, integration: Integration): "success" | "retry" | "dlq" => {
    const entry = retryQueue.find((e) => e.id === entryId);
    if (!entry) return "retry";

    const result = processWebhookPayload(entry.payload, integration.fieldMappings);

    if (result.status === "processed") {
      setRetryQueue((prev) => prev.filter((e) => e.id !== entryId));
      const log: WebhookSyncLog = {
        id: crypto.randomUUID(),
        integrationId: entry.integrationId,
        receivedAt: new Date().toISOString(),
        eventType: entry.eventType,
        status: "processed",
        message: `Reintento exitoso — ${result.message}`,
        mappedFields: result.mappedFields,
        payloadPreview: entry.payloadPreview,
      };
      setSyncLogs((prev) => [log, ...prev].slice(0, 200));
      return "success";
    }

    // Failure path
    const newAttempts = entry.attempts + 1;
    if (newAttempts >= entry.maxRetries) {
      // Move to DLQ
      const dlqEntry: DLQEntry = {
        id: entry.id,
        integrationId: entry.integrationId,
        eventType: entry.eventType,
        payload: entry.payload,
        payloadPreview: entry.payloadPreview,
        attempts: newAttempts,
        failedAt: new Date().toISOString(),
        lastError: entry.lastError,
      };
      setDlq((prev) => [dlqEntry, ...prev].slice(0, 100));
      setRetryQueue((prev) => prev.filter((e) => e.id !== entryId));
      const notif: AdminNotification = {
        id: crypto.randomUUID(),
        integrationId: entry.integrationId,
        integrationName: integration.name,
        eventType: entry.eventType,
        failedAt: dlqEntry.failedAt,
        read: false,
        message: `Evento "${entry.eventType}" no pudo procesarse tras ${newAttempts} intentos`,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      return "dlq";
    }

    // Still retrying
    const delayMs = (integration.retryDelayMs ?? 30000) * Math.pow(2, entry.attempts - 1);
    setRetryQueue((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, attempts: newAttempts, nextRetryAt: new Date(Date.now() + delayMs).toISOString(), lastError: "Sin mapeos válidos para este payload" }
          : e
      )
    );
    return "retry";
  };

  const clearDLQ = (integrationId?: string) => {
    setDlq((prev) => integrationId ? prev.filter((e) => e.integrationId !== integrationId) : []);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const updateTestResult = (
    id: string,
    result: "success" | "error" | "unreachable",
    message: string
  ) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              lastTestResult: result,
              lastTestMessage: message,
              lastTestedAt: new Date().toISOString(),
            }
          : i
      )
    );
  };

  return (
    <IntegrationsContext.Provider
      value={{
        integrations,
        isLoading,
        createIntegration,
        updateIntegration,
        deleteIntegration,
        getIntegration,
        updateTestResult,
        syncLogs,
        addSyncLog,
        clearSyncLogs,
        retryQueue,
        dlq,
        notifications,
        enqueueRetry,
        processRetry,
        clearDLQ,
        dismissNotification,
        markAllNotificationsRead,
      }}
    >
      {children}
    </IntegrationsContext.Provider>
  );
}

export function useIntegrations() {
  const context = useContext(IntegrationsContext);
  if (context === undefined) {
    throw new Error("useIntegrations debe ser usado dentro de IntegrationsProvider");
  }
  return context;
}
