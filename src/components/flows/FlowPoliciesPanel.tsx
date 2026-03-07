"use client";

import { useMemo } from "react";
import { X, Shield, ShieldAlert, ShieldCheck, Globe, Link2 } from "lucide-react";
import { usePolicies } from "@/providers/PoliciesProvider";
import type { Policy } from "@/types/policy";

interface FlowPoliciesPanelProps {
  policyIds: string[];
  onChange: (policyIds: string[]) => void;
  onClose: () => void;
}

export default function FlowPoliciesPanel({
  policyIds,
  onChange,
  onClose,
}: FlowPoliciesPanelProps) {
  const { policies } = usePolicies();

  const globalPolicies = useMemo(
    () => policies.filter((p) => p.active && p.scope === "global"),
    [policies]
  );

  const flowScopedPolicies = useMemo(
    () => policies.filter((p) => p.active && p.scope === "flow"),
    [policies]
  );

  const togglePolicy = (policyId: string) => {
    if (policyIds.includes(policyId)) {
      onChange(policyIds.filter((id) => id !== policyId));
    } else {
      onChange([...policyIds, policyId]);
    }
  };

  return (
    <div className="w-80 border-l border-slate-700 bg-slate-900/95 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[#dd7430]" />
          <span className="text-sm font-semibold text-white">Políticas</span>
          <span className="text-xs text-slate-500">
            ({globalPolicies.length + policyIds.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Global policies (read-only) */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="size-3.5 text-purple-400" />
            <span className="text-xs font-medium text-slate-400">
              Globales (automáticas)
            </span>
            <span className="text-[10px] text-slate-600">
              ({globalPolicies.length})
            </span>
          </div>

          {globalPolicies.length === 0 ? (
            <p className="text-xs text-slate-600 py-2">
              No hay políticas globales activas
            </p>
          ) : (
            <div className="space-y-1">
              {globalPolicies.map((policy) => (
                <PolicyRow key={policy.id} policy={policy} isGlobal />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 mx-4" />

        {/* Flow-scoped policies (toggleable) */}
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Link2 className="size-3.5 text-sky-400" />
            <span className="text-xs font-medium text-slate-400">
              De flujo (asociables)
            </span>
            <span className="text-[10px] text-slate-600">
              ({flowScopedPolicies.length})
            </span>
          </div>

          {flowScopedPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Shield className="size-8 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Sin políticas de flujo</p>
              <p className="text-xs text-slate-500 mt-1">
                Creá políticas con alcance &quot;Por flujo&quot; para asociarlas
                aquí
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {flowScopedPolicies.map((policy) => (
                <PolicyRow
                  key={policy.id}
                  policy={policy}
                  isAssociated={policyIds.includes(policy.id)}
                  onToggle={() => togglePolicy(policy.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700">
        <p className="text-[10px] text-slate-600">
          Las políticas globales se aplican automáticamente. Las de flujo se
          activan al asociarlas manualmente.
        </p>
      </div>
    </div>
  );
}

function PolicyRow({
  policy,
  isGlobal = false,
  isAssociated = false,
  onToggle,
}: {
  policy: Policy;
  isGlobal?: boolean;
  isAssociated?: boolean;
  onToggle?: () => void;
}) {
  const modeColor =
    (policy.enforcementMode ?? "strict") === "strict"
      ? "bg-red-900/30 text-red-400 border-red-800/50"
      : "bg-emerald-900/30 text-emerald-400 border-emerald-800/50";
  const modeLabel =
    (policy.enforcementMode ?? "strict") === "strict"
      ? "Estricto"
      : "Flexible";

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
        isGlobal
          ? "border-slate-700/50 bg-slate-800/30"
          : isAssociated
            ? "border-[#dd7430]/30 bg-[#dd7430]/5"
            : "border-slate-700/50 bg-slate-800/50"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isGlobal ? (
          <ShieldCheck className="size-3.5 text-purple-400 shrink-0" />
        ) : (
          <ShieldAlert className="size-3.5 text-sky-400 shrink-0" />
        )}
        <div className="min-w-0">
          <span className="text-xs font-medium text-white truncate block">
            {policy.name}
          </span>
          <span
            className={`inline-block mt-0.5 px-1.5 py-0 rounded text-[10px] font-medium border ${modeColor}`}
          >
            {modeLabel}
          </span>
        </div>
      </div>

      {isGlobal ? (
        <span className="text-[10px] text-slate-500 shrink-0">Auto</span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={isAssociated}
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
            isAssociated ? "bg-[#dd7430]" : "bg-slate-600"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
              isAssociated ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
}
