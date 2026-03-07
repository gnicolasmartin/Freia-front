"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Info,
  KeyRound,
  MessageCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { AgentFormData } from "@/types/agent";
import type { ValidationIssue } from "@/lib/agent-validator";
import {
  CHANNEL_SCOPES,
  OBJECTIVES,
  KPI_TYPES,
  LLM_MODELS,
  TONES,
  RESPONSE_LENGTHS,
  EMOJI_LEVELS,
  LANGUAGES,
  AGENT_MODE_CONFIG,
  AGENT_STATUS_CONFIG,
  AGENT_STATUS_TRANSITIONS,
  EMPTY_AGENT_FORM,
} from "@/types/agent";
import { useFlows } from "@/providers/FlowsProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import { useChannels } from "@/providers/ChannelsProvider";
import { useWhatsAppTemplates } from "@/providers/WhatsAppTemplatesProvider";
import { useWhatsAppIdentity } from "@/providers/WhatsAppIdentityProvider";
import { usePolicies } from "@/providers/PoliciesProvider";
import { runWhatsAppAgentChecks } from "@/lib/whatsapp-agent-check";
import type { WAAgentCheckResult } from "@/lib/whatsapp-agent-check";
import type { DefaultLanguage } from "@/types/whatsapp-identity";
import { CHANNEL_META } from "@/types/channel";
import { buildSystemPrompt } from "@/lib/system-prompt-builder";

interface AgentFormProps {
  formData: AgentFormData;
  onChange: (data: AgentFormData) => void;
  /** Non-blocking warnings from the validator — shown as an inline summary */
  warnings?: ValidationIssue[];
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-t border-slate-700 pt-5 mt-5">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-slate-200 mb-1.5"
    >
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function ToggleButton({
  active,
  onClick,
  colorClass,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  colorClass?: string;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-slate-700/30 text-slate-500"
          : active
          ? colorClass ?? "bg-[#dd7430] text-white"
          : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <div className="relative group/tip inline-flex">
      <Info className="size-3 text-slate-600 hover:text-slate-400 cursor-help transition-colors" />
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover/tip:block w-60 rounded-lg bg-slate-700 border border-slate-600/80 px-3 py-2 text-xs text-slate-300 shadow-xl leading-relaxed">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-700" />
      </div>
    </div>
  );
}

function SliderField({
  label,
  id,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  format,
  tooltip,
  warning,
}: {
  label: string;
  id: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  tooltip?: string;
  warning?: (v: number) => string | null;
}) {
  const fmt = (v: number) => (format ? format(v) : String(v));
  const display = fmt(value);
  const isDefault = value === defaultValue;
  const warningMsg = warning ? warning(value) : null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <label htmlFor={id} className="text-xs text-slate-400">
            {label}
          </label>
          {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-[#dd7430]">{display}</span>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              title={`Restaurar por defecto: ${fmt(defaultValue)}`}
              className="text-slate-600 hover:text-slate-300 transition-colors"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-600 accent-[#dd7430] cursor-pointer"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-slate-600">{fmt(min)}</span>
        {!isDefault && (
          <span className="text-[10px] text-slate-600">
            def: {fmt(defaultValue)}
          </span>
        )}
        <span className="text-[10px] text-slate-600">{fmt(max)}</span>
      </div>
      {warningMsg && (
        <p className="mt-1 text-[10px] text-amber-500 flex items-center gap-1">
          <AlertTriangle className="size-3 shrink-0" />
          {warningMsg}
        </p>
      )}
    </div>
  );
}

// ─── WhatsApp identity → agent field mapping ──────────────────────────────────

const IDENTITY_LANG_TO_AGENT: Record<DefaultLanguage, string> = {
  "es-AR": "es_ar",
  "pt-BR": "pt_br",
  "en-US": "en_us",
};

// ─── WhatsApp readiness panel ─────────────────────────────────────────────────

function WhatsAppReadinessPanel({
  result,
  defaultsApplied,
}: {
  result: WAAgentCheckResult;
  defaultsApplied: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statusIcon = (status: WAAgentCheckResult["checks"][number]["status"]) => {
    switch (status) {
      case "ok":
        return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />;
      case "error":
        return <XCircle className="size-3.5 shrink-0 text-red-400" />;
      case "skipped":
        return <span className="size-3.5 shrink-0 text-slate-600 text-[10px] font-mono">—</span>;
    }
  };

  const rowColor = (status: WAAgentCheckResult["checks"][number]["status"]) => {
    switch (status) {
      case "ok": return "text-emerald-400";
      case "warning": return "text-amber-400";
      case "error": return "text-red-400";
      case "skipped": return "text-slate-600";
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 overflow-hidden mt-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <MessageCircle className="size-3.5 text-green-400" />
          Requisitos del canal WhatsApp
        </span>
        {result.canActivate ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">
            Listo para activar
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/50">
            Requisitos incompletos
          </span>
        )}
      </div>

      {/* Auto-defaults info banner */}
      {defaultsApplied && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900/20 border-b border-blue-800/30 text-[10px] text-blue-400">
          <Info className="size-3 shrink-0" />
          Se aplicaron los defaults de identidad del canal (idioma, tono, emojis).
        </div>
      )}

      {/* Check rows */}
      <div className="divide-y divide-slate-800">
        {result.checks.map((check) => (
          <div key={check.id}>
            <button
              type="button"
              onClick={() =>
                check.resolution
                  ? setExpandedId(expandedId === check.id ? null : check.id)
                  : undefined
              }
              className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                check.resolution ? "hover:bg-slate-800/50 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="mt-0.5">{statusIcon(check.status)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-300">
                    {check.label}
                  </span>
                  {check.resolution && (
                    <ChevronDown
                      className={`size-3 text-slate-600 shrink-0 transition-transform ${
                        expandedId === check.id ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </div>
                <p className={`text-[10px] mt-0.5 ${rowColor(check.status)}`}>
                  {check.message}
                </p>
              </div>
            </button>
            {expandedId === check.id && check.resolution && (
              <div className="px-3 pb-2.5 pl-8 space-y-1">
                {check.resolution.map((step, i) => (
                  <p key={i} className="text-[10px] text-slate-500">
                    <span className="text-slate-600 mr-1">{i + 1}.</span>
                    {step}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared input classes ─────────────────────────────────────────────────────

const selectClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

export default function AgentForm({ formData, onChange, warnings }: AgentFormProps) {
  const { flows } = useFlows();
  const { config } = useLLMConfig();
  const { channels, getChannelConfig } = useChannels();
  const { templates } = useWhatsAppTemplates();
  const { identity } = useWhatsAppIdentity();
  const { policies } = usePolicies();
  const openaiConfigured = config.openai.isConfigured;

  // Only show channels that are enabled in the channel registry
  const enabledChannelScopes = CHANNEL_SCOPES.filter((c) => {
    const cfg = channels.find((ch) => ch.channel === c.value);
    return cfg?.enabled ?? false;
  });
  // If the current value is not in the enabled list (edge case: channel was disabled after assignment)
  // still include it so the form doesn't lose the value, but we'll show a warning
  const currentCfg = formData.channelScope
    ? getChannelConfig(formData.channelScope)
    : undefined;
  const currentChannelInList = enabledChannelScopes.some(
    (c) => c.value === formData.channelScope
  );
  const channelOptionsToShow =
    !formData.channelScope || currentChannelInList
      ? enabledChannelScopes
      : [
          ...enabledChannelScopes,
          CHANNEL_SCOPES.find((c) => c.value === formData.channelScope)!,
        ].filter(Boolean);

  // Connection state of the selected channel
  const selectedChannelNeedsConnection =
    !!formData.channelScope &&
    !!currentCfg &&
    currentCfg.requiresConnection &&
    currentCfg.connectionStatus !== "connected";

  const selectedChannelDisabled =
    !!formData.channelScope && !!currentCfg && !currentCfg.enabled;

  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const set = <K extends keyof AgentFormData>(field: K, value: AgentFormData[K]) =>
    onChange({ ...formData, [field]: value });

  // ── WhatsApp readiness ────────────────────────────────────────────────────

  const isWhatsApp = formData.channelScope === "whatsapp";

  const waChecks: WAAgentCheckResult | null = isWhatsApp
    ? runWhatsAppAgentChecks({
        isConnected: currentCfg?.connectionStatus === "connected",
        approvedTemplateCount: templates.filter((t) => t.status === "approved").length,
        outboundEnabled: !!formData.whatsappOutbound,
        activePolicyCount: policies.filter(
          (p) => p.active && (p.scope === "global" || p.channelIds?.includes("whatsapp"))
        ).length,
        hasIdentityConfigured: !!identity.businessName,
      })
    : null;

  const handleChannelScopeChange = (scope: AgentFormData["channelScope"]) => {
    if (scope === "whatsapp") {
      onChange({
        ...formData,
        channelScope: scope,
        language: IDENTITY_LANG_TO_AGENT[identity.defaultLanguage] ?? formData.language,
        tone: identity.tone,
        emojiUsage: identity.useEmojis ? "moderado" : "no",
      });
      setDefaultsApplied(true);
    } else {
      set("channelScope", scope);
      setDefaultsApplied(false);
    }
  };

  const generatedPrompt = buildSystemPrompt(formData);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* ============ Advertencias de configuración ============ */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-900/10 p-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
              Advertencias de configuración
            </span>
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-300/90 pl-5">
              {w.message}
            </p>
          ))}
        </div>
      )}

      {/* ============ SECCIÓN 1: Identidad ============ */}
      <div>
        <FieldLabel label="Nombre del agente" required htmlFor="agent-name" />
        <input
          id="agent-name"
          type="text"
          value={formData.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej: Agente de ventas WhatsApp"
          className={inputClasses}
        />
      </div>

      <div>
        <FieldLabel label="Descripción" htmlFor="agent-description" />
        <textarea
          id="agent-description"
          value={formData.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe brevemente el propósito del agente"
          rows={2}
          className={`${inputClasses} resize-none`}
        />
      </div>

      <div>
        <FieldLabel label="Estado" />
        <div className="flex flex-wrap gap-2 mt-1">
          {(["draft", "active", "paused", "archived"] as const).map((s) => {
            const cfg = AGENT_STATUS_CONFIG[s];
            const selectedFlow = flows.find((f) => f.id === formData.flowId);
            const hasPublishedVersion = !!selectedFlow?.publishedVersionId;
            const isCurrent = formData.status === s;

            // A status is selectable only if it's the current state OR a valid transition
            const allowedTransitions = AGENT_STATUS_TRANSITIONS[formData.status] ?? [];
            const isReachable = isCurrent || allowedTransitions.includes(s);

            // Additional conditions for "active"
            const channelNotAvailable =
              selectedChannelNeedsConnection || selectedChannelDisabled;
            const waNotReady = waChecks !== null && !waChecks.canActivate;
            const activationBlocked =
              s === "active" &&
              (!hasPublishedVersion || !openaiConfigured || channelNotAvailable || waNotReady);
            const isDisabled = !isReachable || (!isCurrent && activationBlocked);

            let disabledTitle: string | undefined;
            if (!isReachable) {
              disabledTitle = "Transición no permitida desde el estado actual";
            } else if (activationBlocked) {
              if (!hasPublishedVersion) {
                disabledTitle = "Requiere flujo con versión publicada";
              } else if (!openaiConfigured) {
                disabledTitle =
                  "Requiere API Key de OpenAI en Configuraciones";
              } else if (channelNotAvailable) {
                const chMeta = formData.channelScope
                  ? CHANNEL_META[formData.channelScope]
                  : null;
                disabledTitle = selectedChannelDisabled
                  ? `El canal ${chMeta?.label ?? ""} está deshabilitado — actívalo en Canales`
                  : `${chMeta?.label ?? "El canal"} requiere conexión — conéctalo en Configuración de Canales`;
              } else if (waNotReady) {
                disabledTitle = "WhatsApp: requisitos incompletos — revisa el panel de verificación";
              }
            }

            const activeColor =
              s === "active"
                ? "bg-emerald-600 text-white"
                : s === "paused"
                ? "bg-amber-600 text-white"
                : s === "archived"
                ? "bg-slate-600/80 text-slate-300"
                : "bg-slate-600 text-white";

            return (
              <ToggleButton
                key={s}
                active={isCurrent}
                colorClass={activeColor}
                disabled={isDisabled}
                title={disabledTitle}
                onClick={() => set("status", s)}
              >
                {cfg.label}
              </ToggleButton>
            );
          })}
        </div>
        {formData.status === "archived" && (
          <p className="mt-1.5 text-xs text-slate-500">
            El agente está archivado y no procesará nuevas conversaciones. Puedes restaurarlo a Borrador.
          </p>
        )}
      </div>

      {/* ============ SECCIÓN 2: Alcance operativo ============ */}
      <SectionHeader title="Alcance operativo" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Canal" required htmlFor="agent-channel" />
          <select
            id="agent-channel"
            value={formData.channelScope}
            onChange={(e) =>
              handleChannelScopeChange(
                e.target.value as AgentFormData["channelScope"]
              )
            }
            className={selectClasses}
          >
            <option value="">Seleccionar...</option>
            {channelOptionsToShow.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {enabledChannelScopes.length === 0 && (
            <p className="mt-1.5 text-xs text-slate-500">
              No hay canales habilitados.{" "}
              <a
                href="/channels"
                className="text-[#dd7430] underline underline-offset-2 hover:text-orange-300"
              >
                Ir a Canales
              </a>{" "}
              para habilitarlos.
            </p>
          )}
          {/* Warning: selected channel requires connection */}
          {selectedChannelNeedsConnection && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg border border-amber-800/50 bg-amber-900/15 text-xs text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>
                {CHANNEL_META[formData.channelScope!]?.label ?? "Este canal"}{" "}
                requiere conexión.{" "}
                <a
                  href="/channels"
                  className="underline underline-offset-2 hover:text-amber-300"
                >
                  Configurar en Canales
                </a>{" "}
                para poder activar el agente.
              </span>
            </div>
          )}
          {/* Warning: channel disabled after being assigned */}
          {selectedChannelDisabled && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg border border-red-800/50 bg-red-900/15 text-xs text-red-400">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
              <span>
                El canal seleccionado está deshabilitado.{" "}
                <a
                  href="/channels"
                  className="underline underline-offset-2 hover:text-red-300"
                >
                  Habilitarlo en Canales
                </a>{" "}
                o seleccionar otro canal.
              </span>
            </div>
          )}

          {/* WhatsApp outbound toggle */}
          {isWhatsApp && (
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.whatsappOutbound}
                onChange={(e) => set("whatsappOutbound", e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-slate-900"
              />
              <span className="text-sm text-slate-300">
                Este agente puede enviar mensajes iniciados por la empresa{" "}
                <span className="text-slate-500">(outbound — requiere templates aprobados)</span>
              </span>
            </label>
          )}

          {/* WhatsApp readiness panel */}
          {isWhatsApp && waChecks && (
            <WhatsAppReadinessPanel
              result={waChecks}
              defaultsApplied={defaultsApplied}
            />
          )}
        </div>

        <div>
          <FieldLabel label="Flujo asociado" required htmlFor="agent-flow" />
          <select
            id="agent-flow"
            value={formData.flowId}
            onChange={(e) => set("flowId", e.target.value)}
            className={selectClasses}
          >
            <option value="">Seleccionar flujo...</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Flow version info */}
      {formData.flowId && (() => {
        const selectedFlow = flows.find((f) => f.id === formData.flowId);
        if (!selectedFlow) return null;
        const publishedVersion = selectedFlow.versions?.find(
          (v) => v.id === selectedFlow.publishedVersionId
        );
        const isDraftModified =
          publishedVersion &&
          selectedFlow.updatedAt > publishedVersion.publishedAt;

        if (!publishedVersion) {
          return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-800/50 bg-amber-900/20 text-xs text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Sin versión publicada — el agente no podrá activarse hasta que el flujo sea publicado
            </div>
          );
        }
        return (
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
            isDraftModified
              ? "border-amber-800/50 bg-amber-900/10 text-amber-400"
              : "border-emerald-800/50 bg-emerald-900/10 text-emerald-400"
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 shrink-0" />
              v{publishedVersion.version} · Versión publicada
            </div>
            {isDraftModified && (
              <span className="text-amber-500 shrink-0">Flujo modificado desde última publicación</span>
            )}
          </div>
        );
      })()}

      <div>
        <FieldLabel label="Modo de operación" />
        <div className="flex flex-wrap gap-2 mt-1">
          {(["flow-driven", "hybrid", "ai-guided"] as const).map((m) => {
            const cfg = AGENT_MODE_CONFIG[m];
            const activeColor =
              m === "flow-driven"
                ? "bg-sky-600 text-white"
                : m === "hybrid"
                ? "bg-violet-600 text-white"
                : "bg-orange-600 text-white";
            return (
              <ToggleButton
                key={m}
                active={formData.mode === m}
                colorClass={activeColor}
                onClick={() => set("mode", m)}
              >
                {cfg.label}
              </ToggleButton>
            );
          })}
        </div>
        {formData.mode && (
          <p className="mt-1.5 text-xs text-slate-500">
            {AGENT_MODE_CONFIG[formData.mode].description}
          </p>
        )}
      </div>

      {/* ============ SECCIÓN 3: Objetivo ============ */}
      <SectionHeader title="Objetivo" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Objetivo principal" htmlFor="agent-objective" />
          <select
            id="agent-objective"
            value={formData.primaryObjective}
            onChange={(e) => set("primaryObjective", e.target.value)}
            className={selectClasses}
          >
            <option value="">Seleccionar...</option>
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel label="KPI principal" htmlFor="agent-kpi" />
          <select
            id="agent-kpi"
            value={formData.kpiType}
            onChange={(e) => set("kpiType", e.target.value)}
            className={selectClasses}
          >
            <option value="">Seleccionar...</option>
            {KPI_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formData.kpiType && (
        <div>
          <FieldLabel label="Meta del KPI (valor objetivo)" htmlFor="agent-kpi-target" />
          <input
            id="agent-kpi-target"
            type="number"
            min={0}
            value={formData.kpiTarget ?? ""}
            onChange={(e) =>
              set(
                "kpiTarget",
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
            placeholder="Opcional"
            className={inputClasses}
          />
        </div>
      )}

      {/* ============ SECCIÓN 4: Configuración AI ============ */}
      <SectionHeader title="Configuración AI" />

      <div>
        <FieldLabel label="Proveedor LLM" />
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/30 text-slate-400 text-sm">
          <span
            className={`size-2 rounded-full shrink-0 ${
              openaiConfigured ? "bg-emerald-400" : "bg-slate-500"
            }`}
          />
          OpenAI
        </div>
        {!openaiConfigured ? (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg border border-amber-800/50 bg-amber-900/15 text-xs text-amber-400">
            <KeyRound className="size-3.5 shrink-0 mt-0.5" />
            <span>
              No hay API Key de OpenAI configurada.{" "}
              <a
                href="/settings"
                className="underline underline-offset-2 hover:text-amber-300"
              >
                Ir a Configuraciones
              </a>{" "}
              para agregar tu clave.
            </span>
          </div>
        ) : config.openai.isValidated ? (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border border-emerald-800/40 bg-emerald-900/10 text-xs text-emerald-400">
            <CheckCircle2 className="size-3.5 shrink-0" />
            API Key validada correctamente
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/30 text-xs text-slate-400">
            <KeyRound className="size-3.5 shrink-0" />
            API Key configurada · sin validar
          </div>
        )}
      </div>

      <div>
        <FieldLabel label="Modelo" htmlFor="agent-model" />
        <select
          id="agent-model"
          value={formData.modelName}
          onChange={(e) => set("modelName", e.target.value)}
          className={selectClasses}
        >
          {LLM_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} — {m.contextK}k ctx
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 space-y-4">
        <SliderField
          label="Temperature"
          id="agent-temp"
          value={formData.temperature}
          defaultValue={EMPTY_AGENT_FORM.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => set("temperature", v)}
          format={(v) => v.toFixed(1)}
          tooltip="Controla la aleatoriedad. Bajo (0–0.3): predecible y consistente. Medio (0.7–1.0): equilibrado. Alto (1.5–2): creativo pero puede ser incoherente."
          warning={(v) =>
            v > 1.5
              ? "Creatividad muy alta — las respuestas pueden ser incoherentes"
              : v < 0.2 && v > 0
              ? "Temperatura muy baja — respuestas serán muy predecibles y repetitivas"
              : null
          }
        />
        <SliderField
          label="Max tokens"
          id="agent-max-tokens"
          value={formData.maxTokens}
          defaultValue={EMPTY_AGENT_FORM.maxTokens}
          min={256}
          max={4096}
          step={64}
          onChange={(v) => set("maxTokens", v)}
          tooltip="Límite de tokens por respuesta. 1 token ≈ 0.75 palabras. Valores bajos truncarán respuestas largas; valores muy altos aumentan el costo por llamada."
          warning={(v) =>
            v <= 256
              ? "Límite muy bajo — las respuestas podrán ser truncadas prematuramente"
              : null
          }
        />
        <SliderField
          label="Top P"
          id="agent-top-p"
          value={formData.topP}
          defaultValue={EMPTY_AGENT_FORM.topP}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => set("topP", v)}
          format={(v) => v.toFixed(2)}
          tooltip="Nucleus sampling: el modelo solo considera tokens cuya probabilidad acumulada alcanza este valor. 1.0 desactiva el efecto. Evitar ajustar junto con temperature."
          warning={(v) =>
            v < 0.5
              ? "Nucleus sampling muy restrictivo — el vocabulario será muy limitado"
              : null
          }
        />
        <SliderField
          label="Frequency penalty"
          id="agent-freq-pen"
          value={formData.frequencyPenalty}
          defaultValue={EMPTY_AGENT_FORM.frequencyPenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={(v) => set("frequencyPenalty", v)}
          format={(v) => v.toFixed(1)}
          tooltip="Penaliza tokens según su frecuencia en la respuesta. Valores positivos reducen repeticiones literales; negativos las aumentan. Recomendado: 0."
          warning={(v) =>
            v > 1.5
              ? "Penalización alta — puede hacer el texto poco natural"
              : v < -1
              ? "Valor negativo alto — aumentará las repeticiones"
              : null
          }
        />
        <SliderField
          label="Presence penalty"
          id="agent-pres-pen"
          value={formData.presencePenalty}
          defaultValue={EMPTY_AGENT_FORM.presencePenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={(v) => set("presencePenalty", v)}
          format={(v) => v.toFixed(1)}
          tooltip="Penaliza tokens que ya aparecieron al menos una vez. Incentiva al modelo a abordar nuevos conceptos y evitar repetir ideas. Recomendado: 0."
          warning={(v) =>
            v > 1.5
              ? "Penalización alta — el modelo evitará retomar conceptos importantes"
              : v < -1
              ? "Valor negativo alto — el modelo tenderá a repetir ideas"
              : null
          }
        />
      </div>

      {formData.temperature !== EMPTY_AGENT_FORM.temperature &&
        formData.topP !== EMPTY_AGENT_FORM.topP && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-800/40 bg-amber-900/10 text-xs text-amber-400">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <span className="font-medium">Parámetros en conflicto:</span>{" "}
              ajustar Temperature y Top P simultáneamente puede producir
              resultados impredecibles. Se recomienda modificar solo uno.
            </span>
          </div>
        )}

      {/* ============ SECCIÓN 5: Estilo ============ */}
      <SectionHeader title="Estilo" />

      <div>
        <FieldLabel label="Tono" />
        <div className="flex flex-wrap gap-2 mt-1">
          {TONES.map((o) => (
            <ToggleButton
              key={o.value}
              active={formData.tone === o.value}
              onClick={() => set("tone", o.value)}
            >
              {o.label}
            </ToggleButton>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Longitud de respuesta" />
          <div className="flex flex-col gap-2 mt-1">
            {RESPONSE_LENGTHS.map((o) => (
              <ToggleButton
                key={o.value}
                active={formData.responseLength === o.value}
                onClick={() => set("responseLength", o.value)}
              >
                {o.label}
              </ToggleButton>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel label="Uso de emojis" />
          <div className="flex flex-col gap-2 mt-1">
            {EMOJI_LEVELS.map((o) => (
              <ToggleButton
                key={o.value}
                active={formData.emojiUsage === o.value}
                onClick={() => set("emojiUsage", o.value)}
              >
                {o.label}
              </ToggleButton>
            ))}
          </div>
        </div>
      </div>

      <div>
        <FieldLabel label="Idioma" htmlFor="agent-language" />
        <select
          id="agent-language"
          value={formData.language}
          onChange={(e) => set("language", e.target.value)}
          className={selectClasses}
        >
          {LANGUAGES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ============ SECCIÓN 6: Políticas ============ */}
      <SectionHeader title="Políticas" />


      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Alcance de política" />
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/30 text-slate-400 text-sm">
            Inherited (heredado del flujo)
          </div>
        </div>

        <div>
          <FieldLabel label="Permitir override" />
          <button
            type="button"
            role="switch"
            aria-checked={formData.allowOverride}
            onClick={() => set("allowOverride", !formData.allowOverride)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors mt-1 ${
              formData.allowOverride ? "bg-[#dd7430]" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                formData.allowOverride ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ============ System Prompt Preview ============ */}
      <div className="border-t border-slate-700 pt-5 mt-5">
        <button
          type="button"
          onClick={() => setPromptOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left group"
        >
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Vista previa del System Prompt
          </h3>
          <ChevronDown
            className={`size-4 text-slate-500 group-hover:text-slate-300 transition-all ${
              promptOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {promptOpen && (
          <div className="mt-3">
            <div className="relative">
              <textarea
                readOnly
                value={generatedPrompt}
                rows={18}
                spellCheck={false}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-300 font-mono resize-none focus:outline-none leading-relaxed"
              />
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
              >
                {copied ? (
                  <Check className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-600">
              Generado automáticamente a partir de la configuración del agente.
              Se actualiza en tiempo real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
