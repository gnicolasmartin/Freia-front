"use client";

import { useState } from "react";
import { Upload, CheckCircle2, XCircle, Loader2, Database } from "lucide-react";

const EXPORTABLE_KEYS = [
  "freia_companies",
  "freia_system_users",
  "freia_profiles",
  "freia_agents",
  "freia_flows",
  "freia_products",
  "freia_variant_types",
  "freia_discounts",
  "freia_policies",
  "freia_channels",
  "freia_tool_registry",
  "freia_integrations",
  "freia_conversations",
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function ExportDbPage() {
  const [status, setStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    imported?: Record<string, number>;
    errors?: string[];
  } | null>(null);
  const [localData, setLocalData] = useState<Record<string, unknown[]> | null>(null);

  function collectLocalStorage(): Record<string, unknown[]> {
    const data: Record<string, unknown[]> = {};
    for (const key of EXPORTABLE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            data[key] = parsed;
          }
        }
      } catch {
        // skip invalid keys
      }
    }
    return data;
  }

  function handlePreview() {
    const data = collectLocalStorage();
    setLocalData(data);
  }

  async function handleExport() {
    setStatus("exporting");
    setResult(null);

    try {
      const data = localData ?? collectLocalStorage();

      const res = await fetch(`${API_URL}/seed/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      setResult(json);
      setStatus("done");
    } catch (err) {
      setResult({ errors: [err instanceof Error ? err.message : String(err)] });
      setStatus("error");
    }
  }

  const totalRows = localData
    ? Object.values(localData).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Database className="h-8 w-8 text-[#dd7430]" aria-label="Database" />
          <h1 className="text-2xl font-bold text-white">
            Exportar Base Local → PostgreSQL
          </h1>
        </div>

        <p className="mb-6 text-slate-400">
          Esta herramienta lee los datos de localStorage del navegador y los envía
          al backend para insertarlos en la base de datos PostgreSQL de producción.
        </p>

        {/* Step 1: Preview */}
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">
            1. Vista previa de datos locales
          </h2>
          <button
            onClick={handlePreview}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
          >
            Escanear localStorage
          </button>

          {localData && (
            <div className="mt-4 space-y-1">
              {EXPORTABLE_KEYS.map((key) => {
                const count = localData[key]?.length ?? 0;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className={count > 0 ? "text-white" : "text-slate-500"}>
                      {key}
                    </span>
                    <span
                      className={
                        count > 0
                          ? "font-mono text-emerald-400"
                          : "font-mono text-slate-600"
                      }
                    >
                      {count} registros
                    </span>
                  </div>
                );
              })}
              <div className="mt-3 border-t border-slate-700 pt-3 flex items-center justify-between text-sm font-semibold">
                <span className="text-white">Total</span>
                <span className="font-mono text-[#dd7430]">{totalRows} registros</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Export */}
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">
            2. Enviar a PostgreSQL
          </h2>
          <p className="mb-3 text-sm text-slate-400">
            Destino: <code className="text-[#dd7430]">{API_URL}/seed/import</code>
          </p>
          <button
            onClick={handleExport}
            disabled={status === "exporting" || !localData || totalRows === 0}
            className="flex items-center gap-2 rounded-md bg-[#dd7430] px-4 py-2 text-sm font-medium text-white hover:bg-[#c5642a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "exporting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading" />
                Exportando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" aria-label="Upload" />
                Exportar a producción
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-6 ${
              status === "done"
                ? "border-emerald-700 bg-emerald-900/20"
                : "border-red-700 bg-red-900/20"
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              {status === "done" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-label="Success" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" aria-label="Error" />
              )}
              <h3 className="font-semibold text-white">
                {status === "done" ? "Migración completada" : "Error"}
              </h3>
            </div>

            {result.imported && (
              <div className="space-y-1">
                {Object.entries(result.imported).map(([key, count]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-300">{key}</span>
                    <span className="font-mono text-emerald-400">
                      {count} insertados
                    </span>
                  </div>
                ))}
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-400">
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
