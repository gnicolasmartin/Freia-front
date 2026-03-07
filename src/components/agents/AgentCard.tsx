"use client";

import { Archive, ArchiveRestore, Bot, Pause, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import type { Agent, AgentStatus } from "@/types/agent";
import {
  AGENT_STATUS_CONFIG,
  AGENT_STATUS_TRANSITIONS,
  AGENT_MODE_CONFIG,
  CHANNEL_SCOPES,
  OBJECTIVES,
  KPI_TYPES,
  LLM_MODELS,
  TONES,
  LANGUAGES,
} from "@/types/agent";
import { useFlows } from "@/providers/FlowsProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";

interface AgentCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (id: string) => void;
  onStatusChange: (agent: Agent, newStatus: AgentStatus) => void;
}

function getLabel(
  options: readonly { value: string; label: string }[],
  value: string | undefined
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

// Icon + tooltip for each possible next-status action button
const STATUS_ACTION_CONFIG: Partial<
  Record<
    AgentStatus,
    { icon: React.FC<{ className?: string }>; label: string; colorClass: string }
  >
> = {
  active:   { icon: Play,           label: "Activar",    colorClass: "hover:text-emerald-400" },
  paused:   { icon: Pause,          label: "Pausar",     colorClass: "hover:text-amber-400"   },
  draft:    { icon: RotateCcw,      label: "A Borrador", colorClass: "hover:text-slate-300"   },
  archived: { icon: Archive,        label: "Archivar",   colorClass: "hover:text-slate-500"   },
};

// Restore from archived gets a separate dedicated icon
const RESTORE_ACTION = { icon: ArchiveRestore, label: "Restaurar como Borrador" };

export default function AgentCard({ agent, onEdit, onDelete, onStatusChange }: AgentCardProps) {
  const { flows } = useFlows();
  const { config } = useLLMConfig();

  const statusCfg = AGENT_STATUS_CONFIG[agent.status];
  const modeCfg = AGENT_MODE_CONFIG[agent.mode];
  const agentFlow = flows.find((f) => f.id === agent.flowId);
  const flowName = agentFlow?.name;
  const publishedVersion = agentFlow?.versions?.find(
    (v) => v.id === agentFlow?.publishedVersionId
  );
  const isDraftModified =
    publishedVersion && agentFlow && agentFlow.updatedAt > publishedVersion.publishedAt;
  const channelLabel = getLabel(CHANNEL_SCOPES, agent.channelScope);
  const objectiveLabel = getLabel(OBJECTIVES, agent.primaryObjective);
  const kpiLabel = getLabel(KPI_TYPES, agent.kpiType);
  const modelLabel = LLM_MODELS.find((m) => m.value === agent.modelName)?.label;
  const toneLabel = getLabel(TONES, agent.tone);
  const languageLabel = getLabel(LANGUAGES, agent.language);

  const isArchived = agent.status === "archived";

  // Which status transitions are allowed from the current state
  const allowedNextStatuses = AGENT_STATUS_TRANSITIONS[agent.status] ?? [];

  // "active" transition requires a published flow and a configured API key
  const canActivate = !!publishedVersion && config.openai.isConfigured;

  function handleStatusAction(next: AgentStatus) {
    if (next === "active" && !canActivate) return;
    onStatusChange(agent, next);
  }

  return (
    <div
      className={`rounded-xl border p-5 backdrop-blur-sm transition-all group ${
        isArchived
          ? "border-slate-700/50 bg-slate-900/60 opacity-60"
          : "border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-slate-600"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50">
            <Bot className={`size-5 ${isArchived ? "text-slate-600" : "text-slate-300"}`} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-base font-semibold truncate ${isArchived ? "text-slate-500" : "text-white"}`}>
              {agent.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.bgClass} ${statusCfg.colorClass} ${statusCfg.borderClass}`}
              >
                {statusCfg.label}
              </span>
              <span className={`text-xs font-medium ${isArchived ? "text-slate-600" : modeCfg.colorClass}`}>
                {modeCfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons — revealed on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Quick status transitions */}
          {allowedNextStatuses.map((next) => {
            if (next === "archived") {
              // Archive action — always show for non-archived agents
              return (
                <button
                  key={next}
                  onClick={() => handleStatusAction(next)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-400 hover:bg-slate-700/50 transition-colors"
                  aria-label="Archivar agente"
                  title="Archivar agente"
                >
                  <Archive className="size-4" />
                </button>
              );
            }
            if (next === "draft" && agent.status === "archived") {
              // Restore from archived
              return (
                <button
                  key={next}
                  onClick={() => handleStatusAction(next)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                  aria-label={RESTORE_ACTION.label}
                  title={RESTORE_ACTION.label}
                >
                  <ArchiveRestore className="size-4" />
                </button>
              );
            }
            const cfg = STATUS_ACTION_CONFIG[next];
            if (!cfg) return null;
            const Icon = cfg.icon;
            const isDisabled = next === "active" && !canActivate;
            const disabledReason = !publishedVersion
              ? "Requiere flujo con versión publicada"
              : !config.openai.isConfigured
              ? "Requiere API Key de OpenAI"
              : undefined;
            return (
              <button
                key={next}
                onClick={() => !isDisabled && handleStatusAction(next)}
                disabled={isDisabled}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDisabled
                    ? "text-slate-700 cursor-not-allowed"
                    : `text-slate-500 ${cfg.colorClass} hover:bg-slate-700/50`
                }`}
                aria-label={cfg.label}
                title={isDisabled ? disabledReason : cfg.label}
              >
                <Icon className="size-4" />
              </button>
            );
          })}

          {/* Edit — hidden for archived agents */}
          {!isArchived && (
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#dd7430] hover:bg-slate-700/50 transition-colors"
              aria-label={`Editar ${agent.name}`}
            >
              <Pencil className="size-4" />
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => onDelete(agent.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
            aria-label={`Eliminar ${agent.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {agent.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Details */}
      <div className={`space-y-1.5 text-sm ${isArchived ? "opacity-50" : ""}`}>
        {channelLabel && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Canal</span>
            <span className="text-slate-300">{channelLabel}</span>
          </div>
        )}
        {flowName && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Flujo</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-300 truncate max-w-[110px] text-right">
                {flowName}
              </span>
              {publishedVersion ? (
                <span
                  className={`shrink-0 text-xs font-mono px-1.5 py-0.5 rounded ${
                    isDraftModified
                      ? "bg-amber-900/30 text-amber-400"
                      : "bg-emerald-900/30 text-emerald-400"
                  }`}
                  title={isDraftModified ? "Flujo modificado desde última publicación" : "Versión publicada"}
                >
                  v{publishedVersion.version}
                </span>
              ) : (
                <span
                  className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-900/30 text-red-400"
                  title="El flujo no tiene versión publicada"
                >
                  sin pub.
                </span>
              )}
            </div>
          </div>
        )}
        {objectiveLabel && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Objetivo</span>
            <span className="text-slate-300">{objectiveLabel}</span>
          </div>
        )}
        {kpiLabel && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">KPI</span>
            <span className="text-slate-300">{kpiLabel}</span>
          </div>
        )}
      </div>

      {/* Footer: model + style */}
      <div className={`mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between ${isArchived ? "opacity-40" : ""}`}>
        <div className="flex items-center gap-2 text-xs">
          {modelLabel && (
            <span className="text-slate-400">{modelLabel}</span>
          )}
          <span className="text-slate-500">t={agent.temperature.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {toneLabel && <span>{toneLabel}</span>}
          {languageLabel && <span>· {languageLabel}</span>}
        </div>
      </div>
    </div>
  );
}
