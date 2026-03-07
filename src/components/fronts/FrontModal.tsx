"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Globe, Palette, Link2, AlertCircle, Check, FileText, Shield, Braces } from "lucide-react";
import { useFronts } from "@/providers/FrontsProvider";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import FrontPagesPanel from "./FrontPagesPanel";
import FrontAuthPanel from "./FrontAuthPanel";
import FrontVariablesPanel from "./FrontVariablesPanel";
import type { Front, FrontFormData, FrontTemplate } from "@/types/front";
import { EMPTY_FRONT_FORM, validateSubdomain, FRONT_TEMPLATES } from "@/types/front";

interface FrontModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingFront?: Front | null;
}

type Tab = "general" | "branding" | "assignments" | "pages" | "auth";

const BASE_TABS: { key: Tab; label: string; icon: React.FC<{ className?: string }>; editOnly?: boolean }[] = [
  { key: "general", label: "General", icon: Globe },
  { key: "branding", label: "Branding", icon: Palette },
  { key: "assignments", label: "Asignaciones", icon: Link2 },
  { key: "pages", label: "Páginas", icon: FileText, editOnly: true },
  { key: "auth", label: "Acceso", icon: Shield, editOnly: true },
];

export default function FrontModal({ isOpen, onClose, editingFront }: FrontModalProps) {
  const { createFront, updateFront, isSubdomainAvailable } = useFronts();
  const { agents } = useAgents();
  const { flows } = useFlows();

  const [formData, setFormData] = useState<FrontFormData>({ ...EMPTY_FRONT_FORM });
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingFront) {
        const { id, createdAt, updatedAt, publishedVersionId, versions, pages, authConfig, ...rest } = editingFront;
        setFormData({ ...EMPTY_FRONT_FORM, ...rest });
      } else {
        setFormData({ ...EMPTY_FRONT_FORM });
      }
      setActiveTab("general");
      setSubmitAttempted(false);
    }
  }, [isOpen, editingFront]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Validation
  const subdomainFormatError = validateSubdomain(formData.subdomain);
  const subdomainTaken =
    formData.subdomain &&
    !subdomainFormatError &&
    !isSubdomainAvailable(formData.subdomain, editingFront?.id);
  const subdomainError = subdomainFormatError || (subdomainTaken ? "Este subdominio ya está en uso" : null);

  const nameError = !formData.name.trim() ? "El nombre es obligatorio" : null;
  const isValid = !nameError && !subdomainError;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!isValid) return;

    if (editingFront) {
      updateFront(editingFront.id, formData);
    } else {
      createFront(formData);
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const toggleAgent = (agentId: string) => {
    setFormData((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(agentId)
        ? prev.agentIds.filter((id) => id !== agentId)
        : [...prev.agentIds, agentId],
    }));
  };

  const toggleFlow = (flowId: string) => {
    setFormData((prev) => ({
      ...prev,
      flowIds: prev.flowIds.includes(flowId)
        ? prev.flowIds.filter((id) => id !== flowId)
        : [...prev.flowIds, flowId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">
            {editingFront ? "Editar Front" : "Nuevo Front"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 px-6">
          {BASE_TABS
            .filter((tab) => !tab.editOnly || editingFront)
            .map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === key
                  ? "border-[#dd7430] text-[#dd7430]"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {activeTab === "general" && (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Mi Front de ventas"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430]"
                />
                {submitAttempted && nameError && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="size-3" /> {nameError}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe el propósito de este front..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430] resize-none"
                />
              </div>

              {/* Subdomain */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Subdominio <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.subdomain}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      }))
                    }
                    placeholder="mi-empresa"
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white font-mono placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430]"
                  />
                  <span className="text-slate-400 text-sm whitespace-nowrap">.freia.app</span>
                </div>
                {submitAttempted && subdomainError && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="size-3" /> {subdomainError}
                  </p>
                )}
                {formData.subdomain && !subdomainError && (
                  <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="size-3" /> Subdominio disponible
                  </p>
                )}
              </div>

              {/* Status — read-only, controlled via publish/unpublish actions */}
              {editingFront && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Estado
                  </label>
                  <div className={`px-4 py-2.5 rounded-lg border text-sm font-medium ${
                    editingFront.status === "published"
                      ? "border-emerald-700/50 bg-emerald-900/10 text-emerald-400"
                      : "border-slate-600 bg-slate-700/30 text-slate-400"
                  }`}>
                    {editingFront.status === "published" ? "Publicado" : "Borrador"}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Usa los botones de Publicar / Despublicar en la tarjeta para cambiar el estado.
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "branding" && (
            <>
              {/* Template selector */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Template de diseño
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Custom / no template option */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        branding: { ...p.branding, template: undefined },
                      }))
                    }
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      !formData.branding.template
                        ? "border-[#dd7430] bg-[#dd7430]/5"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex gap-2 mb-2 h-5">
                      <div className="flex-1 rounded bg-slate-600" />
                      <div className="flex-1 rounded bg-slate-700" />
                    </div>
                    <p className="text-sm font-medium text-white">Personalizado</p>
                    <p className="text-[11px] text-slate-400">Colores manuales</p>
                  </button>

                  {/* Template options */}
                  {(Object.entries(FRONT_TEMPLATES) as [FrontTemplate, typeof FRONT_TEMPLATES[FrontTemplate]][]).map(([key, tpl]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          branding: {
                            ...p.branding,
                            template: key,
                            primaryColor: tpl.primaryColor,
                            secondaryColor: tpl.secondaryColor,
                          },
                        }))
                      }
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        formData.branding.template === key
                          ? "border-[#dd7430] bg-[#dd7430]/5"
                          : "border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex gap-1 mb-2 h-5 rounded overflow-hidden">
                        <div className="flex-1" style={{ backgroundColor: tpl.primaryColor }} />
                        <div className="flex-1" style={{ backgroundColor: tpl.secondaryColor }} />
                        <div className="w-3" style={{ backgroundColor: tpl.accentColor }} />
                      </div>
                      <p className="text-sm font-medium text-white">{tpl.label}</p>
                      <p className="text-[11px] text-slate-400">{tpl.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  URL del Logo
                </label>
                <input
                  type="url"
                  value={formData.branding.logoUrl ?? ""}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      branding: { ...p.branding, logoUrl: e.target.value || undefined },
                    }))
                  }
                  placeholder="https://ejemplo.com/logo.png"
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430]"
                />
                {formData.branding.logoUrl && (
                  <div className="mt-3 flex items-center justify-center p-4 rounded-lg border border-slate-700 bg-slate-900/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.branding.logoUrl}
                      alt="Logo preview"
                      className="max-h-16 max-w-[200px] object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Color Primario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.branding.primaryColor ?? "#dd7430"}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        branding: { ...p.branding, primaryColor: e.target.value },
                      }))
                    }
                    className="size-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.branding.primaryColor ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        branding: { ...p.branding, primaryColor: e.target.value || undefined },
                      }))
                    }
                    placeholder="#dd7430"
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430]"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Color Secundario
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.branding.secondaryColor ?? "#1e293b"}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        branding: { ...p.branding, secondaryColor: e.target.value },
                      }))
                    }
                    className="size-10 rounded-lg border border-slate-600 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.branding.secondaryColor ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        branding: { ...p.branding, secondaryColor: e.target.value || undefined },
                      }))
                    }
                    placeholder="#1e293b"
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-white font-mono text-sm placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430]"
                  />
                </div>
              </div>

              {/* Branding Preview */}
              {(formData.branding.primaryColor || formData.branding.secondaryColor || formData.branding.template) && (
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  <div
                    className="h-8"
                    style={{ backgroundColor: formData.branding.primaryColor ?? "#dd7430" }}
                  />
                  <div
                    className="h-16 flex items-center justify-center"
                    style={{ backgroundColor: formData.branding.secondaryColor ?? "#1e293b" }}
                  >
                    <span className="text-xs text-white/60">
                      {formData.branding.template
                        ? `Template: ${FRONT_TEMPLATES[formData.branding.template].label}`
                        : "Vista previa del branding"}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "assignments" && (
            <>
              {/* Agents */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Agentes asignados
                </label>
                {agents.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay agentes creados aún.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {agents.map((agent) => (
                      <label
                        key={agent.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          formData.agentIds.includes(agent.id)
                            ? "border-[#dd7430]/50 bg-[#dd7430]/5"
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.agentIds.includes(agent.id)}
                          onChange={() => toggleAgent(agent.id)}
                          className="size-4 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-white">{agent.name}</span>
                          {agent.description && (
                            <span className="text-xs text-slate-500 block truncate">
                              {agent.description}
                            </span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          agent.status === "active"
                            ? "bg-emerald-900/30 text-emerald-400"
                            : "bg-slate-700/50 text-slate-400"
                        }`}>
                          {agent.status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Flows */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Flujos asignados
                </label>
                {flows.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay flujos creados aún.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {flows.map((flow) => (
                      <label
                        key={flow.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          formData.flowIds.includes(flow.id)
                            ? "border-[#dd7430]/50 bg-[#dd7430]/5"
                            : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.flowIds.includes(flow.id)}
                          onChange={() => toggleFlow(flow.id)}
                          className="size-4 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-white">{flow.name}</span>
                          {flow.description && (
                            <span className="text-xs text-slate-500 block truncate">
                              {flow.description}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {formData.flowIds.length > 0 && (
                <button
                  onClick={() => setShowVariables(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm hover:text-[#dd7430] hover:border-[#dd7430]/40 transition-colors"
                >
                  <Braces className="size-4" />
                  Ver variables disponibles
                  <span className="ml-auto text-[10px] text-slate-600">
                    {formData.flowIds.length} flujo{formData.flowIds.length !== 1 ? "s" : ""}
                  </span>
                </button>
              )}

              {formData.agentIds.length === 0 && formData.flowIds.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  Selecciona al menos un agente o flujo para este front.
                </p>
              )}
            </>
          )}

          {activeTab === "pages" && editingFront && (
            <FrontPagesPanel front={editingFront} />
          )}

          {activeTab === "auth" && editingFront && (
            <FrontAuthPanel front={editingFront} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors text-sm"
          >
            {editingFront ? "Guardar cambios" : "Crear Front"}
          </button>
        </div>
      </div>

      {/* Variables Panel */}
      {showVariables && (
        <FrontVariablesPanel
          flowIds={formData.flowIds}
          onClose={() => setShowVariables(false)}
        />
      )}
    </div>
  );
}
