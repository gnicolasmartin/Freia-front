"use client";

import { useState } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Flame,
  Activity,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  Tag,
  Eye,
} from "lucide-react";
import { usePolicies } from "@/providers/PoliciesProvider";
import PolicyModal from "@/components/policies/PolicyModal";
import type { Policy } from "@/types/policy";
import { POLICY_SCOPES } from "@/types/policy";
import { CHANNEL_SCOPES as CHANNELS } from "@/types/agent";

const SCOPE_COLORS: Record<string, string> = {
  global: "bg-purple-900/30 text-purple-400 border-purple-800/50",
  flow: "bg-sky-900/30 text-sky-400 border-sky-800/50",
  channel: "bg-teal-900/30 text-teal-400 border-teal-800/50",
};

function getScopeLabel(value: string): string {
  return POLICY_SCOPES.find((s) => s.value === value)?.label ?? value;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export default function PoliciesPage() {
  const { policies, deletePolicy } = usePolicies();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Policy | null>(null);

  const handleNew = () => {
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, policy: Policy) => {
    e.stopPropagation();
    setEditingPolicy(policy);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPolicy(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, policy: Policy) => {
    e.stopPropagation();
    setDeleteConfirm(policy);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deletePolicy(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Políticas</h1>
          <p className="text-slate-400 mt-1">
            Define restricciones y reglas de comportamiento para los agentes
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-5" />
          <span>Nueva Política</span>
        </button>
      </div>

      {/* Policy List or Empty State */}
      {policies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((policy) => {
            const scopeColor =
              SCOPE_COLORS[policy.scope] || SCOPE_COLORS.global;
            const versionCount = policy.versions?.length ?? 0;
            const lastVersion =
              versionCount > 0
                ? policy.versions[versionCount - 1]
                : null;

            return (
              <div
                key={policy.id}
                onClick={(e) => handleEdit(e, policy)}
                className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 backdrop-blur-sm hover:border-slate-600 transition-all group cursor-pointer"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50">
                      <Shield className="size-5 text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">
                        {policy.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${scopeColor}`}
                        >
                          {getScopeLabel(policy.scope)}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                            policy.active
                              ? "bg-green-900/30 text-green-400 border-green-800/50"
                              : "bg-slate-700/50 text-slate-400 border-slate-600"
                          }`}
                        >
                          {policy.active ? "Activa" : "Inactiva"}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                            (policy.enforcementMode ?? "strict") === "flexible"
                              ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50"
                              : "bg-red-900/30 text-red-400 border-red-800/50"
                          }`}
                        >
                          {(policy.enforcementMode ?? "strict") === "strict" ? "Estricto" : "Flexible"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEdit(e, policy)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#dd7430] hover:bg-slate-700/50 transition-colors"
                      aria-label={`Editar ${policy.name}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, policy)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                      aria-label={`Eliminar ${policy.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {policy.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {policy.description}
                  </p>
                )}

                {/* Channel labels */}
                {policy.scope === "channel" && (policy.channelIds ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(policy.channelIds ?? []).map((chId) => {
                      const label = CHANNELS.find((c) => c.value === chId)?.label ?? chId;
                      return (
                        <span
                          key={chId}
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-teal-900/20 text-teal-400 border border-teal-800/40"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Restriction badges */}
                {((policy.forbiddenCategories?.length ?? 0) > 0 ||
                  (policy.forbiddenKeywords?.length ?? 0) > 0 ||
                  (policy.forbiddenResponseCategories?.length ?? 0) > 0 ||
                  (policy.forbiddenResponseKeywords?.length ?? 0) > 0 ||
                  (policy.authorityRules?.length ?? 0) > 0 ||
                  (policy.escalationTriggerCategories?.length ?? 0) > 0 ||
                  (policy.escalationTriggerKeywords?.length ?? 0) > 0 ||
                  (policy.escalationTriggerRules?.length ?? 0) > 0 ||
                  (policy.riskScoreThreshold ?? 0) > 0 ||
                  (policy.inputClassificationCategories?.length ?? 0) > 0 ||
                  (policy.inputClassificationKeywords?.length ?? 0) > 0) && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {(policy.forbiddenCategories?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/20 text-red-400 border border-red-800/50">
                        <ShieldAlert className="size-3" />
                        {policy.forbiddenCategories.length} categor{policy.forbiddenCategories.length === 1 ? "ía" : "ías"}
                      </span>
                    )}
                    {(policy.forbiddenKeywords?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/20 text-red-400 border border-red-800/50">
                        <Tag className="size-3" />
                        {policy.forbiddenKeywords.length} keyword{policy.forbiddenKeywords.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {((policy.forbiddenResponseCategories?.length ?? 0) > 0 ||
                      (policy.forbiddenResponseKeywords?.length ?? 0) > 0) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/20 text-amber-400 border border-amber-800/50">
                        <Ban className="size-3" />
                        {(policy.forbiddenResponseCategories?.length ?? 0) + (policy.forbiddenResponseKeywords?.length ?? 0)} restricci{((policy.forbiddenResponseCategories?.length ?? 0) + (policy.forbiddenResponseKeywords?.length ?? 0)) === 1 ? "ón" : "ones"} de respuesta
                      </span>
                    )}
                    {(policy.authorityRules?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-900/20 text-violet-400 border border-violet-800/50">
                        <ShieldCheck className="size-3" />
                        {policy.authorityRules.length} regla{policy.authorityRules.length === 1 ? "" : "s"} de autoridad
                      </span>
                    )}
                    {(() => {
                      const triggerCount =
                        (policy.escalationTriggerCategories?.length ?? 0) +
                        (policy.escalationTriggerKeywords?.length ?? 0) +
                        (policy.escalationTriggerRules?.length ?? 0);
                      return triggerCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-900/20 text-rose-400 border border-rose-800/50">
                          <Flame className="size-3" />
                          {triggerCount} trigger{triggerCount === 1 ? "" : "s"}
                        </span>
                      ) : null;
                    })()}
                    {(policy.riskScoreThreshold ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-900/20 text-cyan-400 border border-cyan-800/50">
                        <Activity className="size-3" />
                        Riesgo &ge; {policy.riskScoreThreshold}
                      </span>
                    )}
                    {(() => {
                      const classCount = (policy.inputClassificationCategories?.length ?? 0) +
                        (policy.inputClassificationKeywords?.length ?? 0);
                      return classCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-900/20 text-orange-400 border border-orange-800/50">
                          <Eye className="size-3" />
                          {classCount} clasificaci{classCount === 1 ? "ón" : "ones"}
                        </span>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Info footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-3">
                    {lastVersion && (
                      <p className="text-xs text-slate-500">
                        v{lastVersion.version}
                      </p>
                    )}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="size-3" />
                    {formatRelativeTime(policy.updatedAt || policy.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
          <Shield className="size-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            No hay políticas creadas
          </h2>
          <p className="text-slate-400 text-center max-w-md mb-6">
            Crea tu primera política para definir restricciones y reglas de
            comportamiento para los agentes.
          </p>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-5" />
            <span>Crear primera política</span>
          </button>
        </div>
      )}

      {/* Policy Modal */}
      <PolicyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingPolicy={editingPolicy}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirm(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-900/30">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Eliminar política
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                ¿Estás seguro de que querés eliminar{" "}
                <span className="font-semibold text-white">
                  {deleteConfirm.name}
                </span>
                ? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
