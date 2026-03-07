import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { useSimulationBorder } from "../SimulationHighlightContext";

export default function StartNode({ id, selected }: NodeProps) {
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-green-400 ring-2 ring-green-400/30",
    "border-green-500/60"
  );

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[160px] ${borderClass}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-green-500/20">
          <Play className="size-4 text-green-400" />
        </div>
        <span className="text-sm font-semibold text-white">Inicio</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-500 !border-green-400 !w-3 !h-3"
      />
    </div>
  );
}
