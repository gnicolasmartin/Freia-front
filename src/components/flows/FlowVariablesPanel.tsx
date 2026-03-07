"use client";

import { useState } from "react";
import {
  X,
  Variable,
  Plus,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Clock,
} from "lucide-react";
import type { FlowVariable, FlowVariableType } from "@/types/flow";
import { RESERVED_PREFIXES } from "@/types/flow";
import { BUILTIN_VARIABLES, PRODUCT_VARIABLES, CATEGORY_LABELS, type VariableCategory } from "@/lib/template-variables";
import { inputClasses, selectClasses } from "./fields/styles";

const VARIABLE_TYPES: { value: FlowVariableType; label: string }[] = [
  { value: "string", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "boolean", label: "Booleano" },
  { value: "date", label: "Fecha" },
  { value: "enum", label: "Enum (opciones)" },
];

interface FlowVariablesPanelProps {
  variables: FlowVariable[];
  onChange: (variables: FlowVariable[]) => void;
  onClose: () => void;
  useStock?: boolean;
}

function validateName(
  name: string,
  existingVariables: FlowVariable[],
  currentId?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "El nombre es obligatorio";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return "Solo letras, números y guiones bajos. Debe empezar con letra o _";
  }
  for (const prefix of RESERVED_PREFIXES) {
    if (trimmed.startsWith(prefix) || trimmed === prefix.slice(0, -1)) {
      return `El prefijo "${prefix}" está reservado`;
    }
  }
  const duplicate = existingVariables.find(
    (v) => v.name === trimmed && v.id !== currentId
  );
  if (duplicate) return "Ya existe una variable con este nombre";
  return null;
}

function formatTTL(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// --- Built-in variables grouped by category (read-only) ---

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  contact: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  channel: { bg: "bg-sky-500/20", text: "text-sky-400" },
  conversation: { bg: "bg-teal-500/20", text: "text-teal-400" },
  lead: { bg: "bg-blue-500/20", text: "text-blue-400" },
  system: { bg: "bg-purple-500/20", text: "text-purple-400" },
  product: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
};

function BuiltinVariablesSection({ useStock = false }: { useStock?: boolean }) {
  const [open, setOpen] = useState(false);

  const allBuiltins = useStock
    ? [...BUILTIN_VARIABLES, ...PRODUCT_VARIABLES]
    : BUILTIN_VARIABLES;

  // Group by category
  const grouped = allBuiltins.reduce<
    Record<string, typeof BUILTIN_VARIABLES>
  >((acc, v) => {
    (acc[v.category] ??= []).push(v);
    return acc;
  }, {});

  return (
    <div className="border-t border-slate-700">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Lock className="size-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-400">
            Variables del contexto
          </span>
          <span className="text-[10px] text-slate-600">
            ({allBuiltins.length})
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="size-3.5 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-2 max-h-60 overflow-y-auto">
          {Object.entries(grouped).map(([category, vars]) => {
            const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.system;
            const label =
              CATEGORY_LABELS[category as VariableCategory] ?? category;

            return (
              <div key={category}>
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  >
                    {label}
                  </span>
                </div>
                <div className="space-y-px">
                  {vars.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                    >
                      <Lock className="size-2.5 text-slate-600 shrink-0" />
                      <span className="font-mono text-slate-300 truncate">
                        {v.name}
                      </span>
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {v.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-600 px-2 pt-1">
            Disponibles automáticamente en plantillas y condiciones
          </p>
        </div>
      )}
    </div>
  );
}

export default function FlowVariablesPanel({
  variables,
  onChange,
  onClose,
  useStock = false,
}: FlowVariablesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAdd = () => {
    const newVar: FlowVariable = {
      id: crypto.randomUUID(),
      name: "",
      type: "string",
    };
    onChange([...variables, newVar]);
    setExpandedId(newVar.id);
  };

  const handleRemove = (id: string) => {
    onChange(variables.filter((v) => v.id !== id));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdate = (id: string, updates: Partial<FlowVariable>) => {
    const updated = variables.map((v) =>
      v.id === id ? { ...v, ...updates } : v
    );

    // Validate name if changed
    if ("name" in updates) {
      const error = validateName(updates.name || "", updated, id);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) next[id] = error;
        else delete next[id];
        return next;
      });
    }

    onChange(updated);
  };

  return (
    <div className="w-80 border-l border-slate-700 bg-slate-900/95 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Variable className="size-4 text-[#dd7430]" />
          <span className="text-sm font-semibold text-white">Variables</span>
          <span className="text-xs text-slate-500">({variables.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {variables.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Variable className="size-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Sin variables definidas</p>
            <p className="text-xs text-slate-500 mt-1">
              Las variables almacenan datos obtenidos durante la conversación
            </p>
          </div>
        )}

        {variables.map((variable) => {
          const isExpanded = expandedId === variable.id;
          const error = errors[variable.id];
          const typeLabel =
            VARIABLE_TYPES.find((t) => t.value === variable.type)?.label ??
            variable.type;

          return (
            <div
              key={variable.id}
              className={`rounded-lg border transition-colors ${
                error
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-slate-700/50 bg-slate-800/50"
              }`}
            >
              {/* Summary row */}
              <button
                type="button"
                onClick={() =>
                  setExpandedId(isExpanded ? null : variable.id)
                }
                className="flex items-center justify-between w-full px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-sm font-mono truncate ${
                      variable.name
                        ? "text-white"
                        : "text-slate-500 italic"
                    }`}
                  >
                    {variable.name || "sin nombre"}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">
                    {typeLabel}
                  </span>
                  {variable.ttlSeconds && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-400/70 shrink-0">
                      <Clock className="size-2.5" />
                      {formatTTL(variable.ttlSeconds)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {error && (
                    <AlertCircle className="size-3 text-red-400" />
                  )}
                  {isExpanded ? (
                    <ChevronUp className="size-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="size-3.5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Expanded edit form */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 pt-3">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) =>
                        handleUpdate(variable.id, { name: e.target.value })
                      }
                      placeholder="nombre_variable"
                      className={`${inputClasses} font-mono text-xs`}
                    />
                    {error && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {error}
                      </p>
                    )}
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Tipo
                    </label>
                    <select
                      value={variable.type}
                      onChange={(e) =>
                        handleUpdate(variable.id, {
                          type: e.target.value as FlowVariableType,
                          ...(e.target.value !== "enum"
                            ? { enumValues: undefined }
                            : {}),
                        })
                      }
                      className={selectClasses}
                    >
                      {VARIABLE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Enum values */}
                  {variable.type === "enum" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Opciones (una por línea)
                      </label>
                      <textarea
                        value={(variable.enumValues ?? []).join("\n")}
                        onChange={(e) =>
                          handleUpdate(variable.id, {
                            enumValues: e.target.value
                              .split("\n")
                              .filter((v) => v.trim()),
                          })
                        }
                        rows={3}
                        placeholder={"opcion_1\nopcion_2\nopcion_3"}
                        className={`${inputClasses} font-mono text-xs resize-none`}
                      />
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Descripción
                      <span className="text-slate-500 font-normal ml-1">
                        (opcional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={variable.description ?? ""}
                      onChange={(e) =>
                        handleUpdate(variable.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder="Para qué se usa esta variable..."
                      className={inputClasses}
                    />
                  </div>

                  {/* TTL */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Expiración (TTL)
                        <span className="text-slate-500 font-normal">
                          (opcional)
                        </span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={variable.ttlSeconds ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleUpdate(variable.id, {
                            ttlSeconds: val ? parseInt(val, 10) || undefined : undefined,
                          });
                        }}
                        placeholder="Sin expiración"
                        className={`${inputClasses} text-xs flex-1`}
                      />
                      <span className="text-xs text-slate-500 shrink-0">
                        segundos
                      </span>
                    </div>
                    {variable.ttlSeconds && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        El valor se invalida tras {formatTTL(variable.ttlSeconds)} sin actualización
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleRemove(variable.id)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="size-3" />
                    Eliminar variable
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Built-in system variables (read-only) */}
      <BuiltinVariablesSection useStock={useStock} />

      {/* Add button */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 transition-colors"
        >
          <Plus className="size-3.5" />
          Agregar variable
        </button>
      </div>
    </div>
  );
}
