"use client";

import { useState, useEffect } from "react";
import { X, Zap, CheckCircle, AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import type { Integration, WebhookEventSample } from "@/types/integration";
import { WEBHOOK_EVENT_SAMPLES, processWebhookPayload } from "@/types/integration";

interface WebhookSimulateModalProps {
  integration: Integration;
  onClose: () => void;
  onSimulate: (
    eventType: string,
    payload: Record<string, unknown>,
    result: ReturnType<typeof processWebhookPayload>
  ) => void;
  onFail: (eventType: string, payload: Record<string, unknown>) => void;
}

const labelClasses = "block text-xs font-medium text-slate-300 mb-1";
const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-colors";

export default function WebhookSimulateModal({
  integration,
  onClose,
  onSimulate,
  onFail,
}: WebhookSimulateModalProps) {
  const samples = WEBHOOK_EVENT_SAMPLES[integration.type];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [payloadText, setPayloadText] = useState("");
  const [payloadError, setPayloadError] = useState("");
  const [result, setResult] = useState<ReturnType<typeof processWebhookPayload> | null>(null);
  const [simulateFail, setSimulateFail] = useState(false);
  const [enqueuedMsg, setEnqueuedMsg] = useState("");

  // Populate textarea when sample changes
  useEffect(() => {
    const sample = samples[selectedIdx];
    if (sample) {
      setPayloadText(JSON.stringify(sample.payload, null, 2));
      setPayloadError("");
      setResult(null);
      setEnqueuedMsg("");
    }
  }, [selectedIdx, samples]);

  const handleExecute = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payloadText) as Record<string, unknown>;
      setPayloadError("");
    } catch {
      setPayloadError("JSON inválido — revisá la sintaxis");
      return;
    }

    const eventType = samples[selectedIdx]?.eventType ?? "custom";

    if (simulateFail) {
      onFail(eventType, parsed);
      setEnqueuedMsg(`Evento "${eventType}" encolado para reintento — fallo de conexión simulado`);
      setResult(null);
      return;
    }

    const outcome = processWebhookPayload(parsed, integration.fieldMappings);
    setResult(outcome);
    setEnqueuedMsg("");
    onSimulate(eventType, parsed, outcome);
  };

  const selectedSample: WebhookEventSample | undefined = samples[selectedIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/20">
              <Zap className="size-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Simular evento webhook</h2>
              <p className="text-[11px] text-slate-400">{integration.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Event type selector */}
          <div>
            <label className={labelClasses}>Tipo de evento</label>
            <select
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
              className={inputClasses}
            >
              {samples.map((s, i) => (
                <option key={i} value={i}>
                  {s.label} ({s.eventType})
                </option>
              ))}
            </select>
          </div>

          {/* Payload editor */}
          <div>
            <label className={labelClasses}>Payload (JSON editable)</label>
            <textarea
              value={payloadText}
              onChange={(e) => {
                setPayloadText(e.target.value);
                setPayloadError("");
                setResult(null);
                setEnqueuedMsg("");
              }}
              rows={10}
              className={`${inputClasses} font-mono text-xs resize-y`}
            />
            {payloadError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {payloadError}
              </p>
            )}
          </div>

          {/* Fail mode toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => {
                setSimulateFail((v) => !v);
                setResult(null);
                setEnqueuedMsg("");
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                simulateFail ? "bg-red-600" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  simulateFail ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-xs text-slate-400">
              Simular fallo de conexión{" "}
              {simulateFail && (
                <span className="text-red-400 font-medium">— encola para reintento</span>
              )}
            </span>
          </label>

          {/* Success / Ignored result */}
          {result && (
            <div
              className={`rounded-xl border p-4 ${
                result.status === "processed"
                  ? "border-emerald-800/50 bg-emerald-900/10"
                  : "border-slate-700 bg-slate-800/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {result.status === "processed" ? (
                  <CheckCircle className="size-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-400" />
                )}
                <span
                  className={`text-xs font-semibold ${
                    result.status === "processed" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {result.status === "processed" ? "Procesado" : "Ignorado"}
                </span>
                <span className="text-xs text-slate-400">— {result.message}</span>
              </div>

              {result.mappedFields.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Campos actualizados
                  </p>
                  {result.mappedFields.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[11px] font-mono bg-slate-800/50 rounded-lg px-3 py-1.5"
                    >
                      <span className="text-sky-400 truncate">{f.externalField}</span>
                      <ArrowRight className="size-3 text-slate-600 shrink-0" />
                      <span className="text-emerald-400 truncate">{f.freiaField}</span>
                      <span className="text-slate-500 ml-auto shrink-0">
                        {String(f.value).slice(0, 30)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enqueued message */}
          {enqueuedMsg && (
            <div className="rounded-xl border border-amber-800/50 bg-amber-900/10 p-4 flex items-center gap-2">
              <RotateCcw className="size-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400">{enqueuedMsg}</p>
            </div>
          )}

          {/* No samples available */}
          {samples.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">
              No hay eventos de muestra para integraciones de tipo Custom.
              <br />
              Editá el payload manualmente.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          {(result || enqueuedMsg) && (
            <button
              type="button"
              onClick={() => { setResult(null); setEnqueuedMsg(""); }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              Limpiar resultado
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleExecute}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors text-white ${
              simulateFail ? "bg-red-600 hover:bg-red-700" : "bg-sky-600 hover:bg-sky-700"
            }`}
          >
            {simulateFail ? <RotateCcw className="size-4" /> : <Zap className="size-4" />}
            {simulateFail ? "Simular fallo" : "Ejecutar simulación"}
          </button>
        </div>
      </div>
    </div>
  );
}
