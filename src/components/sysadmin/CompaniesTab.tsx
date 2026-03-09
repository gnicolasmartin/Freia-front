"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Ban, CheckCircle } from "lucide-react";
import { useCompanies } from "@/providers/CompanyProvider";
import { useUserManagement } from "@/providers/UserManagementProvider";
import { COMPANY_STATUS_CONFIG } from "@/types/user-management";
import type { Company, CompanyStatus } from "@/types/user-management";

export default function CompaniesTab() {
  const { companies, createCompany, updateCompany, deleteCompany } = useCompanies();
  const { getUsersByCompany } = useUserManagement();
  const [modal, setModal] = useState<{ open: boolean; editing: Company | null }>({ open: false, editing: null });
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openCreate = () => {
    setName("");
    setModal({ open: true, editing: null });
  };

  const openEdit = (c: Company) => {
    setName(c.name);
    setModal({ open: true, editing: c });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (modal.editing) {
      updateCompany(modal.editing.id, { name: name.trim() });
    } else {
      createCompany({ name: name.trim() });
    }
    setModal({ open: false, editing: null });
  };

  const handleToggleStatus = (c: Company) => {
    const newStatus: CompanyStatus = c.status === "active" ? "suspended" : "active";
    updateCompany(c.id, { status: newStatus });
  };

  const handleDelete = (id: string) => {
    deleteCompany(id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-4" />
          Crear empresa
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Usuarios</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Creada</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {companies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay empresas registradas
                </td>
              </tr>
            ) : (
              companies.map((c) => {
                const statusCfg = COMPANY_STATUS_CONFIG[c.status];
                const userCount = getUsersByCompany(c.id).length;
                return (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.bg} border ${statusCfg.border}`}>
                        <span className={`size-1.5 rounded-full ${c.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{userCount}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.createdAt).toLocaleDateString("es-AR")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" aria-label="Editar">
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className={`p-1.5 rounded-md transition-colors ${c.status === "active" ? "text-slate-400 hover:text-amber-400 hover:bg-amber-900/20" : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20"}`}
                          aria-label={c.status === "active" ? "Suspender" : "Activar"}
                        >
                          {c.status === "active" ? <Ban className="size-3.5" /> : <CheckCircle className="size-3.5" />}
                        </button>
                        {confirmDelete === c.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(c.id)} className="px-2 py-1 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50">
                              Confirmar
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(c.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors" aria-label="Eliminar">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {modal.editing ? "Editar empresa" : "Crear empresa"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
                  placeholder="Nombre de la empresa"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setModal({ open: false, editing: null })}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {modal.editing ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
