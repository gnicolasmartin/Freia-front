"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Shield, ShieldAlert, Ban, ShieldCheck, Flame, Activity, Trash2, Lock, Eye } from "lucide-react";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import type {
  Policy,
  PolicyFormData,
  ForbiddenCategory,
  ForbiddenResponseCategory,
  ResponseViolationAction,
  AuthorityRule,
  AuthorityViolationAction,
  EscalationTriggerCategory,
  EscalationTriggerRule,
  EscalationTriggerAction,
  RiskScoreAction,
  InputClassificationCategory,
  InputClassificationAction,
} from "@/types/policy";
import {
  EMPTY_POLICY_FORM,
  POLICY_SCOPES,
  FORBIDDEN_CATEGORIES,
  FORBIDDEN_RESPONSE_CATEGORIES,
  ESCALATION_TRIGGER_CATEGORIES,
  INPUT_CLASSIFICATION_CATEGORIES,
  resolveEnforcementActions,
} from "@/types/policy";
import type { EnforcementMode } from "@/types/policy";
import { INTENT_KEYWORDS } from "@/lib/flow-simulator";
import { CHANNEL_SCOPES as CHANNELS } from "@/types/agent";

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPolicy?: Policy | null;
}

const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

const selectClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none appearance-none";

const CheckIcon = () => (
  <svg
    className="size-3 text-white"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={3}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const VIOLATION_ACTIONS: { value: ResponseViolationAction; label: string; description: string }[] = [
  { value: "block", label: "Bloquear", description: "No enviar la respuesta" },
  { value: "escalate", label: "Escalar", description: "Transferir a humano" },
  { value: "reformulate", label: "Reformular", description: "Reemplazar con mensaje genérico" },
];

const ESCALATION_ACTIONS: { value: EscalationTriggerAction; label: string; description: string }[] = [
  { value: "escalate", label: "Escalar", description: "Forzar escalamiento a supervisor" },
  { value: "flag", label: "Marcar", description: "Marcar conversación y continuar" },
  { value: "notify", label: "Notificar", description: "Enviar notificación a supervisor" },
];

const RISK_SCORE_ACTIONS: { value: RiskScoreAction; label: string; description: string }[] = [
  { value: "warn", label: "Advertir", description: "Mostrar alerta en la simulación" },
  { value: "escalate", label: "Escalar", description: "Forzar escalamiento a supervisor" },
];

const CLASSIFICATION_ACTIONS: { value: InputClassificationAction; label: string; description: string }[] = [
  { value: "ignore", label: "Ignorar", description: "Registrar silenciosamente y continuar" },
  { value: "escalate", label: "Escalar", description: "Detener flujo y transferir a humano" },
  { value: "warn", label: "Advertir", description: "Mostrar advertencia y continuar" },
];

export default function PolicyModal({
  isOpen,
  onClose,
  editingPolicy,
}: PolicyModalProps) {
  const { createPolicy, updatePolicy } = usePolicies();
  const { tools, getToolSchema } = useToolRegistry();
  const authorityToolOptions = tools.map((t) => ({ value: t.id, label: t.name }));
  const [formData, setFormData] = useState<PolicyFormData>({
    ...EMPTY_POLICY_FORM,
  });
  const [error, setError] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newResponseKeyword, setNewResponseKeyword] = useState("");
  const [newRule, setNewRule] = useState<{
    type: "forbidden" | "limit";
    toolName: string;
    paramName: string;
    maxValue: number;
    description: string;
  }>({ type: "forbidden", toolName: "", paramName: "", maxValue: 0, description: "" });
  const [newEscalationKeyword, setNewEscalationKeyword] = useState("");
  const [newClassificationKeyword, setNewClassificationKeyword] = useState("");
  const [newEscalationRule, setNewEscalationRule] = useState<{
    type: "intent" | "confidence";
    intentName: string;
    confidenceThreshold: number;
    description: string;
  }>({ type: "intent", intentName: "", confidenceThreshold: 0.5, description: "" });

  useEffect(() => {
    if (isOpen) {
      if (editingPolicy) {
        setFormData({
          name: editingPolicy.name,
          description: editingPolicy.description,
          scope: editingPolicy.scope,
          channelIds: editingPolicy.channelIds ?? [],
          active: editingPolicy.active,
          enforcementMode: editingPolicy.enforcementMode ?? "strict",
          forbiddenCategories: editingPolicy.forbiddenCategories ?? [],
          forbiddenKeywords: editingPolicy.forbiddenKeywords ?? [],
          forbiddenResponseCategories: editingPolicy.forbiddenResponseCategories ?? [],
          forbiddenResponseKeywords: editingPolicy.forbiddenResponseKeywords ?? [],
          responseViolationAction: editingPolicy.responseViolationAction ?? "block",
          authorityRules: editingPolicy.authorityRules ?? [],
          authorityViolationAction: editingPolicy.authorityViolationAction ?? "block",
          escalationTriggerCategories: editingPolicy.escalationTriggerCategories ?? [],
          escalationTriggerKeywords: editingPolicy.escalationTriggerKeywords ?? [],
          escalationTriggerRules: editingPolicy.escalationTriggerRules ?? [],
          escalationTriggerAction: editingPolicy.escalationTriggerAction ?? "escalate",
          riskScoreThreshold: editingPolicy.riskScoreThreshold ?? 0,
          riskScoreAction: editingPolicy.riskScoreAction ?? "warn",
          inputClassificationCategories: editingPolicy.inputClassificationCategories ?? [],
          inputClassificationKeywords: editingPolicy.inputClassificationKeywords ?? [],
          inputClassificationAction: editingPolicy.inputClassificationAction ?? "escalate",
        });
      } else {
        setFormData({ ...EMPTY_POLICY_FORM });
      }
      setError(null);
      setNewKeyword("");
      setNewResponseKeyword("");
      setNewRule({ type: "forbidden", toolName: "", paramName: "", maxValue: 0, description: "" });
      setNewEscalationKeyword("");
      setNewEscalationRule({ type: "intent", intentName: "", confidenceThreshold: 0.5, description: "" });
      setNewClassificationKeyword("");
    }
  }, [isOpen, editingPolicy]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

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

  // Sync action fields when enforcement mode changes
  const prevModeRef = useRef(formData.enforcementMode);
  useEffect(() => {
    if (formData.enforcementMode === prevModeRef.current) return;
    prevModeRef.current = formData.enforcementMode;
    const resolved = resolveEnforcementActions(formData.enforcementMode);
    setFormData((prev) => ({
      ...prev,
      responseViolationAction: resolved.responseViolationAction,
      authorityViolationAction: resolved.authorityViolationAction,
      escalationTriggerAction: resolved.escalationTriggerAction,
      riskScoreAction: resolved.riskScoreAction,
      inputClassificationAction: resolved.inputClassificationAction,
    }));
  }, [formData.enforcementMode]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setError("El nombre de la política es requerido.");
      return;
    }

    if (editingPolicy) {
      updatePolicy(editingPolicy.id, formData);
    } else {
      createPolicy(formData);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // --- Forbidden data (input) helpers ---

  const toggleCategory = (catValue: ForbiddenCategory) => {
    setFormData((prev) => {
      const current = prev.forbiddenCategories ?? [];
      const has = current.includes(catValue);
      return {
        ...prev,
        forbiddenCategories: has
          ? current.filter((c) => c !== catValue)
          : [...current, catValue],
      };
    });
  };

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    const current = formData.forbiddenKeywords ?? [];
    if (current.some((k) => k.toLowerCase() === kw.toLowerCase())) return;
    setFormData((prev) => ({
      ...prev,
      forbiddenKeywords: [...(prev.forbiddenKeywords ?? []), kw],
    }));
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    setFormData((prev) => ({
      ...prev,
      forbiddenKeywords: (prev.forbiddenKeywords ?? []).filter((k) => k !== kw),
    }));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  // --- Forbidden response (output) helpers ---

  const toggleResponseCategory = (catValue: ForbiddenResponseCategory) => {
    setFormData((prev) => {
      const current = prev.forbiddenResponseCategories ?? [];
      const has = current.includes(catValue);
      return {
        ...prev,
        forbiddenResponseCategories: has
          ? current.filter((c) => c !== catValue)
          : [...current, catValue],
      };
    });
  };

  const addResponseKeyword = () => {
    const kw = newResponseKeyword.trim();
    if (!kw) return;
    const current = formData.forbiddenResponseKeywords ?? [];
    if (current.some((k) => k.toLowerCase() === kw.toLowerCase())) return;
    setFormData((prev) => ({
      ...prev,
      forbiddenResponseKeywords: [...(prev.forbiddenResponseKeywords ?? []), kw],
    }));
    setNewResponseKeyword("");
  };

  const removeResponseKeyword = (kw: string) => {
    setFormData((prev) => ({
      ...prev,
      forbiddenResponseKeywords: (prev.forbiddenResponseKeywords ?? []).filter((k) => k !== kw),
    }));
  };

  const handleResponseKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addResponseKeyword();
    }
  };

  // --- Authority rules helpers ---

  const addAuthorityRule = () => {
    if (!newRule.toolName) return;
    if (newRule.type === "limit" && (!newRule.paramName || newRule.maxValue <= 0)) return;
    const rule: AuthorityRule = {
      id: crypto.randomUUID(),
      type: newRule.type,
      toolName: newRule.toolName,
      ...(newRule.type === "limit"
        ? { paramName: newRule.paramName, maxValue: newRule.maxValue }
        : {}),
      description:
        newRule.description.trim() ||
        (newRule.type === "forbidden"
          ? `${authorityToolOptions.find((t) => t.value === newRule.toolName)?.label ?? newRule.toolName} — Prohibido`
          : `${authorityToolOptions.find((t) => t.value === newRule.toolName)?.label ?? newRule.toolName} — Máx. ${newRule.maxValue}`),
    };
    setFormData((prev) => ({
      ...prev,
      authorityRules: [...(prev.authorityRules ?? []), rule],
    }));
    setNewRule({ type: "forbidden", toolName: "", paramName: "", maxValue: 0, description: "" });
  };

  const removeAuthorityRule = (ruleId: string) => {
    setFormData((prev) => ({
      ...prev,
      authorityRules: (prev.authorityRules ?? []).filter((r) => r.id !== ruleId),
    }));
  };

  const getNumericParams = (toolName: string) => {
    const schema = getToolSchema(toolName);
    return schema.filter((p) => p.type === "number");
  };

  // --- Escalation trigger helpers ---

  const toggleEscalationCategory = (catValue: EscalationTriggerCategory) => {
    setFormData((prev) => {
      const current = prev.escalationTriggerCategories ?? [];
      const has = current.includes(catValue);
      return {
        ...prev,
        escalationTriggerCategories: has
          ? current.filter((c) => c !== catValue)
          : [...current, catValue],
      };
    });
  };

  const addEscalationKeyword = () => {
    const kw = newEscalationKeyword.trim();
    if (!kw) return;
    const current = formData.escalationTriggerKeywords ?? [];
    if (current.some((k) => k.toLowerCase() === kw.toLowerCase())) return;
    setFormData((prev) => ({
      ...prev,
      escalationTriggerKeywords: [...(prev.escalationTriggerKeywords ?? []), kw],
    }));
    setNewEscalationKeyword("");
  };

  const removeEscalationKeyword = (kw: string) => {
    setFormData((prev) => ({
      ...prev,
      escalationTriggerKeywords: (prev.escalationTriggerKeywords ?? []).filter((k) => k !== kw),
    }));
  };

  const handleEscalationKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addEscalationKeyword();
    }
  };

  const addEscalationRule = () => {
    if (newEscalationRule.type === "intent" && !newEscalationRule.intentName) return;
    if (newEscalationRule.type === "confidence" && newEscalationRule.confidenceThreshold <= 0) return;
    const rule: EscalationTriggerRule = {
      id: crypto.randomUUID(),
      type: newEscalationRule.type,
      ...(newEscalationRule.type === "intent"
        ? { intentName: newEscalationRule.intentName }
        : { confidenceThreshold: newEscalationRule.confidenceThreshold }),
      description:
        newEscalationRule.description.trim() ||
        (newEscalationRule.type === "intent"
          ? `Intent: ${INTENT_KEYWORDS.find((i) => i.intent === newEscalationRule.intentName)?.label ?? newEscalationRule.intentName}`
          : `Confianza < ${(newEscalationRule.confidenceThreshold * 100).toFixed(0)}%`),
    };
    setFormData((prev) => ({
      ...prev,
      escalationTriggerRules: [...(prev.escalationTriggerRules ?? []), rule],
    }));
    setNewEscalationRule({ type: "intent", intentName: "", confidenceThreshold: 0.5, description: "" });
  };

  const removeEscalationRule = (ruleId: string) => {
    setFormData((prev) => ({
      ...prev,
      escalationTriggerRules: (prev.escalationTriggerRules ?? []).filter((r) => r.id !== ruleId),
    }));
  };

  if (!isOpen) return null;

  const isEditing = !!editingPolicy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2
            id="policy-modal-title"
            className="text-xl font-bold text-white"
          >
            {isEditing ? "Editar Política" : "Nueva Política"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label
              htmlFor="policy-name"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              id="policy-name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ej: No revelar precios de competidores"
              className={inputClasses}
            />
          </div>

          {/* Descripción */}
          <div>
            <label
              htmlFor="policy-description"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Descripción
            </label>
            <textarea
              id="policy-description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe qué restricción o comportamiento define esta política..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </div>

          {/* Alcance */}
          <div>
            <label
              htmlFor="policy-scope"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Alcance
            </label>
            <select
              id="policy-scope"
              value={formData.scope}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  scope: e.target.value as PolicyFormData["scope"],
                }))
              }
              className={selectClasses}
            >
              {POLICY_SCOPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {formData.scope === "flow" && (
              <p className="text-xs text-sky-400/80 mt-2 flex items-center gap-1.5">
                <Shield className="size-3 shrink-0" />
                Esta política debe ser asociada manualmente desde el editor de flujo.
              </p>
            )}
            {formData.scope === "channel" && (
              <>
                <p className="text-xs text-teal-400/80 mt-2 flex items-center gap-1.5">
                  <Shield className="size-3 shrink-0" />
                  Esta política se aplica automáticamente en los canales seleccionados.
                </p>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Canales
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((ch) => {
                      const selected = (formData.channelIds ?? []).includes(ch.value);
                      return (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => {
                              const current = prev.channelIds ?? [];
                              return {
                                ...prev,
                                channelIds: selected
                                  ? current.filter((id) => id !== ch.value)
                                  : [...current, ch.value],
                              };
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            selected
                              ? "bg-teal-900/40 text-teal-300 border-teal-700/60"
                              : "bg-slate-800/50 text-slate-400 border-slate-600 hover:border-slate-500"
                          }`}
                        >
                          {selected && <span className="mr-1">✓</span>}
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modo de Aplicación */}
          <div className="rounded-xl border border-slate-600 bg-slate-800/30 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-200 mb-1">
                Modo de aplicación
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Define cómo la política responde ante violaciones detectadas
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, enforcementMode: "strict" as EnforcementMode }))
                }
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.enforcementMode === "strict"
                    ? "bg-red-900/20 text-red-300 border-red-700/60 shadow-lg shadow-red-900/10"
                    : "bg-slate-800/50 text-slate-400 border-slate-600 hover:border-slate-500"
                }`}
              >
                <ShieldAlert className="size-5" />
                <span className="text-sm font-semibold">Estricto</span>
                <span className="text-[11px] text-center leading-tight opacity-70">
                  Bloquea y escala inmediatamente
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, enforcementMode: "flexible" as EnforcementMode }))
                }
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.enforcementMode === "flexible"
                    ? "bg-emerald-900/20 text-emerald-300 border-emerald-700/60 shadow-lg shadow-emerald-900/10"
                    : "bg-slate-800/50 text-slate-400 border-slate-600 hover:border-slate-500"
                }`}
              >
                <ShieldCheck className="size-5" />
                <span className="text-sm font-semibold">Flexible</span>
                <span className="text-[11px] text-center leading-tight opacity-70">
                  Reformula y advierte primero
                </span>
              </button>
            </div>
          </div>

          {/* Datos Prohibidos (input restrictions) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-red-400" />
              <span className="text-sm font-medium text-slate-200">
                Datos Prohibidos
              </span>
            </div>

            {/* Categorías */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Categorías de datos que el agente no puede solicitar
              </p>
              <div className="space-y-2">
                {FORBIDDEN_CATEGORIES.map((cat) => {
                  const selected = (formData.forbiddenCategories ?? []).includes(
                    cat.value
                  );
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                        selected
                          ? "bg-red-900/20 text-red-300 border-red-800/50"
                          : "bg-slate-800/30 text-slate-400 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <div
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "bg-red-500 border-red-500"
                            : "border-slate-500"
                        }`}
                      >
                        {selected && <CheckIcon />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium">{cat.label}</span>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {cat.keywords.join(", ")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keywords personalizados */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Keywords personalizados
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="Ej: CUIL, domicilio..."
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {(formData.forbiddenKeywords ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(formData.forbiddenKeywords ?? []).map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/20 text-red-300 border border-red-800/50"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-red-100 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Respuestas Prohibidas (output restrictions) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Ban className="size-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-200">
                Respuestas Prohibidas
              </span>
            </div>

            {/* Categorías de respuesta */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Temas sobre los que el agente no puede responder
              </p>
              <div className="space-y-2">
                {FORBIDDEN_RESPONSE_CATEGORIES.map((cat) => {
                  const selected = (formData.forbiddenResponseCategories ?? []).includes(
                    cat.value
                  );
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleResponseCategory(cat.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                        selected
                          ? "bg-amber-900/20 text-amber-300 border-amber-800/50"
                          : "bg-slate-800/30 text-slate-400 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <div
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "bg-amber-500 border-amber-500"
                            : "border-slate-500"
                        }`}
                      >
                        {selected && <CheckIcon />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium">{cat.label}</span>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {cat.keywords.join(", ")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keywords de respuesta personalizados */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Keywords personalizados
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newResponseKeyword}
                  onChange={(e) => setNewResponseKeyword(e.target.value)}
                  onKeyDown={handleResponseKeywordKeyDown}
                  placeholder="Ej: precio proveedor, comisión..."
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={addResponseKeyword}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {(formData.forbiddenResponseKeywords ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(formData.forbiddenResponseKeywords ?? []).map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-900/20 text-amber-300 border border-amber-800/50"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeResponseKeyword(kw)}
                        className="hover:text-amber-100 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Acción ante violación (read-only, determinado por modo) */}
            {((formData.forbiddenResponseCategories ?? []).length > 0 ||
              (formData.forbiddenResponseKeywords ?? []).length > 0) && (
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Lock className="size-3" />
                  Acción ante violación (determinado por modo)
                </p>
                <div className="flex gap-2 pointer-events-none opacity-60">
                  {VIOLATION_ACTIONS.map((action) => (
                    <div
                      key={action.value}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border text-center ${
                        resolveEnforcementActions(formData.enforcementMode).responseViolationAction === action.value
                          ? "bg-amber-900/30 text-amber-300 border-amber-800/50"
                          : "bg-slate-800/50 text-slate-400 border-slate-600"
                      }`}
                      title={action.description}
                    >
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Límites de Autoridad */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-violet-400" />
              <span className="text-sm font-medium text-slate-200">
                Límites de Autoridad
              </span>
            </div>

            {/* Existing rules */}
            {(formData.authorityRules ?? []).length > 0 && (
              <div className="space-y-2">
                {(formData.authorityRules ?? []).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm border bg-violet-900/20 text-violet-300 border-violet-800/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-violet-800/50 shrink-0">
                        {rule.type === "forbidden" ? "Prohibido" : "Límite"}
                      </span>
                      <span className="truncate">{rule.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAuthorityRule(rule.id)}
                      className="shrink-0 p-1 rounded text-violet-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add rule form */}
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
              <p className="text-xs text-slate-400">Agregar regla</p>
              <div className="flex gap-2">
                <select
                  value={newRule.type}
                  onChange={(e) =>
                    setNewRule((prev) => ({
                      ...prev,
                      type: e.target.value as "forbidden" | "limit",
                      paramName: "",
                      maxValue: 0,
                    }))
                  }
                  className={`${selectClasses} flex-1`}
                >
                  <option value="forbidden">Prohibido</option>
                  <option value="limit">Límite numérico</option>
                </select>
                <select
                  value={newRule.toolName}
                  onChange={(e) =>
                    setNewRule((prev) => ({
                      ...prev,
                      toolName: e.target.value,
                      paramName: "",
                    }))
                  }
                  className={`${selectClasses} flex-1`}
                >
                  <option value="">Herramienta...</option>
                  {authorityToolOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {newRule.type === "limit" && newRule.toolName && (
                <div className="flex gap-2">
                  <select
                    value={newRule.paramName}
                    onChange={(e) =>
                      setNewRule((prev) => ({
                        ...prev,
                        paramName: e.target.value,
                      }))
                    }
                    className={`${selectClasses} flex-1`}
                  >
                    <option value="">Parámetro...</option>
                    {getNumericParams(newRule.toolName).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={newRule.maxValue || ""}
                    onChange={(e) =>
                      setNewRule((prev) => ({
                        ...prev,
                        maxValue: parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="Máx."
                    className={`${inputClasses} w-24`}
                    min={0}
                  />
                </div>
              )}
              <input
                type="text"
                value={newRule.description}
                onChange={(e) =>
                  setNewRule((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descripción (opcional)"
                className={inputClasses}
              />
              <button
                type="button"
                onClick={addAuthorityRule}
                disabled={!newRule.toolName || (newRule.type === "limit" && (!newRule.paramName || newRule.maxValue <= 0))}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-violet-800/50 text-violet-300 hover:text-violet-200 hover:border-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-3.5" />
                Agregar
              </button>
            </div>

            {/* Authority violation action (read-only, determinado por modo) */}
            {(formData.authorityRules ?? []).length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Lock className="size-3" />
                  Acción ante violación de autoridad (determinado por modo)
                </p>
                <div className="flex gap-2 pointer-events-none opacity-60">
                  {([
                    { value: "block" as AuthorityViolationAction, label: "Bloquear", description: "No ejecutar la herramienta" },
                    { value: "escalate" as AuthorityViolationAction, label: "Escalar a humano", description: "Transferir a un agente humano" },
                  ]).map((action) => (
                    <div
                      key={action.value}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border text-center ${
                        resolveEnforcementActions(formData.enforcementMode).authorityViolationAction === action.value
                          ? "bg-violet-900/30 text-violet-300 border-violet-800/50"
                          : "bg-slate-800/50 text-slate-400 border-slate-600"
                      }`}
                      title={action.description}
                    >
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Triggers de Escalamiento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-rose-400" />
              <span className="text-sm font-medium text-slate-200">
                Triggers de Escalamiento
              </span>
            </div>

            {/* Categorías de trigger */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Situaciones que fuerzan escalamiento automático
              </p>
              <div className="space-y-2">
                {ESCALATION_TRIGGER_CATEGORIES.map((cat) => {
                  const selected = (formData.escalationTriggerCategories ?? []).includes(
                    cat.value
                  );
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleEscalationCategory(cat.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
                        selected
                          ? "bg-rose-900/20 text-rose-300 border-rose-800/50"
                          : "bg-slate-800/30 text-slate-400 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <div
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          selected
                            ? "bg-rose-500 border-rose-500"
                            : "border-slate-500"
                        }`}
                      >
                        {selected && <CheckIcon />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium">{cat.label}</span>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {cat.keywords.join(", ")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keywords de escalamiento personalizados */}
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Keywords personalizados
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEscalationKeyword}
                  onChange={(e) => setNewEscalationKeyword(e.target.value)}
                  onKeyDown={handleEscalationKeywordKeyDown}
                  placeholder="Ej: urgente, cancelar todo..."
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={addEscalationKeyword}
                  className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {(formData.escalationTriggerKeywords ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(formData.escalationTriggerKeywords ?? []).map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-900/20 text-rose-300 border border-rose-800/50"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeEscalationKeyword(kw)}
                        className="hover:text-rose-100 transition-colors"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Existing escalation rules */}
            {(formData.escalationTriggerRules ?? []).length > 0 && (
              <div className="space-y-2">
                {(formData.escalationTriggerRules ?? []).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm border bg-rose-900/20 text-rose-300 border-rose-800/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-rose-800/50 shrink-0">
                        {rule.type === "intent" ? "Intent" : "Confianza"}
                      </span>
                      <span className="truncate">{rule.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEscalationRule(rule.id)}
                      className="shrink-0 p-1 rounded text-rose-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add escalation rule form */}
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
              <p className="text-xs text-slate-400">Agregar regla</p>
              <div className="flex gap-2">
                <select
                  value={newEscalationRule.type}
                  onChange={(e) =>
                    setNewEscalationRule((prev) => ({
                      ...prev,
                      type: e.target.value as "intent" | "confidence",
                      intentName: "",
                      confidenceThreshold: 0.5,
                    }))
                  }
                  className={`${selectClasses} flex-1`}
                >
                  <option value="intent">Por intent</option>
                  <option value="confidence">Por confianza</option>
                </select>
                {newEscalationRule.type === "intent" ? (
                  <select
                    value={newEscalationRule.intentName}
                    onChange={(e) =>
                      setNewEscalationRule((prev) => ({
                        ...prev,
                        intentName: e.target.value,
                      }))
                    }
                    className={`${selectClasses} flex-1`}
                  >
                    <option value="">Intent...</option>
                    {INTENT_KEYWORDS.map((ik) => (
                      <option key={ik.intent} value={ik.intent}>
                        {ik.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-slate-400 shrink-0">{"<"}</span>
                    <input
                      type="number"
                      value={newEscalationRule.confidenceThreshold || ""}
                      onChange={(e) =>
                        setNewEscalationRule((prev) => ({
                          ...prev,
                          confidenceThreshold: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0.5"
                      className={`${inputClasses} w-20`}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <span className="text-xs text-slate-400 shrink-0">
                      ({((newEscalationRule.confidenceThreshold || 0) * 100).toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
              <input
                type="text"
                value={newEscalationRule.description}
                onChange={(e) =>
                  setNewEscalationRule((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Descripción (opcional)"
                className={inputClasses}
              />
              <button
                type="button"
                onClick={addEscalationRule}
                disabled={
                  (newEscalationRule.type === "intent" && !newEscalationRule.intentName) ||
                  (newEscalationRule.type === "confidence" && newEscalationRule.confidenceThreshold <= 0)
                }
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-rose-800/50 text-rose-300 hover:text-rose-200 hover:border-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-3.5" />
                Agregar
              </button>
            </div>

            {/* Escalation action (read-only, determinado por modo) */}
            {((formData.escalationTriggerCategories ?? []).length > 0 ||
              (formData.escalationTriggerKeywords ?? []).length > 0 ||
              (formData.escalationTriggerRules ?? []).length > 0) && (
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Lock className="size-3" />
                  Acción ante trigger (determinado por modo)
                </p>
                <div className="flex gap-2 pointer-events-none opacity-60">
                  {ESCALATION_ACTIONS.map((action) => (
                    <div
                      key={action.value}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border text-center ${
                        resolveEnforcementActions(formData.enforcementMode).escalationTriggerAction === action.value
                          ? "bg-rose-900/30 text-rose-300 border-rose-800/50"
                          : "bg-slate-800/50 text-slate-400 border-slate-600"
                      }`}
                      title={action.description}
                    >
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Score de Riesgo */}
          <div className="space-y-3 rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="size-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-cyan-300">
                Score de Riesgo
              </h3>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">
                Umbral de riesgo (0 = deshabilitado)
              </p>
              <input
                type="number"
                min={0}
                max={100}
                value={formData.riskScoreThreshold}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setFormData((prev) => ({ ...prev, riskScoreThreshold: val }));
                }}
                className={inputClasses}
                placeholder="0"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Cuando el score acumulado alcance este valor, se ejecutará la acción configurada.
              </p>
            </div>

            {formData.riskScoreThreshold > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Lock className="size-3" />
                  Acción al superar umbral (determinado por modo)
                </p>
                <div className="flex gap-2 pointer-events-none opacity-60">
                  {RISK_SCORE_ACTIONS.map((action) => (
                    <div
                      key={action.value}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border text-center ${
                        resolveEnforcementActions(formData.enforcementMode).riskScoreAction === action.value
                          ? "bg-cyan-900/30 text-cyan-300 border-cyan-800/50"
                          : "bg-slate-800/50 text-slate-400 border-slate-600"
                      }`}
                      title={action.description}
                    >
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Moderación de contenido (Input Classification) */}
          <div className="space-y-3 rounded-xl border border-orange-800/40 bg-orange-950/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="size-4 text-orange-400" />
              <h3 className="text-sm font-semibold text-orange-300">
                Moderación de contenido
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 -mt-1">
              Analiza mensajes del usuario ANTES de entrar al motor para detectar contenido sensible.
            </p>

            {/* Classification categories */}
            <div>
              <p className="text-xs text-slate-400 mb-2">Categorías a detectar</p>
              <div className="space-y-1.5">
                {INPUT_CLASSIFICATION_CATEGORIES.map((cat) => {
                  const selected = (formData.inputClassificationCategories ?? []).includes(cat.value as InputClassificationCategory);
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => {
                          const current = prev.inputClassificationCategories ?? [];
                          const has = current.includes(cat.value as InputClassificationCategory);
                          return {
                            ...prev,
                            inputClassificationCategories: has
                              ? current.filter((c) => c !== cat.value)
                              : [...current, cat.value as InputClassificationCategory],
                          };
                        });
                      }}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        selected
                          ? "bg-orange-900/30 text-orange-300 border border-orange-800/50"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center size-4 rounded border ${
                          selected
                            ? "bg-orange-500 border-orange-500"
                            : "border-slate-500"
                        }`}
                      >
                        {selected && <CheckIcon />}
                      </span>
                      <span className="flex-1">{cat.label}</span>
                      <span className="text-[10px] text-slate-500">
                        {cat.keywords.length} palabras
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Classification custom keywords */}
            <div>
              <p className="text-xs text-slate-400 mb-2">Palabras clave adicionales</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClassificationKeyword}
                  onChange={(e) => setNewClassificationKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const kw = newClassificationKeyword.trim();
                      if (kw && !(formData.inputClassificationKeywords ?? []).includes(kw)) {
                        setFormData((prev) => ({
                          ...prev,
                          inputClassificationKeywords: [...(prev.inputClassificationKeywords ?? []), kw],
                        }));
                        setNewClassificationKeyword("");
                      }
                    }
                  }}
                  className={inputClasses}
                  placeholder="Agregar palabra clave..."
                />
                <button
                  type="button"
                  onClick={() => {
                    const kw = newClassificationKeyword.trim();
                    if (kw && !(formData.inputClassificationKeywords ?? []).includes(kw)) {
                      setFormData((prev) => ({
                        ...prev,
                        inputClassificationKeywords: [...(prev.inputClassificationKeywords ?? []), kw],
                      }));
                      setNewClassificationKeyword("");
                    }
                  }}
                  className="shrink-0 p-2.5 rounded-lg bg-orange-900/30 text-orange-400 hover:bg-orange-900/50 transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {(formData.inputClassificationKeywords ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.inputClassificationKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-900/20 text-orange-300 border border-orange-800/50"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            inputClassificationKeywords: prev.inputClassificationKeywords.filter((_, j) => j !== i),
                          }))
                        }
                        className="ml-0.5 hover:text-orange-100"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Classification action (read-only, driven by enforcement mode) */}
            {((formData.inputClassificationCategories ?? []).length > 0 || (formData.inputClassificationKeywords ?? []).length > 0) && (
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Lock className="size-3" />
                  Acción al detectar contenido (determinado por modo)
                </p>
                <div className="flex gap-2 pointer-events-none opacity-60">
                  {CLASSIFICATION_ACTIONS.map((action) => (
                    <div
                      key={action.value}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border text-center ${
                        resolveEnforcementActions(formData.enforcementMode).inputClassificationAction === action.value
                          ? "bg-orange-900/30 text-orange-300 border-orange-800/50"
                          : "bg-slate-800/50 text-slate-400 border-slate-600"
                      }`}
                      title={action.description}
                    >
                      {action.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Estado (solo en edición) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">
                Estado
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, active: true }))
                  }
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    formData.active
                      ? "bg-green-900/30 text-green-400 border-green-800/50"
                      : "bg-slate-800/50 text-slate-400 border-slate-600 hover:border-slate-500"
                  }`}
                >
                  Activa
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, active: false }))
                  }
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    !formData.active
                      ? "bg-red-900/30 text-red-400 border-red-800/50"
                      : "bg-slate-800/50 text-slate-400 border-slate-600 hover:border-slate-500"
                  }`}
                >
                  Inactiva
                </button>
              </div>
            </div>
          )}
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
            {isEditing ? "Guardar Cambios" : "Crear Política"}
          </button>
        </div>
      </div>
    </div>
  );
}
