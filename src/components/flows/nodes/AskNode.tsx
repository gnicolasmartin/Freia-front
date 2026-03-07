import { Handle, Position, type NodeProps } from "@xyflow/react";
import { HelpCircle, ArrowRight, AlertCircle } from "lucide-react";
import { useSimulationBorder } from "../SimulationHighlightContext";

const RESPONSE_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  email: "Email",
  phone: "Teléfono",
  date: "Fecha",
  boolean: "Sí/No",
};

export default function AskNode({ id, data, selected }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const responseType = nodeData.responseType as string | undefined;
  const variable = nodeData.variable as string | undefined;
  const hasValidation = !!(nodeData.validationRule as string);
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-cyan-400 ring-2 ring-cyan-400/30",
    "border-cyan-500/60"
  );

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[180px] ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-cyan-500 !border-cyan-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/20">
          <HelpCircle className="size-4 text-cyan-400" />
        </div>
        <span className="text-sm font-semibold text-white">
          {(nodeData.label as string) || "Pregunta"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {responseType && (
          <span className="inline-block text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
            {RESPONSE_TYPE_LABELS[responseType] || responseType}
          </span>
        )}
        {hasValidation && (
          <span className="inline-block text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
            validación
          </span>
        )}
      </div>
      {variable ? (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-400">
          <ArrowRight className="size-3 shrink-0" />
          <span className="font-mono truncate">{variable}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
          <AlertCircle className="size-3 shrink-0" />
          <span>Sin variable destino</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-500 !border-cyan-400 !w-3 !h-3"
      />
    </div>
  );
}
