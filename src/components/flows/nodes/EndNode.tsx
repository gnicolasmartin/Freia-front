import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Square } from "lucide-react";
import { useSimulationBorder } from "../SimulationHighlightContext";

const OUTCOME_STYLES: Record<string, { label: string; color: string }> = {
  resolved: { label: "Resuelto", color: "bg-green-500" },
  escalated: { label: "Escalado", color: "bg-yellow-500" },
  abandoned: { label: "Abandonado", color: "bg-slate-500" },
  error: { label: "Error", color: "bg-red-500" },
};

export default function EndNode({ id, data, selected }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const outcome = nodeData.outcome as string | undefined;
  const outcomeInfo = outcome ? OUTCOME_STYLES[outcome] : undefined;
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-red-400 ring-2 ring-red-400/30",
    "border-red-500/60"
  );

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[160px] ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-500 !border-red-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/20">
          <Square className="size-4 text-red-400" />
        </div>
        <span className="text-sm font-semibold text-white">
          {(nodeData.label as string) || "Fin"}
        </span>
      </div>
      {outcomeInfo && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className={`size-2 rounded-full ${outcomeInfo.color}`} />
          <span className="text-xs text-slate-400">{outcomeInfo.label}</span>
        </div>
      )}
    </div>
  );
}
