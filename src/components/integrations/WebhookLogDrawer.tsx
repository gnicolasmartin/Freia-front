"use client";

import { useState } from "react";
import {
  X,
  Zap,
  Trash2,
  ScrollText,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Integration, WebhookSyncLog } from "@/types/integration";

interface WebhookLogDrawerProps {
  integration: Integration;
  logs: WebhookSyncLog[];
  onClear: () => void;
  onClose: () => void;
  onSimulate: () => void;
}

type FilterStatus = "all" | "processed" | "ignored" | "error";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `Hace ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `Hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function StatusBadge({ status }: { status: WebhookSyncLog["status"] }) {
  const map = {
    processed: "bg-emerald-900/30 text-emerald-400 border-emerald-800/50",
    ignored: "bg-slate-700/50 text-slate-400 border-slate-600/50",
    error: "bg-red-900/30 text-red-400 border-red-800/50",
  };
  const labels = { processed: "Procesado", ignored: "Ignorado", error: "Error" };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function LogEntry({ log }: { log: WebhookSyncLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasMappedFields = (log.mappedFields?.length ?? 0) > 0;

  return (
    <div className="border border-slate-700/50 rounded-xl bg-slate-800/30 overflow-hidden">
      <div
        className={`px-3 py-2.5 ${hasMappedFields ? "cursor-pointer hover:bg-slate-700/20" : ""}`}
        onClick={() => hasMappedFields && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            {relativeTime(log.receivedAt)}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-900/20 text-sky-400 border border-sky-800/30 truncate">
            {log.eventType}
          </span>
          <StatusBadge status={log.status} />
          {hasMappedFields && (
            <span className="ml-auto text-slate-500 shrink-0">
              {expanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </span>
          )}
        </div>
        {log.message && (
          <p className="text-[11px] text-slate-400 truncate">{log.message}</p>
        )}
      </div>

      {expanded && hasMappedFields && (
        <div className="px-3 pb-2.5 border-t border-slate-700/30 pt-2 space-y-1">
          {log.mappedFields!.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1 text-[10px] font-mono bg-slate-800/50 rounded-lg px-2.5 py-1"
            >
              <span className="text-sky-400 truncate">{f.externalField}</span>
              <ArrowRight className="size-2.5 text-slate-600 shrink-0" />
              <span className="text-emerald-400 truncate">{f.freiaField}</span>
              <span className="text-slate-500 ml-auto shrink-0 max-w-[80px] truncate">
                {String(f.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FILTER_LABELS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "processed", label: "Procesados" },
  { value: "ignored", label: "Ignorados" },
  { value: "error", label: "Error" },
];

export default function WebhookLogDrawer({
  integration,
  logs,
  onClear,
  onClose,
  onSimulate,
}: WebhookLogDrawerProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");

  const filtered = filter === "all" ? logs : logs.filter((l) => l.status === filter);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-96 flex flex-col border-l border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ScrollText className="size-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{integration.name}</p>
              <p className="text-[10px] text-slate-500">
                {logs.length} evento{logs.length !== 1 ? "s" : ""} registrado{logs.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onSimulate}
              title="Simular evento"
              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
            >
              <Zap className="size-3.5" />
            </button>
            {logs.length > 0 && (
              <button
                onClick={onClear}
                title="Limpiar log"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-700/50 shrink-0">
          {FILTER_LABELS.map((f) => {
            const count =
              f.value === "all"
                ? logs.length
                : logs.filter((l) => l.status === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  filter === f.value
                    ? "bg-sky-900/40 text-sky-400 border border-sky-800/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className="ml-1 text-[9px] opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-slate-800/50 border border-slate-700 mb-3">
                <ScrollText className="size-5 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-400">Sin eventos</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                {logs.length === 0
                  ? "Simulá un evento para ver el resultado en el log"
                  : "No hay eventos con este filtro"}
              </p>
              {logs.length === 0 && (
                <button
                  onClick={onSimulate}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600/20 text-sky-400 border border-sky-800/50 hover:bg-sky-600/30 transition-colors"
                >
                  <Zap className="size-3" />
                  Simular evento
                </button>
              )}
            </div>
          ) : (
            filtered.map((log) => <LogEntry key={log.id} log={log} />)
          )}
        </div>

        {/* Footer stats */}
        {logs.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle className="size-3 text-emerald-400" />
                {logs.filter((l) => l.status === "processed").length} procesados
              </span>
              <span>
                {logs.filter((l) => l.status === "ignored").length} ignorados
              </span>
              {logs.filter((l) => l.status === "error").length > 0 && (
                <span className="text-red-400">
                  {logs.filter((l) => l.status === "error").length} errores
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
