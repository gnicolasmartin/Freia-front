import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MessageSquare } from "lucide-react";
import { parseTemplate } from "@/lib/template-engine";
import { useSimulationBorder } from "../SimulationHighlightContext";

function renderTruncatedMessage(message: string, maxLength = 40) {
  const truncated =
    message.length > maxLength ? message.slice(0, maxLength) + "..." : message;

  const tokens = parseTemplate(truncated);
  return tokens.map((token, i) => {
    if (token.type === "variable") {
      return (
        <span key={i} className="text-[#dd7430] font-mono">
          {token.raw}
        </span>
      );
    }
    return <span key={i}>{token.raw}</span>;
  });
}

export default function MessageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const message = nodeData.message as string | undefined;
  const interactiveType = nodeData.interactiveType as string | undefined;
  const options = (nodeData.options as Array<unknown>) || [];
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-orange-400 ring-2 ring-orange-400/30",
    "border-orange-500/60"
  );

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[180px] max-w-[220px] ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !border-orange-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-orange-500/20">
          <MessageSquare className="size-4 text-orange-400" />
        </div>
        <span className="text-sm font-semibold text-white truncate">
          {(nodeData.label as string) || "Mensaje"}
        </span>
      </div>
      {message && (
        <p className="text-xs text-slate-400 mt-1.5 truncate">
          {renderTruncatedMessage(message)}
        </p>
      )}
      {interactiveType && interactiveType !== "none" && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium">
            {interactiveType === "buttons" ? "Botones" : "Lista"}
          </span>
          {options.length > 0 && (
            <span className="text-[10px] text-slate-500">
              {options.length}{" "}
              {options.length === 1 ? "opción" : "opciones"}
            </span>
          )}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-orange-500 !border-orange-400 !w-3 !h-3"
      />
    </div>
  );
}
