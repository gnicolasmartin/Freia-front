"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useFlows } from "@/providers/FlowsProvider";
import type { Flow, FlowFormData } from "@/types/flow";
import { EMPTY_FLOW_FORM, FLOW_STATUSES } from "@/types/flow";

interface FlowModalProps {
  isOpen: boolean;
  onClose: (createdFlowId?: string) => void;
  editingFlow?: Flow | null;
}

const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

const selectClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

export default function FlowModal({
  isOpen,
  onClose,
  editingFlow,
}: FlowModalProps) {
  const { createFlow, updateFlow } = useFlows();
  const [formData, setFormData] = useState<FlowFormData>({
    ...EMPTY_FLOW_FORM,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingFlow) {
        const { id, createdAt, nodes, edges, ...rest } = editingFlow;
        setFormData({ ...EMPTY_FLOW_FORM, ...rest });
      } else {
        setFormData({ ...EMPTY_FLOW_FORM });
      }
      setError(null);
    }
  }, [isOpen, editingFlow]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError("El nombre del flujo es requerido.");
      return;
    }

    if (editingFlow) {
      updateFlow(editingFlow.id, formData);
      onClose();
    } else {
      const newFlow = createFlow(formData);
      onClose(newFlow.id);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const isEditing = !!editingFlow;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="flow-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2
            id="flow-modal-title"
            className="text-xl font-bold text-white"
          >
            {isEditing ? "Editar Flujo" : "Nuevo Flujo"}
          </h2>
          <button
            onClick={() => onClose()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label
              htmlFor="flow-name"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Nombre del flujo <span className="text-red-400">*</span>
            </label>
            <input
              id="flow-name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ej: Flujo de ventas inicial"
              className={inputClasses}
            />
          </div>

          {/* Descripción */}
          <div>
            <label
              htmlFor="flow-description"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Descripción
            </label>
            <textarea
              id="flow-description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe el propósito de este flujo..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </div>

          {/* Estado */}
          {isEditing && (
            <div>
              <label
                htmlFor="flow-status"
                className="block text-sm font-medium text-slate-200 mb-1.5"
              >
                Estado
              </label>
              <select
                id="flow-status"
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className={selectClasses}
              >
                {FLOW_STATUSES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isEditing && (
            <p className="text-xs text-slate-500">
              Una vez creado, podrás diseñar el flujo visualmente en el editor
              de canvas.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          <button
            onClick={() => onClose()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-[#dd7430] text-white hover:bg-orange-600 transition-colors"
          >
            {isEditing ? "Guardar Cambios" : "Crear y abrir editor"}
          </button>
        </div>
      </div>
    </div>
  );
}
