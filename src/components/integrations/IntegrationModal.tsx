"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Plug,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Check,
  AlertTriangle,
  Webhook,
  Copy,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { Integration, IntegrationFormData, IntegrationType, Capability, FieldType, FreiaField } from "@/types/integration";
import {
  CREDENTIAL_SCHEMAS,
  EMPTY_INTEGRATION_FORM,
  INTEGRATION_TYPES,
  DEFAULT_CAPABILITIES_BY_TYPE,
  FREIA_FIELDS,
  FREIA_FIELD_NAMESPACES,
  EXTERNAL_FIELDS,
  FIELD_TYPE_LABELS,
  areFieldTypesCompatible,
  getWebhookUrl,
} from "@/types/integration";
import { CAPABILITY_LABELS } from "@/types/tool-registry";
import { decryptCredential } from "@/lib/crypto-utils";

function generateWebhookSecret(): string {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  return "whsec_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getMappingTypeInfo(
  internalField: string,
  externalField: string,
  integrationType: IntegrationType
): { freiaType?: FieldType; externalType?: FieldType; compatible: boolean } {
  const freiaFieldDef = FREIA_FIELDS.find((f) => f.key === internalField);
  const externalDefs = EXTERNAL_FIELDS[integrationType];
  const externalFieldDef = externalDefs.find((f) => f.key === externalField);
  if (!freiaFieldDef || !externalFieldDef) return { compatible: true };
  return {
    freiaType: freiaFieldDef.type,
    externalType: externalFieldDef.type,
    compatible: areFieldTypesCompatible(freiaFieldDef.type, externalFieldDef.type),
  };
}

interface IntegrationModalProps {
  editingIntegration: Integration | null;
  onClose: () => void;
  onSave: (data: IntegrationFormData) => void;
}

type TestState = "idle" | "testing" | "success" | "error";

const labelClasses = "block text-xs font-medium text-slate-300 mb-1";
const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-colors";

export default function IntegrationModal({
  editingIntegration,
  onClose,
  onSave,
}: IntegrationModalProps) {
  const isEditing = !!editingIntegration;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<IntegrationFormData>(EMPTY_INTEGRATION_FORM);
  const [decrypting, setDecrypting] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const incompatibleCount = useMemo(
    () =>
      form.fieldMappings.filter((m) => {
        const info = getMappingTypeInfo(m.internalField, m.externalField, form.type);
        return !info.compatible;
      }).length,
    [form.fieldMappings, form.type]
  );

  // On open: populate form (decrypting credentials if editing)
  useEffect(() => {
    if (editingIntegration) {
      setDecrypting(true);
      Promise.all(
        editingIntegration.credentials.map(async (c) => ({
          ...c,
          value: await decryptCredential(c.value),
        }))
      ).then((decrypted) => {
        setForm({
          name: editingIntegration.name,
          description: editingIntegration.description,
          type: editingIntegration.type,
          baseEndpoint: editingIntegration.baseEndpoint,
          credentials: decrypted,
          fieldMappings: editingIntegration.fieldMappings,
          active: editingIntegration.active,
          supportedCapabilities: editingIntegration.supportedCapabilities ?? [],
          webhookEnabled: editingIntegration.webhookEnabled ?? false,
          webhookSecret: editingIntegration.webhookSecret ?? "",
          retryEnabled: editingIntegration.retryEnabled ?? false,
          maxRetries: editingIntegration.maxRetries ?? 3,
          retryDelayMs: editingIntegration.retryDelayMs ?? 30000,
        });
        setDecrypting(false);
      });
    } else {
      setForm(EMPTY_INTEGRATION_FORM);
    }
    scrollRef.current?.scrollTo(0, 0);
    setTestState("idle");
    setTestMessage("");
    setVisibleSecrets(new Set());
  }, [editingIntegration]);

  // When type changes, rebuild credentials from schema (preserving existing values)
  const handleTypeChange = (type: IntegrationType) => {
    const schema = CREDENTIAL_SCHEMAS[type];
    const newCreds = schema.map((s) => {
      const existing = form.credentials.find((c) => c.key === s.key);
      return { key: s.key, label: s.label, value: existing?.value ?? "" };
    });
    setForm((f) => ({
      ...f,
      type,
      credentials: newCreds,
      supportedCapabilities: DEFAULT_CAPABILITIES_BY_TYPE[type] ?? [],
    }));
  };

  const toggleCapability = (cap: Capability) => {
    setForm((f) => ({
      ...f,
      supportedCapabilities: f.supportedCapabilities.includes(cap)
        ? f.supportedCapabilities.filter((c) => c !== cap)
        : [...f.supportedCapabilities, cap],
    }));
  };

  // Initialize credentials when form type is set (for new integrations)
  useEffect(() => {
    if (!isEditing && form.credentials.length === 0) {
      const schema = CREDENTIAL_SCHEMAS[form.type];
      setForm((f) => ({
        ...f,
        credentials: schema.map((s) => ({ key: s.key, label: s.label, value: "" })),
      }));
    }
  }, [isEditing, form.type, form.credentials.length]);

  const handleCredentialChange = (key: string, value: string) => {
    setForm((f) => ({
      ...f,
      credentials: f.credentials.map((c) => (c.key === key ? { ...c, value } : c)),
    }));
  };

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addFieldMapping = () => {
    setForm((f) => ({
      ...f,
      fieldMappings: [
        ...f.fieldMappings,
        { id: crypto.randomUUID(), externalField: "", internalField: "" },
      ],
    }));
  };

  const updateFieldMapping = (
    id: string,
    field: "externalField" | "internalField",
    value: string
  ) => {
    setForm((f) => ({
      ...f,
      fieldMappings: f.fieldMappings.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    }));
  };

  const removeFieldMapping = (id: string) => {
    setForm((f) => ({
      ...f,
      fieldMappings: f.fieldMappings.filter((m) => m.id !== id),
    }));
  };

  const handleTest = async () => {
    if (!form.baseEndpoint) {
      setTestState("error");
      setTestMessage("Ingresá una URL base antes de probar");
      return;
    }
    setTestState("testing");
    setTestMessage("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(form.baseEndpoint, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setTestState("success");
      setTestMessage(`Conexión exitosa (HTTP ${res.status})`);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        setTestState("error");
        setTestMessage("Timeout — el endpoint no respondió en 5s");
      } else {
        setTestState("error");
        setTestMessage("No se pudo conectar (CORS o red no alcanzable)");
      }
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  const credentialSchema = CREDENTIAL_SCHEMAS[form.type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Plug className="size-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {isEditing ? "Editar integración" : "Nueva integración"}
            </h2>
            <p className="text-xs text-slate-400">
              {isEditing ? editingIntegration.name : "Conectá con un sistema externo"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {decrypting && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="size-3.5 animate-spin" />
              Descifrando credenciales...
            </div>
          )}

          {/* --- General --- */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              General
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClasses}>Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Mi integración HubSpot"
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Descripción</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Descripción opcional..."
                  className={`${inputClasses} resize-none`}
                />
              </div>
              <div>
                <label className={labelClasses}>Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value as IntegrationType)}
                  className={inputClasses}
                >
                  {(Object.entries(INTEGRATION_TYPES) as [IntegrationType, typeof INTEGRATION_TYPES[IntegrationType]][]).map(
                    ([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-white">Activo</p>
                  <p className="text-xs text-slate-400">Habilitar esta integración</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.active ? "bg-[#dd7430]" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      form.active ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* --- Conexión --- */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Conexión
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClasses}>URL base *</label>
                <input
                  type="url"
                  value={form.baseEndpoint}
                  onChange={(e) => setForm((f) => ({ ...f, baseEndpoint: e.target.value }))}
                  placeholder="https://api.hubapi.com"
                  className={inputClasses}
                  onFocus={() => { setTestState("idle"); setTestMessage(""); }}
                />
              </div>

              {/* Credential fields (dynamic per type) */}
              {credentialSchema.map((schema) => {
                const cred = form.credentials.find((c) => c.key === schema.key);
                const isSecret = schema.isSecret;
                const isVisible = visibleSecrets.has(schema.key);

                return (
                  <div key={schema.key}>
                    <label className={labelClasses}>
                      {schema.label}
                      {isSecret && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-purple-400">
                          <span>•</span> cifrado
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={isSecret && !isVisible ? "password" : "text"}
                        value={cred?.value ?? ""}
                        onChange={(e) => handleCredentialChange(schema.key, e.target.value)}
                        placeholder={schema.placeholder}
                        className={`${inputClasses} ${isSecret ? "pr-10" : ""}`}
                        autoComplete="off"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => toggleSecretVisibility(schema.key)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                          tabIndex={-1}
                        >
                          {isVisible ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* --- Test Connection --- */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Test de conexión
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTest}
                disabled={testState === "testing"}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {testState === "testing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plug className="size-4" />
                )}
                {testState === "testing" ? "Probando..." : "Test Connection"}
              </button>

              {testState === "success" && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle className="size-4" />
                  {testMessage}
                </span>
              )}
              {testState === "error" && (
                <span className="flex items-center gap-1.5 text-sm text-red-400">
                  <XCircle className="size-4" />
                  {testMessage}
                </span>
              )}
            </div>
            {testState === "error" && testMessage.includes("CORS") && (
              <p className="mt-2 text-xs text-slate-500">
                Si el endpoint existe pero responde con CORS, la conexión puede funcionar
                correctamente en producción.
              </p>
            )}
          </section>

          {/* --- Capabilities --- */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Capabilities
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Declarar qué operaciones abstractas soporta esta integración
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(CAPABILITY_LABELS) as [Capability, (typeof CAPABILITY_LABELS)[Capability]][]).map(
                ([cap, meta]) => {
                  const isChecked = form.supportedCapabilities.includes(cap);
                  return (
                    <label
                      key={cap}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? "border-purple-500/30 bg-purple-500/5"
                          : "border-slate-700/50 bg-slate-800/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCapability(cap)}
                        className="sr-only"
                      />
                      <div
                        className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? "bg-purple-500 border-purple-500"
                            : "border-slate-600 bg-transparent"
                        }`}
                      >
                        {isChecked && <Check className="size-2.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium ${meta.color}`}>{meta.label}</p>
                        <p className="text-[10px] text-slate-500 truncate">{meta.description}</p>
                      </div>
                    </label>
                  );
                }
              )}
            </div>
          </section>

          {/* --- Field Mapping --- */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Mapeo de campos ({form.fieldMappings.length})
              </p>
              <button
                type="button"
                onClick={addFieldMapping}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 border border-slate-600 transition-colors"
              >
                <Plus className="size-3" />
                Agregar
              </button>
            </div>

            {/* Column headers */}
            {form.fieldMappings.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <p className="flex-1 text-[10px] text-slate-500 font-medium">Campo Freia</p>
                <div className="size-4 shrink-0" />
                <p className="flex-1 text-[10px] text-slate-500 font-medium">
                  Campo {form.type === "custom" ? "externo" : INTEGRATION_TYPES[form.type].label}
                </p>
                {incompatibleCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertTriangle className="size-3" />
                    {incompatibleCount} tipo{incompatibleCount > 1 ? "s" : ""} incompatible{incompatibleCount > 1 ? "s" : ""}
                  </span>
                )}
                <div className="size-7 shrink-0" />
              </div>
            )}

            {form.fieldMappings.length === 0 ? (
              <p className="text-xs text-slate-600 py-2">
                Sin mapeos — los datos se transferirán sin transformación
              </p>
            ) : (
              <div className="space-y-3">
                {form.fieldMappings.map((mapping) => {
                  const typeInfo = getMappingTypeInfo(
                    mapping.internalField,
                    mapping.externalField,
                    form.type
                  );
                  // Group Freia fields by namespace
                  const freiaGroups = FREIA_FIELDS.reduce(
                    (acc, f) => {
                      if (!acc[f.namespace]) acc[f.namespace] = [];
                      acc[f.namespace].push(f);
                      return acc;
                    },
                    {} as Record<string, FreiaField[]>
                  );
                  return (
                    <div key={mapping.id} className="flex items-start gap-2">
                      {/* Freia field select */}
                      <div className="flex-1 min-w-0">
                        <select
                          value={mapping.internalField}
                          onChange={(e) =>
                            updateFieldMapping(mapping.id, "internalField", e.target.value)
                          }
                          className={inputClasses}
                        >
                          <option value="">— Campo Freia —</option>
                          {(Object.entries(freiaGroups) as [FreiaField["namespace"], FreiaField[]][]).map(
                            ([ns, fields]) => (
                              <optgroup key={ns} label={FREIA_FIELD_NAMESPACES[ns].label}>
                                {fields.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} · {FIELD_TYPE_LABELS[f.type].label}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          )}
                        </select>
                        {typeInfo.freiaType && (
                          <span
                            className={`text-[10px] mt-0.5 block ${FIELD_TYPE_LABELS[typeInfo.freiaType].color}`}
                          >
                            {FIELD_TYPE_LABELS[typeInfo.freiaType].label}
                          </span>
                        )}
                      </div>

                      <ArrowRight className="size-4 text-slate-500 shrink-0 mt-2" />

                      {/* External field select or free text */}
                      <div className="flex-1 min-w-0">
                        {form.type === "custom" ? (
                          <input
                            type="text"
                            value={mapping.externalField}
                            onChange={(e) =>
                              updateFieldMapping(mapping.id, "externalField", e.target.value)
                            }
                            placeholder="campo.externo"
                            className={inputClasses}
                          />
                        ) : (
                          <select
                            value={mapping.externalField}
                            onChange={(e) =>
                              updateFieldMapping(mapping.id, "externalField", e.target.value)
                            }
                            className={inputClasses}
                          >
                            <option value="">— Campo externo —</option>
                            {EXTERNAL_FIELDS[form.type].map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label} · {FIELD_TYPE_LABELS[f.type].label}
                              </option>
                            ))}
                          </select>
                        )}
                        {typeInfo.externalType && (
                          <span
                            className={`text-[10px] mt-0.5 block ${FIELD_TYPE_LABELS[typeInfo.externalType].color}`}
                          >
                            {FIELD_TYPE_LABELS[typeInfo.externalType].label}
                          </span>
                        )}
                      </div>

                      {/* Incompatibility warning */}
                      {!typeInfo.compatible ? (
                        <AlertTriangle
                          className="size-4 text-amber-400 shrink-0 mt-2"
                          aria-label="Tipos incompatibles"
                        />
                      ) : (
                        <div className="size-4 shrink-0" />
                      )}

                      <button
                        type="button"
                        onClick={() => removeFieldMapping(mapping.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Webhook section */}
          <section className="border-t border-slate-700/50 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Webhook className="size-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-200">Webhook entrante</h3>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, webhookEnabled: !f.webhookEnabled }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.webhookEnabled ? "bg-sky-600" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    form.webhookEnabled ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Webhook URL — only when editing an existing integration */}
            {isEditing && editingIntegration && (
              <div className="mb-3">
                <label className={labelClasses}>URL del webhook</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={getWebhookUrl(editingIntegration.id)}
                    className={`${inputClasses} font-mono text-xs text-sky-300 bg-slate-900/50`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getWebhookUrl(editingIntegration.id));
                      setWebhookCopied(true);
                      setTimeout(() => setWebhookCopied(false), 2000);
                    }}
                    className="px-2.5 py-2 rounded-lg border border-slate-600 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
                  >
                    {webhookCopied ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Configurá esta URL en el sistema externo para recibir eventos
                </p>
              </div>
            )}

            {!isEditing && (
              <p className="text-[11px] text-slate-500 mb-3">
                La URL del webhook estará disponible después de crear la integración.
              </p>
            )}

            {/* Secret field — only when webhook is enabled */}
            {form.webhookEnabled && (
              <div>
                <label className={labelClasses}>Secreto de firma (HMAC-SHA256)</label>
                <div className="flex gap-2">
                  <input
                    type={showWebhookSecret ? "text" : "password"}
                    value={form.webhookSecret ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
                    placeholder="whsec_..."
                    className={`${inputClasses} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret((v) => !v)}
                    className="px-2.5 py-2 rounded-lg border border-slate-600 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
                  >
                    {showWebhookSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, webhookSecret: generateWebhookSecret() }))}
                    title="Generar secreto"
                    className="px-2.5 py-2 rounded-lg border border-slate-600 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Se usa para verificar la autenticidad de los payloads entrantes
                </p>
              </div>
            )}
          </section>

          {/* Resiliencia section */}
          <section className="border-t border-slate-700/50 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">Retry automático</h3>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, retryEnabled: !f.retryEnabled }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.retryEnabled ? "bg-amber-600" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    form.retryEnabled ? "translate-x-4.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {form.retryEnabled && (
              <div className="space-y-3">
                <div>
                  <label className={labelClasses}>Máximo de reintentos</label>
                  <select
                    value={form.maxRetries ?? 3}
                    onChange={(e) => setForm((f) => ({ ...f, maxRetries: Number(e.target.value) }))}
                    className={inputClasses}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} intento{n > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>Intervalo base entre reintentos</label>
                  <select
                    value={form.retryDelayMs ?? 30000}
                    onChange={(e) => setForm((f) => ({ ...f, retryDelayMs: Number(e.target.value) }))}
                    className={inputClasses}
                  >
                    <option value={5000}>5 segundos</option>
                    <option value={30000}>30 segundos</option>
                    <option value={60000}>1 minuto</option>
                    <option value={300000}>5 minutos</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Backoff exponencial: cada reintento duplica el intervalo
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-[#dd7430] text-white hover:bg-[#c4652a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? "Guardar cambios" : "Crear integración"}
          </button>
        </div>
      </div>
    </div>
  );
}
