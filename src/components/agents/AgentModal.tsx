"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useAuditLog } from "@/providers/AuditLogProvider";
import AgentForm from "./AgentForm";
import type { Agent, AgentFormData, AgentStatus } from "@/types/agent";
import { EMPTY_AGENT_FORM } from "@/types/agent";
import { validateAgent } from "@/lib/agent-validator";

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAgent?: Agent | null;
  /** Called when a status transition is triggered via quick-action from cards */
  onStatusChange?: (agent: Agent, newStatus: AgentStatus) => void;
}

export default function AgentModal({
  isOpen,
  onClose,
  editingAgent,
}: AgentModalProps) {
  const { createAgent, updateAgent } = useAgents();
  const { flows } = useFlows();
  const { config } = useLLMConfig();
  const { policies } = usePolicies();
  const { addEntry } = useAuditLog();
  const [formData, setFormData] = useState<AgentFormData>({
    ...EMPTY_AGENT_FORM,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Reset form when modal opens/closes or editing agent changes
  useEffect(() => {
    if (isOpen) {
      if (editingAgent) {
        const { id, createdAt, updatedAt, ...rest } = editingAgent;
        setFormData({ ...EMPTY_AGENT_FORM, ...rest });
      } else {
        setFormData({ ...EMPTY_AGENT_FORM });
      }
      setSubmitAttempted(false);
    }
  }, [isOpen, editingAgent]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Live validation — recomputed on every formData change
  const validation = useMemo(
    () =>
      validateAgent(formData, {
        flows,
        isApiKeyConfigured: config.openai.isConfigured,
        policies,
      }),
    [formData, flows, config.openai.isConfigured, policies]
  );

  const handleSubmit = () => {
    setSubmitAttempted(true);

    // Basic required-field check (name, channel) — outside the validator
    if (!formData.name.trim()) return;
    if (!formData.channelScope) return;

    // Validator covers: flowId, modelName, API key (active), flow draft (active)
    if (!validation.isValid) return;

    if (editingAgent) {
      updateAgent(editingAgent.id, formData);

      // Audit status change if it was modified via the form
      if (editingAgent.status !== formData.status) {
        addEntry({
          type: "agent_status_change",
          agentId: editingAgent.id,
          agentName: formData.name || editingAgent.name,
          previousStatus: editingAgent.status,
          newStatus: formData.status,
        });
      }
    } else {
      createAgent(formData);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const isEditing = !!editingAgent;

  // Show errors only after the user has tried to submit once
  const visibleErrors = submitAttempted ? validation.errors : [];
  // Name / channel errors (outside validator)
  const nameError = submitAttempted && !formData.name.trim()
    ? "El nombre del agente es requerido."
    : null;
  const channelError = submitAttempted && !formData.channelScope
    ? "El canal es requerido."
    : null;
  const allErrors = [
    ...(nameError ? [{ message: nameError }] : []),
    ...(channelError ? [{ message: channelError }] : []),
    ...visibleErrors,
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2
            id="agent-modal-title"
            className="text-xl font-bold text-white"
          >
            {isEditing ? "Editar Agente" : "Nuevo Agente"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Blocking errors — shown after first submit attempt */}
          {allErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-900/50 bg-red-900/20 p-3 space-y-1">
              {allErrors.map((e, i) => (
                <p key={i} className="text-sm text-red-400 flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  {e.message}
                </p>
              ))}
            </div>
          )}

          <AgentForm
            formData={formData}
            onChange={setFormData}
            warnings={validation.warnings}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-[#dd7430] text-white hover:bg-orange-600 transition-colors"
          >
            {isEditing ? "Guardar Cambios" : "Crear Agente"}
          </button>
        </div>
      </div>
    </div>
  );
}
