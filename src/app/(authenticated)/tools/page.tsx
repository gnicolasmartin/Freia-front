"use client";

import { useState } from "react";
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Play,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import ToolModal from "@/components/tools/ToolModal";
import type { ToolDefinition } from "@/types/tool-registry";
import { TOOL_CATEGORIES, CATEGORY_COLORS } from "@/types/tool-registry";

function getCategoryLabel(value: string): string {
  return TOOL_CATEGORIES.find((c) => c.value === value)?.label ?? value;
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

export default function ToolsPage() {
  const { tools, deleteTool } = useToolRegistry();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolDefinition | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ToolDefinition | null>(null);

  const handleNew = () => {
    setEditingTool(null);
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, tool: ToolDefinition) => {
    e.stopPropagation();
    setEditingTool(tool);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTool(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, tool: ToolDefinition) => {
    e.stopPropagation();
    setDeleteConfirm(tool);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteTool(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Herramientas</h1>
          <p className="text-slate-400 mt-1">
            Registro central de herramientas disponibles para los flujos
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-5" />
          <span>Nueva Herramienta</span>
        </button>
      </div>

      {/* Tool List or Empty State */}
      {tools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const catColors = CATEGORY_COLORS[tool.category] ?? CATEGORY_COLORS.support;
            const versionCount = tool.versions?.length ?? 0;
            const lastVersion =
              versionCount > 0 ? tool.versions[versionCount - 1] : null;

            return (
              <div
                key={tool.id}
                onClick={(e) => handleEdit(e, tool)}
                className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 backdrop-blur-sm hover:border-slate-600 transition-all group cursor-pointer"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                      <Wrench className="size-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">
                        {tool.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${catColors.bg} ${catColors.text} ${catColors.border}`}
                        >
                          {getCategoryLabel(tool.category)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEdit(e, tool)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-purple-400 hover:bg-slate-700/50 transition-colors"
                      aria-label={`Editar ${tool.name}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, tool)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                      aria-label={`Eliminar ${tool.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {tool.description && (
                  <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                    {tool.description}
                  </p>
                )}

                {/* ID */}
                <p className="text-xs font-mono text-slate-500 mb-3 truncate">
                  {tool.id}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {tool.inputSchema.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/20 text-purple-400 border border-purple-800/50">
                      <ArrowRight className="size-3" />
                      {tool.inputSchema.length} entrada{tool.inputSchema.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {tool.outputSchema.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-900/20 text-sky-400 border border-sky-800/50">
                      <ArrowRightLeft className="size-3" />
                      {tool.outputSchema.length} salida{tool.outputSchema.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {tool.requiresConfirmation && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/20 text-amber-400 border border-amber-800/50">
                      <ShieldCheck className="size-3" />
                      Confirmación
                    </span>
                  )}
                  {tool.supportsSimulation && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/20 text-emerald-400 border border-emerald-800/50">
                      <Play className="size-3" />
                      Simulable
                    </span>
                  )}
                </div>

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
                    {formatRelativeTime(tool.updatedAt || tool.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
          <Wrench className="size-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            No hay herramientas registradas
          </h2>
          <p className="text-slate-400 text-center max-w-md mb-6">
            Crea tu primera herramienta para que pueda ser utilizada en los flujos
            de conversación.
          </p>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-5" />
            <span>Crear primera herramienta</span>
          </button>
        </div>
      )}

      {/* Tool Modal */}
      <ToolModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingTool={editingTool}
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
                Eliminar herramienta
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                ¿Estás seguro de que querés eliminar{" "}
                <span className="font-semibold text-white">
                  {deleteConfirm.name}
                </span>
                ? Los flujos que usen esta herramienta podrían verse afectados.
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
