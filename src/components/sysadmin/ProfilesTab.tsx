"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { useProfiles } from "@/providers/ProfileProvider";
import { useCompanies } from "@/providers/CompanyProvider";
import type { Profile, ModulePermission } from "@/types/user-management";
import ProfileModal from "./ProfileModal";

export default function ProfilesTab() {
  const { profiles, createProfile, updateProfile, deleteProfile } = useProfiles();
  const { getCompany } = useCompanies();

  const [modal, setModal] = useState<{ open: boolean; editing: Profile | null }>({ open: false, editing: null });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSave = (data: { name: string; companyId: string; permissions: ModulePermission[] }) => {
    if (modal.editing) {
      updateProfile(modal.editing.id, { name: data.name, permissions: data.permissions });
    } else {
      createProfile(data);
    }
    setModal({ open: false, editing: null });
  };

  const handleDuplicate = (p: Profile) => {
    createProfile({
      name: `${p.name} (copia)`,
      companyId: p.companyId,
      permissions: [...p.permissions],
    });
  };

  // Group profiles by company
  const byCompany = new Map<string, Profile[]>();
  for (const p of profiles) {
    const group = byCompany.get(p.companyId) ?? [];
    group.push(p);
    byCompany.set(p.companyId, group);
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-4" />
          Crear perfil
        </button>
      </div>

      {/* Profiles grouped by company */}
      {byCompany.size === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-500">
          No hay perfiles registrados
        </div>
      ) : (
        Array.from(byCompany.entries()).map(([companyId, companyProfiles]) => {
          const company = getCompany(companyId);
          return (
            <div key={companyId} className="space-y-2">
              <h3 className="text-sm font-medium text-slate-300 px-1">
                {company?.name ?? "Empresa desconocida"}
              </h3>
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Permisos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Creado</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {companyProfiles.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-300 bg-slate-700/50 px-2 py-1 rounded-md">
                            {p.permissions.length} permisos
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(p.createdAt).toLocaleDateString("es-AR")}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModal({ open: true, editing: p })}
                              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                              aria-label="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(p)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
                              aria-label="Duplicar"
                            >
                              <Copy className="size-3.5" />
                            </button>
                            {confirmDelete === p.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { deleteProfile(p.id); setConfirmDelete(null); }} className="px-2 py-1 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50">
                                  Confirmar
                                </button>
                                <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white">
                                  No
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(p.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors" aria-label="Eliminar">
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {/* Profile Modal */}
      {modal.open && (
        <ProfileModal
          editing={modal.editing}
          onSave={handleSave}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}
