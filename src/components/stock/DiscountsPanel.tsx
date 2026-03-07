"use client";

import { useState } from "react";
import { Percent, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useProducts } from "@/providers/ProductsProvider";
import { DiscountModal } from "@/components/stock/DiscountModal";
import type { Discount } from "@/types/product";

export function DiscountsPanel() {
  const { discounts, deleteDiscount, getDiscountUsage } = useProducts();
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<{ discount: Discount; usageCount: number } | null>(null);

  const openCreate = () => {
    setEditingDiscount(null);
    setIsModalOpen(true);
  };

  const openEdit = (d: Discount) => {
    setEditingDiscount(d);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDiscount(null);
  };

  const requestDelete = (d: Discount) => {
    setDeleteState({ discount: d, usageCount: getDiscountUsage(d.id).length });
  };

  const handleDeleteConfirm = () => {
    if (deleteState) deleteDiscount(deleteState.discount.id);
    setDeleteState(null);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Panel header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Definí descuentos por porcentaje para reutilizarlos en productos y flujos.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shrink-0"
            aria-label="Nuevo descuento"
          >
            <Plus className="size-4" />
            <span>Nuevo descuento</span>
          </button>
        </div>

        {/* List */}
        {discounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
            <Percent className="size-10 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Sin descuentos definidos</h3>
            <p className="text-slate-400 text-sm text-center max-w-xs mb-5">
              Creá descuentos reutilizables que podés aplicar a tus productos.
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              aria-label="Agregar primer descuento"
            >
              <Plus className="size-4" />
              <span>Agregar descuento</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 overflow-hidden backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-6 py-3 font-medium">Nombre</th>
                  <th className="px-6 py-3 font-medium">Porcentaje</th>
                  <th className="px-6 py-3 font-medium">Descripción</th>
                  <th className="px-6 py-3 font-medium">Creado</th>
                  <th className="px-6 py-3 font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {discounts.map((d) => {
                  const usageCount = getDiscountUsage(d.id).length;
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Percent className="size-4 text-emerald-400 shrink-0" />
                          <span className="text-white font-medium">{d.name}</span>
                          {usageCount > 0 && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
                              {usageCount} producto{usageCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                          {d.percentage % 1 === 0 ? d.percentage : d.percentage.toFixed(2)} %
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs max-w-xs">
                        {d.description || <span className="italic text-slate-600">—</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(d.createdAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(d)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            aria-label={`Editar ${d.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => requestDelete(d)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label={`Eliminar ${d.name}`}
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

      <DiscountModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editingDiscount={editingDiscount}
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
            {deleteState.usageCount > 0 && (
              <div className="mb-4 flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400">
                  Este descuento está asignado a{" "}
                  <span className="text-amber-400 font-medium">
                    {deleteState.usageCount} producto{deleteState.usageCount !== 1 ? "s" : ""}
                  </span>
                  . Al eliminarlo, se desasignará automáticamente.
                </p>
              </div>
            )}
            <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar descuento?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Se eliminará{" "}
              <span className="text-white font-medium">{deleteState.discount.name}</span>{" "}
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-400">
                {deleteState.discount.percentage % 1 === 0 ? deleteState.discount.percentage : deleteState.discount.percentage.toFixed(2)} %
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
          </div>
        </div>
      )}
    </>
  );
}
