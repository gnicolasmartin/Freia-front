"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  MessageCircle,
  Instagram,
  Facebook,
  Mail,
  CheckCircle2,
  XCircle,
  WifiOff,
  Wifi,
  AlertTriangle,
  Link2,
  Unlink,
  X,
  Loader2,
  Eye,
  EyeOff,
  ShieldAlert,
  FlaskConical,
  Pencil,
  Hash,
  KeyRound,
  Webhook,
  Building2,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  Activity,
  FileText,
  Plus,
  Trash2,
  Tag,
  Clock,
  Phone,
  RefreshCw,
  ShieldCheck,
  Palette,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Send,
  AlertCircle,
} from "lucide-react";
import { useChannels } from "@/providers/ChannelsProvider";
import { useWhatsAppTemplates } from "@/providers/WhatsAppTemplatesProvider";
import { useWhatsAppOptIn } from "@/providers/WhatsAppOptInProvider";
import { useWhatsAppIdentity } from "@/providers/WhatsAppIdentityProvider";
import {
  getWindowStatus,
  formatWindowTime,
} from "@/lib/conversation-window";
import {
  autoCreatePendingIfNeeded,
  getOptInStatus,
} from "@/lib/whatsapp-optin";
import type {
  WhatsAppTemplate,
  TemplateUseCase,
  TemplateCategory,
  TemplateVariable,
} from "@/types/whatsapp-template";
import type { OptInRecord, OptInStatus } from "@/types/whatsapp-optin";
import type { MessageTone, DefaultLanguage } from "@/types/whatsapp-identity";
import { CHANNEL_SCOPES } from "@/types/agent";
import type { ChannelScope, Agent } from "@/types/agent";
import { CHANNEL_META } from "@/types/channel";
import type { ChannelConfig } from "@/types/channel";
import { useAgents } from "@/providers/AgentsProvider";
import { useBusinessHours } from "@/providers/BusinessHoursProvider";
import { useRouting } from "@/providers/RoutingProvider";
import {
  resolveRoute,
  CONDITION_TYPE_LABELS,
  OPERATOR_LABELS,
  TEXT_OPERATORS,
  HOURS_OPERATORS,
} from "@/lib/whatsapp-router";
import type {
  RoutingRule,
  RoutingCondition,
  RoutingConditionType,
  RoutingOperator,
  RoutingReasonCode,
  RoutingDecision,
  InboundMessageContext,
} from "@/types/routing";
import {
  useWhatsAppMessages,
  type OutboundMessage,
} from "@/providers/WhatsAppMessagesProvider";
import { getErrorSuggestion } from "@/lib/whatsapp-errors";
import { addWhatsAppAuditEntry } from "@/lib/whatsapp-audit";

// --- Icons per channel ---
const CHANNEL_ICONS: Record<ChannelScope, React.ReactNode> = {
  web: <Globe className="size-5" />,
  whatsapp: <MessageCircle className="size-5" />,
  instagram: <Instagram className="size-5" />,
  facebook: <Facebook className="size-5" />,
  email: <Mail className="size-5" />,
};

// ─── WhatsApp Business Platform credential form ────────────────────────────

type TestStatus = "idle" | "testing" | "success" | "error";

interface WAFields {
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  verify_token: string;
}

interface WhatsAppConnectFormProps {
  initialValues?: WAFields;
  onConnect: (metadata: Record<string, string>) => void;
  onCancel: () => void;
}

function WhatsAppConnectForm({
  initialValues,
  onConnect,
  onCancel,
}: WhatsAppConnectFormProps) {
  const [fields, setFields] = useState<WAFields>({
    phone_number_id: initialValues?.phone_number_id ?? "",
    waba_id: initialValues?.waba_id ?? "",
    access_token: initialValues?.access_token ?? "",
    verify_token: initialValues?.verify_token ?? "",
  });
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const allFilled = Object.values(fields).every((v) => v.trim().length > 0);

  const setField = (k: keyof WAFields, v: string) => {
    setFields((prev) => ({ ...prev, [k]: v }));
    // Reset test result when user edits
    if (testStatus !== "idle") {
      setTestStatus("idle");
      setTestMessage("");
    }
  };

  const handleTest = () => {
    if (!allFilled) return;
    setTestStatus("testing");
    setTestMessage("");

    // Simulate API call to graph.facebook.com/v18.0/{phone_number_id}
    setTimeout(() => {
      const id = fields.phone_number_id.trim();
      if (!/^\d{10,}$/.test(id)) {
        setTestStatus("error");
        setTestMessage(
          "Phone Number ID inválido — debe ser un identificador numérico de 10 o más dígitos (ej: 12345678901234)."
        );
        return;
      }
      if (!fields.waba_id.trim()) {
        setTestStatus("error");
        setTestMessage("WABA ID requerido.");
        return;
      }
      // Simulate successful verification
      setTestStatus("success");
      setTestMessage(
        `Número verificado · ID ${id} accesible vía WhatsApp Cloud API`
      );
      // Auto-connect after brief feedback delay
      setTimeout(() => {
        onConnect({ ...fields });
      }, 900);
    }, 1800);
  };

  const inputBase =
    "w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors";
  const inputNormal = `${inputBase} border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30`;

  return (
    <div className="space-y-4 pt-3 border-t border-slate-700">
      <p className="text-xs text-slate-400">
        Ingresa las credenciales de tu cuenta{" "}
        <strong className="text-slate-300">WhatsApp Business Platform</strong>{" "}
        (Meta Cloud API).
      </p>

      {/* phone_number_id */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
          <Hash className="size-3 text-slate-600" />
          Phone Number ID
          <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={fields.phone_number_id}
          onChange={(e) => setField("phone_number_id", e.target.value)}
          placeholder="ej: 12345678901234"
          className={inputNormal}
        />
        <p className="text-[10px] text-slate-600 mt-1">
          ID numérico del número registrado en Meta Business Manager.
        </p>
      </div>

      {/* waba_id */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
          <Building2 className="size-3 text-slate-600" />
          WABA ID (WhatsApp Business Account)
          <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={fields.waba_id}
          onChange={(e) => setField("waba_id", e.target.value)}
          placeholder="ej: 987654321098765"
          className={inputNormal}
        />
        <p className="text-[10px] text-slate-600 mt-1">
          ID de tu cuenta de WhatsApp Business en Meta.
        </p>
      </div>

      {/* access_token */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
          <KeyRound className="size-3 text-slate-600" />
          Access Token
          <span className="text-red-400">*</span>
          <span className="ml-1 text-[10px] text-slate-600 font-normal normal-case tracking-normal">
            (permanente o de sistema)
          </span>
        </label>
        <div className="relative">
          <input
            type={showAccessToken ? "text" : "password"}
            value={fields.access_token}
            onChange={(e) => setField("access_token", e.target.value)}
            placeholder="EAAxxxxxxxxxxxxxxx..."
            className={`${inputNormal} pr-9`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowAccessToken((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            tabIndex={-1}
          >
            {showAccessToken ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* verify_token */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
          <Webhook className="size-3 text-slate-600" />
          Verify Token (webhook)
          <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type={showVerifyToken ? "text" : "password"}
            value={fields.verify_token}
            onChange={(e) => setField("verify_token", e.target.value)}
            placeholder="token-secreto-webhook"
            className={`${inputNormal} pr-9`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowVerifyToken((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
            tabIndex={-1}
          >
            {showVerifyToken ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1">
          Token que Meta envía al verificar tu webhook.
        </p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5">
        <ShieldAlert className="size-3.5 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Nota de seguridad:</strong> En
          producción, los tokens deben almacenarse en un secret manager (AWS
          Secrets Manager, HashiCorp Vault, etc.) y nunca exponerse en cliente.
          Este entorno los guarda localmente de forma simulada.
        </p>
      </div>

      {/* Test result feedback */}
      {testStatus === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800/40 bg-red-900/10 px-3 py-2 text-xs text-red-400">
          <XCircle className="size-3.5 shrink-0 mt-0.5" />
          {testMessage}
        </div>
      )}
      {testStatus === "success" && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800/40 bg-emerald-900/10 px-3 py-2 text-xs text-emerald-400">
          <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
          {testMessage} — conectando…
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={!allFilled || testStatus === "testing" || testStatus === "success"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testStatus === "testing" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : testStatus === "success" ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <FlaskConical className="size-3.5" />
          )}
          {testStatus === "testing"
            ? "Verificando…"
            : testStatus === "success"
            ? "Verificado"
            : "Test Connection"}
        </button>
        <button
          onClick={onCancel}
          disabled={testStatus === "testing" || testStatus === "success"}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Meta OAuth form (Instagram / Facebook) ────────────────────────────────

interface ConnectFormProps {
  channel: ChannelScope;
  onConnect: (metadata: Record<string, string>) => void;
  onCancel: () => void;
}

function MetaConnectForm({ channel, onConnect, onCancel }: ConnectFormProps) {
  const [connecting, setConnecting] = useState(false);
  const meta = CHANNEL_META[channel];
  const label = channel === "instagram" ? "Instagram" : "Facebook";
  const accentClass =
    channel === "instagram"
      ? "bg-pink-600 hover:bg-pink-500"
      : "bg-blue-600 hover:bg-blue-500";

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      onConnect({ accountName: `Mi cuenta de ${label}` });
    }, 1800);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-700">
      <p className="text-xs text-slate-400">{meta.connectDescription}</p>
      <div className="flex gap-2">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${accentClass}`}
        >
          {connecting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Link2 className="size-3.5" />
          )}
          {connecting ? "Autorizando…" : `Conectar con ${label}`}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── WhatsApp webhook configuration panel ──────────────────────────────────

interface WebhookStatus {
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  queueDepth: number;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      title="Copiar"
    >
      {copied ? (
        <Check className="size-3 text-emerald-400" />
      ) : (
        <Copy className="size-3" />
      )}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function WhatsAppWebhookPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const webhookUrl = "/api/webhooks/whatsapp";

  // Fetch env-var status when panel opens
  useEffect(() => {
    if (!open || status) return;
    setLoadingStatus(true);
    fetch("/api/webhooks/whatsapp/status")
      .then((r) => r.json())
      .then((data: WebhookStatus) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));
  }, [open, status]);

  const EnvRow = ({
    name,
    configured,
  }: {
    name: string;
    configured: boolean;
  }) => (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-slate-400">{name}</span>
      <span
        className={`flex items-center gap-1 ${
          configured ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {configured ? (
          <>
            <CheckCircle2 className="size-3" /> Configurado
          </>
        ) : (
          <>
            <AlertTriangle className="size-3" /> No configurado
          </>
        )}
      </span>
    </div>
  );

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Webhook className="size-3.5 text-emerald-500" />
          Configuración del Webhook
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700">
          {/* Webhook URL */}
          <div className="pt-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
              URL del Webhook (configurar en Meta Business Manager)
            </p>
            <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
              <span className="font-mono text-xs text-slate-300 flex-1 truncate">
                {webhookUrl}
              </span>
              <CopyButton value={webhookUrl} />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              Subscribed fields:{" "}
              <span className="font-mono">messages</span>
            </p>
          </div>

          {/* Env var status */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
              Variables de entorno del servidor
            </p>
            <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 space-y-2">
              {loadingStatus ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" />
                  Verificando…
                </div>
              ) : status ? (
                <>
                  <EnvRow
                    name="WHATSAPP_VERIFY_TOKEN"
                    configured={status.verifyTokenConfigured}
                  />
                  <EnvRow
                    name="WHATSAPP_APP_SECRET"
                    configured={status.appSecretConfigured}
                  />
                  {status.queueDepth > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-sky-400 pt-1 border-t border-slate-700/60">
                      <Activity className="size-3" />
                      {status.queueDepth} evento
                      {status.queueDepth !== 1 ? "s" : ""} en cola
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-600">
                  No se pudo verificar el estado del servidor.
                </span>
              )}
            </div>
            {status && (!status.verifyTokenConfigured || !status.appSecretConfigured) && (
              <p className="text-[10px] text-amber-500 mt-1.5 flex items-start gap-1">
                <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                Configura las variables en{" "}
                <span className="font-mono">.env.local</span>. Ver{" "}
                <span className="font-mono">.env.local.example</span> para
                referencia.
              </p>
            )}
          </div>

          {/* Quick guide */}
          <div className="rounded-md border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 space-y-1.5 text-[10px] text-slate-500">
            <p className="font-medium text-slate-400 text-xs">
              Pasos para activar el webhook en Meta:
            </p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>
                Ve a{" "}
                <span className="text-slate-400">
                  Meta for Developers → WhatsApp → Configuration
                </span>
              </li>
              <li>
                En <em>Webhook</em>, ingresa la URL y el{" "}
                <span className="font-mono">Verify Token</span>
              </li>
              <li>
                Asegúrate de que{" "}
                <span className="font-mono">WHATSAPP_VERIFY_TOKEN</span> en el
                servidor coincida exactamente
              </li>
              <li>
                Suscribe el campo{" "}
                <span className="font-mono">messages</span>
              </li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sky-500 hover:text-sky-400 transition-colors mt-1"
            >
              Documentación oficial
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp Templates Panel ───────────────────────────────────────────────

type TemplatesPanelTab = "templates" | "usecases" | "windows";

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  AUTHENTICATION: "Autenticación",
};
const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  MARKETING: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  UTILITY: "bg-sky-900/40 text-sky-400 border-sky-700/50",
  AUTHENTICATION: "bg-violet-900/40 text-violet-400 border-violet-700/50",
};

const LANGUAGES = [
  { code: "es", label: "Español (es)" },
  { code: "en_US", label: "English (en_US)" },
  { code: "pt_BR", label: "Português (pt_BR)" },
];

function extractVariableIndexes(text: string): number[] {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  return [...new Set(matches.map((m) => parseInt(m[1], 10)))].sort(
    (a, b) => a - b
  );
}

function renderPreview(bodyText: string, variables: TemplateVariable[]): string {
  let preview = bodyText;
  for (const v of variables) {
    const placeholder = v.example
      ? v.example
      : `[${v.label || `Variable ${v.index}`}]`;
    preview = preview.replace(
      new RegExp(`\\{\\{${v.index}\\}\\}`, "g"),
      placeholder
    );
  }
  return preview;
}

const EMPTY_TEMPLATE_FORM = {
  name: "",
  language: "es",
  category: "MARKETING" as TemplateCategory,
  headerText: "",
  bodyText: "",
  footerText: "",
  variables: [] as TemplateVariable[],
};

const EMPTY_USE_CASE_FORM = {
  name: "",
  description: "",
  templateId: "",
};

function WhatsAppTemplatesPanel() {
  const {
    templates,
    useCases,
    contactWindows,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addUseCase,
    updateUseCase,
    deleteUseCase,
    recordUserMessage,
    addContact,
  } = useWhatsAppTemplates();
  const { policy: optInPolicy, setOptInStatus } = useWhatsAppOptIn();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TemplatesPanelTab>("templates");

  // ── Template form state ────────────────────────────────────────────────────
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);

  function openNewTemplateForm() {
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setEditingTemplateId(null);
    setShowTemplateForm(true);
  }

  function openEditTemplateForm(t: WhatsAppTemplate) {
    setTemplateForm({
      name: t.name,
      language: t.language,
      category: t.category,
      headerText: t.headerText ?? "",
      bodyText: t.bodyText,
      footerText: t.footerText ?? "",
      variables: t.variables,
    });
    setEditingTemplateId(t.id);
    setShowTemplateForm(true);
  }

  function handleBodyTextChange(text: string) {
    const indexes = extractVariableIndexes(text);
    const newVars: TemplateVariable[] = indexes.map((idx) => ({
      index: idx,
      label:
        templateForm.variables.find((v) => v.index === idx)?.label ??
        `Variable ${idx}`,
      example:
        templateForm.variables.find((v) => v.index === idx)?.example ?? "",
    }));
    setTemplateForm((prev) => ({ ...prev, bodyText: text, variables: newVars }));
  }

  function handleSaveTemplate() {
    if (!templateForm.name.trim() || !templateForm.bodyText.trim()) return;
    const data = {
      name: templateForm.name.trim(),
      language: templateForm.language,
      category: templateForm.category,
      headerText: templateForm.headerText.trim() || undefined,
      bodyText: templateForm.bodyText,
      footerText: templateForm.footerText.trim() || undefined,
      variables: templateForm.variables,
    };
    if (editingTemplateId) {
      updateTemplate(editingTemplateId, data);
    } else {
      addTemplate(data);
    }
    setShowTemplateForm(false);
    setEditingTemplateId(null);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
  }

  // ── Use case form state ────────────────────────────────────────────────────
  const [showUseCaseForm, setShowUseCaseForm] = useState(false);
  const [editingUseCaseId, setEditingUseCaseId] = useState<string | null>(null);
  const [useCaseForm, setUseCaseForm] = useState(EMPTY_USE_CASE_FORM);

  function openNewUseCaseForm() {
    setUseCaseForm(EMPTY_USE_CASE_FORM);
    setEditingUseCaseId(null);
    setShowUseCaseForm(true);
  }

  function openEditUseCaseForm(uc: TemplateUseCase) {
    setUseCaseForm({
      name: uc.name,
      description: uc.description ?? "",
      templateId: uc.templateId,
    });
    setEditingUseCaseId(uc.id);
    setShowUseCaseForm(true);
  }

  function handleSaveUseCase() {
    if (!useCaseForm.name.trim() || !useCaseForm.templateId) return;
    const data = {
      name: useCaseForm.name.trim(),
      description: useCaseForm.description.trim() || undefined,
      templateId: useCaseForm.templateId,
    };
    if (editingUseCaseId) {
      updateUseCase(editingUseCaseId, data);
    } else {
      addUseCase(data);
    }
    setShowUseCaseForm(false);
    setEditingUseCaseId(null);
    setUseCaseForm(EMPTY_USE_CASE_FORM);
  }

  // ── Windows state ──────────────────────────────────────────────────────────
  const [newContactPhone, setNewContactPhone] = useState("");

  function handleAddContact() {
    const phone = newContactPhone.trim();
    if (!phone) return;
    addContact(phone);
    setNewContactPhone("");
  }

  // Poll events to auto-update windows when the tab is open
  useEffect(() => {
    if (!open || activeTab !== "windows") return;
    const poll = async () => {
      try {
        const res = await fetch("/api/webhooks/whatsapp/events");
        if (!res.ok) return;
        const data = (await res.json()) as {
          events: Array<{ type: string; from?: string }>;
        };
        for (const ev of data.events ?? []) {
          if (ev.type === "channel.message.received" && ev.from) {
            recordUserMessage(ev.from);
          }
        }
      } catch {
        // ignore network errors
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, [open, activeTab, recordUserMessage]);

  const approvedTemplates = templates.filter((t) => t.status === "approved");

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="size-3.5 text-violet-400" />
          Templates de Mensaje
          {templates.length > 0 && (
            <span className="ml-1 text-[10px] bg-violet-900/40 text-violet-400 border border-violet-700/50 rounded-full px-1.5 py-0">
              {templates.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/60">
            {(
              [
                { id: "templates", label: "Templates", icon: <FileText className="size-3" /> },
                { id: "usecases", label: "Casos de uso", icon: <Tag className="size-3" /> },
                { id: "windows", label: "Ventanas", icon: <Clock className="size-3" /> },
              ] as { id: TemplatesPanelTab; label: string; icon: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-2 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "text-white border-b-2 border-violet-400 -mb-px bg-slate-800/30"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Templates ── */}
          {activeTab === "templates" && (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Templates registrados
                </p>
                {!showTemplateForm && (
                  <button
                    onClick={openNewTemplateForm}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Plus className="size-3" /> Nuevo template
                  </button>
                )}
              </div>

              {/* Template form */}
              {showTemplateForm && (
                <div className="rounded-md border border-violet-700/50 bg-slate-900/60 p-3 space-y-2.5">
                  <p className="text-xs font-medium text-violet-300">
                    {editingTemplateId ? "Editar template" : "Nuevo template"}
                  </p>

                  {/* Name */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Nombre <span className="text-slate-600">(snake_case)</span>
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) =>
                        setTemplateForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="ej. follow_up_lead"
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Language + Category */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">
                        Idioma
                      </label>
                      <select
                        value={templateForm.language}
                        onChange={(e) =>
                          setTemplateForm((p) => ({
                            ...p,
                            language: e.target.value,
                          }))
                        }
                        className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-violet-500"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">
                        Categoría
                      </label>
                      <select
                        value={templateForm.category}
                        onChange={(e) =>
                          setTemplateForm((p) => ({
                            ...p,
                            category: e.target.value as TemplateCategory,
                          }))
                        }
                        className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-violet-500"
                      >
                        {(
                          ["MARKETING", "UTILITY", "AUTHENTICATION"] as TemplateCategory[]
                        ).map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Header (optional) */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Encabezado{" "}
                      <span className="text-slate-600">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={templateForm.headerText}
                      onChange={(e) =>
                        setTemplateForm((p) => ({
                          ...p,
                          headerText: e.target.value,
                        }))
                      }
                      placeholder="Texto del encabezado"
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Cuerpo{" "}
                      <span className="text-slate-600">
                        (usa {"{{1}}"}, {"{{2}}"}, … para variables)
                      </span>
                    </label>
                    <textarea
                      value={templateForm.bodyText}
                      onChange={(e) => handleBodyTextChange(e.target.value)}
                      rows={3}
                      placeholder={`Hola {{1}}, te contactamos sobre tu {{2}}.`}
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none font-mono"
                    />
                  </div>

                  {/* Footer (optional) */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Pie{" "}
                      <span className="text-slate-600">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={templateForm.footerText}
                      onChange={(e) =>
                        setTemplateForm((p) => ({
                          ...p,
                          footerText: e.target.value,
                        }))
                      }
                      placeholder="Texto del pie de mensaje"
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Variables */}
                  {templateForm.variables.length > 0 && (
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1.5">
                        Variables detectadas
                      </label>
                      <div className="space-y-1.5">
                        {templateForm.variables.map((v) => (
                          <div
                            key={v.index}
                            className="flex items-center gap-2"
                          >
                            <span className="font-mono text-[10px] text-violet-400 w-6 shrink-0">
                              {`{{${v.index}}}`}
                            </span>
                            <input
                              type="text"
                              value={v.label}
                              onChange={(e) =>
                                setTemplateForm((p) => ({
                                  ...p,
                                  variables: p.variables.map((vv) =>
                                    vv.index === v.index
                                      ? { ...vv, label: e.target.value }
                                      : vv
                                  ),
                                }))
                              }
                              placeholder="Etiqueta"
                              className="flex-1 rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                            />
                            <input
                              type="text"
                              value={v.example}
                              onChange={(e) =>
                                setTemplateForm((p) => ({
                                  ...p,
                                  variables: p.variables.map((vv) =>
                                    vv.index === v.index
                                      ? { ...vv, example: e.target.value }
                                      : vv
                                  ),
                                }))
                              }
                              placeholder="Ejemplo"
                              className="flex-1 rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {templateForm.bodyText && (
                    <div className="rounded border border-slate-700/60 bg-slate-800/40 p-2.5">
                      <p className="text-[10px] text-slate-600 mb-1.5 uppercase tracking-wide">
                        Vista previa
                      </p>
                      {templateForm.headerText && (
                        <p className="text-xs font-semibold text-slate-300 mb-1">
                          {templateForm.headerText}
                        </p>
                      )}
                      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {renderPreview(
                          templateForm.bodyText,
                          templateForm.variables
                        )}
                      </p>
                      {templateForm.footerText && (
                        <p className="text-[10px] text-slate-500 mt-1 italic">
                          {templateForm.footerText}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Form actions */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setShowTemplateForm(false);
                        setEditingTemplateId(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={
                        !templateForm.name.trim() || !templateForm.bodyText.trim()
                      }
                      className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1 rounded transition-colors"
                    >
                      {editingTemplateId ? "Guardar cambios" : "Crear template"}
                    </button>
                  </div>
                </div>
              )}

              {/* Template list */}
              {templates.length === 0 && !showTemplateForm ? (
                <p className="text-xs text-slate-600 py-2 text-center">
                  No hay templates registrados.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-800/30 px-2.5 py-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-slate-200">
                            {t.name}
                          </span>
                          <span className="text-[9px] text-slate-500 bg-slate-800 border border-slate-700 rounded px-1 py-0">
                            {t.language}
                          </span>
                          <span
                            className={`text-[9px] border rounded px-1 py-0 ${CATEGORY_COLORS[t.category]}`}
                          >
                            {CATEGORY_LABELS[t.category]}
                          </span>
                          {t.status === "approved" ? (
                            <span className="text-[9px] text-emerald-400 bg-emerald-900/30 border border-emerald-700/50 rounded px-1 py-0">
                              Aprobado
                            </span>
                          ) : t.status === "pending" ? (
                            <span className="text-[9px] text-amber-400 bg-amber-900/30 border border-amber-700/50 rounded px-1 py-0 flex items-center gap-0.5">
                              <Loader2 className="size-2 animate-spin" />
                              Pendiente
                            </span>
                          ) : (
                            <span className="text-[9px] text-red-400 bg-red-900/30 border border-red-700/50 rounded px-1 py-0">
                              Rechazado
                            </span>
                          )}
                          {t.variables.length > 0 && (
                            <span className="text-[9px] text-slate-500">
                              {t.variables.length} var
                              {t.variables.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 truncate mt-0.5">
                          {t.bodyText}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditTemplateForm(t)}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          aria-label="Editar template"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          aria-label="Eliminar template"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Casos de uso ── */}
          {activeTab === "usecases" && (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Casos de uso registrados
                </p>
                {!showUseCaseForm && (
                  <button
                    onClick={openNewUseCaseForm}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Plus className="size-3" /> Nuevo caso de uso
                  </button>
                )}
              </div>

              {/* Use case form */}
              {showUseCaseForm && (
                <div className="rounded-md border border-violet-700/50 bg-slate-900/60 p-3 space-y-2.5">
                  <p className="text-xs font-medium text-violet-300">
                    {editingUseCaseId ? "Editar caso de uso" : "Nuevo caso de uso"}
                  </p>

                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={useCaseForm.name}
                      onChange={(e) =>
                        setUseCaseForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="ej. Follow-up de lead"
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Descripción{" "}
                      <span className="text-slate-600">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={useCaseForm.description}
                      onChange={(e) =>
                        setUseCaseForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Cuándo usar este template"
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">
                      Template vinculado
                    </label>
                    <select
                      value={useCaseForm.templateId}
                      onChange={(e) =>
                        setUseCaseForm((p) => ({
                          ...p,
                          templateId: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-violet-500"
                    >
                      <option value="">— Seleccionar template —</option>
                      {approvedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.language})
                        </option>
                      ))}
                    </select>
                    {approvedTemplates.length === 0 && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        No hay templates aprobados. Crea y aprueba un template primero.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setShowUseCaseForm(false);
                        setEditingUseCaseId(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveUseCase}
                      disabled={
                        !useCaseForm.name.trim() || !useCaseForm.templateId
                      }
                      className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1 rounded transition-colors"
                    >
                      {editingUseCaseId ? "Guardar cambios" : "Crear caso de uso"}
                    </button>
                  </div>
                </div>
              )}

              {/* Use case list */}
              {useCases.length === 0 && !showUseCaseForm ? (
                <p className="text-xs text-slate-600 py-2 text-center">
                  No hay casos de uso registrados.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {useCases.map((uc) => {
                    const tmpl = templates.find((t) => t.id === uc.templateId);
                    return (
                      <div
                        key={uc.id}
                        className="flex items-start gap-2 rounded-md border border-slate-700/60 bg-slate-800/30 px-2.5 py-2 text-xs"
                      >
                        <Tag className="size-3 text-slate-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-200 font-medium">
                              {uc.name}
                            </span>
                            {tmpl && (
                              <span className="text-[9px] font-mono text-violet-400 bg-violet-900/30 border border-violet-700/50 rounded px-1">
                                {tmpl.name} / {tmpl.language}
                              </span>
                            )}
                          </div>
                          {uc.description && (
                            <p className="text-slate-500 mt-0.5">
                              {uc.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditUseCaseForm(uc)}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            aria-label="Editar caso de uso"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => deleteUseCase(uc.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            aria-label="Eliminar caso de uso"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Ventanas ── */}
          {activeTab === "windows" && (
            <div className="p-3 space-y-3">
              {/* Info banner */}
              <div className="rounded-md border border-sky-700/40 bg-sky-900/20 px-3 py-2 text-[10px] text-sky-300 leading-relaxed">
                <p className="font-medium text-xs text-sky-200 mb-0.5">
                  Ventana de conversación de 24 horas
                </p>
                Cada vez que un usuario te escribe, se abre una ventana de 24h
                para responder con mensajes libres. Fuera de esa ventana, solo
                puedes iniciar conversaciones con templates aprobados.
              </div>

              {/* Add contact */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">
                  Agregar contacto para seguimiento
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                    placeholder="+5491112345678"
                    className="flex-1 rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 font-mono"
                  />
                  <button
                    onClick={handleAddContact}
                    disabled={!newContactPhone.trim()}
                    className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded transition-colors"
                  >
                    <Plus className="size-3" />
                    Agregar
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/webhooks/whatsapp/events");
                        if (!res.ok) return;
                        const data = (await res.json()) as {
                          events: Array<{ type: string; from?: string }>;
                        };
                        for (const ev of data.events ?? []) {
                          if (
                            ev.type === "channel.message.received" &&
                            ev.from
                          ) {
                            recordUserMessage(ev.from);
                          }
                        }
                      } catch {
                        // ignore
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label="Actualizar ventanas"
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Contact window list */}
              {contactWindows.length === 0 ? (
                <p className="text-xs text-slate-600 py-2 text-center">
                  Los contactos aparecen aquí automáticamente cuando recibes
                  mensajes.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {contactWindows.map((cw) => {
                    const status = getWindowStatus(cw.lastUserMessageAt);
                    return (
                      <div
                        key={cw.phoneNumber}
                        className="flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-800/30 px-2.5 py-2 text-xs"
                      >
                        <Phone className="size-3 text-slate-500 shrink-0" />
                        <span className="font-mono text-slate-300 flex-1">
                          {cw.phoneNumber}
                        </span>

                        {status === "open" ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                            <span className="text-emerald-400">Abierta</span>
                            {cw.lastUserMessageAt && (
                              <span className="text-slate-500 text-[10px]">
                                · {formatWindowTime(cw.lastUserMessageAt)}
                              </span>
                            )}
                          </div>
                        ) : status === "closed" ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="size-1.5 rounded-full bg-red-400 inline-block" />
                            <span className="text-red-400">Cerrada</span>
                            {cw.lastUserMessageAt && (
                              <span className="text-slate-500 text-[10px]">
                                · {formatWindowTime(cw.lastUserMessageAt)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="size-1.5 rounded-full bg-slate-500 inline-block" />
                            <span className="text-slate-500">Sin datos</span>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            recordUserMessage(cw.phoneNumber);
                            // If policy says to auto-create pending opt-in on first inbound,
                            // create a "pending" record if none exists yet.
                            if (optInPolicy.autoCreatePendingOnInbound &&
                                getOptInStatus(cw.phoneNumber) === "none") {
                              autoCreatePendingIfNeeded(cw.phoneNumber, "Mensaje entrante (simulado)");
                              setOptInStatus(cw.phoneNumber, "pending", "Mensaje entrante (simulado)");
                            }
                          }}
                          className="text-[10px] text-slate-600 hover:text-emerald-400 transition-colors border border-slate-700 hover:border-emerald-700/50 rounded px-1.5 py-0.5 shrink-0"
                        >
                          Simular mensaje
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp Opt-in Panel ───────────────────────────────────────────────────

const OPT_IN_STATUS_CONFIG: Record<
  Exclude<OptInStatus, "none">,
  { label: string; className: string; icon: string }
> = {
  confirmed: {
    label: "Confirmado",
    className: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
    icon: "✓",
  },
  pending: {
    label: "Pendiente",
    className: "bg-amber-900/40 text-amber-400 border-amber-700/50",
    icon: "⏳",
  },
  revoked: {
    label: "Revocado",
    className: "bg-red-900/40 text-red-400 border-red-700/50",
    icon: "✗",
  },
};

const OPT_IN_SOURCES = [
  "Manual (admin)",
  "Formulario web",
  "WhatsApp flow",
  "Importación",
  "API",
] as const;

const EMPTY_OPT_IN_FORM = {
  phoneNumber: "",
  status: "confirmed" as OptInStatus,
  source: "Manual (admin)" as string,
  notes: "",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function WhatsAppOptInPanel() {
  const { optInRecords, policy, setOptInStatus, removeRecord, updatePolicy } =
    useWhatsAppOptIn();

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_OPT_IN_FORM);

  function openNewForm() {
    setForm(EMPTY_OPT_IN_FORM);
    setEditingPhone(null);
    setShowForm(true);
  }

  function openEditForm(record: OptInRecord) {
    setForm({
      phoneNumber: record.phoneNumber,
      status: record.status === "none" ? "pending" : record.status,
      source: record.source ?? "Manual (admin)",
      notes: record.notes ?? "",
    });
    setEditingPhone(record.phoneNumber);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.phoneNumber.trim()) return;
    setOptInStatus(
      form.phoneNumber.trim(),
      form.status,
      form.source || undefined,
      form.notes.trim() || undefined
    );
    setShowForm(false);
    setEditingPhone(null);
    setForm(EMPTY_OPT_IN_FORM);
  }

  const unconfirmedCount = optInRecords.filter(
    (r) => r.status !== "confirmed"
  ).length;

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          Reglas de Opt-in
          {optInRecords.length > 0 && (
            <span className="ml-1 text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 rounded-full px-1.5 py-0">
              {optInRecords.length}
            </span>
          )}
          {unconfirmedCount > 0 && (
            <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/50 rounded-full px-1.5 py-0">
              {unconfirmedCount} sin confirmar
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700 p-3 space-y-4">
          {/* ── Policy toggles ── */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">
              Política de opt-in
            </p>
            <div className="space-y-2">
              {(
                [
                  {
                    key: "requireConfirmedForBusinessInitiated" as keyof typeof policy,
                    label:
                      "Requerir opt-in confirmado para mensajes iniciados por la empresa",
                    description:
                      "Bloquea templates y mensajes proactivos si el contacto no ha confirmado.",
                  },
                  {
                    key: "allowRepliesInOpenWindow" as keyof typeof policy,
                    label:
                      "Permitir respuestas en conversaciones iniciadas por el usuario",
                    description:
                      "Dentro de la ventana de 24h, permite responder aunque el opt-in no esté confirmado.",
                  },
                  {
                    key: "autoCreatePendingOnInbound" as keyof typeof policy,
                    label:
                      "Crear registro pendiente al recibir el primer mensaje",
                    description:
                      'Registra automáticamente al contacto como "pendiente" cuando envía un mensaje.',
                  },
                ] as { key: keyof typeof policy; label: string; description: string }[]
              ).map(({ key, label, description }) => (
                <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={policy[key] as boolean}
                      onChange={(e) =>
                        updatePolicy({ [key]: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 rounded-full bg-slate-700 peer-checked:bg-emerald-600 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-300 group-hover:text-white transition-colors">
                      {label}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Contact registry ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                Registro de contactos
              </p>
              {!showForm && (
                <button
                  onClick={openNewForm}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Plus className="size-3" /> Registrar opt-in
                </button>
              )}
            </div>

            {/* Form */}
            {showForm && (
              <div className="rounded-md border border-emerald-700/50 bg-slate-900/60 p-3 space-y-2.5 mb-3">
                <p className="text-xs font-medium text-emerald-300">
                  {editingPhone ? "Editar registro" : "Registrar opt-in"}
                </p>

                {/* Phone */}
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Número de teléfono (E.164)
                  </label>
                  <input
                    type="text"
                    value={form.phoneNumber}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phoneNumber: e.target.value }))
                    }
                    disabled={!!editingPhone}
                    placeholder="+5491112345678"
                    className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-50"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Estado
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        status: e.target.value as OptInStatus,
                      }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="confirmed">✓ Confirmado</option>
                    <option value="pending">⏳ Pendiente</option>
                    <option value="revoked">✗ Revocado</option>
                  </select>
                </div>

                {/* Source */}
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Fuente del opt-in
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, source: e.target.value }))
                    }
                    className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                  >
                    {OPT_IN_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Notas{" "}
                    <span className="text-slate-600">(opcional)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    rows={2}
                    placeholder="ej. Opt-in vía landing page Black Friday"
                    className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingPhone(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!form.phoneNumber.trim()}
                    className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1 rounded transition-colors"
                  >
                    {editingPhone ? "Guardar cambios" : "Registrar"}
                  </button>
                </div>
              </div>
            )}

            {/* Record list */}
            {optInRecords.length === 0 && !showForm ? (
              <p className="text-xs text-slate-600 py-2 text-center">
                No hay contactos registrados.
              </p>
            ) : (
              <div className="space-y-1.5">
                {optInRecords.map((record) => {
                  const cfg =
                    record.status !== "none"
                      ? OPT_IN_STATUS_CONFIG[
                          record.status as Exclude<OptInStatus, "none">
                        ]
                      : null;
                  const evidenceTs =
                    record.confirmedAt ??
                    record.pendingSince ??
                    record.revokedAt;
                  return (
                    <div
                      key={record.phoneNumber}
                      className="rounded-md border border-slate-700/60 bg-slate-800/30 px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Phone className="size-3 text-slate-500 shrink-0" />
                        <span className="font-mono text-slate-300 flex-1 truncate">
                          {record.phoneNumber}
                        </span>
                        {cfg && (
                          <span
                            className={`text-[9px] border rounded px-1.5 py-0 ${cfg.className}`}
                          >
                            {cfg.icon} {cfg.label}
                          </span>
                        )}
                        <button
                          onClick={() => openEditForm(record)}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          aria-label="Editar opt-in"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => removeRecord(record.phoneNumber)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          aria-label="Eliminar registro"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>

                      {/* Evidence */}
                      <div className="mt-1 ml-5 text-[10px] text-slate-600 space-y-0.5">
                        {record.source && (
                          <p>
                            Fuente:{" "}
                            <span className="text-slate-500">{record.source}</span>
                          </p>
                        )}
                        {evidenceTs && (
                          <p>
                            {record.status === "confirmed"
                              ? "Confirmado"
                              : record.status === "revoked"
                              ? "Revocado"
                              : "Pendiente desde"}{" "}
                            el{" "}
                            <span className="text-slate-500">
                              {formatDate(evidenceTs)}
                            </span>
                          </p>
                        )}
                        {record.notes && (
                          <p className="italic text-slate-600">{record.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp routing panel ──────────────────────────────────────────────────

const REASON_COLORS: Record<RoutingReasonCode, string> = {
  phone_number_match:   "bg-blue-900/40 text-blue-300 border border-blue-700/50",
  keyword_match:        "bg-green-900/40 text-green-300 border border-green-700/50",
  template_match:       "bg-purple-900/40 text-purple-300 border border-purple-700/50",
  business_hours_match: "bg-sky-900/40 text-sky-300 border border-sky-700/50",
  multi_condition_match:"bg-teal-900/40 text-teal-300 border border-teal-700/50",
  default_fallback:     "bg-amber-900/40 text-amber-300 border border-amber-700/50",
  no_agents_configured: "bg-red-900/40 text-red-300 border border-red-700/50",
};

const REASON_LABELS: Record<RoutingReasonCode, string> = {
  phone_number_match:   "Phone Number",
  keyword_match:        "Keyword",
  template_match:       "Template",
  business_hours_match: "Horario",
  multi_condition_match:"Multi-condición",
  default_fallback:     "Fallback",
  no_agents_configured: "Sin agentes",
};

function RuleEditor({
  draft,
  agents,
  onSave,
  onCancel,
  onChange,
}: {
  draft: RoutingRule;
  agents: Agent[];
  onSave: () => void;
  onCancel: () => void;
  onChange: (updated: RoutingRule) => void;
}) {
  function addCondition() {
    const newCond: RoutingCondition = {
      id: crypto.randomUUID(),
      type: "keyword",
      operator: "contains",
      value: "",
    };
    onChange({ ...draft, conditions: [...draft.conditions, newCond] });
  }

  function updateCondition(id: string, patch: Partial<RoutingCondition>) {
    onChange({
      ...draft,
      conditions: draft.conditions.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        if (patch.type) {
          if (patch.type === "business_hours") {
            updated.operator = "is_open";
            updated.value = "";
          } else if (
            updated.operator === "is_open" ||
            updated.operator === "is_closed"
          ) {
            updated.operator = "contains";
          }
        }
        return updated;
      }),
    });
  }

  function removeCondition(id: string) {
    onChange({
      ...draft,
      conditions: draft.conditions.filter((c) => c.id !== id),
    });
  }

  const isValid =
    draft.name.trim() !== "" &&
    draft.conditions.length > 0 &&
    draft.agentId !== "";

  return (
    <div className="rounded border border-indigo-700/60 bg-slate-800/60 px-2.5 py-2.5 space-y-3">
      {/* Name + enabled toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...draft, enabled: !draft.enabled })}
          className={`shrink-0 relative inline-flex w-7 h-4 rounded-full transition-colors ${
            draft.enabled ? "bg-indigo-600" : "bg-slate-700"
          }`}
          title={draft.enabled ? "Desactivar" : "Activar"}
        >
          <span
            className={`inline-block w-3 h-3 rounded-full bg-white shadow transform transition-transform my-0.5 ${
              draft.enabled ? "translate-x-3.5" : "translate-x-0.5"
            }`}
          />
        </button>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Nombre de la regla"
          className="flex-1 rounded border border-slate-700 bg-slate-900 text-xs text-white px-2 py-1 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Conditions */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Condiciones (AND)
        </p>
        {draft.conditions.map((cond) => (
          <div key={cond.id} className="flex items-center gap-1.5 flex-wrap">
            <select
              value={cond.type}
              onChange={(e) =>
                updateCondition(cond.id, {
                  type: e.target.value as RoutingConditionType,
                })
              }
              className="rounded border border-slate-700 bg-slate-900 text-[11px] text-white px-1.5 py-1 focus:outline-none focus:border-indigo-500"
            >
              {(
                Object.entries(CONDITION_TYPE_LABELS) as [
                  RoutingConditionType,
                  string,
                ][]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={cond.operator}
              onChange={(e) =>
                updateCondition(cond.id, {
                  operator: e.target.value as RoutingOperator,
                })
              }
              className="rounded border border-slate-700 bg-slate-900 text-[11px] text-white px-1.5 py-1 focus:outline-none focus:border-indigo-500"
            >
              {(cond.type === "business_hours"
                ? HOURS_OPERATORS
                : TEXT_OPERATORS
              ).map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
            {cond.type !== "business_hours" && (
              <input
                type="text"
                value={cond.value}
                onChange={(e) =>
                  updateCondition(cond.id, { value: e.target.value })
                }
                placeholder="valor"
                className="flex-1 min-w-[80px] rounded border border-slate-700 bg-slate-900 text-[11px] text-white px-1.5 py-1 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            )}
            <button
              type="button"
              onClick={() => removeCondition(cond.id)}
              className="text-slate-600 hover:text-red-400 p-0.5 shrink-0"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Plus className="size-3" /> Agregar condición
        </button>
      </div>

      {/* Target agent */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
          Agente destino
        </p>
        <select
          value={draft.agentId}
          onChange={(e) => onChange({ ...draft, agentId: e.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 text-xs text-white px-2 py-1 focus:outline-none focus:border-indigo-500"
        >
          <option value="">— Seleccionar agente —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onSave}
          disabled={!isValid}
          className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white px-3 py-1 rounded transition-colors"
        >
          Guardar regla
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function WhatsAppRoutingPanel() {
  const { config, updateConfig } = useRouting();
  const { agents } = useAgents();
  const { config: bhConfig } = useBusinessHours();
  const [open, setOpen] = useState(false);

  // Simulator state
  const [simPhoneNumberId, setSimPhoneNumberId] = useState("");
  const [simText, setSimText] = useState("");
  const [simTemplate, setSimTemplate] = useState("");
  const [simResult, setSimResult] = useState<RoutingDecision | null>(null);

  // Rule editor state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoutingRule | null>(null);

  function startNew() {
    const newRule: RoutingRule = {
      id: crypto.randomUUID(),
      name: "",
      enabled: true,
      priority:
        config.rules.length > 0
          ? Math.max(...config.rules.map((r) => r.priority)) + 1
          : 1,
      conditions: [],
      agentId: "",
      updatedAt: new Date().toISOString(),
    };
    setDraft(newRule);
    setEditingRuleId(newRule.id);
  }

  function startEdit(rule: RoutingRule) {
    setDraft({ ...rule, conditions: rule.conditions.map((c) => ({ ...c })) });
    setEditingRuleId(rule.id);
  }

  function cancelEdit() {
    setEditingRuleId(null);
    setDraft(null);
  }

  function saveRule() {
    if (!draft) return;
    const exists = config.rules.some((r) => r.id === draft.id);
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    const newRules = exists
      ? config.rules.map((r) => (r.id === draft.id ? updated : r))
      : [...config.rules, updated];
    updateConfig({ rules: newRules });
    cancelEdit();
  }

  function deleteRule(id: string) {
    updateConfig({ rules: config.rules.filter((r) => r.id !== id) });
    if (editingRuleId === id) cancelEdit();
  }

  function toggleEnabled(id: string) {
    updateConfig({
      rules: config.rules.map((r) =>
        r.id === id
          ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() }
          : r
      ),
    });
  }

  function movePriority(id: string, direction: "up" | "down") {
    const sorted = [...config.rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((r) => r.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newRules = config.rules.map((r) => {
      if (r.id === sorted[idx].id) return { ...r, priority: sorted[swapIdx].priority };
      if (r.id === sorted[swapIdx].id) return { ...r, priority: sorted[idx].priority };
      return r;
    });
    updateConfig({ rules: newRules });
  }

  function runSimulator() {
    const msg: InboundMessageContext = {
      from: "",
      phoneNumberId: simPhoneNumberId,
      text: simText,
      templateName: simTemplate || undefined,
    };
    setSimResult(resolveRoute(msg, config, agents, bhConfig));
  }

  const sortedRules = [...config.rules].sort((a, b) => a.priority - b.priority);
  const enabledCount = config.rules.filter((r) => r.enabled).length;

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <GitBranch className="size-3.5 text-indigo-400" />
          <span className="font-medium">Routing de mensajes</span>
          {enabledCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-400 border border-indigo-700/50">
              {enabledCount} regla{enabledCount !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700 p-3 space-y-4">
          <p className="text-[11px] text-slate-500">
            Define qué agente responde según criterios del mensaje entrante. Las
            reglas se evalúan en orden de prioridad; gana la primera
            coincidencia.
          </p>

          {/* ── Default agent ────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Agente por defecto (fallback)
            </p>
            <select
              value={config.defaultAgentId}
              onChange={(e) => updateConfig({ defaultAgentId: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Sin agente por defecto —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-[10px] text-slate-600">
              Se usa cuando ninguna regla coincide con el mensaje entrante.
            </p>
          </div>

          {/* ── Rules list ────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Reglas de routing
            </p>
            {sortedRules.length === 0 && editingRuleId === null && (
              <p className="text-[11px] text-slate-600 italic py-1.5">
                Sin reglas. Los mensajes usarán el agente por defecto.
              </p>
            )}

            <div className="space-y-1.5">
              {sortedRules.map((rule, idx) =>
                editingRuleId === rule.id && draft ? (
                  <RuleEditor
                    key={rule.id}
                    draft={draft}
                    agents={agents}
                    onSave={saveRule}
                    onCancel={cancelEdit}
                    onChange={(updated) => setDraft(updated)}
                  />
                ) : (
                  <div
                    key={rule.id}
                    className={`rounded border ${
                      rule.enabled
                        ? "border-slate-700/60 bg-slate-800/40"
                        : "border-slate-800/60 bg-slate-900/30 opacity-60"
                    } px-2.5 py-2`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleEnabled(rule.id)}
                        className={`shrink-0 relative inline-flex w-7 h-4 rounded-full transition-colors ${
                          rule.enabled ? "bg-indigo-600" : "bg-slate-700"
                        }`}
                        title={rule.enabled ? "Desactivar" : "Activar"}
                      >
                        <span
                          className={`inline-block w-3 h-3 rounded-full bg-white shadow transform transition-transform my-0.5 ${
                            rule.enabled ? "translate-x-3.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-[10px] text-slate-600 shrink-0 w-4">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-medium text-slate-300 flex-1 truncate">
                        {rule.name || (
                          <span className="italic text-slate-600">
                            Sin nombre
                          </span>
                        )}
                      </span>
                      {(() => {
                        const a = agents.find((x) => x.id === rule.agentId);
                        return a ? (
                          <span className="text-[10px] text-slate-500 truncate max-w-[80px]">
                            {a.name}
                          </span>
                        ) : null;
                      })()}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => movePriority(rule.id, "up")}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-30"
                          title="Subir prioridad"
                        >
                          <ArrowUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePriority(rule.id, "down")}
                          disabled={idx === sortedRules.length - 1}
                          className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-30"
                          title="Bajar prioridad"
                        >
                          <ArrowDown className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(rule)}
                          className="p-0.5 text-slate-600 hover:text-slate-300"
                          title="Editar"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="p-0.5 text-slate-600 hover:text-red-400"
                          title="Eliminar"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                    {rule.conditions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {rule.conditions.map((c) => (
                          <span
                            key={c.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 font-mono"
                          >
                            {CONDITION_TYPE_LABELS[c.type]}{" "}
                            {OPERATOR_LABELS[c.operator]}
                            {c.value ? ` "${c.value}"` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
              {/* New rule editor (not yet in config.rules) */}
              {editingRuleId !== null &&
                draft !== null &&
                !config.rules.some((r) => r.id === editingRuleId) && (
                  <RuleEditor
                    draft={draft}
                    agents={agents}
                    onSave={saveRule}
                    onCancel={cancelEdit}
                    onChange={(updated) => setDraft(updated)}
                  />
                )}
            </div>
            {editingRuleId === null && (
              <button
                type="button"
                onClick={startNew}
                className="mt-2 flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Plus className="size-3" /> Agregar regla
              </button>
            )}
          </div>

          {/* ── Simulator ──────────────────────────────────────────── */}
          <div className="border-t border-slate-700/50 pt-3 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Probar routing
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={simPhoneNumberId}
                  onChange={(e) => setSimPhoneNumberId(e.target.value)}
                  placeholder="123456789"
                  className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Template (opcional)
                </label>
                <input
                  type="text"
                  value={simTemplate}
                  onChange={(e) => setSimTemplate(e.target.value)}
                  placeholder="seguimiento_lead"
                  className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">
                Mensaje
              </label>
              <input
                type="text"
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="quiero info sobre precios"
                className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={runSimulator}
              className="flex items-center gap-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded transition-colors"
            >
              <FlaskConical className="size-3.5" /> Simular entrada
            </button>
            {simResult && (
              <div className="rounded border border-slate-700 bg-slate-900/60 p-2.5 space-y-1.5">
                <div className="flex items-center flex-wrap gap-2">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      REASON_COLORS[simResult.reasonCode]
                    }`}
                  >
                    {REASON_LABELS[simResult.reasonCode]}
                  </span>
                  {simResult.agentName ? (
                    <span className="text-xs font-medium text-white">
                      {simResult.agentName}
                    </span>
                  ) : (
                    simResult.reasonCode !== "no_agents_configured" && (
                      <span className="text-[11px] text-slate-500 italic">
                        (Agente sin nombre)
                      </span>
                    )
                  )}
                  {simResult.ruleName && (
                    <span className="text-[10px] text-slate-500">
                      · {simResult.ruleName}
                    </span>
                  )}
                </div>
                {simResult.matchedConditions &&
                  simResult.matchedConditions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {simResult.matchedConditions.map((c, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 font-mono"
                        >
                          {c.type} {c.operator}
                          {c.value ? ` "${c.value}"` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                {simResult.reasonCode === "no_agents_configured" && (
                  <p className="text-[11px] text-red-400">
                    No hay agente asignado. Configura un agente por defecto o
                    agrega reglas.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp messages panel ──────────────────────────────────────────────────

/** Relative-time formatting (no external dependency). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

const STATUS_META: Record<
  OutboundMessage["status"],
  { label: string; iconClass: string; badgeClass: string }
> = {
  pending:   { label: "Pendiente",  iconClass: "text-amber-400",   badgeClass: "bg-amber-900/40 text-amber-300 border border-amber-700/50" },
  sent:      { label: "Enviado",    iconClass: "text-slate-400",   badgeClass: "bg-slate-700/60 text-slate-300 border border-slate-600/50" },
  delivered: { label: "Entregado",  iconClass: "text-emerald-400", badgeClass: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50" },
  read:      { label: "Leído",      iconClass: "text-blue-400",    badgeClass: "bg-blue-900/40 text-blue-300 border border-blue-700/50" },
  failed:    { label: "Fallido",    iconClass: "text-red-400",     badgeClass: "bg-red-900/40 text-red-300 border border-red-700/50" },
};

function StatusIcon({ status }: { status: OutboundMessage["status"] }) {
  const cls = `size-3.5 ${STATUS_META[status].iconClass}`;
  switch (status) {
    case "pending":   return <Clock className={cls} />;
    case "sent":      return <Check className={cls} />;
    case "delivered": return <CheckCircle2 className={cls} />;
    case "read":      return <CheckCircle2 className={cls} />;
    case "failed":    return <XCircle className={cls} />;
  }
}

function MessageRow({ msg }: { msg: OutboundMessage }) {
  const meta = STATUS_META[msg.status];
  const ts =
    msg.status === "pending"
      ? msg.createdAt
      : msg.status === "sent"
        ? (msg.sentAt ?? msg.createdAt)
        : (msg.statusUpdatedAt ?? msg.sentAt ?? msg.createdAt);
  const suggestion = msg.status === "failed" ? getErrorSuggestion(msg.errorCode) : null;
  const preview = msg.text.length > 50 ? msg.text.slice(0, 50) + "…" : msg.text;

  return (
    <div className="py-2 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-2">
        <StatusIcon status={msg.status} />
        <span className="text-[11px] font-mono text-slate-400 shrink-0">{msg.to}</span>
        <span className="text-[11px] text-slate-500 flex-1 truncate">{preview}</span>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.badgeClass}`}>
          {meta.label}
        </span>
        <span className="shrink-0 text-[10px] text-slate-600">{relativeTime(ts)}</span>
      </div>
      {msg.status === "failed" && (
        <div className="mt-1.5 ml-5 space-y-1">
          {(msg.errorCode || msg.errorTitle) && (
            <p className="text-[10px] font-mono text-red-400">
              {msg.errorCode ? `${msg.errorCode}: ` : ""}{msg.errorTitle ?? msg.error ?? "Error desconocido"}
            </p>
          )}
          {suggestion && (
            <div className="flex items-start gap-1 rounded bg-amber-900/20 border border-amber-700/30 px-2 py-1">
              <AlertCircle className="size-3 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300">{suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

function WhatsAppMessagesPanel() {
  const { messages, clearMessages } = useWhatsAppMessages();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "failed">("all");
  const [page, setPage] = useState(1);

  const filtered = filter === "failed"
    ? messages.filter((m) => m.status === "failed")
    : messages;
  const displayed = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = displayed.length < filtered.length;

  const failedCount = messages.filter((m) => m.status === "failed").length;

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Send className="size-3.5 text-slate-400" />
          <span className="font-medium">Mensajes enviados</span>
          {messages.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 border border-slate-600/50">
              {messages.length}
            </span>
          )}
          {failedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/50">
              {failedCount} fallido{failedCount !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60">
            <div className="flex items-center gap-1">
              {(["all", "failed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setFilter(f); setPage(1); }}
                  className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                    filter === f
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {f === "all" ? "Todos" : "Fallidos"}
                </button>
              ))}
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearMessages}
                className="text-[11px] text-slate-600 hover:text-red-400 transition-colors"
              >
                Limpiar historial
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="px-3">
            {displayed.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic py-3">
                {filter === "failed" ? "Sin mensajes fallidos." : "Sin mensajes enviados aún."}
              </p>
            ) : (
              displayed.map((msg) => <MessageRow key={msg.id} msg={msg} />)
            )}
          </div>

          {hasMore && (
            <div className="px-3 py-2">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Mostrar más ({filtered.length - displayed.length} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp test mode panel ───────────────────────────────────────────────

interface TestResult {
  id: string;
  timestamp: string;
  type: "inbound" | "outbound" | "status";
  label: string;
  status: "pass" | "fail";
  detail: string;
}

function WhatsAppTestModePanel() {
  const { testMode, setTestMode, messages, sendMessage, updateMessageStatus } =
    useWhatsAppMessages();
  const { config } = useRouting();
  const { agents } = useAgents();
  const { config: bhConfig } = useBusinessHours();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const [inboundFrom, setInboundFrom] = useState("+5491100000001");
  const [inboundText, setInboundText] = useState(
    "Hola, necesito ayuda con mi pedido"
  );
  const [outboundTo, setOutboundTo] = useState("+5491100000001");
  const [outboundText, setOutboundText] = useState(
    "Mensaje de prueba desde Freia"
  );

  function addResult(result: Omit<TestResult, "id" | "timestamp">) {
    setResults((prev) =>
      [
        { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...result },
        ...prev,
      ].slice(0, 30)
    );
  }

  function runInboundSim() {
    const msg: InboundMessageContext = {
      from: inboundFrom,
      phoneNumberId: "",
      text: inboundText,
    };
    const decision = resolveRoute(msg, config, agents, bhConfig);
    addWhatsAppAuditEntry({
      eventType: "inbound_received",
      direction: "inbound",
      phoneNumber: inboundFrom,
      contentPreview: inboundText.slice(0, 100),
      inboundMessageType: "text",
    });
    const agentName = decision.agentId
      ? (agents.find((a) => a.id === decision.agentId)?.name ?? decision.agentId)
      : "ninguno";
    addResult({
      type: "inbound",
      label: "Recepción simulada",
      status: "pass",
      detail: `Enrutado → ${agentName} (${decision.reasonCode})`,
    });
  }

  async function runOutboundSim() {
    if (!testMode) return;
    setRunning(true);
    const mockId = await sendMessage(outboundTo, outboundText);
    setRunning(false);
    if (mockId) {
      addResult({
        type: "outbound",
        label: "Envío simulado",
        status: "pass",
        detail: `ID: ${mockId}`,
      });
    } else {
      addResult({
        type: "outbound",
        label: "Envío simulado",
        status: "fail",
        detail: "El envío retornó null",
      });
    }
  }

  function runStatusSim() {
    const lastTest = messages.find(
      (m) => m.status === "sent" && m.messageId?.startsWith("wamid.test.")
    );
    if (!lastTest?.messageId) {
      addResult({
        type: "status",
        label: "Actualización de estado",
        status: "fail",
        detail:
          "Sin mensaje de prueba disponible. Ejecuta primero el test de envío.",
      });
      return;
    }
    updateMessageStatus(lastTest.messageId, "delivered");
    addResult({
      type: "status",
      label: "Actualización de estado",
      status: "pass",
      detail: `${lastTest.messageId} → delivered`,
    });
  }

  async function runFullSuite() {
    runInboundSim();
    await runOutboundSim();
    // status sim runs after outbound so there's a test message available
    // Brief yield to let state settle
    setTimeout(() => {
      const lastTest = messages.find(
        (m) => m.status === "sent" && m.messageId?.startsWith("wamid.test.")
      );
      if (lastTest?.messageId) {
        updateMessageStatus(lastTest.messageId, "delivered");
        addResult({
          type: "status",
          label: "Actualización de estado",
          status: "pass",
          detail: `${lastTest.messageId} → delivered`,
        });
      }
    }, 200);
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FlaskConical
            className={`size-3.5 ${testMode ? "text-amber-400" : "text-slate-400"}`}
          />
          <span className="font-medium">Modo test</span>
          {testMode && (
            <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/50 text-[10px] font-semibold uppercase tracking-wide">
              Activo
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700 p-3 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-slate-300 font-medium">
                Activar modo test
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Los envíos se simulan sin llamadas reales a la API de WhatsApp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTestMode(!testMode)}
              className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 ${
                testMode ? "bg-amber-600" : "bg-slate-700"
              }`}
              aria-label={testMode ? "Desactivar modo test" : "Activar modo test"}
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform my-0.5 mx-0.5 ${
                  testMode ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {testMode && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>
                Modo test activo — los mensajes{" "}
                <strong>no se envían realmente</strong>. Desactiva antes de
                entrar en producción.
              </span>
            </div>
          )}

          {/* Test 1: Inbound */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              1 · Simular recepción (webhook inbound)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">
                  Número origen
                </label>
                <input
                  type="text"
                  value={inboundFrom}
                  onChange={(e) => setInboundFrom(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 text-[11px] text-white px-2 py-1.5 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">
                  Texto del mensaje
                </label>
                <input
                  type="text"
                  value={inboundText}
                  onChange={(e) => setInboundText(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 text-[11px] text-white px-2 py-1.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={runInboundSim}
              className="text-[11px] px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            >
              Simular recepción
            </button>
          </div>

          {/* Test 2: Outbound */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              2 · Probar envío (outbound)
            </p>
            {!testMode && (
              <p className="text-[10px] text-amber-500">
                Activa el modo test para simular envíos sin API real.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">
                  Número destino
                </label>
                <input
                  type="text"
                  value={outboundTo}
                  onChange={(e) => setOutboundTo(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 text-[11px] text-white px-2 py-1.5 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">
                  Texto del mensaje
                </label>
                <input
                  type="text"
                  value={outboundText}
                  onChange={(e) => setOutboundText(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 text-[11px] text-white px-2 py-1.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={runOutboundSim}
              disabled={!testMode || running}
              className={`text-[11px] px-3 py-1.5 rounded transition-colors ${
                testMode && !running
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {running ? "Enviando..." : "Probar envío"}
            </button>
          </div>

          {/* Test 3: Status update */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              3 · Simular actualización de estado
            </p>
            <p className="text-[10px] text-slate-600">
              Avanza el último mensaje de prueba a{" "}
              <span className="font-mono text-slate-400">delivered</span>.
            </p>
            <button
              type="button"
              onClick={runStatusSim}
              className="text-[11px] px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            >
              Simular estado
            </button>
          </div>

          {/* Run all */}
          {testMode && (
            <div className="pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={runFullSuite}
                disabled={running}
                className={`w-full text-[11px] px-3 py-2 rounded font-medium transition-colors ${
                  running
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                    : "bg-amber-900/40 hover:bg-amber-800/50 text-amber-300 border border-amber-800/50"
                }`}
              >
                {running ? "Ejecutando..." : "▶ Ejecutar suite completa"}
              </button>
            </div>
          )}

          {/* Test report */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Reporte de pruebas
                </p>
                <button
                  type="button"
                  onClick={() => setResults([])}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                >
                  Limpiar
                </button>
              </div>
              {results.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-start gap-2 rounded border px-2.5 py-1.5 text-[11px] ${
                    r.status === "pass"
                      ? "border-emerald-800/50 bg-emerald-900/10"
                      : "border-red-800/50 bg-red-900/10"
                  }`}
                >
                  <span
                    className={`shrink-0 font-bold ${r.status === "pass" ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {r.status === "pass" ? "✓" : "✗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`font-medium ${r.status === "pass" ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {r.label}
                    </span>
                    <span className="text-slate-500"> — </span>
                    <span className="text-slate-400">{r.detail}</span>
                  </div>
                  <span
                    className="text-slate-600 shrink-0 font-mono"
                    title={r.timestamp}
                  >
                    {new Date(r.timestamp).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WhatsApp connected credential summary ─────────────────────────────────

function WhatsAppConnectedSummary({
  metadata,
  onEdit,
}: {
  metadata: Record<string, string>;
  onEdit: () => void;
}) {
  return (
    <>
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 divide-y divide-slate-700/60">
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <Hash className="size-3" /> Phone Number ID
        </span>
        <span className="font-mono text-slate-300">
          {metadata.phone_number_id}
        </span>
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <Building2 className="size-3" /> WABA ID
        </span>
        <span className="font-mono text-slate-300">{metadata.waba_id}</span>
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <KeyRound className="size-3" /> Access Token
        </span>
        <span className="font-mono text-slate-600 tracking-widest text-[11px]">
          ●●●●●●●●●●●●●●●●
        </span>
      </div>
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="text-slate-500 flex items-center gap-1.5">
          <Webhook className="size-3" /> Verify Token
        </span>
        <span className="font-mono text-slate-600 tracking-widest text-[11px]">
          ●●●●●●●●●●●●
        </span>
      </div>
      <div className="px-3 py-2 flex justify-end">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Pencil className="size-3" />
          Editar credenciales
        </button>
      </div>
    </div>

    {/* Webhook configuration panel */}
    <WhatsAppWebhookPanel />

    {/* Templates panel */}
    <WhatsAppTemplatesPanel />

    {/* Opt-in panel */}
    <WhatsAppOptInPanel />

    {/* Identity panel */}
    <WhatsAppIdentityPanel />

    {/* Routing panel */}
    <WhatsAppRoutingPanel />

    {/* Messages panel */}
    <WhatsAppMessagesPanel />

    {/* Test mode panel */}
    <WhatsAppTestModePanel />
    </>
  );
}

// ─── WhatsApp identity panel ────────────────────────────────────────────────

const LANGUAGE_OPTIONS: { value: DefaultLanguage; label: string }[] = [
  { value: "es-AR", label: "Español (Argentina)" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
];

function WhatsAppIdentityPanel() {
  const { identity, updateIdentity } = useWhatsAppIdentity();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    businessName: identity.businessName,
    signature: identity.signature ?? "",
    welcomeMessage: identity.welcomeMessage ?? "",
    outOfHoursMessage: identity.outOfHoursMessage ?? "",
    defaultLanguage: identity.defaultLanguage,
    tone: identity.tone,
    useEmojis: identity.useEmojis,
  });

  // Re-sync form when identity changes externally (e.g. cross-tab)
  useEffect(() => {
    setForm({
      businessName: identity.businessName,
      signature: identity.signature ?? "",
      welcomeMessage: identity.welcomeMessage ?? "",
      outOfHoursMessage: identity.outOfHoursMessage ?? "",
      defaultLanguage: identity.defaultLanguage,
      tone: identity.tone,
      useEmojis: identity.useEmojis,
    });
  }, [identity]);

  // Live preview: replace {{brandName}} in the form's signature using the form's businessName
  const signaturePreview = form.signature
    ? form.signature.replace(/\{\{brandName\}\}/g, form.businessName || "")
    : "";

  function handleSave() {
    updateIdentity({
      businessName: form.businessName,
      signature: form.signature || undefined,
      welcomeMessage: form.welcomeMessage || undefined,
      outOfHoursMessage: form.outOfHoursMessage || undefined,
      defaultLanguage: form.defaultLanguage,
      tone: form.tone,
      useEmojis: form.useEmojis,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isModified =
    form.businessName !== identity.businessName ||
    (form.signature || "") !== (identity.signature ?? "") ||
    (form.welcomeMessage || "") !== (identity.welcomeMessage ?? "") ||
    (form.outOfHoursMessage || "") !== (identity.outOfHoursMessage ?? "") ||
    form.defaultLanguage !== identity.defaultLanguage ||
    form.tone !== identity.tone ||
    form.useEmojis !== identity.useEmojis;

  return (
    <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Palette className="size-3.5 text-blue-400" />
          <span className="font-medium">Identidad del canal</span>
          {identity.businessName && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 border border-blue-700/50">
              {identity.businessName}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-700 p-3 space-y-5">

          {/* ── Section 1: Brand identity ──────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Identidad de marca
            </p>

            {/* Business name */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Nombre del negocio
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessName: e.target.value }))
                }
                placeholder="Ej: Acme Corp"
                className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              <p className="mt-0.5 text-[10px] text-slate-600">
                Usado como{" "}
                <code className="text-slate-500">{"{{brandName}}"}</code> en la
                firma
              </p>
            </div>

            {/* Signature */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Firma de mensajes{" "}
                <span className="text-slate-600">(opcional)</span>
              </label>
              <input
                type="text"
                value={form.signature}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signature: e.target.value }))
                }
                placeholder="Ej: — Equipo {{brandName}}"
                className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
              />
              {signaturePreview && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-600">Vista previa:</span>
                  <span className="text-[10px] text-slate-400 italic">
                    &ldquo;{signaturePreview}&rdquo;
                  </span>
                </div>
              )}
              {!signaturePreview && (
                <p className="mt-0.5 text-[10px] text-slate-600">
                  Se agrega al final de cada mensaje de texto libre
                </p>
              )}
            </div>
          </div>

          {/* ── Section 2: Automatic messages ─────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Mensajes automáticos
            </p>

            {/* Welcome message */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Bienvenida{" "}
                <span className="text-slate-600">(primer contacto)</span>
              </label>
              <textarea
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, welcomeMessage: e.target.value }))
                }
                rows={2}
                placeholder="Ej: ¡Hola! Gracias por contactarnos. ¿En qué podemos ayudarte?"
                className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Out-of-hours message */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Fuera de horario
              </label>
              <textarea
                value={form.outOfHoursMessage}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outOfHoursMessage: e.target.value }))
                }
                rows={2}
                placeholder="Ej: Estamos fuera de horario. Te responderemos a primera hora."
                className="w-full rounded border border-slate-700 bg-slate-800 text-xs text-white px-2.5 py-1.5 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* ── Section 3: Language and style ─────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Idioma y estilo
            </p>

            {/* Language */}
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-slate-400 w-28 shrink-0">
                Idioma por defecto
              </label>
              <select
                value={form.defaultLanguage}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    defaultLanguage: e.target.value as DefaultLanguage,
                  }))
                }
                className="rounded border border-slate-700 bg-slate-800 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-blue-500"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tone */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400 w-28 shrink-0">
                Tono
              </span>
              <div className="flex rounded overflow-hidden border border-slate-700">
                {(["formal", "cercano"] as MessageTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, tone: t }))}
                    className={`px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                      form.tone === t
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-600">
                {form.tone === "formal"
                  ? "Lenguaje profesional, usted"
                  : "Amigable, vos/tú"}
              </span>
            </div>

            {/* Emojis */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useEmojis}
                onChange={(e) =>
                  setForm((f) => ({ ...f, useEmojis: e.target.checked }))
                }
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <span className="text-[11px] text-slate-300">
                Activar uso de emojis en este canal
              </span>
            </label>
          </div>

          {/* ── Save ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            <button
              onClick={handleSave}
              disabled={!isModified}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              {saved ? (
                <>
                  <Check className="size-3" />
                  Guardado
                </>
              ) : (
                <>
                  <Palette className="size-3" />
                  Guardar identidad
                </>
              )}
            </button>
            {identity.updatedAt && !isModified && (
              <span className="text-[10px] text-slate-600">
                Actualizado{" "}
                {new Date(identity.updatedAt).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Channel Card ───────────────────────────────────────────────────────────

interface ChannelCardProps {
  config: ChannelConfig;
  onEnable: () => void;
  onDisable: () => void;
  onConnect: (metadata: Record<string, string>) => void;
  onDisconnect: () => void;
}

function ChannelCard({
  config,
  onEnable,
  onDisable,
  onConnect,
  onDisconnect,
}: ChannelCardProps) {
  const { channel, enabled, requiresConnection, connectionStatus, metadata } =
    config;
  const meta = CHANNEL_META[channel];
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const isConnected = connectionStatus === "connected";
  const needsConnection = requiresConnection && !isConnected && enabled;

  const handleConnect = (m: Record<string, string>) => {
    onConnect(m);
    setShowConnectForm(false);
    setShowEditForm(false);
  };

  const handleDisconnect = () => {
    onDisconnect();
    setShowDisconnectConfirm(false);
    setShowEditForm(false);
  };

  // Pre-filled values for the edit form
  const waInitialValues: WAFields | undefined =
    channel === "whatsapp" && metadata
      ? {
          phone_number_id: metadata.phone_number_id ?? "",
          waba_id: metadata.waba_id ?? "",
          access_token: metadata.access_token ?? "",
          verify_token: metadata.verify_token ?? "",
        }
      : undefined;

  return (
    <div
      className={`rounded-xl border bg-slate-800/50 p-5 transition-all ${
        enabled ? `${meta.borderClass} bg-slate-800/70` : "border-slate-700"
      }`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-10 items-center justify-center rounded-lg ${meta.iconBgClass} ${meta.iconTextClass}`}
          >
            {CHANNEL_ICONS[channel]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
          </div>
        </div>

        {/* Enable toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={enabled ? onDisable : onEnable}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-[#dd7430]" : "bg-slate-600"
          }`}
        >
          <span
            className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-4.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Connection status (only when enabled) */}
      {enabled && (
        <div className="space-y-3">
          {requiresConnection ? (
            <>
              {/* Status row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">
                        Conectado
                      </span>
                      {/* Meta channels show account name inline */}
                      {channel !== "whatsapp" && metadata?.accountName && (
                        <span className="text-xs text-slate-500">
                          · {metadata.accountName}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <WifiOff className="size-3.5 text-amber-400" />
                      <span className="text-xs text-amber-400 font-medium">
                        Requiere conexión
                      </span>
                    </>
                  )}
                </div>

                {isConnected && !showEditForm ? (
                  <button
                    onClick={() => setShowDisconnectConfirm(true)}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Unlink className="size-3" />
                    Desconectar
                  </button>
                ) : !isConnected && !showConnectForm ? (
                  <button
                    onClick={() => setShowConnectForm(true)}
                    className={`flex items-center gap-1 text-xs font-medium ${meta.iconTextClass} hover:opacity-80 transition-opacity`}
                  >
                    <Wifi className="size-3" />
                    Conectar
                  </button>
                ) : null}
              </div>

              {/* WhatsApp credential summary when connected */}
              {isConnected &&
                channel === "whatsapp" &&
                metadata &&
                !showEditForm && (
                  <WhatsAppConnectedSummary
                    metadata={metadata}
                    onEdit={() => setShowEditForm(true)}
                  />
                )}

              {/* Edit form (WhatsApp re-connect) */}
              {showEditForm && channel === "whatsapp" && (
                <WhatsAppConnectForm
                  initialValues={waInitialValues}
                  onConnect={handleConnect}
                  onCancel={() => setShowEditForm(false)}
                />
              )}

              {/* New connection form */}
              {showConnectForm && !isConnected && (
                <>
                  {channel === "whatsapp" ? (
                    <WhatsAppConnectForm
                      onConnect={handleConnect}
                      onCancel={() => setShowConnectForm(false)}
                    />
                  ) : (
                    <MetaConnectForm
                      channel={channel}
                      onConnect={handleConnect}
                      onCancel={() => setShowConnectForm(false)}
                    />
                  )}
                </>
              )}

              {/* Disconnect confirmation */}
              {showDisconnectConfirm && (
                <div className="flex items-center justify-between rounded-lg border border-red-800/50 bg-red-900/10 px-3 py-2">
                  <span className="text-xs text-red-400">
                    ¿Desconectar este canal?
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDisconnect}
                      className="text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      Sí, desconectar
                    </button>
                    <button
                      onClick={() => setShowDisconnectConfirm(false)}
                      className="text-xs text-slate-500 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Warning: enabled but not connected */}
              {needsConnection && !showConnectForm && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>
                    Canal habilitado pero sin conexión. Los agentes que usen
                    este canal no podrán activarse.
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">
                Disponible — no requiere conexión adicional
              </span>
            </div>
          )}
        </div>
      )}

      {/* Disabled state */}
      {!enabled && (
        <div className="flex items-center gap-2 mt-1">
          <XCircle className="size-3.5 text-slate-600" />
          <span className="text-xs text-slate-600">
            Canal deshabilitado — no aparecerá como opción en agentes
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const {
    channels,
    enableChannel,
    disableChannel,
    connectChannel,
    disconnectChannel,
  } = useChannels();

  const channelOrder: ChannelScope[] = CHANNEL_SCOPES.map((c) => c.value);
  const orderedChannels = channelOrder
    .map((ch) => channels.find((c) => c.channel === ch))
    .filter(Boolean) as ChannelConfig[];

  const enabledCount = channels.filter((c) => c.enabled).length;
  const connectedCount = channels.filter(
    (c) => c.connectionStatus === "connected"
  ).length;
  const pendingCount = channels.filter(
    (c) =>
      c.enabled &&
      c.requiresConnection &&
      c.connectionStatus !== "connected"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Configuración de Canales
          </h1>
          <p className="text-slate-400 mt-1">
            Habilita y conecta los canales de comunicación disponibles para tus
            agentes.
          </p>
        </div>
        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400">
            <span className="size-1.5 rounded-full bg-[#dd7430]" />
            {enabledCount} habilitado{enabledCount !== 1 ? "s" : ""}
          </span>
          {connectedCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-700/40 text-xs text-emerald-400">
              <Wifi className="size-3" />
              {connectedCount} conectado{connectedCount !== 1 ? "s" : ""}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-700/40 text-xs text-amber-400">
              <WifiOff className="size-3" />
              {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-sky-800/40 bg-sky-900/10 px-4 py-3 text-sm text-sky-400">
        <AlertTriangle className="size-4 shrink-0 mt-0.5 text-sky-500" />
        <span>
          Solo los canales <strong>habilitados y conectados</strong> aparecerán
          como opciones al crear o editar agentes. Los canales que requieren
          conexión (WhatsApp, Instagram, Facebook) deben estar conectados para
          que sus agentes puedan activarse.
        </span>
      </div>

      {/* Channel cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orderedChannels.map((config) => (
          <ChannelCard
            key={config.channel}
            config={config}
            onEnable={() => enableChannel(config.channel)}
            onDisable={() => disableChannel(config.channel)}
            onConnect={(metadata) =>
              connectChannel(config.channel, metadata)
            }
            onDisconnect={() => disconnectChannel(config.channel)}
          />
        ))}
      </div>
    </div>
  );
}
