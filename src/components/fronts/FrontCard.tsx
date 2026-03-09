"use client";

import { Globe, Pencil, Trash2, Bot, GitBranch, EyeOff, Upload, CloudOff, History } from "lucide-react";
import type { Front } from "@/types/front";
import { FRONT_STATUS_CONFIG } from "@/types/front";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";

interface FrontCardProps {
  front: Front;
  onEdit: (front: Front) => void;
  onDelete: (id: string) => void;
  onPublish: (front: Front) => void;
  onUnpublish: (front: Front) => void;
  onViewHistory: (front: Front) => void;
}

export default function FrontCard({ front, onEdit, onDelete, onPublish, onUnpublish, onViewHistory }: FrontCardProps) {
  const { agents } = useAgents();
  const { flows } = useFlows();

  const statusCfg = FRONT_STATUS_CONFIG[front.status];
  const isDraft = front.status === "draft";
  const isPublished = front.status === "published";

  const assignedAgents = agents.filter((a) => front.agentIds.includes(a.id));
  const assignedFlows = flows.filter((f) => front.flowIds.includes(f.id));

  const publishedVersion = front.versions?.find((v) => v.id === front.publishedVersionId);
  const totalVersions = front.versions?.length ?? 0;

  return (
    <div
      className={`rounded-xl border p-5 backdrop-blur-sm transition-all group ${
        isDraft
          ? "border-slate-700/50 bg-slate-900/60 opacity-80"
          : "border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-slate-600"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50">
            <Globe className={`size-5 ${isDraft ? "text-slate-600" : "text-slate-300"}`} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-base font-semibold truncate ${isDraft ? "text-slate-500" : "text-white"}`}>
              {front.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}
              >
                {statusCfg.label}
              </span>
              {publishedVersion && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400">
                  v{publishedVersion.version}
                </span>
              )}
              {isDraft && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <EyeOff className="size-3" />
                  No público
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Publish / Unpublish */}
          {isDraft ? (
            <button
              onClick={() => onPublish(front)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors"
              aria-label="Publicar front"
            >
              <Upload className="size-4" />
            </button>
          ) : (
            <button
              onClick={() => onUnpublish(front)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-700/50 transition-colors"
              aria-label="Despublicar front"
            >
              <CloudOff className="size-4" />
            </button>
          )}

          {/* Version history */}
          {totalVersions > 0 && (
            <button
              onClick={() => onViewHistory(front)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-slate-700/50 transition-colors"
              aria-label="Ver historial de versiones"
            >
              <History className="size-4" />
            </button>
          )}

          <button
            onClick={() => onEdit(front)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#dd7430] hover:bg-slate-700/50 transition-colors"
            aria-label={`Editar ${front.name}`}
          >
            <Pencil className="size-4" />
          </button>
          <button
            onClick={() => onDelete(front.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
            aria-label={`Eliminar ${front.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {front.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">
          {front.description}
        </p>
      )}

      {/* Subdomain */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Subdominio</span>
          {isDraft ? (
            <span className="text-slate-400 font-mono text-xs">
              {front.subdomain}.freiatech.com
            </span>
          ) : (
            <a
              href={`/f/${front.subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#dd7430] hover:text-orange-400 font-mono text-xs transition-colors"
            >
              {front.subdomain}.freiatech.com
            </a>
          )}
        </div>

        {/* Agents count */}
        {assignedAgents.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Agentes</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Bot className="size-3.5" />
              <span className="text-xs">
                {assignedAgents.length} {assignedAgents.length === 1 ? "agente" : "agentes"}
              </span>
            </div>
          </div>
        )}

        {/* Flows count */}
        {assignedFlows.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Flujos</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <GitBranch className="size-3.5" />
              <span className="text-xs">
                {assignedFlows.length} {assignedFlows.length === 1 ? "flujo" : "flujos"}
              </span>
            </div>
          </div>
        )}

        {/* Versions */}
        {totalVersions > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Versiones</span>
            <span className="text-xs text-slate-300">
              {totalVersions} {totalVersions === 1 ? "versión" : "versiones"}
            </span>
          </div>
        )}
      </div>

      {/* Footer: branding preview */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {front.branding.primaryColor && (
            <div
              className="size-4 rounded-full border border-slate-600"
              style={{ backgroundColor: front.branding.primaryColor }}
              title={`Color primario: ${front.branding.primaryColor}`}
            />
          )}
          {front.branding.secondaryColor && (
            <div
              className="size-4 rounded-full border border-slate-600"
              style={{ backgroundColor: front.branding.secondaryColor }}
              title={`Color secundario: ${front.branding.secondaryColor}`}
            />
          )}
          {!front.branding.primaryColor && !front.branding.secondaryColor && (
            <span className="text-xs text-slate-600">Sin branding</span>
          )}
        </div>
        <span className="text-xs text-slate-600">
          {new Date(front.updatedAt).toLocaleDateString("es-AR")}
        </span>
      </div>
    </div>
  );
}
