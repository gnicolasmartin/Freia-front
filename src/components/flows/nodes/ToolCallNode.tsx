import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Wrench, ArrowRight, ShieldCheck } from "lucide-react";
import type { ToolParamMapping } from "@/types/flow";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import { useSimulationBorder } from "../SimulationHighlightContext";

export default function ToolCallNode({ id, data, selected }: NodeProps) {
  const { getToolLabel, getToolSchema } = useToolRegistry();
  const nodeData = data as Record<string, unknown>;
  const tool = (nodeData.tool as string) || (nodeData.toolId as string) || undefined;
  // parameterMapping can be array (visual format) or object (saved format)
  const rawMapping = nodeData.parameterMapping;
  const mappings: ToolParamMapping[] = Array.isArray(rawMapping)
    ? rawMapping as ToolParamMapping[]
    : rawMapping && typeof rawMapping === "object"
      ? Object.entries(rawMapping as Record<string, { variableName?: string }>).map(
          ([paramName, m]) => ({ id: paramName, paramName, variableName: m?.variableName || "" })
        )
      : [];
  const requireConfirmation = !!nodeData.requireConfirmation;
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-purple-400 ring-2 ring-purple-400/30",
    "border-purple-500/60"
  );

  const schema = tool ? getToolSchema(tool) : [];
  const mappedCount = mappings.filter((m) => m.variableName).length;

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[180px] ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-500 !border-purple-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/20">
          <Wrench className="size-4 text-purple-400" />
        </div>
        <span className="text-sm font-semibold text-white">
          {(nodeData.label as string) || "Tool Call"}
        </span>
      </div>
      {tool && (
        <p className="text-xs text-purple-300 mt-1.5 truncate">
          {getToolLabel(tool)}
        </p>
      )}
      {/* Mapping summary */}
      {tool && schema.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {mappings
            .filter((m) => m.variableName)
            .slice(0, 3)
            .map((m) => (
              <p
                key={m.paramName}
                className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-0.5"
              >
                <span className="text-purple-400">{m.variableName}</span>
                <ArrowRight className="size-2.5 text-slate-600 shrink-0" />
                <span>{m.paramName}</span>
              </p>
            ))}
          {mappedCount > 3 && (
            <p className="text-[10px] text-slate-500 italic">
              +{mappedCount - 3} más
            </p>
          )}
          {mappedCount === 0 && (
            <p className="text-[10px] text-amber-400 italic">
              Sin parámetros asignados
            </p>
          )}
        </div>
      )}
      {/* Confirmation indicator */}
      {requireConfirmation && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400">
          <ShieldCheck className="size-3" />
          <span>Requiere confirmación</span>
        </div>
      )}
      {/* Success / Error routing handles */}
      <div className="flex justify-between mt-1.5 text-[9px] font-medium px-1">
        <span className="text-emerald-400">✓ OK</span>
        <span className="text-red-400">✗ Error</span>
      </div>
      <Handle
        type="source"
        id="success"
        position={Position.Bottom}
        style={{ left: "30%" }}
        className="!bg-emerald-500 !border-emerald-400 !w-3 !h-3"
      />
      <Handle
        type="source"
        id="error"
        position={Position.Bottom}
        style={{ left: "70%" }}
        className="!bg-red-500 !border-red-400 !w-3 !h-3"
      />
    </div>
  );
}
