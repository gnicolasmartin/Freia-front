"use client";

import { useMemo } from "react";
import StatCard from "@/components/StatCard";
import InconclusiveConversions from "@/components/InconclusiveConversions";
import FAQsAndKeywords from "@/components/FAQsAndKeywords";
import AverageConversationTime from "@/components/AverageConversationTime";
import {
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Clock,
  Activity,
  Package,
  Bot,
  Globe,
} from "lucide-react";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useFronts } from "@/providers/FrontsProvider";
import { useProducts } from "@/providers/ProductsProvider";
import { useConversations } from "@/providers/ConversationsProvider";
import { useAuditLog } from "@/providers/AuditLogProvider";

export default function DashboardPage() {
  const { agents } = useAgents();
  const { flows } = useFlows();
  const { fronts } = useFronts();
  const { products } = useProducts();
  const { conversations } = useConversations();
  const { entries: auditEntries } = useAuditLog();

  // --- Computed metrics ---

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const activeFlows = flows.filter((f) => f.status === "active").length;
  const publishedFronts = fronts.filter((f) => f.status === "published").length;

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockProducts = products.filter((p) => p.stock < 10);

  const activeConversations = conversations.filter((c) => c.status === "active").length;
  const completedConversations = conversations.filter((c) => c.status === "completed").length;
  const abandonedConversations = conversations.filter((c) => c.status === "abandoned").length;
  const totalConversations = conversations.length;

  const conversionRate = totalConversations > 0
    ? Math.round((completedConversations / totalConversations) * 1000) / 10
    : 0;

  // --- Conversation time stats ---
  const conversationTimes = useMemo(() => {
    const completed = conversations.filter((c) => c.status === "completed" && c.startedAt && c.lastActivityAt);
    if (completed.length === 0) return { avg: 0, min: 0, max: 0 };
    const durations = completed.map((c) => {
      const start = new Date(c.startedAt).getTime();
      const end = new Date(c.lastActivityAt).getTime();
      return Math.max(0, (end - start) / 60000); // minutes
    });
    return {
      avg: durations.reduce((s, d) => s + d, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }, [conversations]);

  // --- Inconclusive breakdown (abandoned conversations by last node) ---
  const inconclusiveReasons = useMemo(() => {
    const abandoned = conversations.filter((c) => c.status === "abandoned");
    if (abandoned.length === 0) return [];
    const nodeCount: Record<string, number> = {};
    for (const c of abandoned) {
      const key = c.currentNodeId || "desconocido";
      nodeCount[key] = (nodeCount[key] || 0) + 1;
    }
    return Object.entries(nodeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({
        reason: reason === "desconocido" ? "Sin datos" : `Nodo: ${reason}`,
        count,
        percentage: Math.round((count / abandoned.length) * 100),
      }));
  }, [conversations]);

  // --- FAQs: most queried products (from conversations with vars) ---
  const frequentKeywords = useMemo(() => {
    const mentions: Record<string, number> = {};
    for (const c of conversations) {
      const query = c.vars?.consulta_cliente;
      if (typeof query === "string" && query.trim()) {
        const key = query.trim().toLowerCase();
        mentions[key] = (mentions[key] || 0) + 1;
      }
      const query2 = c.vars?.segunda_consulta;
      if (typeof query2 === "string" && query2.trim()) {
        const key = query2.trim().toLowerCase();
        mentions[key] = (mentions[key] || 0) + 1;
      }
    }
    // Also count product names from stock
    const productMentions: Record<string, number> = {};
    for (const [term, count] of Object.entries(mentions)) {
      const match = products.find((p) =>
        p.name.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term) ||
        p.model?.toLowerCase().includes(term)
      );
      const label = match?.name ?? term;
      productMentions[label] = (productMentions[label] || 0) + count;
    }

    return Object.entries(productMentions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([keyword, count]) => ({
        keyword,
        count,
        trend: "stable" as const,
      }));
  }, [conversations, products]);

  // --- Recent audit activity ---
  const recentAuditCount = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return auditEntries.filter((e) => new Date(e.timestamp).getTime() > oneDayAgo).length;
  }, [auditEntries]);

  const lastAuditTime = useMemo(() => {
    if (auditEntries.length === 0) return null;
    const sorted = [...auditEntries].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return new Date(sorted[0].timestamp);
  }, [auditEntries]);

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return "Sin actividad";
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Hace instantes";
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Resumen de actividad y métricas principales
          </p>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Conversaciones Activas"
          value={activeConversations}
          icon={<Activity className="size-6 text-[#dd7430]" />}
          description="En este momento"
        />
        <StatCard
          title="Conversiones Completadas"
          value={completedConversations}
          icon={<TrendingUp className="size-6 text-green-400" />}
          description={`de ${totalConversations} totales`}
        />
        <StatCard
          title="Tasa de Conversión"
          value={`${conversionRate}%`}
          icon={<MessageSquare className="size-6 text-blue-400" />}
          description="Completadas / totales"
        />
        <StatCard
          title="Abandonadas"
          value={abandonedConversations}
          icon={<AlertCircle className="size-6 text-yellow-500" />}
          description="Conversaciones sin resolver"
        />
      </div>

      {/* Resources overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Agentes"
          value={activeAgents}
          icon={<Bot className="size-6 text-sky-400" />}
          description={`${agents.length} totales · ${activeAgents} activos`}
        />
        <StatCard
          title="Flujos"
          value={activeFlows}
          icon={<Activity className="size-6 text-emerald-400" />}
          description={`${flows.length} totales · ${activeFlows} activos`}
        />
        <StatCard
          title="Fronts Publicados"
          value={publishedFronts}
          icon={<Globe className="size-6 text-violet-400" />}
          description={`${fronts.length} totales`}
        />
        <StatCard
          title="Productos"
          value={totalProducts}
          icon={<Package className="size-6 text-amber-400" />}
          description={`${totalStock} unidades en stock`}
        />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inconclusive Conversions */}
        {abandonedConversations > 0 ? (
          <InconclusiveConversions
            reasons={inconclusiveReasons}
            total={abandonedConversations}
          />
        ) : (
          <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
            <h3 className="text-base font-semibold text-white mb-4">
              Conversiones Inconclusas
            </h3>
            <p className="text-sm text-slate-500 text-center py-8">
              No hay conversaciones abandonadas.
            </p>
          </div>
        )}

        {/* Average Conversation Time */}
        <AverageConversationTime
          averageMinutes={conversationTimes.avg}
          totalConversations={totalConversations}
          shortestMinutes={conversationTimes.min}
          longestMinutes={conversationTimes.max}
        />
      </div>

      {/* FAQs and Keywords */}
      {frequentKeywords.length > 0 ? (
        <FAQsAndKeywords keywords={frequentKeywords} />
      ) : (
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <h3 className="text-base font-semibold text-white mb-4">
            FAQs y Menciones Frecuentes
          </h3>
          <p className="text-sm text-slate-500 text-center py-8">
            Las consultas frecuentes aparecerán aquí cuando haya conversaciones.
          </p>
        </div>
      )}

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-900/10 p-6">
          <h3 className="text-base font-semibold text-amber-300 mb-3">
            Productos con stock bajo (&lt; 10 unidades)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{p.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{p.sku}</p>
                </div>
                <span className={`text-sm font-bold ml-3 ${p.stock === 0 ? "text-red-400" : "text-amber-400"}`}>
                  {p.stock}
                </span>
              </div>
            ))}
          </div>
          {lowStockProducts.length > 6 && (
            <p className="text-xs text-amber-400/60 mt-3">
              y {lowStockProducts.length - 6} productos más con stock bajo
            </p>
          )}
        </div>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <Clock className="size-5 text-[#dd7430] mb-3" />
          <p className="text-sm text-slate-400 mb-1">Última actividad</p>
          <p className="text-lg font-semibold text-white">{formatLastUpdate(lastAuditTime)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <Activity className="size-5 text-green-400 mb-3" />
          <p className="text-sm text-slate-400 mb-1">Eventos (24h)</p>
          <p className="text-lg font-semibold text-white">{recentAuditCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <Bot className="size-5 text-sky-400 mb-3" />
          <p className="text-sm text-slate-400 mb-1">Agentes activos</p>
          <p className="text-lg font-semibold text-white">{activeAgents} / {agents.length}</p>
        </div>
      </div>
    </div>
  );
}
