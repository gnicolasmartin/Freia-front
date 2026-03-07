"use client";

import {
  X,
  Play,
  MessageSquare,
  HelpCircle,
  GitBranch,
  Wrench,
  UserCheck,
  Square,
  ShoppingCart,
} from "lucide-react";
import type { Node } from "@xyflow/react";
import { useMemo } from "react";
import type { FlowVariable } from "@/types/flow";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { useIntegrations } from "@/providers/IntegrationsProvider";
import type { Capability } from "@/types/tool-registry";
import FieldRenderer, { type NodeTypeConfig } from "./fields/FieldRenderer";
import { helpTextClasses, labelClasses } from "./fields/styles";

interface NodePropertiesPanelProps {
  node: Node;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  flowVariables?: FlowVariable[];
  allowedToolIds?: string[];
  useStock?: boolean;
}

// --- Option constants ---

const RESPONSE_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Teléfono" },
  { value: "date", label: "Fecha" },
  { value: "boolean", label: "Sí/No" },
] as const;

export const TEAM_OPTIONS = [
  { value: "ventas", label: "Ventas" },
  { value: "soporte", label: "Soporte Técnico" },
  { value: "facturacion", label: "Facturación" },
  { value: "reclamos", label: "Reclamos" },
] as const;

export const OUTCOME_OPTIONS = [
  { value: "resolved", label: "Resuelto" },
  { value: "escalated", label: "Escalado" },
  { value: "abandoned", label: "Abandonado" },
  { value: "error", label: "Error" },
] as const;

// --- Node configuration ---

const NODE_CONFIG: Record<string, NodeTypeConfig> = {
  start: {
    label: "Inicio",
    icon: Play,
    color: "text-green-400",
    fields: [],
  },
  message: {
    label: "Message",
    icon: MessageSquare,
    color: "text-orange-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      {
        key: "message",
        label: "Plantilla de mensaje",
        type: "textarea",
        rows: 5,
        templateHighlight: true,
        helpText: "Usa {{variable}} para insertar valores dinámicos",
      },
      {
        key: "interactiveType",
        label: "Tipo de interacción",
        type: "select",
        options: [
          { value: "none",    label: "Solo mensaje" },
          { value: "buttons", label: "Botones (máx. 3)" },
          { value: "list",    label: "Lista de opciones" },
        ],
      },
      {
        key: "options",
        label: "Opciones",
        type: "key-value-list",
        keyLabel: "Etiqueta (usuario ve)",
        valueLabel: "Valor (guardado)",
        keyPlaceholder: "Ej: Sí",
        valuePlaceholder: "Ej: yes",
      },
      {
        key: "saveToVariable",
        label: "Guardar selección en variable",
        type: "variable-select",
        placeholder: "Seleccionar variable...",
        helpText: "Usa esta variable en un nodo Condición para ramificar según la elección.",
      },
    ],
  },
  ask: {
    label: "Ask",
    icon: HelpCircle,
    color: "text-cyan-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      { key: "question", label: "Pregunta", type: "textarea", rows: 3 },
      {
        key: "responseType",
        label: "Tipo de respuesta esperada",
        type: "select",
        options: RESPONSE_TYPES,
      },
      {
        key: "variable",
        label: "Guardar respuesta en variable (saveToVar)",
        type: "variable-select",
        placeholder: "Seleccionar variable...",
        required: true,
        helpText: "Obligatorio — la respuesta se almacena en conversationState.vars",
      },
      {
        key: "validationRule",
        label: "Regla de validación",
        type: "text",
        helpText: "Expresión para validar la respuesta del usuario",
      },
      {
        key: "maxRetries",
        label: "Reintentos máximos",
        type: "number",
        min: 1,
        max: 10,
        helpText: "Cantidad de reintentos antes de continuar (por defecto: 3)",
      },
      {
        key: "errorMessage",
        label: "Mensaje de error",
        type: "textarea",
        rows: 2,
        placeholder: "Mensaje cuando la validación falla...",
        helpText: "Se muestra al usuario si la validación falla. Se permite reintento.",
      },
    ],
  },
  condition: {
    label: "Condition",
    icon: GitBranch,
    color: "text-blue-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      {
        key: "rules",
        label: "Reglas de condición",
        type: "condition-rules",
      },
    ],
  },
  toolcall: {
    label: "Tool Call",
    icon: Wrench,
    color: "text-purple-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      {
        key: "tool",
        label: "Herramienta",
        type: "select",
        options: [], // Populated dynamically from ToolRegistry
      },
      {
        key: "parameterMapping",
        label: "Mapeo de parámetros",
        type: "tool-param-mapping",
        toolKey: "tool",
        helpText: "Asigná variables del flujo a cada parámetro de la herramienta",
      },
      {
        key: "requireConfirmation",
        label: "Pedir confirmación al usuario",
        type: "toggle",
      },
      {
        key: "confirmationMessage",
        label: "Mensaje de confirmación",
        type: "textarea",
        rows: 2,
        placeholder: "¿Deseas continuar con esta acción?",
      },
    ],
  },
  handoff: {
    label: "Handoff",
    icon: UserCheck,
    color: "text-amber-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      {
        key: "target",
        label: "Equipo destino",
        type: "select",
        options: TEAM_OPTIONS,
      },
      {
        key: "handoffMessage",
        label: "Mensaje durante la derivación",
        type: "textarea",
        rows: 3,
        placeholder: "Te estamos derivando con un agente especializado...",
      },
    ],
  },
  end: {
    label: "End",
    icon: Square,
    color: "text-red-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      {
        key: "outcome",
        label: "Tipo de resultado",
        type: "select",
        options: OUTCOME_OPTIONS,
      },
    ],
  },
  stocklookup: {
    label: "Stock Lookup",
    icon: ShoppingCart,
    color: "text-emerald-400",
    fields: [
      { key: "label", label: "Nombre", type: "text" },
      {
        key: "searchMode",
        label: "Fuente de búsqueda",
        type: "select",
        options: [
          { value: "variable", label: "Desde variable de flujo" },
          { value: "literal", label: "Texto fijo" },
        ],
      },
      {
        key: "searchVariable",
        label: "Variable de búsqueda",
        type: "variable-select",
        helpText: "Variable con el nombre o código del producto a buscar",
      },
      {
        key: "searchLiteral",
        label: "Texto de búsqueda",
        type: "text",
        placeholder: "Ej: zapatillas negras",
      },
      { key: "saveProductId", label: "Guardar product_id en", type: "variable-select" as const },
      { key: "saveProductName", label: "Guardar product_name en", type: "variable-select" as const },
      { key: "saveVariantId", label: "Guardar variant_id en", type: "variable-select" as const },
      { key: "savePrice", label: "Guardar price en", type: "variable-select" as const },
      { key: "saveFinalPrice", label: "Guardar final_price en", type: "variable-select" as const },
      { key: "saveDiscounts", label: "Guardar discounts[] en", type: "variable-select" as const },
    ],
  },
};

export default function NodePropertiesPanel({
  node,
  onUpdate,
  onClose,
  flowVariables = [],
  allowedToolIds = [],
  useStock = false,
}: NodePropertiesPanelProps) {
  const { tools } = useToolRegistry();
  const { integrations } = useIntegrations();

  const allowedCapabilities = useMemo((): Set<Capability> => {
    const caps = new Set<Capability>();
    integrations
      .filter((i) => i.active)
      .forEach((i) => (i.supportedCapabilities ?? []).forEach((c) => caps.add(c)));
    return caps;
  }, [integrations]);

  const toolOptions = useMemo(() => {
    let filtered =
      allowedToolIds.length > 0
        ? tools.filter((t) => allowedToolIds.includes(t.id))
        : tools;

    if (allowedCapabilities.size > 0) {
      filtered = filtered.filter(
        (t) => !t.capability || allowedCapabilities.has(t.capability)
      );
    }

    return filtered.map((t) => ({ value: t.id, label: t.name }));
  }, [tools, allowedToolIds, allowedCapabilities]);

  const baseConfig = NODE_CONFIG[node.type || ""] ?? {
    label: "Nodo",
    icon: Square,
    color: "text-slate-400",
    fields: [{ key: "label", label: "Nombre", type: "text" as const }],
  };

  // Inject dynamic tool options into the toolcall config
  const config = useMemo(() => {
    if (node.type !== "toolcall") return baseConfig;
    return {
      ...baseConfig,
      fields: baseConfig.fields.map((f) =>
        f.key === "tool" ? { ...f, options: toolOptions } : f
      ),
    };
  }, [baseConfig, node.type, toolOptions]);

  const Icon = config.icon;
  const nodeData = node.data as Record<string, unknown>;

  const handleChange = (key: string, value: unknown) => {
    onUpdate(node.id, { ...nodeData, [key]: value });
  };

  return (
    <div className="w-80 shrink-0 border-l border-slate-700 bg-slate-900/80 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${config.color}`} />
          <h3 className="text-sm font-semibold text-white">{config.label}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          aria-label="Cerrar panel"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node ID (read-only) */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            ID
          </label>
          <p className="text-xs text-slate-400 font-mono truncate">
            {node.id}
          </p>
        </div>

        {config.fields.length === 0 && (
          <p className="text-xs text-slate-500">
            Este nodo no tiene propiedades editables.
          </p>
        )}

        {config.fields.map((field) => {
          // Conditional visibility: hide confirmationMessage when toggle is off
          if (
            field.key === "confirmationMessage" &&
            !nodeData.requireConfirmation
          ) {
            return null;
          }
          // Conditional visibility: hide interactive fields when interactiveType is "none"
          if (
            (field.key === "options" || field.key === "saveToVariable") &&
            (!nodeData.interactiveType || nodeData.interactiveType === "none")
          ) {
            return null;
          }
          // Conditional visibility: stocklookup search source
          if (field.key === "searchVariable" && nodeData.searchMode === "literal") return null;
          if (field.key === "searchLiteral" && nodeData.searchMode !== "literal") return null;

          return (
            <div key={field.key}>
              <label
                htmlFor={`prop-${field.key}`}
                className={
                  field.type === "toggle"
                    ? "flex items-center justify-between text-xs font-medium text-slate-300 mb-1"
                    : labelClasses
                }
              >
                {field.label}
                {field.required && (
                  <span className="text-red-400 ml-0.5">*</span>
                )}
                {field.type === "toggle" && (
                  <FieldRenderer
                    field={field}
                    value={nodeData[field.key]}
                    onChange={(val) => handleChange(field.key, val)}
                    flowVariables={flowVariables}
                    nodeData={nodeData}
                    useStock={useStock}
                  />
                )}
              </label>
              {field.helpText && (
                <p className={helpTextClasses}>{field.helpText}</p>
              )}
              {field.type !== "toggle" && (
                <FieldRenderer
                  field={field}
                  value={nodeData[field.key]}
                  onChange={(val) => handleChange(field.key, val)}
                  flowVariables={flowVariables}
                  useStock={useStock}
                />
              )}
            </div>
          );
        })}

        {/* Position (read-only) */}
        <div className="pt-3 border-t border-slate-700/50">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Posición
          </label>
          <p className="text-xs text-slate-400 font-mono">
            x: {Math.round(node.position.x)}, y:{" "}
            {Math.round(node.position.y)}
          </p>
        </div>
      </div>
    </div>
  );
}
