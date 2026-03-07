"use client";

import { useState, useMemo } from "react";
import {
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  X,
  Wrench,
  RefreshCw,
  Database,
  Users,
  CalendarDays,
  ShieldCheck,
  Bot,
  GitBranch,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { useConversations } from "@/providers/ConversationsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useAgents } from "@/providers/AgentsProvider";
import type { ConversationStatus } from "@/types/flow";

// --- Types ---

type GroupBy = "agent" | "date" | "resolution";

interface FilterState {
  agentId: string;
  resolution: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface EnrichedConversation {
  id: string;
  flowId: string;
  versionId: string;
  agentId?: string;
  currentNodeId: string;
  vars: Record<string, unknown>;
  status: ConversationStatus;
  startedAt: string;
  lastActivityAt: string;
  retryCount: Record<string, number>;
  toolExecutionLogs: Array<{
    nodeId: string;
    tool: string;
    timestamp: string;
    request: Record<string, unknown>;
    response?: Record<string, unknown>;
    error?: string;
    durationMs?: number;
  }>;
  flowName: string;
  agentName: string | undefined;
}

// --- Helpers ---

const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; icon: React.ReactNode; badgeClass: string; dotClass: string }
> = {
  active: {
    label: "En curso",
    icon: <Clock className="size-3.5" />,
    badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  completed: {
    label: "Resuelta",
    icon: <CheckCircle2 className="size-3.5" />,
    badgeClass: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    dotClass: "bg-sky-400",
  },
  abandoned: {
    label: "Abandonada",
    icon: <XCircle className="size-3.5" />,
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-400",
  },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateGroup(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function durationLabel(startedAt: string, lastActivityAt: string): string {
  const diffMs =
    new Date(lastActivityAt).getTime() - new Date(startedAt).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ${diffMin % 60}m`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// --- Main page ---

export default function ConversationsPage() {
  const { conversations, isLoading } = useConversations();
  const { flows } = useFlows();
  const { agents } = useAgents();

  const [groupBy, setGroupBy] = useState<GroupBy>("agent");
  const [filter, setFilter] = useState<FilterState>({
    agentId: "",
    resolution: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  // Enrich conversations with resolved names
  const enriched = useMemo<EnrichedConversation[]>(() => {
    return conversations.map((conv) => {
      const flow = flows.find((f) => f.id === conv.flowId);
      const agent = conv.agentId
        ? agents.find((a) => a.id === conv.agentId)
        : agents.find((a) => a.flowId === conv.flowId);
      return {
        ...conv,
        flowName: flow?.name ?? "Flujo desconocido",
        agentName: agent?.name,
      };
    });
  }, [conversations, flows, agents]);

  // Filter
  const filtered = useMemo(() => {
    return enriched.filter((conv) => {
      if (filter.agentId) {
        const agentForConv = conv.agentId
          ? conv.agentId
          : agents.find((a) => a.flowId === conv.flowId)?.id;
        if (agentForConv !== filter.agentId) return false;
      }
      if (filter.resolution && conv.status !== filter.resolution) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (
          !conv.flowName.toLowerCase().includes(q) &&
          !conv.id.toLowerCase().includes(q) &&
          !(conv.agentName?.toLowerCase().includes(q))
        )
          return false;
      }
      if (filter.dateFrom) {
        if (new Date(conv.startedAt) < new Date(filter.dateFrom)) return false;
      }
      if (filter.dateTo) {
        if (
          new Date(conv.startedAt) >
          new Date(filter.dateTo + "T23:59:59")
        )
          return false;
      }
      return true;
    });
  }, [enriched, filter, agents]);

  // Group — sort each group by startedAt desc
  const groups = useMemo(() => {
    const map = new Map<string, EnrichedConversation[]>();
    for (const conv of filtered) {
      let key: string;
      if (groupBy === "agent") {
        key = conv.agentName ?? "Sin agente asignado";
      } else if (groupBy === "date") {
        key = formatDateGroup(conv.startedAt);
      } else {
        key = STATUS_CONFIG[conv.status].label;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(conv);
    }
    // Sort items within each group newest first
    for (const items of map.values()) {
      items.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    }
    // Sort groups
    const entries = [...map.entries()];
    if (groupBy === "date") {
      entries.sort(
        (a, b) =>
          new Date(b[1][0].startedAt).getTime() -
          new Date(a[1][0].startedAt).getTime()
      );
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries;
  }, [filtered, groupBy]);

  // Initialize expanded groups when groups change
  const allGroupKeys = groups.map(([key]) => key).join(",");
  useMemo(() => {
    setExpandedGroups(new Set(groups.map(([key]) => key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroupKeys]);

  const selected = enriched.find((c) => c.id === selectedId);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeFilterCount = [
    filter.agentId,
    filter.resolution,
    filter.dateFrom,
    filter.dateTo,
  ].filter(Boolean).length;

  const groupByOptions: { value: GroupBy; label: string; icon: React.ReactNode }[] = [
    { value: "agent", label: "Agente", icon: <Bot className="size-3.5" /> },
    { value: "date", label: "Fecha", icon: <CalendarDays className="size-3.5" /> },
    {
      value: "resolution",
      label: "Resolución",
      icon: <ShieldCheck className="size-3.5" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Cargando conversaciones...
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Left panel — list */}
      <div
        className={`flex flex-col gap-3 transition-all duration-300 ${
          selected ? "w-[420px] shrink-0" : "flex-1"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Conversaciones</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {filtered.length} conversacion{filtered.length !== 1 ? "es" : ""}
              {conversations.length !== filtered.length &&
                ` de ${conversations.length}`}
            </p>
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-[#dd7430]/20 text-[#dd7430] border border-[#dd7430]/30"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 bg-[#dd7430] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por agente, flujo o ID..."
            value={filter.search}
            onChange={(e) =>
              setFilter((f) => ({ ...f, search: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-1 focus:ring-[#dd7430]/30 transition-all"
          />
          {filter.search && (
            <button
              onClick={() => setFilter((f) => ({ ...f, search: "" }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Agente
                </label>
                <select
                  value={filter.agentId}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, agentId: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
                >
                  <option value="">Todos los agentes</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Resolución
                </label>
                <select
                  value={filter.resolution}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, resolution: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
                >
                  <option value="">Todas</option>
                  <option value="active">En curso</option>
                  <option value="completed">Resuelta</option>
                  <option value="abandoned">Abandonada</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Desde
                </label>
                <input
                  type="date"
                  value={filter.dateFrom}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, dateFrom: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filter.dateTo}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, dateTo: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() =>
                  setFilter({
                    agentId: "",
                    resolution: "",
                    search: "",
                    dateFrom: "",
                    dateTo: "",
                  })
                }
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Group by controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Agrupar por:</span>
          <div className="flex gap-1">
            {groupByOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  groupBy === opt.value
                    ? "bg-[#dd7430]/20 text-[#dd7430] border border-[#dd7430]/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/30 py-16 text-center">
              <MessageSquare className="size-10 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">
                No hay conversaciones
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Las conversaciones aparecerán aquí cuando los agentes comiencen
                a operar.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/30 py-12 text-center">
              <Search className="size-8 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">Sin resultados</p>
              <p className="text-slate-500 text-sm mt-1">
                Ajusta los filtros de búsqueda.
              </p>
            </div>
          ) : (
            groups.map(([groupKey, items]) => (
              <div key={groupKey} className="space-y-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="flex items-center gap-2 w-full text-left px-1 py-0.5 group"
                >
                  <ChevronDown
                    className={`size-3.5 text-slate-500 transition-transform ${
                      expandedGroups.has(groupKey) ? "" : "-rotate-90"
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {groupKey}
                  </span>
                  <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </button>

                {/* Group items */}
                {expandedGroups.has(groupKey) && (
                  <div className="space-y-1 ml-1">
                    {items.map((conv) => {
                      const cfg = STATUS_CONFIG[conv.status];
                      const isSelected = conv.id === selectedId;
                      return (
                        <button
                          key={conv.id}
                          onClick={() =>
                            setSelectedId(
                              isSelected ? null : conv.id
                            )
                          }
                          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                            isSelected
                              ? "border-[#dd7430]/50 bg-[#dd7430]/10"
                              : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.badgeClass}`}
                                >
                                  {cfg.icon}
                                  {cfg.label}
                                </span>
                                <span className="text-xs font-mono text-slate-500">
                                  #{shortId(conv.id)}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-white truncate">
                                {conv.flowName}
                              </p>
                              {conv.agentName && groupBy !== "agent" && (
                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Bot className="size-3" />
                                  {conv.agentName}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-slate-500">
                                  {formatDateTime(conv.startedAt)}
                                </span>
                                {conv.toolExecutionLogs.length > 0 && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Wrench className="size-3" />
                                    {conv.toolExecutionLogs.length}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {durationLabel(
                                    conv.startedAt,
                                    conv.lastActivityAt
                                  )}
                                </span>
                              </div>
                            </div>
                            <ChevronRight
                              className={`size-4 shrink-0 mt-1 transition-transform ${
                                isSelected
                                  ? "text-[#dd7430] rotate-90"
                                  : "text-slate-600"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary stats */}
        {conversations.length > 0 && (
          <div className="flex gap-3 pt-2 border-t border-slate-800">
            {(
              [
                ["active", conversations],
                ["completed", conversations],
                ["abandoned", conversations],
              ] as const
            ).map(([status, all]) => {
              const count = all.filter((c) => c.status === status).length;
              const cfg = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-1.5">
                  <div
                    className={`size-1.5 rounded-full ${cfg.dotClass}`}
                  />
                  <span className="text-xs text-slate-500">
                    {count} {cfg.label.toLowerCase()}
                    {count !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right panel — detail */}
      {selected && (
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
          {/* Detail header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/60 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    STATUS_CONFIG[selected.status].badgeClass
                  }`}
                >
                  {STATUS_CONFIG[selected.status].icon}
                  {STATUS_CONFIG[selected.status].label}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  #{shortId(selected.id)}
                </span>
              </div>
              <h2 className="text-base font-semibold text-white truncate">
                {selected.flowName}
              </h2>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-3 shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Detail body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3">
              {selected.agentName && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <Bot className="size-3" /> Agente
                  </p>
                  <p className="text-sm text-white font-medium">
                    {selected.agentName}
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <GitBranch className="size-3" /> Flujo
                </p>
                <p className="text-sm text-white font-medium">
                  {selected.flowName}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <CalendarDays className="size-3" /> Inicio
                </p>
                <p className="text-sm text-white">
                  {formatDateTime(selected.startedAt)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                  <Clock className="size-3" /> Duración
                </p>
                <p className="text-sm text-white">
                  {durationLabel(selected.startedAt, selected.lastActivityAt)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 col-span-2">
                <p className="text-xs text-slate-500 mb-1">Nodo actual</p>
                <p className="text-sm text-white font-mono">
                  {selected.currentNodeId}
                </p>
              </div>
            </div>

            {/* Variables */}
            {Object.keys(selected.vars).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Database className="size-3.5" />
                  Variables capturadas
                </h3>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(selected.vars).map(([key, val], idx) => (
                        <tr
                          key={key}
                          className={
                            idx !== 0 ? "border-t border-slate-700/60" : ""
                          }
                        >
                          <td className="px-3 py-2 text-slate-400 font-mono text-xs w-1/3">
                            {key}
                          </td>
                          <td className="px-3 py-2 text-white text-xs break-all">
                            {val === undefined || val === null
                              ? <span className="text-slate-600 italic">—</span>
                              : String(val)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tool execution logs */}
            {selected.toolExecutionLogs.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Wrench className="size-3.5" />
                  Herramientas ejecutadas ({selected.toolExecutionLogs.length})
                </h3>
                <div className="space-y-2">
                  {selected.toolExecutionLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border px-3 py-2.5 text-xs ${
                        log.error
                          ? "border-red-500/30 bg-red-500/10"
                          : "border-slate-700 bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono font-medium text-white">
                          {log.tool}
                        </span>
                        <div className="flex items-center gap-2">
                          {log.durationMs !== undefined && (
                            <span className="text-slate-500">
                              {log.durationMs}ms
                            </span>
                          )}
                          {log.error ? (
                            <span className="text-red-400 flex items-center gap-1">
                              <XCircle className="size-3" /> Error
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> OK
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-500">
                        Nodo:{" "}
                        <span className="font-mono text-slate-400">
                          {log.nodeId}
                        </span>
                      </p>
                      {log.error && (
                        <p className="text-red-400 mt-1 break-all">
                          {log.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retry info */}
            {Object.keys(selected.retryCount).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Reintentos por nodo
                </h3>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(selected.retryCount).map(
                        ([nodeId, count], idx) => (
                          <tr
                            key={nodeId}
                            className={
                              idx !== 0 ? "border-t border-slate-700/60" : ""
                            }
                          >
                            <td className="px-3 py-2 text-slate-400 font-mono text-xs">
                              {nodeId}
                            </td>
                            <td className="px-3 py-2 text-amber-400 text-xs font-medium">
                              {count} reintento{count !== 1 ? "s" : ""}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty sections notice */}
            {selected.toolExecutionLogs.length === 0 &&
              Object.keys(selected.vars).filter(
                (k) => selected.vars[k] !== undefined
              ).length === 0 && (
                <div className="flex flex-col items-center py-6 text-center">
                  <Users className="size-8 text-slate-600 mb-2" />
                  <p className="text-slate-500 text-sm">
                    Esta conversación no tiene variables ni herramientas
                    ejecutadas.
                  </p>
                </div>
              )}

            {/* Full ID */}
            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-600">
                ID completo:{" "}
                <span className="font-mono text-slate-500">{selected.id}</span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Versión:{" "}
                <span className="font-mono text-slate-500">
                  {selected.versionId}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
