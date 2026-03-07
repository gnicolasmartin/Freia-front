"use client";

import { useState } from "react";
import { X, Search, ChevronDown, ChevronRight, Lock, Clock, Braces } from "lucide-react";
import { useFlows } from "@/providers/FlowsProvider";
import type { FlowVariableType } from "@/types/flow";
import {
  BUILTIN_VARIABLES,
  PRODUCT_VARIABLES,
  CATEGORY_LABELS,
  type AutocompleteVariable,
  type VariableCategory,
} from "@/lib/template-variables";

interface FrontVariablesPanelProps {
  flowIds: string[];
  onClose: () => void;
}

type TypeFilter = "all" | FlowVariableType;

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "enum", label: "Enum" },
];

const TYPE_BADGE_COLORS: Record<string, string> = {
  string: "bg-slate-700/50 text-slate-400",
  number: "bg-sky-900/30 text-sky-400",
  boolean: "bg-violet-900/30 text-violet-400",
  date: "bg-amber-900/30 text-amber-400",
  enum: "bg-emerald-900/30 text-emerald-400",
};

export default function FrontVariablesPanel({ flowIds, onClose }: FrontVariablesPanelProps) {
  const { flows } = useFlows();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const assignedFlows = flows.filter((f) => flowIds.includes(f.id));

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const matchesFilter = (name: string, type: string, description?: string) => {
    const matchesType = typeFilter === "all" || type === typeFilter;
    if (!matchesType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      (description?.toLowerCase().includes(q) ?? false)
    );
  };

  // Group builtin variables by category
  const allBuiltins = [...BUILTIN_VARIABLES, ...PRODUCT_VARIABLES];
  const builtinCategories = new Map<VariableCategory, AutocompleteVariable[]>();
  for (const v of allBuiltins) {
    if (!matchesFilter(v.name, v.type, v.description)) continue;
    const list = builtinCategories.get(v.category) ?? [];
    list.push(v);
    builtinCategories.set(v.category, list);
  }

  // Count total filtered variables
  let totalFlowVars = 0;
  for (const flow of assignedFlows) {
    totalFlowVars += flow.variables.filter((v) =>
      matchesFilter(v.name, v.type, v.description)
    ).length;
  }
  let totalBuiltinVars = 0;
  for (const vars of builtinCategories.values()) {
    totalBuiltinVars += vars.length;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-800 border-l border-slate-700 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Braces className="size-5 text-[#dd7430]" />
            <h2 className="text-lg font-semibold text-white">Variables disponibles</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-5 py-3 border-b border-slate-700/50 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar variable..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 text-sm text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  typeFilter === opt.value
                    ? "bg-[#dd7430]/15 text-[#dd7430] border border-[#dd7430]/40"
                    : "bg-slate-700/30 text-slate-500 border border-slate-700 hover:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* Empty state */}
          {assignedFlows.length === 0 && (
            <div className="text-center py-8">
              <Braces className="size-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No hay flujos asignados a este front.</p>
              <p className="text-xs text-slate-600 mt-1">
                Asigna flujos en la pestaña &quot;Asignaciones&quot; para ver sus variables.
              </p>
            </div>
          )}

          {/* Flow variables */}
          {assignedFlows.map((flow) => {
            const filtered = flow.variables.filter((v) =>
              matchesFilter(v.name, v.type, v.description)
            );
            if (filtered.length === 0 && search.trim()) return null;
            const isCollapsed = collapsedSections.has(flow.id);

            return (
              <div key={flow.id}>
                <button
                  onClick={() => toggleSection(flow.id)}
                  className="flex items-center gap-2 w-full text-left mb-1.5 group"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="size-3.5 text-slate-500" />
                  )}
                  <span className="text-sm font-medium text-white group-hover:text-[#dd7430] transition-colors">
                    {flow.name}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    ({filtered.length} variable{filtered.length !== 1 ? "s" : ""})
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="ml-5 space-y-1">
                    {filtered.length === 0 ? (
                      <p className="text-[11px] text-slate-600 py-1">
                        Sin variables definidas.
                      </p>
                    ) : (
                      filtered.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-700/50 bg-slate-800/50 hover:border-slate-600 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-white">{v.name}</code>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${TYPE_BADGE_COLORS[v.type] ?? TYPE_BADGE_COLORS.string}`}>
                                {v.type}
                              </span>
                              {v.ttlSeconds && v.ttlSeconds > 0 && (
                                <span className="flex items-center gap-0.5 text-[9px] text-slate-600">
                                  <Clock className="size-2.5" />
                                  {v.ttlSeconds}s
                                </span>
                              )}
                            </div>
                            {v.description && (
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                {v.description}
                              </p>
                            )}
                            {v.type === "enum" && v.enumValues && v.enumValues.length > 0 && (
                              <p className="text-[9px] text-slate-600 mt-0.5">
                                Valores: {v.enumValues.join(", ")}
                              </p>
                            )}
                            <p className="text-[9px] text-slate-600 mt-0.5">
                              Origen: {flow.name}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Builtin variables */}
          {builtinCategories.size > 0 && (
            <div>
              <button
                onClick={() => toggleSection("__builtin")}
                className="flex items-center gap-2 w-full text-left mb-1.5 group"
              >
                {collapsedSections.has("__builtin") ? (
                  <ChevronRight className="size-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="size-3.5 text-slate-500" />
                )}
                <Lock className="size-3 text-slate-500" />
                <span className="text-sm font-medium text-white group-hover:text-[#dd7430] transition-colors">
                  Variables del sistema
                </span>
                <span className="text-[10px] text-slate-600">
                  ({totalBuiltinVars})
                </span>
              </button>

              {!collapsedSections.has("__builtin") && (
                <div className="ml-5 space-y-3">
                  {Array.from(builtinCategories.entries()).map(([category, vars]) => (
                    <div key={category}>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                        {CATEGORY_LABELS[category]}
                      </p>
                      <div className="space-y-1">
                        {vars.map((v) => (
                          <div
                            key={v.name}
                            className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-700/30 bg-slate-900/20"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono text-slate-300">{v.name}</code>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${TYPE_BADGE_COLORS[v.type] ?? TYPE_BADGE_COLORS.string}`}>
                                  {v.type}
                                </span>
                                <Lock className="size-2.5 text-slate-600" />
                              </div>
                              {v.description && (
                                <p className="text-[10px] text-slate-600 mt-0.5">
                                  {v.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No results */}
          {search.trim() && totalFlowVars === 0 && totalBuiltinVars === 0 && (
            <div className="text-center py-6">
              <Search className="size-5 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                No se encontraron variables para &quot;{search}&quot;.
              </p>
            </div>
          )}
        </div>

        {/* Footer summary */}
        <div className="border-t border-slate-700 px-5 py-3 shrink-0">
          <p className="text-[10px] text-slate-600">
            {totalFlowVars} variable{totalFlowVars !== 1 ? "s" : ""} de flujos &middot;{" "}
            {totalBuiltinVars} del sistema &middot;{" "}
            {assignedFlows.length} flujo{assignedFlows.length !== 1 ? "s" : ""} asignado{assignedFlows.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
