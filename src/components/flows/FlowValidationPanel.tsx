"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  MousePointerClick,
} from "lucide-react";

export interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
}

interface FlowValidationPanelProps {
  issues: ValidationIssue[];
  onIssueClick?: (issue: ValidationIssue) => void;
}

export default function FlowValidationPanel({
  issues,
  onIssueClick,
}: FlowValidationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const errors = issues.filter((i) => i.type === "error");
  const warnings = issues.filter((i) => i.type === "warning");

  const hasIssues = issues.length > 0;

  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-sm">
      {/* Summary pill */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          errors.length > 0
            ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
            : warnings.length > 0
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
              : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
        }`}
      >
        {errors.length > 0 ? (
          <AlertCircle className="size-3.5" />
        ) : warnings.length > 0 ? (
          <AlertTriangle className="size-3.5" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
        <span>
          {!hasIssues
            ? "Flujo válido"
            : `${errors.length > 0 ? `${errors.length} error${errors.length > 1 ? "es" : ""}` : ""}${errors.length > 0 && warnings.length > 0 ? ", " : ""}${warnings.length > 0 ? `${warnings.length} aviso${warnings.length > 1 ? "s" : ""}` : ""}`}
        </span>
        {hasIssues &&
          (isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          ))}
      </button>

      {/* Expanded issue list */}
      {isExpanded && hasIssues && (
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur-sm p-2 space-y-0.5 max-h-56 overflow-y-auto">
          {errors.map((issue, i) => (
            <IssueRow
              key={`e-${i}`}
              issue={issue}
              onClick={onIssueClick}
              iconColor="text-red-400"
              textColor="text-red-300"
              icon={<AlertCircle className="size-3.5 shrink-0 mt-0.5" />}
            />
          ))}
          {warnings.map((issue, i) => (
            <IssueRow
              key={`w-${i}`}
              issue={issue}
              onClick={onIssueClick}
              iconColor="text-amber-400"
              textColor="text-amber-300"
              icon={<AlertTriangle className="size-3.5 shrink-0 mt-0.5" />}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({
  issue,
  onClick,
  iconColor,
  textColor,
  icon,
}: {
  issue: ValidationIssue;
  onClick?: (issue: ValidationIssue) => void;
  iconColor: string;
  textColor: string;
  icon: React.ReactNode;
}) {
  const isClickable = !!issue.nodeId && !!onClick;

  return (
    <button
      type="button"
      onClick={() => isClickable && onClick?.(issue)}
      disabled={!isClickable}
      className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs w-full text-left transition-colors ${
        isClickable
          ? "hover:bg-slate-800/80 cursor-pointer"
          : "cursor-default"
      }`}
    >
      <span className={iconColor}>{icon}</span>
      <span className={`${textColor} flex-1`}>{issue.message}</span>
      {isClickable && (
        <MousePointerClick className="size-3 text-slate-500 shrink-0 mt-0.5" />
      )}
    </button>
  );
}
