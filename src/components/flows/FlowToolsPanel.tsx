"use client";

import { useMemo } from "react";
import { X, Wrench } from "lucide-react";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { TOOL_CATEGORIES, CATEGORY_COLORS } from "@/types/tool-registry";

interface FlowToolsPanelProps {
  allowedToolIds: string[];
  onChange: (allowedToolIds: string[]) => void;
  onClose: () => void;
}

export default function FlowToolsPanel({
  allowedToolIds,
  onChange,
  onClose,
}: FlowToolsPanelProps) {
  const { tools } = useToolRegistry();

  const isUnrestricted = allowedToolIds.length === 0;

  const toolsByCategory = useMemo(() => {
    const grouped: Record<string, typeof tools> = {};
    for (const cat of TOOL_CATEGORIES) {
      const items = tools.filter((t) => t.category === cat.value);
      if (items.length > 0) {
        grouped[cat.value] = items;
      }
    }
    return grouped;
  }, [tools]);

  const toggleTool = (toolId: string) => {
    if (isUnrestricted) {
      // Switching from unrestricted: allow all EXCEPT the toggled one
      const allExcept = tools
        .filter((t) => t.id !== toolId)
        .map((t) => t.id);
      onChange(allExcept);
    } else if (allowedToolIds.includes(toolId)) {
      const updated = allowedToolIds.filter((id) => id !== toolId);
      // If removing the last one would make it empty, keep unrestricted
      onChange(updated);
    } else {
      onChange([...allowedToolIds, toolId]);
    }
  };

  const isToolAllowed = (toolId: string) =>
    isUnrestricted || allowedToolIds.includes(toolId);

  const allowedCount = isUnrestricted
    ? tools.length
    : allowedToolIds.length;

  return (
    <div className="w-80 border-l border-slate-700 bg-slate-900/95 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Herramientas</span>
          <span className="text-xs text-slate-500">
            ({allowedCount}/{tools.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Unrestricted indicator */}
      {isUnrestricted && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5">
          <p className="text-xs text-purple-300">
            Sin restricción — todas las herramientas permitidas
          </p>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(toolsByCategory).map(([category, categoryTools]) => {
          const catDef = TOOL_CATEGORIES.find((c) => c.value === category);
          const colors = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.support;

          return (
            <div key={category} className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {catDef?.label ?? category}
                </span>
                <span className="text-[10px] text-slate-600">
                  ({categoryTools.length})
                </span>
              </div>

              <div className="space-y-1">
                {categoryTools.map((tool) => {
                  const allowed = isToolAllowed(tool.id);

                  return (
                    <div
                      key={tool.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                        allowed
                          ? "border-purple-500/20 bg-purple-500/5"
                          : "border-slate-700/50 bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Wrench className="size-3.5 text-purple-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-white truncate block">
                            {tool.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono truncate block">
                            {tool.id}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={allowed}
                        onClick={() => toggleTool(tool.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                          allowed ? "bg-purple-500" : "bg-slate-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            allowed ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {tools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center px-4">
            <Wrench className="size-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Sin herramientas</p>
            <p className="text-xs text-slate-500 mt-1">
              Creá herramientas en el registro para asociarlas aquí
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700">
        <p className="text-[10px] text-slate-600">
          Dejá todas activas para no restringir. Desactivar herramientas limita
          las opciones en nodos Tool Call.
        </p>
      </div>
    </div>
  );
}
