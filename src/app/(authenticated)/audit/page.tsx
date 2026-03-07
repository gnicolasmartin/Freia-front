"use client";

import React, { useState, useMemo } from "react";
import {
  ClipboardList,
  Wrench,
  Search,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Activity,
  Trash2,
  AlertTriangle,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Download,
  ChevronDown,
  ChevronRight,
  Brain,
  Clock,
  MessageCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ShoppingCart,
  Package,
  Tag,
  Layers,
  Globe,
  Users,
} from "lucide-react";
import { getStockAuditLog, clearStockAuditLog } from "@/lib/stock-audit";
import type { StockAuditEntry, StockAuditEntityType } from "@/types/stock-audit";
import { ACTION_CONFIG, ENTITY_LABELS } from "@/types/stock-audit";
import { useAuditLog } from "@/providers/AuditLogProvider";
import { useAgentDecisionLog } from "@/providers/AgentDecisionLogProvider";
import { useToolExecutionHistory } from "@/providers/ToolExecutionHistoryProvider";
import { useWhatsAppAudit } from "@/providers/WhatsAppAuditProvider";
import type { WhatsAppAuditEntry, WhatsAppAuditEventType } from "@/types/whatsapp-audit";
import type {
  AuditViolationType,
  ToolExecutionResult,
  AuditLogEntry,
  AgentStatusChangeEntry,
  FrontPublishEntry,
} from "@/types/audit";
import {
  VIOLATION_TYPE_LABELS,
  VIOLATION_TYPE_CONFIG,
  TOOL_EXECUTION_RESULT_CONFIG,
} from "@/types/audit";
import { CATEGORY_COLORS, TOOL_CATEGORIES } from "@/types/tool-registry";
import type { AgentDecisionType } from "@/types/agent-decision";
import { DECISION_TYPE_CONFIG } from "@/types/agent-decision";
import { getFrontAuditLog, clearFrontAuditLog } from "@/lib/front-audit";
import type { FrontAuditEntry, FrontAuditAction } from "@/types/front-audit";
import { FRONT_AUDIT_ACTION_CONFIG } from "@/types/front-audit";

// ─── shared helpers ───────────────────────────────────────────────────────────

const TYPE_ICONS: Record<AuditViolationType, typeof ShieldAlert> = {
  policy_violation: ShieldAlert,
  authority_violation: ShieldCheck,
  escalation_trigger: Flame,
  risk_threshold: Activity,
  input_classification: Eye,
};

const ACTION_LABELS: Record<string, string> = {
  block: "Bloqueada",
  escalate: "Escalada",
  reformulate: "Reformulada",
  flag: "Marcada",
  notify: "Notificada",
  warn: "Advertencia",
  ignore: "Ignorada",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const inputClasses =
  "px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white text-sm focus:outline-none focus:border-[#dd7430]/50 placeholder:text-slate-500";

// ─── page ─────────────────────────────────────────────────────────────────────

type Tab = "violations" | "tools" | "decisions" | "whatsapp" | "stock" | "fronts";

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<Tab>("tools");

  const tabClasses = (tab: Tab) =>
    `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeTab === tab
        ? "bg-slate-700 text-white"
        : "text-slate-400 hover:text-white hover:bg-slate-700/40"
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ClipboardList className="size-7 text-[#dd7430]" />
          Auditoría
        </h1>
        <p className="text-slate-400 mt-1">
          Historial operativo de herramientas, decisiones del agente y violaciones de políticas
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-800/50 rounded-xl border border-slate-700 p-1 w-fit">
        <button onClick={() => setActiveTab("tools")} className={tabClasses("tools")}>
          <Wrench className="size-4" />
          Herramientas ejecutadas
        </button>
        <button onClick={() => setActiveTab("decisions")} className={tabClasses("decisions")}>
          <Brain className="size-4" />
          Decisiones del agente
        </button>
        <button onClick={() => setActiveTab("violations")} className={tabClasses("violations")}>
          <ShieldAlert className="size-4" />
          Violaciones de políticas
        </button>
        <button onClick={() => setActiveTab("whatsapp")} className={tabClasses("whatsapp")}>
          <MessageCircle className="size-4" />
          WhatsApp
        </button>
        <button onClick={() => setActiveTab("stock")} className={tabClasses("stock")}>
          <ShoppingCart className="size-4" />
          Catálogo
        </button>
        <button onClick={() => setActiveTab("fronts")} className={tabClasses("fronts")}>
          <Globe className="size-4" />
          Fronts
        </button>
      </div>

      {activeTab === "tools" ? (
        <ToolsTab />
      ) : activeTab === "decisions" ? (
        <DecisionsTab />
      ) : activeTab === "violations" ? (
        <ViolationsTab />
      ) : activeTab === "whatsapp" ? (
        <WhatsAppTab />
      ) : activeTab === "stock" ? (
        <StockAuditTab />
      ) : (
        <FrontsAuditTab />
      )}
    </div>
  );
}

// ─── tool executions tab ──────────────────────────────────────────────────────

function ToolsTab() {
  const { entries, isLoading, clearHistory } = useToolExecutionHistory();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<ToolExecutionResult | "all">("all");
  const [filterUser, setFilterUser] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Unique users in dataset
  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.userId, e.userName);
    return Array.from(map.entries());
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (filterCategory !== "all" && e.toolCategory !== filterCategory) return false;
      if (filterResult !== "all" && e.result !== filterResult) return false;
      if (filterUser !== "all" && e.userId !== filterUser) return false;
      if (dateFrom && new Date(e.timestamp) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(e.timestamp) >= to) return false;
      }
      if (q) {
        const haystack = `${e.toolName} ${e.flowName} ${e.userName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filterCategory, filterResult, filterUser, dateFrom, dateTo, search]);

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ["Fecha", "Herramienta", "Categoría", "Resultado", "Flujo", "Fuente", "Usuario", "Duración", "Error"],
      ...filtered.map((e) => [
        formatDateTime(e.timestamp),
        e.toolName,
        e.toolCategory,
        e.result,
        e.flowName,
        e.simulationSource,
        e.userName,
        e.durationMs !== undefined ? String(e.durationMs) : "",
        e.error ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `herramientas_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dd7430]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
        {/* Row 1: search + dates */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por herramienta, flujo o usuario..."
              className={`${inputClasses} pl-10 w-full`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClasses} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClasses} />
          </div>
        </div>

        {/* Row 2: selects */}
        <div className="flex flex-wrap gap-3">
          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={inputClasses}
          >
            <option value="all">Todos los tipos</option>
            {TOOL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {/* Result */}
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as ToolExecutionResult | "all")}
            className={inputClasses}
          >
            <option value="all">Todos los resultados</option>
            <option value="success">Exitoso</option>
            <option value="error">Error</option>
          </select>

          {/* User */}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className={inputClasses}
          >
            <option value="all">Todos los usuarios</option>
            {users.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {filtered.length} de {entries.length} ejecuciones
        </p>
        <div className="flex gap-2">
          {filtered.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-sky-900/20 text-sky-400 border border-sky-800/40 hover:bg-sky-900/40 transition-colors"
            >
              <Download className="size-4" />
              Exportar CSV
            </button>
          )}
          {entries.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/20 text-red-400 border border-red-800/40 hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="size-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState icon={Wrench} title="Sin ejecuciones registradas" subtitle="Las herramientas ejecutadas durante simulaciones aparecerán aquí" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" subtitle="Ajustá los filtros para ver más registros" />
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Herramienta</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Resultado</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Flujo</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Usuario</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Duración</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((entry) => {
                  const resultConfig = TOOL_EXECUTION_RESULT_CONFIG[entry.result];
                  const catColors = CATEGORY_COLORS[entry.toolCategory];
                  const isExpanded = expandedId === entry.id;

                  return (
                    <>
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                          {formatDateTime(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${catColors.text} ${catColors.bg} ${catColors.border}`}
                            >
                              {entry.toolCategory.toUpperCase()}
                            </span>
                            <span className="text-sm text-white font-medium">{entry.toolName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${resultConfig.bgClass} ${resultConfig.colorClass} ${resultConfig.borderClass}`}
                          >
                            {entry.result === "success" ? (
                              <CheckCircle className="size-3" />
                            ) : (
                              <XCircle className="size-3" />
                            )}
                            {resultConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          <span className="font-medium">{entry.flowName}</span>
                          <span className="text-slate-600 ml-1.5 text-xs">{entry.simulationSource}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{entry.userName}</td>
                        <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                          {formatDuration(entry.durationMs)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="bg-slate-900/40">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                                  Request
                                </p>
                                <pre className="text-xs text-slate-300 bg-slate-800/60 rounded-lg p-3 overflow-x-auto font-mono">
                                  {JSON.stringify(entry.request, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                                  {entry.error ? "Error" : "Response"}
                                </p>
                                {entry.error ? (
                                  <p className="text-xs text-red-400 bg-red-900/10 rounded-lg p-3 border border-red-900/30">
                                    {entry.error}
                                  </p>
                                ) : (
                                  <pre className="text-xs text-slate-300 bg-slate-800/60 rounded-lg p-3 overflow-x-auto font-mono">
                                    {JSON.stringify(entry.response ?? {}, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <ConfirmModal
          count={entries.length}
          label="ejecuciones de herramienta"
          onConfirm={() => { clearHistory(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── decisions tab ────────────────────────────────────────────────────────────

function durationColor(ms: number): string {
  if (ms < 500) return "text-emerald-400";
  if (ms < 2000) return "text-amber-400";
  return "text-red-400";
}

function DecisionsTab() {
  const { entries, isLoading, clearLog } = useAgentDecisionLog();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<AgentDecisionType>>(
    new Set(Object.keys(DECISION_TYPE_CONFIG) as AgentDecisionType[])
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toggleType = (type: AgentDecisionType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (!activeTypes.has(e.decisionType)) return false;
      if (dateFrom && new Date(e.timestamp) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(e.timestamp) >= to) return false;
      }
      if (q) {
        const haystack = `${e.agentName ?? ""} ${e.flowName ?? ""} ${e.modelName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, activeTypes, dateFrom, dateTo, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dd7430]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por agente, flujo o modelo..."
              className={`${inputClasses} pl-10 w-full`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClasses} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClasses} />
          </div>
        </div>

        {/* Type pills */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DECISION_TYPE_CONFIG) as AgentDecisionType[]).map((type) => {
            const active = activeTypes.has(type);
            const cfg = DECISION_TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? `${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`
                    : "bg-slate-900/30 text-slate-500 border-slate-700 opacity-50"
                }`}
              >
                <Brain className="size-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{filtered.length} de {entries.length} decisiones</p>
        {entries.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/20 text-red-400 border border-red-800/40 hover:bg-red-900/30 transition-colors"
          >
            <Trash2 className="size-4" />
            Limpiar registro
          </button>
        )}
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Sin decisiones registradas"
          subtitle="Las decisiones del agente durante simulaciones con API Key configurada aparecerán aquí"
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" subtitle="Ajustá los filtros para ver más registros" />
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Agente / Flujo</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Modelo</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Tiempo</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Resultado</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((entry) => {
                  const cfg = DECISION_TYPE_CONFIG[entry.decisionType];
                  const isExpanded = expandedId === entry.id;
                  return (
                    <>
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                          {formatDateTime(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`}>
                            <Brain className="size-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {entry.agentName && (
                            <span className="text-white font-medium">{entry.agentName}</span>
                          )}
                          {entry.flowName && (
                            <span className="text-slate-500 text-xs ml-1.5">{entry.flowName}</span>
                          )}
                          {!entry.agentName && !entry.flowName && (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-slate-300 font-mono">{entry.modelName}</span>
                          <span className="text-slate-600 text-xs ml-1.5">t={entry.temperature.toFixed(1)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-sm font-mono ${durationColor(entry.durationMs)}`}>
                            <Clock className="size-3.5" />
                            {entry.durationMs < 1000
                              ? `${entry.durationMs}ms`
                              : `${(entry.durationMs / 1000).toFixed(1)}s`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.success ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle className="size-3.5" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-400">
                              <XCircle className="size-3.5" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="bg-slate-900/40">
                          <td colSpan={7} className="px-6 py-4 space-y-4">
                            {/* Error message */}
                            {entry.errorMessage && (
                              <p className="text-xs text-red-400 bg-red-900/10 rounded-lg p-3 border border-red-900/30">
                                {entry.errorMessage}
                              </p>
                            )}

                            {/* Final result */}
                            {entry.responseContent && (
                              <div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                                  Resultado final
                                </p>
                                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">
                                  {entry.responseContent}
                                </p>
                              </div>
                            )}

                            {/* Tool calls */}
                            {entry.toolCalls && entry.toolCalls.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                                  Tool calls ({entry.toolCalls.length})
                                </p>
                                <div className="space-y-2">
                                  {entry.toolCalls.map((tc, i) => (
                                    <div key={i} className="bg-emerald-900/10 border border-emerald-800/30 rounded-lg p-3">
                                      <p className="text-xs font-mono text-emerald-400 mb-1.5">{tc.functionName}</p>
                                      <pre className="text-xs text-slate-300 overflow-x-auto font-mono">
                                        {JSON.stringify(tc.arguments, null, 2)}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Prompt messages */}
                            <div>
                              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                                Prompt generado ({entry.promptMessages.length} mensajes)
                              </p>
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {entry.promptMessages.map((msg, i) => (
                                  <div
                                    key={i}
                                    className={`rounded-lg p-3 text-xs border ${
                                      msg.role === "system"
                                        ? "bg-purple-900/10 border-purple-800/30 text-purple-300"
                                        : msg.role === "assistant"
                                        ? "bg-slate-800/60 border-slate-700/50 text-slate-300"
                                        : msg.role === "tool"
                                        ? "bg-emerald-900/10 border-emerald-800/30 text-emerald-300"
                                        : "bg-sky-900/10 border-sky-800/30 text-sky-300"
                                    }`}
                                  >
                                    <span className="font-mono font-semibold uppercase text-[10px] opacity-70 mr-2">
                                      [{msg.role}]
                                    </span>
                                    {msg.toolCallSummary ? (
                                      <span className="italic">{msg.toolCallSummary}</span>
                                    ) : (
                                      <span className="whitespace-pre-wrap break-words">
                                        {msg.content ?? "—"}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmModal
          count={entries.length}
          label="decisiones del agente"
          onConfirm={() => { clearLog(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── violations tab (existing content, kept intact) ───────────────────────────

function ViolationsTab() {
  const { entries, isLoading, clearLog } = useAuditLog();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<AuditViolationType>>(
    new Set(["policy_violation", "authority_violation", "escalation_trigger", "risk_threshold", "input_classification"])
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toggleType = (type: AuditViolationType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  type ViolationEntry = Exclude<AuditLogEntry, AgentStatusChangeEntry | FrontPublishEntry>;

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return entries
      .filter((e): e is ViolationEntry => e.type !== "agent_status_change" && e.type !== "front_published" && e.type !== "front_unpublished")
      .filter((e) => {
        if (!activeTypes.has(e.type)) return false;
        if (dateFrom && new Date(e.timestamp) < new Date(dateFrom)) return false;
        if (dateTo) {
          const to = new Date(dateTo);
          to.setDate(to.getDate() + 1);
          if (new Date(e.timestamp) >= to) return false;
        }
        if (lowerSearch) {
          const haystack = `${e.policyName} ${e.flowName}`.toLowerCase();
          if (!haystack.includes(lowerSearch)) return false;
        }
        return true;
      });
  }, [entries, activeTypes, dateFrom, dateTo, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dd7430]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por política o flujo..."
              className={`${inputClasses} pl-10 w-full`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClasses} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClasses} />
          </div>
        </div>

        {/* Type pills */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VIOLATION_TYPE_LABELS) as AuditViolationType[]).map((type) => {
            const active = activeTypes.has(type);
            const config = VIOLATION_TYPE_CONFIG[type];
            const Icon = TYPE_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? `${config.bgClass} ${config.colorClass} ${config.borderClass}`
                    : "bg-slate-900/30 text-slate-500 border-slate-700 opacity-50"
                }`}
              >
                <Icon className="size-3.5" />
                {VIOLATION_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{filtered.length} de {entries.length} registros</p>
        {entries.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/20 text-red-400 border border-red-800/40 hover:bg-red-900/30 transition-colors"
          >
            <Trash2 className="size-4" />
            Limpiar registro
          </button>
        )}
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin registros" subtitle="Las violaciones de políticas detectadas en simulaciones aparecerán aquí" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" subtitle="Ajustá los filtros para ver más registros" />
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Política</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Acción</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Contexto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((entry) => {
                  const config = VIOLATION_TYPE_CONFIG[entry.type];
                  const Icon = TYPE_ICONS[entry.type];
                  return (
                    <tr key={entry.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                        {formatDateTime(entry.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.colorClass} border ${config.borderClass}`}>
                          <Icon className="size-3.5" />
                          {VIOLATION_TYPE_LABELS[entry.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-medium">{entry.policyName}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        <span className="text-slate-300">{entry.flowName}</span>
                        <span className="text-slate-600 mx-1.5">·</span>
                        <span className="text-slate-500">{entry.simulationSource}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmModal
          count={entries.length}
          label="registros de auditoría"
          onConfirm={() => { clearLog(); setShowClearConfirm(false); }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── shared sub-components ────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
      <Icon className="size-12 text-slate-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-slate-300">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function ConfirmModal({
  count,
  label,
  onConfirm,
  onCancel,
}: {
  count: number;
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-full bg-red-900/30">
            <AlertTriangle className="size-5 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Limpiar registro</h3>
          <button onClick={onCancel} className="ml-auto p-1 text-slate-500 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-slate-300">
          Se eliminarán{" "}
          <span className="text-white font-medium">{count}</span>{" "}
          {label}. Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            Eliminar todo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp tab ──────────────────────────────────────────────────────────────

const WA_EVENT_CONFIG: Record<
  WhatsAppAuditEventType,
  { label: string; bgClass: string; colorClass: string; borderClass: string }
> = {
  outbound_sent:    { label: "Enviado",        bgClass: "bg-emerald-900/40", colorClass: "text-emerald-300", borderClass: "border-emerald-700/50" },
  outbound_failed:  { label: "Fallido",        bgClass: "bg-red-900/40",     colorClass: "text-red-300",     borderClass: "border-red-700/50" },
  template_sent:    { label: "Template",       bgClass: "bg-purple-900/40",  colorClass: "text-purple-300",  borderClass: "border-purple-700/50" },
  template_failed:  { label: "Template ✗",    bgClass: "bg-red-900/40",     colorClass: "text-red-300",     borderClass: "border-red-700/50" },
  status_update:    { label: "Estado",         bgClass: "bg-blue-900/40",    colorClass: "text-blue-300",    borderClass: "border-blue-700/50" },
  inbound_received: { label: "Entrada",        bgClass: "bg-slate-700/60",   colorClass: "text-slate-300",   borderClass: "border-slate-600/50" },
};

const WA_FILTER_LABELS: Array<{ key: WhatsAppAuditEventType | "all"; label: string }> = [
  { key: "all",             label: "Todos" },
  { key: "outbound_sent",   label: "Enviados" },
  { key: "template_sent",   label: "Templates" },
  { key: "status_update",   label: "Estados" },
  { key: "outbound_failed", label: "Fallidos" },
  { key: "template_failed", label: "Template ✗" },
  { key: "inbound_received",label: "Entradas" },
];

function DirectionIcon({ direction }: { direction: WhatsAppAuditEntry["direction"] }) {
  if (direction === "inbound")  return <ArrowDownLeft  className="size-3.5 text-slate-400" />;
  if (direction === "status")   return <ArrowLeftRight  className="size-3.5 text-blue-400" />;
  return <ArrowUpRight className="size-3.5 text-emerald-400" />;
}

function exportWhatsAppCsv(entries: WhatsAppAuditEntry[]) {
  const headers = ["Timestamp", "Tipo", "Dirección", "Número", "Contenido", "Message ID", "Template", "Nuevo Estado", "Error Code", "Error Title", "Error Message"];
  const rows = entries.map((e) => [
    e.timestamp,
    WA_EVENT_CONFIG[e.eventType].label,
    e.direction,
    e.phoneNumber,
    (e.contentPreview ?? "").replace(/"/g, '""'),
    e.messageId ?? "",
    e.templateName ?? "",
    e.newStatus ?? "",
    e.errorCode?.toString() ?? "",
    (e.errorTitle ?? "").replace(/"/g, '""'),
    (e.errorMessage ?? "").replace(/"/g, '""'),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `whatsapp-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WhatsAppTab() {
  const { entries, clearLog } = useWhatsAppAudit();
  const [phoneFilter, setPhoneFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<WhatsAppAuditEventType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [showClear, setShowClear] = useState(false);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.eventType !== typeFilter) return false;
      if (phoneFilter && !e.phoneNumber.includes(phoneFilter)) return false;
      if (dateFrom && e.timestamp < dateFrom) return false;
      if (dateTo && e.timestamp > dateTo + "T23:59:59") return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.phoneNumber.includes(q) &&
          !(e.messageId ?? "").toLowerCase().includes(q) &&
          !(e.contentPreview ?? "").toLowerCase().includes(q) &&
          !(e.templateName ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [entries, typeFilter, phoneFilter, dateFrom, dateTo, search]);

  return (
    <div className="space-y-4">
      {/* Event type filter pills */}
      <div className="flex flex-wrap gap-2">
        {WA_FILTER_LABELS.map(({ key, label }) => {
          const active = typeFilter === key;
          const cfg = key !== "all" ? WA_EVENT_CONFIG[key] : null;
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active && cfg
                  ? `${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`
                  : active
                    ? "bg-slate-700 text-white border-slate-600"
                    : "bg-slate-900/30 text-slate-500 border-slate-700 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search + date filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar número, ID, contenido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClasses} pl-9 w-full`}
          />
        </div>
        <input
          type="text"
          placeholder="+54911…"
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value)}
          className={`${inputClasses} w-40`}
          title="Filtrar por número (conversación)"
        />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClasses} title="Desde" />
        <input type="date" value={dateTo}   onChange={(e) => setDateTo(e.target.value)}   className={inputClasses} title="Hasta" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{filtered.length} de {entries.length} registros</p>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={() => exportWhatsAppCsv(filtered)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <Download className="size-4" />
              CSV
            </button>
          )}
          {entries.length > 0 && (
            <button
              onClick={() => setShowClear(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-900/20 text-red-400 border border-red-800/40 hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="size-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Sin actividad registrada"
          subtitle="Los envíos, recepciones y actualizaciones de estado de WhatsApp aparecerán aquí"
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" subtitle="Prueba ajustar los filtros de búsqueda" />
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80 border-b border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Dir.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Número</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Contenido</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Message ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((entry) => {
                const cfg = WA_EVENT_CONFIG[entry.eventType];
                const isFailed = entry.eventType === "outbound_failed" || entry.eventType === "template_failed";
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap" title={entry.timestamp}>
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <DirectionIcon direction={entry.direction} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {entry.phoneNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                      {entry.templateName
                        ? <span className="text-purple-400">[{entry.templateName}]</span>
                        : entry.newStatus
                          ? <span className="italic text-blue-400">{entry.newStatus}</span>
                          : entry.contentPreview || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {entry.messageId
                        ? <span title={entry.messageId}>{entry.messageId.slice(0, 20)}…</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {isFailed && (entry.errorCode || entry.errorMessage) ? (
                        <span className="text-red-400">
                          {entry.errorCode ? `${entry.errorCode}: ` : ""}{entry.errorTitle ?? entry.errorMessage}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showClear && (
        <ConfirmModal
          count={entries.length}
          label="registros de actividad WhatsApp"
          onConfirm={() => { clearLog(); setShowClear(false); }}
          onCancel={() => setShowClear(false)}
        />
      )}
    </div>
  );
}

// ─── stock audit tab ──────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<StockAuditEntityType, typeof Package> = {
  product: Package,
  discount: Tag,
  variant_type: Layers,
};

function StockAuditTab() {
  const [entries, setEntries] = useState<StockAuditEntry[]>(() => getStockAuditLog());
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState<StockAuditEntityType | "all">("all");
  const [filterAction, setFilterAction] = useState<"create" | "update" | "delete" | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClear, setShowClear] = useState(false);

  const refresh = () => setEntries(getStockAuditLog());

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterEntity !== "all" && e.entityType !== filterEntity) return false;
      if (filterAction !== "all" && !e.action.includes(filterAction)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.entityName.toLowerCase().includes(q) &&
          !e.userName.toLowerCase().includes(q) &&
          !e.entityId.toLowerCase().includes(q)
        )
          return false;
      }
      if (dateFrom && e.timestamp < new Date(dateFrom).toISOString()) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (e.timestamp > to.toISOString()) return false;
      }
      return true;
    });
  }, [entries, filterEntity, filterAction, search, dateFrom, dateTo]);

  const exportCsv = () => {
    const rows = [
      ["Fecha", "Entidad", "Acción", "Nombre", "Usuario", "Cambios"].join(","),
      ...filtered.map((e) =>
        [
          new Date(e.timestamp).toLocaleString("es-AR"),
          ENTITY_LABELS[e.entityType],
          ACTION_CONFIG[e.action].label,
          `"${e.entityName}"`,
          e.userName,
          `"${(e.changes ?? []).map((c) => `${c.field}: ${c.oldValue ?? ""} → ${c.newValue ?? ""}`).join("; ")}"`,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_catalogo_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario..."
            className={`${inputClasses} w-full pl-9`}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value as StockAuditEntityType | "all")}
          className={inputClasses}
        >
          <option value="all">Todos los tipos</option>
          <option value="product">Producto</option>
          <option value="discount">Descuento</option>
          <option value="variant_type">Tipo de variante</option>
        </select>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value as "create" | "update" | "delete" | "all")}
          className={inputClasses}
        >
          <option value="all">Todas las acciones</option>
          <option value="create">Creación</option>
          <option value="update">Modificación</option>
          <option value="delete">Eliminación</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={inputClasses}
          title="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={inputClasses}
          title="Hasta"
        />

        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="size-4" />
          CSV
        </button>

        <button
          onClick={() => setShowClear(true)}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="size-4" />
          Limpiar
        </button>
      </div>

      {/* Summary */}
      <p className="text-xs text-slate-500">
        {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== entries.length && ` (de ${entries.length} total)`}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="size-10 text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Sin registros de auditoría de catálogo</p>
          <p className="text-slate-500 text-xs mt-1">
            Los cambios en productos, descuentos y tipos de variante se registran aquí
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Usuario</th>
                <th className="px-4 py-3 text-left font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((entry) => {
                const cfg = ACTION_CONFIG[entry.action];
                const EntityIcon = ENTITY_ICONS[entry.entityType];
                const isExpanded = expandedId === entry.id;
                const hasChanges = (entry.changes?.length ?? 0) > 0;

                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className={`hover:bg-slate-800/40 transition-colors ${hasChanges ? "cursor-pointer" : ""}`}
                      onClick={() => hasChanges && setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 shrink-0" />
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-slate-300 text-xs">
                          <EntityIcon className="size-3.5 text-slate-500 shrink-0" />
                          {ENTITY_LABELS[entry.entityType]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bgClass} ${cfg.colorClass}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-medium max-w-48 truncate">
                        {entry.entityName}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{entry.userName}</td>
                      <td className="px-4 py-3">
                        {hasChanges ? (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            {entry.changes!.length} campo{entry.changes!.length !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasChanges && (
                      <tr className="bg-slate-900/60">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="space-y-1.5">
                            {entry.changes!.map((change, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                <span className="text-slate-500 w-32 shrink-0">{change.field}</span>
                                <span className="text-red-400 line-through truncate max-w-32">{change.oldValue ?? "—"}</span>
                                <span className="text-slate-500">→</span>
                                <span className="text-emerald-400 truncate max-w-32">{change.newValue ?? "—"}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showClear && (
        <ConfirmModal
          count={entries.length}
          label="registros de auditoría de catálogo"
          onConfirm={() => {
            clearStockAuditLog();
            refresh();
            setShowClear(false);
          }}
          onCancel={() => setShowClear(false)}
        />
      )}
    </div>
  );
}

// ─── fronts user management audit tab ────────────────────────────────────────

function FrontsAuditTab() {
  const [entries, setEntries] = useState<FrontAuditEntry[]>(() => getFrontAuditLog());
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<FrontAuditAction | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showClear, setShowClear] = useState(false);

  const refresh = () => setEntries(getFrontAuditLog());

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterAction !== "all" && e.action !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.visitorEmail.toLowerCase().includes(q) &&
          !(e.visitorName ?? "").toLowerCase().includes(q) &&
          !e.frontName.toLowerCase().includes(q) &&
          !(e.detail ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (dateFrom && e.timestamp < new Date(dateFrom).toISOString()) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (e.timestamp > to.toISOString()) return false;
      }
      return true;
    });
  }, [entries, filterAction, search, dateFrom, dateTo]);

  const exportCsv = () => {
    const rows = [
      ["Fecha", "Acción", "Front", "Email", "Nombre", "Detalle"].join(","),
      ...filtered.map((e) =>
        [
          new Date(e.timestamp).toLocaleString("es-AR"),
          FRONT_AUDIT_ACTION_CONFIG[e.action].label,
          `"${e.frontName}"`,
          e.visitorEmail,
          e.visitorName ?? "",
          `"${e.detail ?? ""}"`,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_fronts_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email, nombre, front..."
            className={`${inputClasses} w-full pl-9`}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value as FrontAuditAction | "all")}
          className={inputClasses}
        >
          <option value="all">Todas las acciones</option>
          <option value="visitor_created">Creado</option>
          <option value="visitor_updated">Editado</option>
          <option value="visitor_deleted">Eliminado</option>
          <option value="visitor_activated">Activado</option>
          <option value="visitor_deactivated">Desactivado</option>
          <option value="visitor_role_changed">Rol cambiado</option>
          <option value="visitor_permissions_changed">Permisos cambiados</option>
          <option value="visitor_invited">Invitado</option>
          <option value="visitor_password_reset">Reset contraseña</option>
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClasses} title="Desde" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClasses} title="Hasta" />

        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="size-4" />
          CSV
        </button>

        <button
          onClick={() => setShowClear(true)}
          disabled={entries.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-slate-800 text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="size-4" />
          Limpiar
        </button>
      </div>

      {/* Summary */}
      <p className="text-xs text-slate-500">
        {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
        {filtered.length !== entries.length && ` (de ${entries.length} total)`}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="size-10 text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Sin registros de gestión de usuarios de fronts</p>
          <p className="text-slate-500 text-xs mt-1">
            Las acciones sobre visitantes (crear, eliminar, activar/desactivar, cambio de rol) se registran aquí
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Acción</th>
                <th className="px-4 py-3 text-left font-medium">Front</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((entry) => {
                const cfg = FRONT_AUDIT_ACTION_CONFIG[entry.action];
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 shrink-0" />
                        {formatDateTime(entry.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bgClass} ${cfg.colorClass}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-32 truncate">{entry.frontName}</td>
                    <td className="px-4 py-3 text-white font-medium max-w-48 truncate">{entry.visitorEmail}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{entry.visitorName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-48 truncate">{entry.detail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showClear && (
        <ConfirmModal
          count={entries.length}
          label="registros de auditoría de fronts"
          onConfirm={() => {
            clearFrontAuditLog();
            refresh();
            setShowClear(false);
          }}
          onCancel={() => setShowClear(false)}
        />
      )}
    </div>
  );
}
