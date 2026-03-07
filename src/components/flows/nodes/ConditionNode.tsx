import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { OPERATOR_LABELS } from "../fields/ConditionRulesField";
import { useSimulationBorder } from "../SimulationHighlightContext";

interface ConditionRule {
  id: string;
  variable: string;
  operator: string;
  value: string;
  label: string;
}

function ruleToSummary(rule: ConditionRule): string {
  const op = OPERATOR_LABELS[rule.operator] ?? rule.operator;
  const variable = rule.variable || "?";
  if (rule.operator === "exists") return `${variable} ${op}`;
  const val = rule.value || "?";
  return `${variable} ${op} ${val}`;
}

export default function ConditionNode({ id, data, selected }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const rules = (nodeData.rules as ConditionRule[]) || [];
  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-blue-400 ring-2 ring-blue-400/30",
    "border-blue-500/60"
  );

  const outputs = [
    ...rules.map((r, i) => ({
      id: `rule-${i}`,
      label: r.label || r.variable || "...",
      summary: ruleToSummary(r),
    })),
    { id: "default", label: "Default", summary: "" },
  ];

  const totalOutputs = outputs.length;

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg ${borderClass}`}
      style={{ minWidth: Math.max(180, totalOutputs * 70) }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !border-blue-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/20">
          <GitBranch className="size-4 text-blue-400" />
        </div>
        <span className="text-sm font-semibold text-white">
          {(nodeData.label as string) || "Condición"}
        </span>
        {rules.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
            {rules.length} regla{rules.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Rule summaries */}
      {rules.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {rules.slice(0, 3).map((rule, i) => (
            <p
              key={rule.id}
              className="text-[10px] text-slate-400 font-mono truncate"
            >
              <span className="text-blue-400 mr-1">{i + 1}.</span>
              {ruleToSummary(rule)}
            </p>
          ))}
          {rules.length > 3 && (
            <p className="text-[10px] text-slate-500 italic">
              +{rules.length - 3} más
            </p>
          )}
        </div>
      )}

      {/* Output labels */}
      <div className="flex justify-between mt-2 text-xs gap-1">
        {outputs.map((output) => (
          <span
            key={output.id}
            className={`truncate text-center flex-1 ${
              output.id === "default"
                ? "text-slate-500 italic"
                : "text-slate-400"
            }`}
          >
            {output.label}
          </span>
        ))}
      </div>

      {/* Dynamic source handles */}
      {outputs.map((output, index) => {
        const leftPercent =
          totalOutputs === 1
            ? 50
            : (index / (totalOutputs - 1)) * 80 + 10;

        return (
          <Handle
            key={output.id}
            type="source"
            position={Position.Bottom}
            id={output.id}
            className={`!w-3 !h-3 ${
              output.id === "default"
                ? "!bg-slate-500 !border-slate-400"
                : "!bg-blue-500 !border-blue-400"
            }`}
            style={{ left: `${leftPercent}%` }}
          />
        );
      })}
    </div>
  );
}
