"use client";

import { useState } from "react";
import { Tag, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useProducts } from "@/providers/ProductsProvider";
import { VariantTypeModal } from "@/components/stock/VariantTypeModal";
import type { VariantType } from "@/types/product";

export function VariantTypesPanel() {
  const { variantTypes, deleteVariantType, getVariantTypeUsage } = useProducts();
  const [editingVariantType, setEditingVariantType] = useState<VariantType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<{ variantType: VariantType; usageCount: number } | null>(null);

  const openCreate = () => {
    setEditingVariantType(null);
    setIsModalOpen(true);
  };

  const openEdit = (vt: VariantType) => {
    setEditingVariantType(vt);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVariantType(null);
  };

  const requestDelete = (vt: VariantType) => {
    const usageCount = getVariantTypeUsage(vt.id).length;
    setDeleteState({ variantType: vt, usageCount });
  };

  const handleDeleteConfirm = () => {
    if (deleteState && deleteState.usageCount === 0) {
      deleteVariantType(deleteState.variantType.id);
    }
    setDeleteState(null);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Panel header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Definí los tipos de atributo que podés asociar a los productos (ej: Color, Talle, Marca).
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors shrink-0"
            aria-label="Nuevo tipo de variante"
          >
            <Plus className="size-4" />
            <span>Nuevo tipo</span>
          </button>
        </div>

        {/* List */}
        {variantTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
            <Tag className="size-10 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Sin tipos definidos</h3>
            <p className="text-slate-400 text-sm text-center max-w-xs mb-5">
              Creá tipos de variante para organizar y tipificar atributos de tus productos.
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              aria-label="Agregar primer tipo de variante"
            >
              <Plus className="size-4" />
              <span>Agregar tipo</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 overflow-hidden backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-6 py-3 font-medium">Nombre</th>
                  <th className="px-6 py-3 font-medium">Clave interna</th>
                  <th className="px-6 py-3 font-medium">Creado</th>
                  <th className="px-6 py-3 font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {variantTypes.map((vt) => {
                  const usageCount = getVariantTypeUsage(vt.id).length;
                  return (
                    <tr
                      key={vt.id}
                      className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Tag className="size-4 text-violet-400 shrink-0" />
                          <span className="text-white font-medium">{vt.name}</span>
                          {usageCount > 0 && (
                            <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-xs text-violet-400">
                              {usageCount} producto{usageCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded text-xs">
                          {vt.key}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(vt.createdAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(vt)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            aria-label={`Editar ${vt.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => requestDelete(vt)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label={`Eliminar ${vt.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VariantTypeModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editingVariantType={editingVariantType}
      />

      {/* Delete dialog */}
      {deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteState(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            {deleteState.usageCount > 0 ? (
              /* Blocked */
              <>
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="size-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      No se puede eliminar este tipo
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      <span className="text-white font-medium">{deleteState.variantType.name}</span> está
                      en uso por{" "}
                      <span className="text-amber-400 font-medium">
                        {deleteState.usageCount} producto{deleteState.usageCount !== 1 ? "s" : ""}
                      </span>
                      . Desasociá el tipo de todos los productos antes de eliminarlo.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteState(null)}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              /* Normal confirmation */
              <>
                <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar tipo de variante?</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Se eliminará el tipo{" "}
                  <span className="text-white font-medium">{deleteState.variantType.name}</span>{" "}
                  <span className="font-mono text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded text-xs">
                    {deleteState.variantType.key}
                  </span>
                  . Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteState(null)}
                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800/50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
