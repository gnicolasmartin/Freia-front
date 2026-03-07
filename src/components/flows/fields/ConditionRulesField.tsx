"use client";

import { useCallback, useMemo } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ArrowDown } from "lucide-react";
import type { FlowVariable } from "@/types/flow";
import { buildAutocompleteList } from "@/lib/template-variables";
import { inputClasses, selectClasses } from "./styles";

export interface ConditionRule {
  id: string;
  variable: string;
  operator: string;
  value: string;
  label: string;
}

export const OPERATOR_OPTIONS = [
  { value: "equals", label: "== Igual a" },
  { value: "not_equals", label: "!= Distinto de" },
  { value: "greater_than", label: "> Mayor que" },
  { value: "less_than", label: "< Menor que" },
  { value: "contains", label: "Contiene" },
  { value: "in", label: "En lista" },
  { value: "exists", label: "Existe" },
] as const;

const NO_VALUE_OPERATORS = new Set(["exists"]);

export const OPERATOR_LABELS: Record<string, string> = {
  equals: "==",
  not_equals: "!=",
  greater_than: ">",
  less_than: "<",
  contains: "contiene",
  in: "en",
  exists: "existe",
};

interface ConditionRulesFieldProps {
  value: ConditionRule[];
  onChange: (value: ConditionRule[]) => void;
  flowVariables?: FlowVariable[];
}

export default function ConditionRulesField({
  value,
  onChange,
  flowVariables = [],
}: ConditionRulesFieldProps) {
  const rules = value || [];

  const variableOptions = useMemo(() => {
    const allVars = buildAutocompleteList(flowVariables);
    return allVars.map((v) => ({
      value: v.name,
      label: v.name,
    }));
  }, [flowVariables]);

  const addRule = useCallback(() => {
    onChange([
      ...rules,
      {
        id: crypto.randomUUID(),
        variable: "",
        operator: "equals",
        value: "",
        label: `Regla ${rules.length + 1}`,
      },
    ]);
  }, [rules, onChange]);

  const removeRule = useCallback(
    (id: string) => {
      onChange(rules.filter((r) => r.id !== id));
    },
    [rules, onChange]
  );

  const updateRule = useCallback(
    (id: string, field: keyof ConditionRule, val: string) => {
      onChange(rules.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
    },
    [rules, onChange]
  );

  const moveRule = useCallback(
    (index: number, direction: "up" | "down") => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rules.length) return;
      const newRules = [...rules];
      [newRules[index], newRules[targetIndex]] = [
        newRules[targetIndex],
        newRules[index],
      ];
      onChange(newRules);
    },
    [rules, onChange]
  );

  return (
    <div className="space-y-2">
      {/* Cascade evaluation info */}
      {rules.length > 1 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
          <ArrowDown className="size-3 text-blue-400 shrink-0" />
          <span className="text-[10px] text-blue-400">
            Evaluación en cascada: se ejecuta la primera regla que se cumpla
          </span>
        </div>
      )}

      {rules.map((rule, index) => (
        <div
          key={rule.id}
          className="rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center justify-center size-5 rounded bg-blue-500/20 text-[10px] font-bold text-blue-400">
                {index + 1}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Regla
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => moveRule(index, "up")}
                disabled={index === 0}
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Subir prioridad"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveRule(index, "down")}
                disabled={index === rules.length - 1}
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Bajar prioridad"
              >
                <ChevronDown className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Label */}
          <input
            type="text"
            value={rule.label}
            onChange={(e) => updateRule(rule.id, "label", e.target.value)}
            placeholder="Nombre de la ruta"
            className={`${inputClasses} text-xs`}
          />

          {/* Variable select */}
          <select
            value={rule.variable}
            onChange={(e) => updateRule(rule.id, "variable", e.target.value)}
            className={`${selectClasses} text-xs font-mono`}
          >
            <option value="">Seleccionar variable...</option>
            {variableOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={rule.operator}
            onChange={(e) => updateRule(rule.id, "operator", e.target.value)}
            className={`${selectClasses} text-xs`}
          >
            {OPERATOR_OPTIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {/* Value (hidden when operator doesn't need one) */}
          {!NO_VALUE_OPERATORS.has(rule.operator) && (
            <input
              type="text"
              value={rule.value}
              onChange={(e) => updateRule(rule.id, "value", e.target.value)}
              placeholder={
                rule.operator === "in"
                  ? "valor1, valor2, valor3"
                  : "valor"
              }
              className={`${inputClasses} text-xs`}
            />
          )}

          {/* Operator hint for 'in' */}
          {rule.operator === "in" && (
            <p className="text-[10px] text-slate-500">
              Valores separados por coma
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRule}
        className="flex items-center gap-1.5 text-xs text-[#dd7430] hover:text-orange-300 transition-colors"
      >
        <Plus className="size-3.5" />
        Agregar regla
      </button>

      {/* Default route indicator (always present, mandatory) */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
        <div className="size-2.5 rounded-full bg-slate-500" />
        <span className="text-xs text-slate-500 italic">
          Ruta por defecto — obligatoria (cuando ninguna regla se cumple)
        </span>
      </div>
    </div>
  );
}
