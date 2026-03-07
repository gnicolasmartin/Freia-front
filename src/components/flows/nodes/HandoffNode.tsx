import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import { useSimulationBorder } from "../SimulationHighlightContext";

const TEAM_LABELS: Record<string, string> = {
  ventas: "Ventas",
  soporte: "Soporte Técnico",
  facturacion: "Facturación",
  reclamos: "Reclamos",
};

export default function HandoffNode({ id, data, selected }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const target = nodeData.target as string | undefined;
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-amber-400 ring-2 ring-amber-400/30",
    "border-amber-500/60"
  );

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[180px] ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-500 !border-amber-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20">
          <UserCheck className="size-4 text-amber-400" />
        </div>
        <span className="text-sm font-semibold text-white">
          {(nodeData.label as string) || "Handoff"}
        </span>
      </div>
      {target && (
        <p className="text-xs text-amber-300 mt-1.5">
          → {TEAM_LABELS[target] || target}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-500 !border-amber-400 !w-3 !h-3"
      />
    </div>
  );
}
