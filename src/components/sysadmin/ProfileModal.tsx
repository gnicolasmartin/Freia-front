"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { useCompanies } from "@/providers/CompanyProvider";
import { MODULE_PERMISSION_CONFIG, TOP_LEVEL_MODULES } from "@/types/user-management";
import type { Profile, ModulePermission, TopLevelModule } from "@/types/user-management";

interface ProfileModalProps {
  editing: Profile | null;
  onSave: (data: { name: string; companyId: string; permissions: ModulePermission[] }) => void;
  onClose: () => void;
}

export default function ProfileModal({ editing, onSave, onClose }: ProfileModalProps) {
  const { companies } = useCompanies();
  const activeCompanies = companies.filter((c) => c.status === "active");

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [permissions, setPermissions] = useState<Set<ModulePermission>>(new Set());

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setCompanyId(editing.companyId);
      setPermissions(new Set(editing.permissions));
    }
  }, [editing]);

  const toggleModule = (mod: TopLevelModule) => {
    const config = MODULE_PERMISSION_CONFIG[mod];
    const allKeys: ModulePermission[] = [mod, ...config.subPermissions.map((s) => s.key)];
    const allSelected = allKeys.every((k) => permissions.has(k));

    setPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allKeys.forEach((k) => next.delete(k));
      } else {
        allKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const togglePermission = (perm: ModulePermission) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  };

  const canSave = name.trim() && companyId;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      companyId,
      permissions: Array.from(permissions),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-slate-700 bg-slate-900/95 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-lg font-semibold text-white">
            {editing ? "Editar perfil" : "Crear perfil"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del perfil</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
              placeholder="Ej: Operador, Solo lectura, Editor..."
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Empresa</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={!!editing}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none disabled:opacity-50"
            >
              <option value="">Seleccionar empresa...</option>
              {activeCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Permisos ({permissions.size} seleccionados)
            </label>
            <div className="space-y-2">
              {TOP_LEVEL_MODULES.map((mod) => {
                const config = MODULE_PERMISSION_CONFIG[mod];
                const allKeys: ModulePermission[] = [mod, ...config.subPermissions.map((s) => s.key)];
                const allSelected = allKeys.every((k) => permissions.has(k));
                const someSelected = allKeys.some((k) => permissions.has(k));

                return (
                  <div key={mod} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                    {/* Module toggle */}
                    <button
                      onClick={() => toggleModule(mod)}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      <div className={`size-4 rounded border flex items-center justify-center transition-colors ${
                        allSelected
                          ? "bg-[#dd7430] border-[#dd7430]"
                          : someSelected
                            ? "bg-[#dd7430]/40 border-[#dd7430]/60"
                            : "border-slate-500 bg-slate-800"
                      }`}>
                        {(allSelected || someSelected) && <Check className="size-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-white">{config.label}</span>
                    </button>

                    {/* Sub-permissions */}
                    {config.subPermissions.length > 0 && (
                      <div className="mt-2 ml-6 flex flex-wrap gap-2">
                        {config.subPermissions.map((sub) => {
                          const selected = permissions.has(sub.key);
                          return (
                            <button
                              key={sub.key}
                              onClick={() => togglePermission(sub.key)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                                selected
                                  ? "bg-[#dd7430]/20 text-[#dd7430] border border-[#dd7430]/40"
                                  : "bg-slate-800 text-slate-400 border border-slate-600 hover:text-white"
                              }`}
                            >
                              <div className={`size-3 rounded-sm border flex items-center justify-center ${
                                selected ? "bg-[#dd7430] border-[#dd7430]" : "border-slate-500"
                              }`}>
                                {selected && <Check className="size-2 text-white" />}
                              </div>
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-700 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40"
          >
            {editing ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
