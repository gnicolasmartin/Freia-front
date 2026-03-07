"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useFlows } from "@/providers/FlowsProvider";
import { useAgents } from "@/providers/AgentsProvider";
import FlowModal from "@/components/flows/FlowModal";
import type { Flow } from "@/types/flow";
import { FLOW_STATUSES } from "@/types/flow";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-700/50 text-slate-300 border-slate-600",
  active: "bg-green-900/30 text-green-400 border-green-800/50",
  inactive: "bg-red-900/30 text-red-400 border-red-800/50",
};

function getStatusLabel(value: string): string {
  return FLOW_STATUSES.find((s) => s.value === value)?.label ?? value;
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

export default function FlowsPage() {
  const router = useRouter();
  const { flows, createFlow, deleteFlow } = useFlows();
  const { agents } = useAgents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Flow | null>(null);

  const handleNewFlow = () => {
    setEditingFlow(null);
    setIsModalOpen(true);
  };

  const handleEditFlow = (e: React.MouseEvent, flow: Flow) => {
    e.stopPropagation();
    setEditingFlow(flow);
    setIsModalOpen(true);
  };

  const handleCloseModal = (createdFlowId?: string) => {
    setIsModalOpen(false);
    setEditingFlow(null);
    // If a new flow was just created, navigate to the editor
    if (createdFlowId) {
      router.push(`/flows/${createdFlowId}`);
    }
  };

  const handleCardClick = (flow: Flow) => {
    router.push(`/flows/${flow.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, flow: Flow) => {
    e.stopPropagation();
    setDeleteConfirm(flow);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteFlow(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const getAssociatedAgents = (flowId: string) => {
    return agents.filter((a) => a.flowId === flowId);
  };

  const associatedAgents = deleteConfirm
    ? getAssociatedAgents(deleteConfirm.id)
    : [];
  const hasAssociatedAgents = associatedAgents.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Flujos</h1>
          <p className="text-slate-400 mt-1">
            Crea y administra los flujos de conversación
          </p>
        </div>
        <button
          onClick={handleNewFlow}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-5" />
          <span>Nuevo Flujo</span>
        </button>
      </div>

      {/* Flow List or Empty State */}
      {flows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {flows.map((flow) => {
            const linked = getAssociatedAgents(flow.id);
            const flowVersions = flow.versions ?? [];
            const lastVersion =
              flowVersions.length > 0
                ? flowVersions[flowVersions.length - 1]
                : null;
            const isDraftModified =
              lastVersion &&
              flow.updatedAt &&
              flow.updatedAt > lastVersion.publishedAt;
            const statusColor = isDraftModified
              ? "bg-amber-900/30 text-amber-400 border-amber-800/50"
              : STATUS_COLORS[flow.status] || STATUS_COLORS.draft;

            return (
              <div
                key={flow.id}
                onClick={() => handleCardClick(flow)}
                className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 backdrop-blur-sm hover:border-slate-600 transition-all group cursor-pointer"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50">
                      <GitBranch className="size-5 text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">
                        {flow.name}
                      </h3>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                      >
                        {isDraftModified
                          ? "Modificado"
                          : getStatusLabel(flow.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEditFlow(e, flow)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#dd7430] hover:bg-slate-700/50 transition-colors"
                      aria-label={`Editar ${flow.name}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, flow)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                      aria-label={`Eliminar ${flow.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {flow.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {flow.description}
                  </p>
                )}

                {/* Info footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">
                      {flow.nodes?.length ?? 0}{" "}
                      {(flow.nodes?.length ?? 0) === 1 ? "nodo" : "nodos"}
                    </p>
                    {(flow.versions?.length ?? 0) > 0 && (
                      <p className="text-xs text-slate-500">
                        v{flow.versions[flow.versions.length - 1].version}
                      </p>
                    )}
                    {linked.length > 0 && (
                      <p className="text-xs text-slate-500">
                        {linked.length}{" "}
                        {linked.length === 1
                          ? "agente"
                          : "agentes"}
                      </p>
                    )}
                  </div>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="size-3" />
                    {formatRelativeTime(flow.updatedAt || flow.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
          <GitBranch className="size-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            No hay flujos creados
          </h2>
          <p className="text-slate-400 text-center max-w-md mb-6">
            Crea tu primer flujo de conversación para definir cómo interactúan
            tus agentes con los clientes.
          </p>
          <button
            onClick={handleNewFlow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-5" />
            <span>Crear primer flujo</span>
          </button>
        </div>
      )}

      {/* Flow Modal */}
      <FlowModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingFlow={editingFlow}
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
              <h3 className="text-lg font-bold text-white">Eliminar flujo</h3>
            </div>

            {hasAssociatedAgents ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  No se puede eliminar{" "}
                  <span className="font-semibold text-white">
                    {deleteConfirm.name}
                  </span>{" "}
                  porque está asociado a los siguientes agentes:
                </p>
                <ul className="space-y-1">
                  {associatedAgents.map((agent) => (
                    <li
                      key={agent.id}
                      className="text-sm text-slate-400 flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-[#dd7430] shrink-0" />
                      {agent.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">
                  Desasocia estos agentes del flujo antes de eliminarlo.
                </p>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
