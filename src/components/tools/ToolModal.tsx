"use client";

import { useState, useEffect, useRef } from "react";
import { X, Wrench, Plus, Trash2 } from "lucide-react";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import type { ToolDefinition, ToolFormData, ToolCategory, ToolOutputField, ToolOutputFieldType } from "@/types/tool-registry";
import { EMPTY_TOOL_FORM, TOOL_CATEGORIES } from "@/types/tool-registry";
import type { ToolParamDef, FlowVariableType } from "@/types/flow";

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTool?: ToolDefinition | null;
}

const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none";

const selectClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none appearance-none";

const PARAM_TYPES: { value: FlowVariableType; label: string }[] = [
  { value: "string", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "boolean", label: "Booleano" },
  { value: "date", label: "Fecha" },
  { value: "enum", label: "Enum" },
];

const OUTPUT_TYPES: { value: ToolOutputFieldType; label: string }[] = [
  { value: "string", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "boolean", label: "Booleano" },
  { value: "date", label: "Fecha" },
  { value: "object", label: "Objeto" },
  { value: "array", label: "Array" },
];

export default function ToolModal({ isOpen, onClose, editingTool }: ToolModalProps) {
  const { createTool, updateTool } = useToolRegistry();
  const [formData, setFormData] = useState<ToolFormData>(EMPTY_TOOL_FORM);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingTool) {
        setFormData({
          id: editingTool.id,
          name: editingTool.name,
          description: editingTool.description,
          category: editingTool.category,
          inputSchema: editingTool.inputSchema.map((p) => ({ ...p })),
          outputSchema: editingTool.outputSchema.map((f) => ({ ...f })),
          requiresConfirmation: editingTool.requiresConfirmation,
          supportsSimulation: editingTool.supportsSimulation,
        });
      } else {
        setFormData(EMPTY_TOOL_FORM);
      }
      scrollRef.current?.scrollTo(0, 0);
    }
  }, [isOpen, editingTool]);

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingTool) {
      updateTool(editingTool.id, formData);
    } else {
      createTool(formData);
    }
    onClose();
  };

  // --- Input schema helpers ---
  const addInputParam = () => {
    setFormData((prev) => ({
      ...prev,
      inputSchema: [
        ...prev.inputSchema,
        { name: "", label: "", type: "string" as FlowVariableType, required: false },
      ],
    }));
  };

  const updateInputParam = (index: number, updates: Partial<ToolParamDef>) => {
    setFormData((prev) => ({
      ...prev,
      inputSchema: prev.inputSchema.map((p, i) =>
        i === index ? { ...p, ...updates } : p
      ),
    }));
  };

  const removeInputParam = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      inputSchema: prev.inputSchema.filter((_, i) => i !== index),
    }));
  };

  // --- Output schema helpers ---
  const addOutputField = () => {
    setFormData((prev) => ({
      ...prev,
      outputSchema: [
        ...prev.outputSchema,
        { name: "", label: "", type: "string" as ToolOutputFieldType },
      ],
    }));
  };

  const updateOutputField = (index: number, updates: Partial<ToolOutputField>) => {
    setFormData((prev) => ({
      ...prev,
      outputSchema: prev.outputSchema.map((f, i) =>
        i === index ? { ...f, ...updates } : f
      ),
    }));
  };

  const removeOutputField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      outputSchema: prev.outputSchema.filter((_, i) => i !== index),
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/20">
              <Wrench className="size-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {editingTool ? "Editar herramienta" : "Nueva herramienta"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* General info */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Información general
            </h3>

            {/* ID (only for new tools) */}
            {!editingTool && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Identificador (slug)
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    }))
                  }
                  placeholder="mi_herramienta"
                  className={inputClasses}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Identificador único (a-z, 0-9, _). Se usa en nodos de flujo.
                </p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Buscar en CRM"
                className={inputClasses}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe qué hace esta herramienta..."
                rows={3}
                className={inputClasses}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Categoría
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value as ToolCategory,
                  }))
                }
                className={selectClasses}
              >
                {TOOL_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Configuration */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Configuración
            </h3>

            <div className="space-y-3">
              {/* Requires confirmation */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`flex size-5 items-center justify-center rounded border transition-colors ${
                    formData.requiresConfirmation
                      ? "bg-purple-500 border-purple-500"
                      : "border-slate-600 group-hover:border-slate-500"
                  }`}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      requiresConfirmation: !prev.requiresConfirmation,
                    }))
                  }
                >
                  {formData.requiresConfirmation && (
                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-sm text-white">Requiere confirmación</span>
                  <p className="text-xs text-slate-500">
                    El usuario debe confirmar antes de ejecutar
                  </p>
                </div>
              </label>

              {/* Supports simulation */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`flex size-5 items-center justify-center rounded border transition-colors ${
                    formData.supportsSimulation
                      ? "bg-purple-500 border-purple-500"
                      : "border-slate-600 group-hover:border-slate-500"
                  }`}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      supportsSimulation: !prev.supportsSimulation,
                    }))
                  }
                >
                  {formData.supportsSimulation && (
                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-sm text-white">Soporta simulación</span>
                  <p className="text-xs text-slate-500">
                    Puede ejecutarse con datos mock en simulaciones
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* Input Schema */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Esquema de entrada
              </h3>
              <button
                type="button"
                onClick={addInputParam}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-900/20 transition-colors"
              >
                <Plus className="size-3.5" />
                Agregar
              </button>
            </div>

            {formData.inputSchema.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Sin parámetros de entrada definidos
              </p>
            ) : (
              <div className="space-y-2">
                {formData.inputSchema.map((param, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) =>
                          updateInputParam(idx, { name: e.target.value })
                        }
                        placeholder="nombre_param"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-white text-xs font-mono placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={param.label}
                        onChange={(e) =>
                          updateInputParam(idx, { label: e.target.value })
                        }
                        placeholder="Label"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                      <select
                        value={param.type}
                        onChange={(e) =>
                          updateInputParam(idx, {
                            type: e.target.value as FlowVariableType,
                          })
                        }
                        className="rounded-lg border border-slate-600 bg-slate-900/50 px-2 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none appearance-none"
                      >
                        {PARAM_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={param.required ?? false}
                          onChange={(e) =>
                            updateInputParam(idx, {
                              required: e.target.checked,
                            })
                          }
                          className="rounded border-slate-600"
                        />
                        Req.
                      </label>
                      <button
                        type="button"
                        onClick={() => removeInputParam(idx)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Output Schema */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Esquema de salida
              </h3>
              <button
                type="button"
                onClick={addOutputField}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-900/20 transition-colors"
              >
                <Plus className="size-3.5" />
                Agregar
              </button>
            </div>

            {formData.outputSchema.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Sin campos de salida definidos
              </p>
            ) : (
              <div className="space-y-2">
                {formData.outputSchema.map((field, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) =>
                          updateOutputField(idx, { name: e.target.value })
                        }
                        placeholder="nombre_campo"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-white text-xs font-mono placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          updateOutputField(idx, { label: e.target.value })
                        }
                        placeholder="Label"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateOutputField(idx, {
                            type: e.target.value as ToolOutputFieldType,
                          })
                        }
                        className="rounded-lg border border-slate-600 bg-slate-900/50 px-2 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none appearance-none"
                      >
                        {OUTPUT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeOutputField(idx)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editingTool ? "Guardar cambios" : "Crear herramienta"}
          </button>
        </div>
      </div>
    </div>
  );
}
