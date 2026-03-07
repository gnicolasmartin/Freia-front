"use client";

import { useMemo } from "react";
import { ArrowRight, AlertCircle, Check, Minus } from "lucide-react";
import type { FlowVariable } from "@/types/flow";
import type { ToolParamDef, ToolParamMapping } from "@/types/flow";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { buildAutocompleteList } from "@/lib/template-variables";
import { selectClasses } from "./styles";

// Type compatibility matrix
const TYPE_COMPAT: Record<string, Set<string>> = {
  string: new Set(["string", "number", "boolean", "date", "enum"]),
  number: new Set(["number", "string"]),
  boolean: new Set(["boolean", "string"]),
  date: new Set(["date", "string"]),
  enum: new Set(["enum", "string"]),
};

function isTypeCompatible(variableType: string, paramType: string): boolean {
  return TYPE_COMPAT[paramType]?.has(variableType) ?? false;
}

interface ToolParamMappingFieldProps {
  value: ToolParamMapping[];
  onChange: (value: ToolParamMapping[]) => void;
  tool: string;
  flowVariables?: FlowVariable[];
}

export default function ToolParamMappingField({
  value,
  onChange,
  tool,
  flowVariables = [],
}: ToolParamMappingFieldProps) {
  const { getToolSchema } = useToolRegistry();
  const mappings = value || [];
  const params = getToolSchema(tool);

  const allVariables = useMemo(
    () => buildAutocompleteList(flowVariables),
    [flowVariables]
  );

  // Ensure every tool param has a mapping entry
  const normalizedMappings = useMemo(() => {
    const existing = new Map(mappings.map((m) => [m.paramName, m]));
    return params.map((param) => {
      const found = existing.get(param.name);
      return found ?? { id: crypto.randomUUID(), paramName: param.name, variableName: "" };
    });
  }, [mappings, params]);

  const updateMapping = (paramName: string, variableName: string) => {
    const exists = normalizedMappings.find((m) => m.paramName === paramName);
    if (exists) {
      onChange(
        normalizedMappings.map((m) =>
          m.paramName === paramName ? { ...m, variableName } : m
        )
      );
    } else {
      onChange([
        ...normalizedMappings,
        { id: crypto.randomUUID(), paramName, variableName },
      ]);
    }
  };

  if (!tool) {
    return (
      <p className="text-xs text-slate-500 italic">
        Seleccioná una herramienta primero
      </p>
    );
  }

  if (params.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">
        Esta herramienta no tiene parámetros definidos
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {params.map((param) => {
        const mapping = normalizedMappings.find(
          (m) => m.paramName === param.name
        );
        const selectedVarName = mapping?.variableName || "";
        const selectedVar = allVariables.find(
          (v) => v.name === selectedVarName
        );
        const hasMapping = !!selectedVarName;
        const isCompat =
          !hasMapping ||
          !selectedVar ||
          isTypeCompatible(selectedVar.type, param.type);

        return (
          <div
            key={param.name}
            className={`rounded-lg border p-2.5 space-y-1.5 ${
              !isCompat
                ? "border-amber-500/30 bg-amber-500/5"
                : hasMapping
                  ? "border-slate-700/50 bg-slate-800/30"
                  : param.required
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-slate-700/30 bg-slate-800/20"
            }`}
          >
            {/* Param header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white">
                  {param.label}
                </span>
                {param.required && (
                  <span className="text-red-400 text-xs">*</span>
                )}
                <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700 text-slate-400">
                  {param.type}
                </span>
              </div>
              <div className="flex items-center">
                {hasMapping && isCompat && (
                  <Check className="size-3 text-emerald-400" />
                )}
                {hasMapping && !isCompat && (
                  <AlertCircle className="size-3 text-amber-400" />
                )}
                {!hasMapping && !param.required && (
                  <Minus className="size-3 text-slate-600" />
                )}
                {!hasMapping && param.required && (
                  <AlertCircle className="size-3 text-red-400" />
                )}
              </div>
            </div>

            {/* Mapping row: variable → param */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedVarName}
                onChange={(e) => updateMapping(param.name, e.target.value)}
                className={`${selectClasses} text-xs font-mono flex-1`}
              >
                <option value="">— sin asignar —</option>
                {allVariables.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.type})
                  </option>
                ))}
              </select>
              <ArrowRight className="size-3 text-slate-500 shrink-0" />
              <span className="text-xs font-mono text-slate-400 shrink-0">
                {param.name}
              </span>
            </div>

            {/* Type incompatibility warning */}
            {hasMapping && !isCompat && selectedVar && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                Tipo incompatible: {selectedVar.type} → {param.type}
              </p>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
        <span>
          {normalizedMappings.filter((m) => m.variableName).length}/
          {params.length} mapeados
        </span>
        {params.some((p) => p.required) && (
          <span className="text-red-400">* obligatorio</span>
        )}
      </div>
    </div>
  );
}
