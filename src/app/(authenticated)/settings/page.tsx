"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Cpu,
  Wifi,
  WifiOff,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
} from "lucide-react";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import { useBusinessHours } from "@/providers/BusinessHoursProvider";
import {
  TIMEZONE_OPTIONS,
  DAYS_ORDER,
  DAY_LABELS,
  isCurrentlyBusinessHours,
} from "@/lib/business-hours";
import type { DayOfWeek, DaySchedule } from "@/types/business-hours";

// --- LLM Provider Card ---

function OpenAIConfigCard() {
  const { config, setApiKey, clearApiKey, testConnection } = useLLMConfig();
  const openai = config.openai;

  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSave = () => {
    if (!inputKey.trim()) return;
    setApiKey("openai", inputKey.trim());
    setInputKey("");
    setTestResult(null);
  };

  const handleClear = () => {
    clearApiKey("openai");
    setInputKey("");
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection("openai");
    setTestResult(result);
    setIsTesting(false);
  };

  const statusBadge = openai.isConfigured ? (
    openai.isValidated ? (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-800/40">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Conectado
      </span>
    ) : (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/30 text-amber-400 border border-amber-800/40">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Sin validar
      </span>
    )
  ) : (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/40">
      <span className="size-1.5 rounded-full bg-slate-500" />
      No configurado
    </span>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 space-y-5">
      {/* Provider header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-700/60 border border-slate-600/50">
            <span className="text-sm font-bold text-white">AI</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">OpenAI</p>
            {openai.isValidated && openai.validatedAt && (
              <p className="text-xs text-slate-500">
                Validado el{" "}
                {new Date(openai.validatedAt).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        {statusBadge}
      </div>

      {/* Current key display */}
      {openai.isConfigured && openai.maskedKey && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Clave actual</span>
            <span className="text-xs font-mono text-slate-300">
              {openai.maskedKey}
            </span>
          </div>
          <button
            onClick={handleClear}
            className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
            aria-label="Eliminar clave API"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {/* Key input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {openai.isConfigured ? "Reemplazar API Key" : "API Key"}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="sk-proj-..."
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 pr-10 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[#dd7430] text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* Test connection */}
      {openai.isConfigured && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-200 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTesting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wifi className="size-4" />
            )}
            {isTesting ? "Probando..." : "Probar conexión"}
          </button>

          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testResult.success ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <WifiOff className="size-4 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* Security disclaimer */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-amber-800/30 bg-amber-900/10 text-xs text-amber-400/80">
        <Info className="size-3.5 shrink-0 mt-0.5" />
        <p>
          <span className="font-medium text-amber-400">Nota de seguridad:</span>{" "}
          Esta clave se almacena localmente con ofuscación básica. En una
          implementación de producción, las claves API se almacenarían en el
          servidor con cifrado real y nunca se expondrían en el frontend.
        </p>
      </div>
    </div>
  );
}

// --- Business Hours Card ---

function BusinessHoursCard() {
  const { config, updateConfig, isOpen } = useBusinessHours();

  // Local draft state so the user can edit before saving
  const [draft, setDraft] = useState(config);
  const [saved, setSaved] = useState(false);
  // Live status refreshed every 30 seconds
  const [liveOpen, setLiveOpen] = useState(() => isCurrentlyBusinessHours(config));

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    setLiveOpen(isCurrentlyBusinessHours(draft));
    const interval = setInterval(() => {
      setLiveOpen(isCurrentlyBusinessHours(draft));
    }, 30_000);
    return () => clearInterval(interval);
  }, [draft]);

  const handleDayToggle = (day: DayOfWeek) => {
    setDraft((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: { ...prev.schedule[day], enabled: !prev.schedule[day].enabled },
      },
    }));
  };

  const handleDayTime = (
    day: DayOfWeek,
    field: keyof Pick<DaySchedule, "start" | "end">,
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: { ...prev.schedule[day], [field]: value },
      },
    }));
  };

  const handleSave = () => {
    updateConfig(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const statusBadge = draft.enabled ? (
    liveOpen ? (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-800/40">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Dentro de horario
      </span>
    ) : (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-800/40">
        <span className="size-1.5 rounded-full bg-red-400" />
        Fuera de horario
      </span>
    )
  ) : (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/40">
      <span className="size-1.5 rounded-full bg-slate-500" />
      Sin restricción
    </span>
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-sky-400" />
          <h2 className="text-lg font-semibold text-white">
            Horario de atención
          </h2>
        </div>
        {statusBadge}
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Configurá cuándo el bot está activo. Fuera de horario,{" "}
        <code className="text-sky-400 text-xs">system.isBusinessHours</code> será{" "}
        <span className="text-slate-300">false</span>.
      </p>

      <div className="space-y-5">
        {/* Enable toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={draft.enabled}
              onChange={() => setDraft((p) => ({ ...p, enabled: !p.enabled }))}
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                draft.enabled ? "bg-sky-600" : "bg-slate-600"
              }`}
            />
            <div
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform shadow-sm ${
                draft.enabled ? "translate-x-4" : ""
              }`}
            />
          </div>
          <span className="text-sm text-slate-200">
            Habilitar restricción de horario
          </span>
        </label>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Zona horaria
          </label>
          <select
            value={draft.timezone}
            onChange={(e) => setDraft((p) => ({ ...p, timezone: e.target.value }))}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-white text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Schedule table */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">
            Horario por día
          </p>
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                    Día
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-slate-400">
                    Abierto
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                    Apertura
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400">
                    Cierre
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS_ORDER.map((day, i) => {
                  const sched = draft.schedule[day];
                  return (
                    <tr
                      key={day}
                      className={`border-b border-slate-700/50 last:border-0 ${
                        i % 2 === 0 ? "bg-slate-800/20" : "bg-slate-800/10"
                      } ${!sched.enabled ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2 text-slate-200 font-medium">
                        {DAY_LABELS[day]}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={sched.enabled}
                          onChange={() => handleDayToggle(day)}
                          className="size-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500/20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={sched.start}
                          disabled={!sched.enabled}
                          onChange={(e) =>
                            handleDayTime(day, "start", e.target.value)
                          }
                          className="rounded border border-slate-600 bg-slate-800/60 px-2 py-1 text-white text-xs focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={sched.end}
                          disabled={!sched.enabled}
                          onChange={(e) =>
                            handleDayTime(day, "end", e.target.value)
                          }
                          className="rounded border border-slate-600 bg-slate-800/60 px-2 py-1 text-white text-xs focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Out-of-hours message */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Mensaje fuera de horario
          </label>
          <textarea
            rows={2}
            value={draft.outOfHoursMessage ?? ""}
            onChange={(e) =>
              setDraft((p) => ({ ...p, outOfHoursMessage: e.target.value }))
            }
            placeholder="Estamos fuera de horario. Te respondemos pronto."
            className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none resize-none"
          />
        </div>

        {/* Booking URL */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Link de reserva{" "}
            <span className="text-slate-500 font-normal">(opcional)</span>
          </label>
          <input
            type="url"
            value={draft.bookingUrl ?? ""}
            onChange={(e) =>
              setDraft((p) => ({ ...p, bookingUrl: e.target.value }))
            }
            placeholder="https://tu-empresa.com/reservas"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-white text-sm placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
          />
        </div>

        {/* Variables hint */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-sky-800/30 bg-sky-900/10 text-xs text-sky-400/80">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          <p>
            Usá{" "}
            <code className="text-sky-300">system.isBusinessHours</code>,{" "}
            <code className="text-sky-300">system.outOfHoursMessage</code> y{" "}
            <code className="text-sky-300">system.bookingUrl</code> en nodos
            Condición del flujo para ramificar según horario.
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 text-white hover:bg-sky-500 transition-colors"
          >
            {saved ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saved ? "Guardado" : "Guardar horarios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Page ---

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Configuraciones</h1>
          <p className="text-slate-400 mt-1">
            Administra la configuración de tu cuenta y preferencias
          </p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* General Settings */}
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="size-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">
              Configuración General
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Nombre de la empresa
              </label>
              <input
                type="text"
                placeholder="Tu empresa"
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Email de contacto
              </label>
              <input
                type="email"
                placeholder="contacto@empresa.com"
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* LLM Providers */}
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="size-4 text-[#dd7430]" />
            <h2 className="text-lg font-semibold text-white">
              Proveedores LLM
            </h2>
          </div>
          <p className="text-sm text-slate-400 mb-5">
            Conecta los modelos de lenguaje que usarán tus agentes para generar
            respuestas.
          </p>

          <OpenAIConfigCard />

          {/* Future providers — placeholder */}
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 flex items-center gap-3 opacity-50">
            <div className="flex size-10 items-center justify-center rounded-lg bg-slate-700/40 border border-slate-600/30">
              <span className="text-xs font-bold text-slate-400">+</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">
                Más proveedores próximamente
              </p>
              <p className="text-xs text-slate-500">
                Anthropic Claude, Google Gemini, Mistral…
              </p>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <BusinessHoursCard />

        {/* Notifications */}
        <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-4">
            Notificaciones
          </h2>
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="email-alerts"
                defaultChecked
                className="size-4 rounded border-slate-600 bg-slate-800 text-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20"
              />
              <label
                htmlFor="email-alerts"
                className="ml-3 text-sm text-slate-300"
              >
                Recibir alertas por email
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="push-alerts"
                defaultChecked
                className="size-4 rounded border-slate-600 bg-slate-800 text-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20"
              />
              <label
                htmlFor="push-alerts"
                className="ml-3 text-sm text-slate-300"
              >
                Notificaciones push
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors">
          <Save className="size-5" />
          <span>Guardar cambios</span>
        </button>
      </div>
    </div>
  );
}
