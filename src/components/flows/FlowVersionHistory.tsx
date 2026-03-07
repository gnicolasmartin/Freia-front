"use client";

import { useState } from "react";
import { X, History, Rocket, RotateCcw, AlertTriangle } from "lucide-react";
import type { FlowVersion } from "@/types/flow";

interface FlowVersionHistoryProps {
  versions: FlowVersion[];
  currentVersionId?: string;
  onRestore: (versionId: string) => void;
  onClose: () => void;
}

export default function FlowVersionHistory({
  versions,
  currentVersionId,
  onRestore,
  onClose,
}: FlowVersionHistoryProps) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  const [confirmRestore, setConfirmRestore] = useState<FlowVersion | null>(
    null
  );

  const handleRestore = () => {
    if (confirmRestore) {
      onRestore(confirmRestore.id);
      setConfirmRestore(null);
    }
  };

  return (
    <div className="w-72 border-l border-slate-700 bg-slate-900/95 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <History className="size-4 text-slate-400" />
          <span className="text-sm font-semibold text-white">Versiones</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Rocket className="size-8 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400">Sin versiones publicadas</p>
            <p className="text-xs text-slate-500 mt-1">
              Publicá el flujo para crear la primera versión
            </p>
          </div>
        ) : (
          sorted.map((version) => {
            const isCurrent = version.id === currentVersionId;
            const date = new Date(version.publishedAt);

            return (
              <div
                key={version.id}
                className={`rounded-lg px-3 py-2.5 transition-colors ${
                  isCurrent
                    ? "bg-[#dd7430]/10 border border-[#dd7430]/30"
                    : "bg-slate-800/50 border border-transparent hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    Versión {version.version}
                  </span>
                  <div className="flex items-center gap-1">
                    {isCurrent && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#dd7430]/20 text-[#dd7430]">
                        Actual
                      </span>
                    )}
                    {!isCurrent && (
                      <button
                        onClick={() => setConfirmRestore(version)}
                        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                        title="Restaurar esta versión"
                      >
                        <RotateCcw className="size-3" />
                        Restaurar
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {date.toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  a las{" "}
                  {date.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {version.nodes.length}{" "}
                  {version.nodes.length === 1 ? "nodo" : "nodos"},{" "}
                  {version.edges.length}{" "}
                  {version.edges.length === 1 ? "conexión" : "conexiones"}
                </p>
                {version.restoredFrom && (
                  <p className="text-xs text-amber-500/70 mt-0.5 flex items-center gap-1">
                    <RotateCcw className="size-2.5" />
                    Restaurada desde v{version.restoredFrom}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Restore confirmation modal */}
      {confirmRestore && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-900/30">
                <AlertTriangle className="size-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-white">
                Restaurar versión
              </h3>
            </div>
            <p className="text-xs text-slate-300 mb-1">
              ¿Restaurar{" "}
              <span className="font-semibold text-white">
                Versión {confirmRestore.version}
              </span>
              ?
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Se creará una nueva versión con el contenido de la v
              {confirmRestore.version}. El draft actual y las versiones
              anteriores no se modifican.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestore}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#dd7430] text-white hover:bg-[#c4652a] transition-colors"
              >
                <RotateCcw className="size-3" />
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
