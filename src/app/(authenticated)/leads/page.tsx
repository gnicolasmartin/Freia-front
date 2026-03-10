"use client";

import { useState, useMemo } from "react";
import {
  Target,
  Search,
  Phone,
  User,
  Clock,
  ChevronRight,
  X,
  Wrench,
  Database,
  CalendarDays,
  Bot,
  GitBranch,
  SlidersHorizontal,
  ChevronDown,
  MessageSquare,
  ShoppingBag,
  Mail,
  TrendingUp,
  UserCheck,
  UserX,
  Sparkles,
} from "lucide-react";
import { useConversations } from "@/providers/ConversationsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useAgents } from "@/providers/AgentsProvider";

// --- Types ---

type LeadStatus = "nuevo" | "en_curso" | "calificado" | "perdido";
type GroupBy = "status" | "agent" | "date";

interface FilterState {
  agentId: string;
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface ToolLog {
  nodeId: string;
  tool: string;
  timestamp: string;
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

interface Lead {
  id: string;
  contactPhone: string;
  contactName: string;
  contactEmail?: string;
  channel: string;
  status: LeadStatus;
  agentId?: string;
  agentName?: string;
  flowId: string;
  flowName: string;
  consultationTopic?: string;
  productName?: string;
  productBrand?: string;
  productPrice?: string;
  firstMessage?: string;
  startedAt: string;
  lastActivityAt: string;
  vars: Record<string, unknown>;
  toolExecutionLogs: ToolLog[];
}

// --- Helpers ---

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function deriveLeadStatus(
  convStatus: string,
  startedAt: string,
  lastActivityAt: string
): LeadStatus {
  if (convStatus === "completed") return "calificado";
  if (convStatus === "abandoned") return "perdido";
  // active → nuevo if very recent, en_curso otherwise
  const elapsed =
    new Date(lastActivityAt).getTime() - new Date(startedAt).getTime();
  return elapsed < FIVE_MINUTES_MS ? "nuevo" : "en_curso";
}

const STATUS_CONFIG: Record<
  LeadStatus,
  {
    label: string;
    icon: React.ReactNode;
    badgeClass: string;
    dotClass: string;
  }
> = {
  nuevo: {
    label: "Nuevo",
    icon: <Sparkles className="size-3.5" />,
    badgeClass:
      "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    dotClass: "bg-sky-400",
  },
  en_curso: {
    label: "En curso",
    icon: <Clock className="size-3.5" />,
    badgeClass:
      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  calificado: {
    label: "Calificado",
    icon: <UserCheck className="size-3.5" />,
    badgeClass:
      "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  perdido: {
    label: "Perdido",
    icon: <UserX className="size-3.5" />,
    badgeClass:
      "bg-red-500/15 text-red-400 border border-red-500/30",
    dotClass: "bg-red-400",
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

function formatPhone(phone: string): string {
  if (!phone) return "—";
  // Format: +54 9 11 6052-7827
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("549")) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  if (digits.length >= 11 && digits.startsWith("54")) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits}`;
}

function timeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays}d`;
}

// --- Consultation topic derivation ---

const TOOL_TOPIC_LABELS: Record<string, string> = {
  calendar_check: "Disponibilidad",
  create_booking: "Reserva",
  search_resources: "Búsqueda",
  crm_lookup: "Consulta CRM",
  send_email: "Email",
  create_ticket: "Ticket",
  knowledge_search: "Consulta",
  apply_discount: "Descuento",
  cancel_order: "Cancelación",
  create_refund: "Reembolso",
};

const BUILTIN_VAR_PREFIXES = ["contact.", "message.", "system.", "lead.", "channel", "product."];

function formatDateCompact(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function formatDateRangeCompact(start?: unknown, end?: unknown): string {
  if (!start) return "";
  const s = String(start);
  const e = end ? String(end) : "";
  if (!e || e === s) return formatDateCompact(s);
  // Same month+year: "13-16 mar 2026"
  try {
    const ds = new Date(s + "T00:00:00");
    const de = new Date(e + "T00:00:00");
    if (ds.getMonth() === de.getMonth() && ds.getFullYear() === de.getFullYear()) {
      return `${ds.getDate()}-${de.getDate()} ${ds.toLocaleDateString("es-AR", { month: "short", year: "numeric" })}`;
    }
  } catch { /* fall through */ }
  return `${formatDateCompact(s)} — ${formatDateCompact(e)}`;
}

function deriveTopicFromLog(log: ToolLog): string | undefined {
  const r = log.request ?? {};
  const resp = log.response as Record<string, unknown> | undefined;

  // Confirmed booking → highest priority
  if (log.tool === "create_booking" && resp?.status === "confirmed") {
    const data = resp.data as Record<string, unknown> | undefined;
    const code = data?.confirmationCode ? ` ${data.confirmationCode}` : "";
    return `Reserva confirmada${code}`;
  }

  // Error responses → skip
  if (resp?.status === "error") return undefined;

  const label = TOOL_TOPIC_LABELS[log.tool] ?? log.tool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Tool-specific detail extraction
  if (log.tool === "calendar_check" || log.tool === "create_booking") {
    const dates = formatDateRangeCompact(r.startDate || r.date, r.endDate);
    return dates ? `${label} — ${dates}` : label;
  }
  if (log.tool === "search_resources") {
    const q = r.query ? String(r.query).slice(0, 50) : "";
    return q ? `${label}: ${q}` : label;
  }
  if (log.tool === "crm_lookup") {
    const q = r.query || r.email || r.phone;
    return q ? `${label}: ${String(q).slice(0, 40)}` : label;
  }
  if (log.tool === "send_email") {
    return r.to ? `${label} a ${String(r.to).slice(0, 30)}` : label;
  }
  if (log.tool === "create_ticket") {
    return r.title ? `${label}: ${String(r.title).slice(0, 40)}` : label;
  }

  // Generic: use first string param value
  const firstParam = Object.values(r).find((v) => typeof v === "string" && v.length > 0);
  return firstParam ? `${label}: ${String(firstParam).slice(0, 40)}` : label;
}

function deriveConsultationTopic(lead: Lead): string | undefined {
  // 1. From tool logs (prioritize confirmed bookings, then last meaningful log)
  const logs = lead.toolExecutionLogs ?? [];
  let bestTopic: string | undefined;
  for (const log of logs) {
    const topic = deriveTopicFromLog(log);
    if (topic) {
      bestTopic = topic;
      // Confirmed booking is the highest priority — stop
      if (log.tool === "create_booking" && (log.response as Record<string, unknown>)?.status === "confirmed") {
        return topic;
      }
    }
  }
  if (bestTopic) return bestTopic;

  // 2. Product name (StockLookup flows)
  if (lead.productName) {
    const brand = lead.productBrand ? `${lead.productBrand} ` : "";
    return `Producto: ${brand}${lead.productName}`;
  }

  // 3. First non-builtin variable with a meaningful string value
  for (const [key, val] of Object.entries(lead.vars)) {
    if (BUILTIN_VAR_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (typeof val === "string" && val.trim().length > 5) {
      return val.trim().slice(0, 80);
    }
  }

  // 4. First message
  if (lead.firstMessage) return lead.firstMessage.slice(0, 60);

  return undefined;
}

// --- Contact extraction from vars ---

const NAME_KEYS = ["nombre", "name", "contactname", "nombre_completo", "full_name", "cliente"];
const PHONE_KEYS = ["telefono", "phone", "celular", "whatsapp", "tel", "mobile", "contactphone"];
const EMAIL_KEYS = ["email", "correo", "mail", "e-mail", "contactemail"];

function extractContactFromVars(vars: Record<string, unknown>): { name?: string; phone?: string; email?: string } {
  const result: { name?: string; phone?: string; email?: string } = {};

  for (const [key, val] of Object.entries(vars)) {
    if (!val || typeof val !== "string" || !val.trim()) continue;
    // Skip builtin vars already handled
    if (key === "contact.phone" || key === "contact.name" || key.startsWith("message.") || key.startsWith("system.")) continue;

    const k = key.toLowerCase().replace(/[._-]/g, "");
    if (!result.name && NAME_KEYS.some((nk) => k.includes(nk))) {
      result.name = val.trim();
    }
    if (!result.phone && PHONE_KEYS.some((pk) => k.includes(pk))) {
      result.phone = val.trim();
    }
    if (!result.email && EMAIL_KEYS.some((ek) => k.includes(ek))) {
      result.email = val.trim();
    }
  }

  return result;
}

// --- Main page ---

export default function LeadsPage() {
  const { conversations, isLoading } = useConversations();
  const { flows } = useFlows();
  const { agents } = useAgents();

  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [filter, setFilter] = useState<FilterState>({
    agentId: "",
    status: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  // Convert conversations with contact data into leads
  const leads = useMemo<Lead[]>(() => {
    return conversations
      .filter((conv) => {
        // Only conversations with contact phone (WhatsApp) are leads
        const phone = conv.vars["contact.phone"];
        return phone && typeof phone === "string" && phone.length > 0;
      })
      .map((conv) => {
        const flow = flows.find((f) => f.id === conv.flowId);
        const agent = conv.agentId
          ? agents.find((a) => a.id === conv.agentId)
          : agents.find((a) => a.flowId === conv.flowId);

        // Extract contact data from variables (enriches beyond contact.phone/name)
        const extracted = extractContactFromVars(conv.vars);
        const contactName = String(conv.vars["contact.name"] ?? "") || extracted.name || "";
        const contactPhone = String(conv.vars["contact.phone"] ?? "") || extracted.phone || "";

        const lead: Lead = {
          id: conv.id,
          contactPhone,
          contactName,
          contactEmail: extracted.email,
          channel: String(conv.vars["channel"] ?? "whatsapp"),
          status: deriveLeadStatus(
            conv.status,
            conv.startedAt,
            conv.lastActivityAt
          ),
          agentId: conv.agentId,
          agentName: agent?.name,
          flowId: conv.flowId,
          flowName: flow?.name ?? "Flujo desconocido",
          productName: conv.vars["product.name"]
            ? String(conv.vars["product.name"])
            : undefined,
          productBrand: conv.vars["product.brand"]
            ? String(conv.vars["product.brand"])
            : undefined,
          productPrice: conv.vars["product.price"]
            ? String(conv.vars["product.price"])
            : undefined,
          firstMessage: conv.vars["message.text"]
            ? String(conv.vars["message.text"])
            : undefined,
          startedAt: conv.startedAt,
          lastActivityAt: conv.lastActivityAt,
          vars: conv.vars,
          toolExecutionLogs: conv.toolExecutionLogs,
        };
        lead.consultationTopic = deriveConsultationTopic(lead);
        return lead;
      })
      .sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime()
      );
  }, [conversations, flows, agents]);

  // Filter
  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (filter.agentId && lead.agentId !== filter.agentId) return false;
      if (filter.status && lead.status !== filter.status) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (
          !lead.contactName.toLowerCase().includes(q) &&
          !lead.contactPhone.includes(q) &&
          !(lead.agentName?.toLowerCase().includes(q)) &&
          !(lead.productName?.toLowerCase().includes(q)) &&
          !(lead.consultationTopic?.toLowerCase().includes(q)) &&
          !(lead.firstMessage?.toLowerCase().includes(q))
        )
          return false;
      }
      if (filter.dateFrom) {
        if (new Date(lead.startedAt) < new Date(filter.dateFrom)) return false;
      }
      if (filter.dateTo) {
        if (new Date(lead.startedAt) > new Date(filter.dateTo + "T23:59:59"))
          return false;
      }
      return true;
    });
  }, [leads, filter]);

  // Group
  const groups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of filtered) {
      let key: string;
      if (groupBy === "status") {
        key = STATUS_CONFIG[lead.status].label;
      } else if (groupBy === "agent") {
        key = lead.agentName ?? "Sin agente";
      } else {
        key = formatDateGroup(lead.startedAt);
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }
    // Sort items within each group
    for (const items of map.values()) {
      items.sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime()
      );
    }
    const entries = [...map.entries()];
    if (groupBy === "date") {
      entries.sort(
        (a, b) =>
          new Date(b[1][0].startedAt).getTime() -
          new Date(a[1][0].startedAt).getTime()
      );
    } else if (groupBy === "status") {
      const order: LeadStatus[] = ["nuevo", "en_curso", "calificado", "perdido"];
      entries.sort((a, b) => {
        const aIdx = order.indexOf(a[1][0].status);
        const bIdx = order.indexOf(b[1][0].status);
        return aIdx - bIdx;
      });
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries;
  }, [filtered, groupBy]);

  // Auto-expand groups
  const allGroupKeys = groups.map(([key]) => key).join(",");
  useMemo(() => {
    setExpandedGroups(new Set(groups.map(([key]) => key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroupKeys]);

  const selected = leads.find((l) => l.id === selectedId);

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
    filter.status,
    filter.dateFrom,
    filter.dateTo,
  ].filter(Boolean).length;

  const groupByOptions: {
    value: GroupBy;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "status",
      label: "Estado",
      icon: <Target className="size-3.5" />,
    },
    { value: "agent", label: "Agente", icon: <Bot className="size-3.5" /> },
    {
      value: "date",
      label: "Fecha",
      icon: <CalendarDays className="size-3.5" />,
    },
  ];

  // Stats
  const stats = useMemo(() => {
    const total = leads.length;
    const nuevo = leads.filter((l) => l.status === "nuevo").length;
    const enCurso = leads.filter((l) => l.status === "en_curso").length;
    const calificado = leads.filter((l) => l.status === "calificado").length;
    const perdido = leads.filter((l) => l.status === "perdido").length;
    const conversionRate =
      total > 0 ? Math.round((calificado / total) * 100) : 0;
    return { total, nuevo, enCurso, calificado, perdido, conversionRate };
  }, [leads]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Cargando leads...
      </div>
    );
  }

  // Contact display variables to show in detail panel
  const DISPLAY_VARS = [
    "contact.phone",
    "contact.name",
    "channel",
    "message.text",
    "message.timestamp",
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Total leads</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="size-1.5 rounded-full bg-emerald-400" />
            <p className="text-xs text-slate-400">En curso</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {stats.nuevo + stats.enCurso}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="size-1.5 rounded-full bg-amber-400" />
            <p className="text-xs text-slate-400">Calificados</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {stats.calificado}
          </p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="size-3.5 text-[#dd7430]" />
            <p className="text-xs text-slate-400">Conversión</p>
          </div>
          <p className="text-2xl font-bold text-[#dd7430]">
            {stats.conversionRate}%
          </p>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel — list */}
        <div
          className={`flex flex-col gap-3 transition-all duration-300 ${
            selected ? "w-[420px] shrink-0" : "flex-1"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Leads</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
                {leads.length !== filtered.length && ` de ${leads.length}`}
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
              placeholder="Buscar por nombre, teléfono, producto..."
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
                    Estado
                  </label>
                  <select
                    value={filter.status}
                    onChange={(e) =>
                      setFilter((f) => ({ ...f, status: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
                  >
                    <option value="">Todos</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="en_curso">En curso</option>
                    <option value="calificado">Calificado</option>
                    <option value="perdido">Perdido</option>
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
                      status: "",
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

          {/* Leads list */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800/30 py-16 text-center">
                <Target className="size-10 text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No hay leads</p>
                <p className="text-slate-500 text-sm mt-1">
                  Los leads aparecerán aquí cuando los contactos escriban por
                  WhatsApp.
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
                      {items.map((lead) => {
                        const cfg = STATUS_CONFIG[lead.status];
                        const isSelected = lead.id === selectedId;
                        const displayName =
                          lead.contactName || formatPhone(lead.contactPhone);
                        return (
                          <button
                            key={lead.id}
                            onClick={() =>
                              setSelectedId(isSelected ? null : lead.id)
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
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Phone className="size-3" />
                                    {formatPhone(lead.contactPhone)}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-white truncate">
                                  {displayName}
                                </p>
                                {lead.consultationTopic ? (
                                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                                    <Search className="size-3 shrink-0" />
                                    {lead.consultationTopic}
                                  </p>
                                ) : lead.firstMessage ? (
                                  <p className="text-xs text-slate-500 mt-0.5 truncate italic">
                                    &ldquo;{lead.firstMessage}&rdquo;
                                  </p>
                                ) : null}
                                <div className="flex items-center gap-3 mt-1.5">
                                  {lead.agentName &&
                                    groupBy !== "agent" && (
                                      <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <Bot className="size-3" />
                                        {lead.agentName}
                                      </span>
                                    )}
                                  <span className="text-xs text-slate-500">
                                    {timeSince(lead.lastActivityAt)}
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

          {/* Summary stats footer */}
          {leads.length > 0 && (
            <div className="flex gap-3 pt-2 border-t border-slate-800 shrink-0">
              {(
                ["nuevo", "en_curso", "calificado", "perdido"] as const
              ).map((status) => {
                const count = leads.filter((l) => l.status === status).length;
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
                  <span className="text-xs text-slate-500">
                    {selected.channel === "whatsapp"
                      ? "WhatsApp"
                      : selected.channel}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-white truncate">
                  {selected.contactName || formatPhone(selected.contactPhone)}
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
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <Phone className="size-3" /> Teléfono
                  </p>
                  <p className="text-sm text-white font-medium">
                    {formatPhone(selected.contactPhone)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <User className="size-3" /> Nombre
                  </p>
                  <p className="text-sm text-white font-medium">
                    {selected.contactName || "—"}
                  </p>
                </div>
                {selected.contactEmail && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                      <Mail className="size-3" /> Email
                    </p>
                    <p className="text-sm text-white font-medium">
                      {selected.contactEmail}
                    </p>
                  </div>
                )}
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
                    <CalendarDays className="size-3" /> Primer contacto
                  </p>
                  <p className="text-sm text-white">
                    {formatDateTime(selected.startedAt)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <Clock className="size-3" /> Última actividad
                  </p>
                  <p className="text-sm text-white">
                    {timeSince(selected.lastActivityAt)}
                  </p>
                </div>
              </div>

              {/* Consultation topic */}
              {selected.consultationTopic && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Search className="size-3.5" />
                    Motivo de consulta
                  </h3>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
                    <p className="text-sm text-white font-medium">
                      {selected.consultationTopic}
                    </p>
                    {selected.productPrice && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-emerald-400 font-medium">
                          ${Number(selected.productPrice).toLocaleString("es-AR")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* First message */}
              {selected.firstMessage && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" />
                    Primer mensaje
                  </h3>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
                    <p className="text-sm text-slate-300 italic">
                      &ldquo;{selected.firstMessage}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* Additional captured variables */}
              {Object.keys(selected.vars).filter(
                (k) =>
                  !DISPLAY_VARS.includes(k) &&
                  !k.startsWith("product.") &&
                  selected.vars[k] !== undefined &&
                  selected.vars[k] !== ""
              ).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Database className="size-3.5" />
                    Variables capturadas
                  </h3>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        {Object.entries(selected.vars)
                          .filter(
                            ([key, val]) =>
                              !DISPLAY_VARS.includes(key) &&
                              !key.startsWith("product.") &&
                              val !== undefined &&
                              val !== ""
                          )
                          .map(([key, val], idx) => (
                            <tr
                              key={key}
                              className={
                                idx !== 0
                                  ? "border-t border-slate-700/60"
                                  : ""
                              }
                            >
                              <td className="px-3 py-2 text-slate-400 font-mono text-xs w-1/3">
                                {key}
                              </td>
                              <td className="px-3 py-2 text-white text-xs break-all">
                                {val === undefined || val === null ? (
                                  <span className="text-slate-600 italic">
                                    —
                                  </span>
                                ) : (
                                  String(val)
                                )}
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
                    Interacciones ({selected.toolExecutionLogs.length})
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
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono font-medium text-white">
                            {log.tool}
                          </span>
                          {log.durationMs !== undefined && (
                            <span className="text-slate-500">
                              {log.durationMs}ms
                            </span>
                          )}
                        </div>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
