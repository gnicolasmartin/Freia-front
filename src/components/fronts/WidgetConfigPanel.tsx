"use client";

import { useState } from "react";
import { Plus, Trash2, AlertCircle, Database, Settings2 } from "lucide-react";
import { useFlows } from "@/providers/FlowsProvider";
import type { FrontSection } from "@/types/front";
import type { Flow } from "@/types/flow";
import type {
  WidgetSize,
  WidgetGeneralConfig,
  WidgetDataBinding,
  DataTransform,
} from "@/types/front-widgets";
import {
  WIDGET_SIZE_LABELS,
  DATA_TRANSFORM_LABELS,
  DEFAULT_GENERAL_CONFIG,
  getWidgetEntry,
} from "@/types/front-widgets";

interface WidgetConfigPanelProps {
  section: FrontSection;
  frontFlowIds: string[];
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

type ConfigTab = "general" | "binding";

export default function WidgetConfigPanel({
  section,
  frontFlowIds,
  onUpdateConfig,
}: WidgetConfigPanelProps) {
  const { flows } = useFlows();
  const widgetEntry = getWidgetEntry(section.type);
  const hasBindableSlots = (widgetEntry?.bindableSlots?.length ?? 0) > 0;

  const [tab, setTab] = useState<ConfigTab>("general");

  const general: WidgetGeneralConfig = {
    ...DEFAULT_GENERAL_CONFIG,
    ...((section.config?._general as WidgetGeneralConfig) ?? {}),
  };

  const bindings: WidgetDataBinding[] =
    (section.config?._bindings as WidgetDataBinding[]) ?? [];

  const assignedFlows = flows.filter((f) => frontFlowIds.includes(f.id));

  const updateGeneral = (patch: Partial<WidgetGeneralConfig>) => {
    onUpdateConfig({ _general: { ...general, ...patch } });
  };

  const updateBindings = (updated: WidgetDataBinding[]) => {
    onUpdateConfig({ _bindings: updated });
  };

  return (
    <div className="mt-2 border border-slate-600/50 rounded-lg bg-slate-800/30 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-700/50">
        <button
          onClick={() => setTab("general")}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors ${
            tab === "general"
              ? "text-[#dd7430] border-b-2 border-[#dd7430] -mb-px"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Settings2 className="size-3" />
          General
        </button>
        {hasBindableSlots && (
          <button
            onClick={() => setTab("binding")}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors ${
              tab === "binding"
                ? "text-[#dd7430] border-b-2 border-[#dd7430] -mb-px"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Database className="size-3" />
            Data Binding
            {bindings.length > 0 && (
              <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-[#dd7430]/20 text-[#dd7430]">
                {bindings.length}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="p-3">
        {tab === "general" && (
          <GeneralTab general={general} onUpdate={updateGeneral} />
        )}
        {tab === "binding" && hasBindableSlots && (
          <BindingTab
            bindings={bindings}
            slots={widgetEntry?.bindableSlots ?? []}
            assignedFlows={assignedFlows}
            onUpdate={updateBindings}
          />
        )}
      </div>
    </div>
  );
}

// --- General Tab ---

function GeneralTab({
  general,
  onUpdate,
}: {
  general: WidgetGeneralConfig;
  onUpdate: (patch: Partial<WidgetGeneralConfig>) => void;
}) {
  const inputCls =
    "w-full rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none";

  return (
    <div className="space-y-3">
      {/* Description */}
      <div>
        <label className="block text-[10px] text-slate-500 mb-1">Descripción</label>
        <textarea
          value={general.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value || undefined })}
          rows={2}
          placeholder="Descripción del widget (visible para el admin)"
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Size */}
      <div>
        <label className="block text-[10px] text-slate-500 mb-1">Tamaño</label>
        <div className="flex gap-1">
          {(Object.keys(WIDGET_SIZE_LABELS) as WidgetSize[]).map((size) => (
            <button
              key={size}
              onClick={() => onUpdate({ size })}
              className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                general.size === size
                  ? "bg-[#dd7430]/15 text-[#dd7430] border border-[#dd7430]/40"
                  : "bg-slate-700/30 text-slate-500 border border-slate-700 hover:text-slate-300"
              }`}
            >
              {WIDGET_SIZE_LABELS[size]}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh */}
      <div>
        <label className="block text-[10px] text-slate-500 mb-1">
          Refresh automático (segundos)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={general.refreshSeconds}
            onChange={(e) =>
              onUpdate({ refreshSeconds: Math.max(0, parseInt(e.target.value) || 0) })
            }
            className={`${inputCls} w-24`}
          />
          <span className="text-[10px] text-slate-600">
            {general.refreshSeconds === 0 ? "Deshabilitado" : `Cada ${general.refreshSeconds}s`}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Binding Tab ---

function BindingTab({
  bindings,
  slots,
  assignedFlows,
  onUpdate,
}: {
  bindings: WidgetDataBinding[];
  slots: string[];
  assignedFlows: Flow[];
  onUpdate: (bindings: WidgetDataBinding[]) => void;
}) {
  const addBinding = () => {
    const newBinding: WidgetDataBinding = {
      id: crypto.randomUUID(),
      flowId: "",
      variableName: "",
      transform: "none",
    };
    onUpdate([...bindings, newBinding]);
  };

  const updateBinding = (id: string, patch: Partial<WidgetDataBinding>) => {
    onUpdate(bindings.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBinding = (id: string) => {
    onUpdate(bindings.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Slots info */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <Database className="size-3" />
        Slots disponibles: {slots.map((s) => `"${s}"`).join(", ")}
      </div>

      {assignedFlows.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/30">
          <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-400/80">
            No hay flujos asignados a este front. Asigna flujos en la pestaña &quot;Asignaciones&quot; para habilitar data binding.
          </span>
        </div>
      )}

      {/* Existing bindings */}
      {bindings.map((binding) => {
        const flow = assignedFlows.find((f) => f.id === binding.flowId);
        const variables = flow?.variables ?? [];
        const selectedVar = variables.find((v) => v.name === binding.variableName);
        const isIncomplete = !binding.flowId || !binding.variableName;

        return (
          <div
            key={binding.id}
            className={`p-2.5 rounded-lg border ${
              isIncomplete
                ? "border-amber-700/30 bg-amber-900/10"
                : "border-slate-700/50 bg-slate-900/20"
            }`}
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Flow select */}
              <div>
                <label className="block text-[9px] text-slate-600 mb-0.5">Flujo</label>
                <select
                  value={binding.flowId}
                  onChange={(e) =>
                    updateBinding(binding.id, { flowId: e.target.value, variableName: "" })
                  }
                  className="w-full rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-[10px] text-white focus:border-[#dd7430] focus:outline-none"
                >
                  <option value="">Seleccionar flujo...</option>
                  {assignedFlows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variable select */}
              <div>
                <label className="block text-[9px] text-slate-600 mb-0.5">Variable</label>
                <select
                  value={binding.variableName}
                  onChange={(e) => updateBinding(binding.id, { variableName: e.target.value })}
                  disabled={!binding.flowId}
                  className="w-full rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-[10px] text-white focus:border-[#dd7430] focus:outline-none disabled:opacity-40"
                >
                  <option value="">Seleccionar variable...</option>
                  {variables.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name} ({v.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Transform */}
              <div>
                <label className="block text-[9px] text-slate-600 mb-0.5">Transformación</label>
                <select
                  value={binding.transform}
                  onChange={(e) =>
                    updateBinding(binding.id, { transform: e.target.value as DataTransform })
                  }
                  className="w-full rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-[10px] text-white focus:border-[#dd7430] focus:outline-none"
                >
                  {(Object.keys(DATA_TRANSFORM_LABELS) as DataTransform[]).map((t) => (
                    <option key={t} value={t}>
                      {DATA_TRANSFORM_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Label override + delete */}
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block text-[9px] text-slate-600 mb-0.5">Label</label>
                  <input
                    type="text"
                    value={binding.label ?? ""}
                    onChange={(e) =>
                      updateBinding(binding.id, { label: e.target.value || undefined })
                    }
                    placeholder={selectedVar?.name ?? "Automático"}
                    className="w-full rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-[10px] text-white focus:border-[#dd7430] focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => removeBinding(binding.id)}
                  className="self-end p-1 text-slate-600 hover:text-red-400 mb-0.5"
                  aria-label="Eliminar binding"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>

            {isIncomplete && (
              <p className="mt-1.5 text-[9px] text-amber-400/60">
                Binding incompleto — selecciona flujo y variable
              </p>
            )}
          </div>
        );
      })}

      {/* Add binding */}
      <button
        onClick={addBinding}
        disabled={assignedFlows.length === 0}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md border border-dashed border-slate-600 text-[10px] text-slate-500 hover:text-[#dd7430] hover:border-[#dd7430]/40 transition-colors disabled:opacity-30 disabled:hover:text-slate-500"
      >
        <Plus className="size-3" />
        Agregar binding
      </button>
    </div>
  );
}
