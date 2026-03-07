"use client";

import { useState } from "react";
import { Globe, Plus, X, Upload, CloudOff, Clock, AlertTriangle, Eye, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useFronts } from "@/providers/FrontsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { useAuditLog } from "@/providers/AuditLogProvider";
import { useAuth } from "@/providers/AuthProvider";
import FrontModal from "@/components/fronts/FrontModal";
import FrontCard from "@/components/fronts/FrontCard";
import type { Front, FrontVersion } from "@/types/front";
import { validateFrontForPublish, type FrontValidationError } from "@/lib/front-validation";

export default function FrontsPage() {
  const { fronts, deleteFront, publishFront, unpublishFront, restoreVersion } = useFronts();
  const { flows } = useFlows();
  const { addEntry } = useAuditLog();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFront, setEditingFront] = useState<Front | null>(null);
  const [historyFront, setHistoryFront] = useState<Front | null>(null);
  const [validationErrors, setValidationErrors] = useState<FrontValidationError[]>([]);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  const performedBy = user?.name ?? user?.email ?? "admin";

  const handleNewFront = () => {
    setEditingFront(null);
    setIsModalOpen(true);
  };

  const handleEditFront = (front: Front) => {
    setEditingFront(front);
    setIsModalOpen(true);
  };

  const handleDeleteFront = (id: string) => {
    const front = fronts.find((f) => f.id === id);
    if (!front) return;
    if (confirm(`¿Eliminar el front "${front.name}"? Esta acción no se puede deshacer.`)) {
      deleteFront(id);
    }
  };

  const handlePublish = (front: Front) => {
    const errors = validateFrontForPublish(front, flows);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (!confirm(`¿Publicar "${front.name}" en ${front.subdomain}.freia.app?`)) return;
    const version = publishFront(front.id, performedBy);
    if (version) {
      addEntry({
        type: "front_published",
        frontId: front.id,
        frontName: front.name,
        subdomain: front.subdomain,
        version: version.version,
        performedBy,
      });
    }
  };

  const handleUnpublish = (front: Front) => {
    if (!confirm(`¿Despublicar "${front.name}"? El acceso web dejará de estar disponible.`)) return;
    const version = unpublishFront(front.id, performedBy);
    if (version) {
      addEntry({
        type: "front_unpublished",
        frontId: front.id,
        frontName: front.name,
        subdomain: front.subdomain,
        version: version.version,
        performedBy,
      });
    }
  };

  const handleViewHistory = (front: Front) => {
    setHistoryFront(front);
  };

  const handleRestore = (front: Front, version: FrontVersion) => {
    const nextVersion = (front.versions.length > 0
      ? Math.max(...front.versions.map((v) => v.version))
      : 0) + 1;
    if (!confirm(`¿Restaurar v${version.version}? Se creará v${nextVersion} con el contenido de v${version.version}.`)) return;
    const restored = restoreVersion(front.id, version.id, performedBy);
    if (restored) {
      addEntry({
        type: "front_version_restored",
        frontId: front.id,
        frontName: front.name,
        subdomain: front.subdomain,
        version: restored.version,
        performedBy,
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFront(null);
  };

  // Keep historyFront in sync with latest state
  const currentHistoryFront = historyFront
    ? fronts.find((f) => f.id === historyFront.id) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Fronts</h1>
          <p className="text-slate-400 mt-1">
            Configura accesos web dedicados con subdominio propio
          </p>
        </div>
        <button
          onClick={handleNewFront}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-5" />
          <span>Nuevo Front</span>
        </button>
      </div>

      {/* Grid or Empty State */}
      {fronts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fronts.map((front) => (
            <FrontCard
              key={front.id}
              front={front}
              onEdit={handleEditFront}
              onDelete={handleDeleteFront}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-16 backdrop-blur-sm">
          <Globe className="size-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            No hay fronts configurados
          </h2>
          <p className="text-slate-400 text-center max-w-md mb-6">
            Crea tu primer front web dedicado y asígnale agentes y flujos para
            publicar un acceso personalizado para tus usuarios.
          </p>
          <button
            onClick={handleNewFront}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-5" />
            <span>Crear primer front</span>
          </button>
        </div>
      )}

      {/* Modal */}
      <FrontModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingFront={editingFront}
      />

      {/* Validation Errors Modal */}
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-xl border border-red-800/50 bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-red-400" />
                <h2 className="text-lg font-semibold text-white">
                  No se puede publicar
                </h2>
              </div>
              <button
                onClick={() => setValidationErrors([])}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-400 mb-3">
                Se encontraron {validationErrors.length} error{validationErrors.length > 1 ? "es" : ""} que deben corregirse:
              </p>
              <div className="space-y-2">
                {validationErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3 rounded-lg border border-red-900/30 bg-red-900/10"
                  >
                    <AlertTriangle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="text-slate-400">
                        {err.pageTitle} → {err.sectionLabel}
                      </span>
                      <p className="text-red-300 mt-0.5">{err.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setValidationErrors([])}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Drawer */}
      {currentHistoryFront && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setHistoryFront(null)}
          />
          <div className="relative w-full max-w-md bg-slate-800 border-l border-slate-700 h-full overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4 sticky top-0 bg-slate-800 z-10">
              <h2 className="text-lg font-semibold text-white">
                Historial de versiones
              </h2>
              <button
                onClick={() => setHistoryFront(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="Cerrar historial"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-slate-400 mb-4">
                {currentHistoryFront.name} &middot;{" "}
                <span className="font-mono">{currentHistoryFront.subdomain}.freia.app</span>
              </p>

              {currentHistoryFront.versions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No hay versiones publicadas aún.
                </p>
              ) : (
                <div className="space-y-3">
                  {[...currentHistoryFront.versions]
                    .sort((a, b) => b.version - a.version)
                    .map((version) => {
                      const isCurrent = version.id === currentHistoryFront.publishedVersionId;
                      const wasUnpublished = !!version.unpublishedAt;

                      return (
                        <div
                          key={version.id}
                          className={`rounded-lg border p-4 ${
                            isCurrent
                              ? "border-emerald-700/50 bg-emerald-900/10"
                              : "border-slate-700 bg-slate-800/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-medium text-white">
                                v{version.version}
                              </span>
                              {isCurrent && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">
                                  Activa
                                </span>
                              )}
                              {wasUnpublished && !isCurrent && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                                  Despublicada
                                </span>
                              )}
                            </div>
                            {!isCurrent && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setPreviewVersionId(previewVersionId === version.id ? null : version.id)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-700 transition-colors"
                                  aria-label={`Vista previa v${version.version}`}
                                >
                                  {previewVersionId === version.id ? <ChevronUp className="size-3.5" /> : <Eye className="size-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleRestore(currentHistoryFront, version)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition-colors"
                                  aria-label={`Restaurar v${version.version}`}
                                >
                                  <RotateCcw className="size-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2 text-slate-400">
                              <Upload className="size-3" />
                              <span>
                                Publicada por <span className="text-slate-300">{version.publishedBy}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <Clock className="size-3" />
                              <span>
                                {new Date(version.publishedAt).toLocaleString("es-AR")}
                              </span>
                            </div>

                            {wasUnpublished && (
                              <>
                                <div className="flex items-center gap-2 text-slate-400 mt-1">
                                  <CloudOff className="size-3" />
                                  <span>
                                    Despublicada por{" "}
                                    <span className="text-slate-300">{version.unpublishedBy}</span>
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-500">
                                  <Clock className="size-3" />
                                  <span>
                                    {new Date(version.unpublishedAt!).toLocaleString("es-AR")}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Snapshot summary */}
                          <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-500">
                            {version.snapshot.agentIds.length} agentes &middot;{" "}
                            {version.snapshot.flowIds.length} flujos &middot;{" "}
                            {version.snapshot.pages.length} páginas
                          </div>

                          {/* Preview panel */}
                          {previewVersionId === version.id && (
                            <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
                              <div>
                                <h4 className="text-xs font-medium text-slate-300 mb-1">Snapshot</h4>
                                <div className="space-y-1 text-xs text-slate-400">
                                  <p><span className="text-slate-500">Nombre:</span> {version.snapshot.name}</p>
                                  {version.snapshot.description && (
                                    <p><span className="text-slate-500">Descripción:</span> {version.snapshot.description}</p>
                                  )}
                                  <p><span className="text-slate-500">Subdominio:</span> <span className="font-mono">{version.snapshot.subdomain}.freia.app</span></p>
                                  {version.snapshot.branding.primaryColor && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-500">Color primario:</span>
                                      <span
                                        className="inline-block size-3 rounded-full border border-slate-600"
                                        style={{ backgroundColor: version.snapshot.branding.primaryColor }}
                                      />
                                      <span className="font-mono">{version.snapshot.branding.primaryColor}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {version.snapshot.pages.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-slate-300 mb-1">Páginas</h4>
                                  <div className="space-y-1">
                                    {version.snapshot.pages
                                      .sort((a, b) => a.order - b.order)
                                      .map((page) => (
                                        <div key={page.id} className="flex items-center justify-between text-xs">
                                          <span className="text-slate-400">
                                            <span className="font-mono text-slate-500">/{page.slug}</span> {page.title}
                                          </span>
                                          <span className="text-slate-500">{page.sections.length} secciones</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Diff vs current */}
                              {(() => {
                                const currentSlugs = new Set(currentHistoryFront.pages.map((p) => p.slug));
                                const snapshotSlugs = new Set(version.snapshot.pages.map((p) => p.slug));
                                const added = currentHistoryFront.pages.filter((p) => !snapshotSlugs.has(p.slug));
                                const removed = version.snapshot.pages.filter((p) => !currentSlugs.has(p.slug));
                                if (added.length === 0 && removed.length === 0) return null;
                                return (
                                  <div>
                                    <h4 className="text-xs font-medium text-slate-300 mb-1">Diferencias vs estado actual</h4>
                                    <div className="space-y-0.5 text-xs">
                                      {removed.map((p) => (
                                        <p key={p.id} className="text-amber-400">
                                          + /{p.slug} (en snapshot, no en actual)
                                        </p>
                                      ))}
                                      {added.map((p) => (
                                        <p key={p.id} className="text-sky-400">
                                          − /{p.slug} (en actual, no en snapshot)
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
