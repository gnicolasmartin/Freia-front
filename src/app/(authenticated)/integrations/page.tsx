"use client";

import { useState, useCallback } from "react";
import {
  Plug,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Lock,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  X,
  Zap,
  ScrollText,
  ShieldAlert,
  Bell,
} from "lucide-react";
import { useIntegrations } from "@/providers/IntegrationsProvider";
import type { Integration, IntegrationFormData } from "@/types/integration";
import { INTEGRATION_TYPES } from "@/types/integration";
import { CAPABILITY_LABELS } from "@/types/tool-registry";
import IntegrationModal from "@/components/integrations/IntegrationModal";
import WebhookSimulateModal from "@/components/integrations/WebhookSimulateModal";
import WebhookLogDrawer from "@/components/integrations/WebhookLogDrawer";
import ResilienceDrawer from "@/components/integrations/ResilienceDrawer";
import NotificationsPanel from "@/components/integrations/NotificationsPanel";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function IntegrationsPage() {
  const {
    integrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
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
  } = useIntegrations();

  const [showModal, setShowModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [logIntegration, setLogIntegration] = useState<Integration | null>(null);
  const [simulateIntegration, setSimulateIntegration] = useState<Integration | null>(null);
  const [resilienceIntegration, setResilienceIntegration] = useState<Integration | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNew = () => {
    setEditingIntegration(null);
    setShowModal(true);
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setShowModal(true);
  };

  const handleSave = useCallback(
    async (data: IntegrationFormData) => {
      if (editingIntegration) {
        await updateIntegration(editingIntegration.id, data);
      } else {
        await createIntegration(data);
      }
      setShowModal(false);
      setEditingIntegration(null);
    },
    [editingIntegration, createIntegration, updateIntegration]
  );

  const handleDelete = (id: string) => {
    deleteIntegration(id);
    setDeletingId(null);
  };

  const handleQuickTest = async (integration: Integration) => {
    if (!integration.baseEndpoint) return;
    setTestingId(integration.id);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(integration.baseEndpoint, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      updateTestResult(integration.id, "success", `HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        updateTestResult(integration.id, "error", "Timeout");
      } else {
        updateTestResult(integration.id, "unreachable", "No alcanzable (CORS o red)");
      }
    } finally {
      setTestingId(null);
    }
  };

  const deletingIntegration = deletingId
    ? integrations.find((i) => i.id === deletingId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Integraciones</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Conectá Freia con sistemas externos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <NotificationsPanel
                notifications={notifications}
                onDismiss={dismissNotification}
                onMarkAllRead={markAllNotificationsRead}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#dd7430] text-white hover:bg-[#c4652a] transition-colors"
          >
            <Plus className="size-4" />
            Nueva integración
          </button>
        </div>
      </div>

      {/* Grid */}
      {integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-800/50 border border-slate-700 mb-4">
            <Plug className="size-8 text-slate-600" />
          </div>
          <p className="text-lg font-medium text-slate-300">Sin integraciones</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">
            Conectá Freia con HubSpot, Salesforce, SAP u otros sistemas via API
          </p>
          <button
            onClick={handleNew}
            className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#dd7430] text-white hover:bg-[#c4652a] transition-colors"
          >
            <Plus className="size-4" />
            Crear primera integración
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {integrations.map((integration) => {
            const retryCount = retryQueue.filter((e) => e.integrationId === integration.id).length;
            const dlqCount = dlq.filter((e) => e.integrationId === integration.id).length;
            return (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                isTesting={testingId === integration.id}
                logCount={syncLogs.filter((l) => l.integrationId === integration.id).length}
                retryCount={retryCount}
                dlqCount={dlqCount}
                onEdit={() => handleEdit(integration)}
                onDelete={() => setDeletingId(integration.id)}
                onTest={() => handleQuickTest(integration)}
                onLog={() => setLogIntegration(integration)}
                onSimulate={() => setSimulateIntegration(integration)}
                onResilience={() => setResilienceIntegration(integration)}
              />
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <IntegrationModal
          editingIntegration={editingIntegration}
          onClose={() => {
            setShowModal(false);
            setEditingIntegration(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Webhook simulate */}
      {simulateIntegration && (
        <WebhookSimulateModal
          integration={simulateIntegration}
          onClose={() => setSimulateIntegration(null)}
          onSimulate={(eventType, payload, result) => {
            addSyncLog({
              integrationId: simulateIntegration.id,
              eventType,
              status: result.status,
              message: result.message,
              mappedFields: result.mappedFields,
              payloadPreview: JSON.stringify(payload).slice(0, 200),
            });
          }}
          onFail={(eventType, payload) => {
            enqueueRetry({
              integrationId: simulateIntegration.id,
              eventType,
              payload,
              payloadPreview: JSON.stringify(payload).slice(0, 200),
              attempts: 1,
              maxRetries: simulateIntegration.maxRetries ?? 3,
              nextRetryAt: new Date(
                Date.now() + (simulateIntegration.retryDelayMs ?? 30000)
              ).toISOString(),
              lastError: "Connection timeout (simulado)",
            });
          }}
        />
      )}

      {/* Webhook log drawer */}
      {logIntegration && (
        <WebhookLogDrawer
          integration={logIntegration}
          logs={syncLogs.filter((l) => l.integrationId === logIntegration.id)}
          onClear={() => clearSyncLogs(logIntegration.id)}
          onClose={() => setLogIntegration(null)}
          onSimulate={() => {
            setLogIntegration(null);
            setSimulateIntegration(logIntegration);
          }}
        />
      )}

      {/* Resilience drawer */}
      {resilienceIntegration && (
        <ResilienceDrawer
          integration={resilienceIntegration}
          retryQueue={retryQueue.filter((e) => e.integrationId === resilienceIntegration.id)}
          dlq={dlq.filter((e) => e.integrationId === resilienceIntegration.id)}
          onRetry={(entryId) => processRetry(entryId, resilienceIntegration)}
          onClearDLQ={() => clearDLQ(resilienceIntegration.id)}
          onClose={() => setResilienceIntegration(null)}
        />
      )}

      {/* Delete confirmation */}
      {deletingIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-900/30 border border-red-800/50 shrink-0">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">Eliminar integración</h3>
                <p className="text-sm text-slate-400 mt-1">
                  ¿Eliminar{" "}
                  <span className="font-medium text-white">{deletingIntegration.name}</span>?
                  Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => setDeletingId(null)}
                className="p-1 rounded text-slate-500 hover:text-white transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId!)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Integration Card ---

interface IntegrationCardProps {
  integration: Integration;
  isTesting: boolean;
  logCount: number;
  retryCount: number;
  dlqCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onLog: () => void;
  onSimulate: () => void;
  onResilience: () => void;
}

function IntegrationCard({
  integration,
  isTesting,
  logCount,
  retryCount,
  dlqCount,
  onEdit,
  onDelete,
  onTest,
  onLog,
  onSimulate,
  onResilience,
}: IntegrationCardProps) {
  const meta = INTEGRATION_TYPES[integration.type];
  const resilienceCount = retryCount + dlqCount;

  return (
    <div className="group relative rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 transition-colors hover:border-slate-600">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex size-9 items-center justify-center rounded-lg text-xs font-bold border shrink-0 ${meta.color} ${meta.bg} ${meta.border}`}
          >
            {meta.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{integration.name}</p>
            <span
              className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border mt-0.5 ${meta.color} ${meta.bg} ${meta.border}`}
            >
              {meta.label}
            </span>
          </div>
        </div>

        {/* Active badge */}
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
            integration.active
              ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800/50"
              : "bg-slate-700 text-slate-500 border border-slate-600"
          }`}
        >
          {integration.active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Description */}
      {integration.description && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{integration.description}</p>
      )}

      {/* Endpoint */}
      <div className="flex items-center gap-1.5 mb-3">
        <Globe className="size-3 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500 truncate font-mono">
          {integration.baseEndpoint || "Sin endpoint"}
        </span>
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400 border border-purple-800/30">
          <Lock className="size-2.5" />
          {integration.credentials.length} cred.
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-900/20 text-sky-400 border border-sky-800/30">
          <ArrowLeftRight className="size-2.5" />
          {integration.fieldMappings.length} mapeos
        </span>

        {/* Last test result */}
        {integration.lastTestResult === "success" && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-900/20 text-emerald-400 border border-emerald-800/30">
            <CheckCircle className="size-2.5" />
            OK
          </span>
        )}
        {integration.lastTestResult === "error" && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-800/30">
            <XCircle className="size-2.5" />
            Error
          </span>
        )}
        {integration.lastTestResult === "unreachable" && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400 border border-amber-800/30">
            <XCircle className="size-2.5" />
            Sin alcance
          </span>
        )}
      </div>

      {/* Capability badges */}
      {integration.supportedCapabilities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-3">
          {integration.supportedCapabilities.slice(0, 3).map((cap) => {
            const capMeta = CAPABILITY_LABELS[cap];
            return (
              <span
                key={cap}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700/50 border border-slate-600/50 ${capMeta.color}`}
              >
                {capMeta.label}
              </span>
            );
          })}
          {integration.supportedCapabilities.length > 3 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-700/50 border border-slate-600/50 text-slate-400">
              +{integration.supportedCapabilities.length - 3} más
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-1 text-[10px] text-slate-600">
          <Clock className="size-2.5" />
          {integration.lastTestedAt
            ? `Probado ${relativeTime(integration.lastTestedAt)}`
            : `Creado ${relativeTime(integration.createdAt)}`}
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onSimulate}
            title="Simular evento webhook"
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
          >
            <Zap className="size-3.5" />
          </button>
          <button
            onClick={onLog}
            title="Ver log de sync"
            className="relative p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
          >
            <ScrollText className="size-3.5" />
            {logCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-sky-500 text-[8px] font-bold text-white">
                {logCount > 9 ? "9+" : logCount}
              </span>
            )}
          </button>
          <button
            onClick={onResilience}
            title="Cola de reintentos y DLQ"
            className="relative p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-900/20 transition-colors"
          >
            <ShieldAlert className="size-3.5" />
            {resilienceCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                {resilienceCount > 9 ? "9+" : resilienceCount}
              </span>
            )}
          </button>
          <button
            onClick={onTest}
            disabled={isTesting || !integration.baseEndpoint}
            title="Test Connection"
            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plug className="size-3.5" />
            )}
          </button>
          <button
            onClick={onEdit}
            title="Editar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Eliminar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
