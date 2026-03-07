"use client";

import { useState } from "react";
import { X, ShieldAlert, RotateCcw, Inbox, Clock, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import type { Integration, RetryQueueEntry, DLQEntry } from "@/types/integration";

interface ResilienceDrawerProps {
  integration: Integration;
  retryQueue: RetryQueueEntry[];
  dlq: DLQEntry[];
  onRetry: (entryId: string) => "success" | "retry" | "dlq";
  onClearDLQ: () => void;
  onClose: () => void;
}

type Tab = "queue" | "dlq";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function futureRelativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Ahora";
  const mins = Math.ceil(diff / 60_000);
  if (mins < 60) return `En ${mins}min`;
  const hours = Math.ceil(mins / 60);
  return `En ${hours}h`;
}

interface RetryResult {
  entryId: string;
  outcome: "success" | "retry" | "dlq";
}

export default function ResilienceDrawer({
  integration,
  retryQueue,
  dlq,
  onRetry,
  onClearDLQ,
  onClose,
}: ResilienceDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [retryResults, setRetryResults] = useState<RetryResult[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = (entryId: string) => {
    setRetryingId(entryId);
    // Simulate async
    setTimeout(() => {
      const outcome = onRetry(entryId);
      setRetryResults((prev) => [...prev, { entryId, outcome }]);
      setRetryingId(null);
    }, 600);
  };

  const getRetryResult = (entryId: string) =>
    retryResults.find((r) => r.entryId === entryId);

  const tabClasses = (tab: Tab) =>
    `flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-slate-700 text-white"
        : "text-slate-400 hover:text-white"
    }`;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[440px] flex flex-col border-l border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-700/30">
            <ShieldAlert className="size-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Resiliencia</h2>
            <p className="text-[11px] text-slate-400">{integration.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 py-3 bg-slate-800/40 border-b border-slate-700/50 shrink-0">
        <button onClick={() => setActiveTab("queue")} className={tabClasses("queue")}>
          Cola de reintentos
          {retryQueue.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
              {retryQueue.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab("dlq")} className={tabClasses("dlq")}>
          Dead Letter Queue
          {dlq.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold">
              {dlq.length}
            </span>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "queue" ? (
          <RetryQueueTab
            entries={retryQueue}
            retryingId={retryingId}
            getRetryResult={getRetryResult}
            onRetry={handleRetry}
          />
        ) : (
          <DLQTab
            entries={dlq}
            integrationId={integration.id}
            integration={integration}
            onRetry={handleRetry}
            onClearDLQ={onClearDLQ}
            retryingId={retryingId}
            getRetryResult={getRetryResult}
          />
        )}
      </div>
    </div>
  );
}

// --- Retry Queue Tab ---

interface RetryQueueTabProps {
  entries: RetryQueueEntry[];
  retryingId: string | null;
  getRetryResult: (id: string) => RetryResult | undefined;
  onRetry: (id: string) => void;
}

function RetryQueueTab({ entries, retryingId, getRetryResult, onRetry }: RetryQueueTabProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-5">
        <div className="flex size-12 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 mb-3">
          <Inbox className="size-6 text-slate-600" />
        </div>
        <p className="text-sm font-medium text-slate-400">Sin eventos en cola</p>
        <p className="text-xs text-slate-600 mt-1">
          Los eventos con fallo de conexión aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {entries.map((entry) => {
        const result = getRetryResult(entry.id);
        const progress = Math.round((entry.attempts / entry.maxRetries) * 100);

        return (
          <div
            key={entry.id}
            className="rounded-xl border border-slate-700 bg-slate-800/40 p-4"
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-900/20 text-amber-400 border border-amber-800/30 shrink-0">
                  <RotateCcw className="size-2.5" />
                  {entry.eventType}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
                <Clock className="size-2.5" />
                {relativeTime(entry.createdAt)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">
                  Intento {entry.attempts} / {entry.maxRetries}
                </span>
                <span className="text-[10px] text-slate-500">
                  Próximo: {futureRelativeTime(entry.nextRetryAt)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Error */}
            <p className="text-[10px] text-slate-500 mb-3 flex items-start gap-1">
              <AlertTriangle className="size-3 shrink-0 mt-0.5 text-amber-600" />
              {entry.lastError}
            </p>

            {/* Result feedback */}
            {result && (
              <div
                className={`mb-2 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                  result.outcome === "success"
                    ? "bg-emerald-900/20 border border-emerald-800/30 text-emerald-400"
                    : result.outcome === "dlq"
                    ? "bg-red-900/20 border border-red-800/30 text-red-400"
                    : "bg-amber-900/20 border border-amber-800/30 text-amber-400"
                }`}
              >
                {result.outcome === "success" ? (
                  <CheckCircle className="size-3 shrink-0" />
                ) : (
                  <AlertTriangle className="size-3 shrink-0" />
                )}
                {result.outcome === "success"
                  ? "Procesado correctamente"
                  : result.outcome === "dlq"
                  ? "Movido a Dead Letter Queue"
                  : "Reintentando — intento incrementado"}
              </div>
            )}

            {/* Retry button */}
            {!result && (
              <button
                onClick={() => onRetry(entry.id)}
                disabled={retryingId === entry.id}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-700/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              >
                <RotateCcw className={`size-3 ${retryingId === entry.id ? "animate-spin" : ""}`} />
                {retryingId === entry.id ? "Reintentando..." : "Reintentar ahora"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- DLQ Tab ---

interface DLQTabProps {
  entries: DLQEntry[];
  integrationId: string;
  integration: Integration;
  onRetry: (id: string) => void;
  onClearDLQ: () => void;
  retryingId: string | null;
  getRetryResult: (id: string) => RetryResult | undefined;
}

function DLQTab({ entries, onRetry, onClearDLQ, retryingId, getRetryResult }: DLQTabProps) {
  return (
    <div className="p-4 space-y-3">
      {entries.length > 0 && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-500">{entries.length} evento(s) sin procesar</p>
          <button
            onClick={onClearDLQ}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="size-3" />
            Limpiar DLQ
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 mb-3">
            <CheckCircle className="size-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-slate-400">DLQ vacía</p>
          <p className="text-xs text-slate-600 mt-1">
            Los eventos que agotaron sus reintentos aparecerán aquí
          </p>
        </div>
      ) : (
        entries.map((entry) => {
          const result = getRetryResult(entry.id);
          return (
            <div
              key={entry.id}
              className="rounded-xl border border-red-900/30 bg-red-900/5 p-4"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-800/30 shrink-0">
                  <AlertTriangle className="size-2.5" />
                  {entry.eventType}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
                  <Clock className="size-2.5" />
                  {relativeTime(entry.failedAt)}
                </span>
              </div>

              {/* Attempts badge */}
              <p className="text-[11px] text-slate-400 mb-2">
                <span className="font-semibold text-red-400">{entry.attempts}</span> intentos fallidos
              </p>

              {/* Error */}
              <p className="text-[10px] text-slate-500 mb-3 flex items-start gap-1">
                <AlertTriangle className="size-3 shrink-0 mt-0.5 text-red-600" />
                {entry.lastError}
              </p>

              {/* Result feedback */}
              {result && (
                <div className="mb-2 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 bg-amber-900/20 border border-amber-800/30 text-amber-400">
                  <RotateCcw className="size-3 shrink-0" />
                  Enviado a cola de reintentos
                </div>
              )}

              {!result && (
                <button
                  onClick={() => onRetry(entry.id)}
                  disabled={retryingId === entry.id}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-700/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`size-3 ${retryingId === entry.id ? "animate-spin" : ""}`} />
                  {retryingId === entry.id ? "Procesando..." : "Reintentar manualmente"}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
