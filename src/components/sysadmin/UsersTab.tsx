"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Ban, CheckCircle, KeyRound } from "lucide-react";
import { useUserManagement } from "@/providers/UserManagementProvider";
import { useCompanies } from "@/providers/CompanyProvider";
import { useProfiles } from "@/providers/ProfileProvider";
import { ROLE_CONFIG, USER_STATUS_CONFIG } from "@/types/user-management";
import type { SystemUser, SystemRole } from "@/types/user-management";
import UserModal from "./UserModal";

export default function UsersTab() {
  const { users, createUser, updateUser, deleteUser, resetPassword, toggleUserStatus } = useUserManagement();
  const { getCompany } = useCompanies();
  const { getProfile } = useProfiles();

  const [modal, setModal] = useState<{ open: boolean; editing: SystemUser | null }>({ open: false, editing: null });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [search, setSearch] = useState("");

  const { companies } = useCompanies();

  const filteredUsers = users.filter((u) => {
    if (filterCompany && u.companyId !== filterCompany) return false;
    if (filterRole && u.role !== filterRole) return false;
    if (filterStatus && u.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleSave = (data: Parameters<typeof createUser>[0]) => {
    if (modal.editing) {
      updateUser(modal.editing.id, {
        email: data.email,
        name: data.name,
        role: data.role,
        companyId: data.companyId,
        profileId: data.profileId,
      });
      // Update password only if provided
      if (data.password !== modal.editing.password) {
        resetPassword(modal.editing.id, data.password);
      }
    } else {
      createUser(data);
    }
    setModal({ open: false, editing: null });
  };

  const handleResetPassword = () => {
    if (resetPasswordModal && newPassword.trim()) {
      resetPassword(resetPasswordModal.id, newPassword.trim());
      setResetPasswordModal(null);
      setNewPassword("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
        />
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-[#dd7430] outline-none"
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-[#dd7430] outline-none"
        >
          <option value="">Todos los roles</option>
          {(Object.entries(ROLE_CONFIG) as [SystemRole, typeof ROLE_CONFIG.root][]).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-[#dd7430] outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="disabled">Deshabilitados</option>
        </select>
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-4" />
          Crear usuario
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Empresa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Perfil</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Último login</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No se encontraron usuarios
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const roleCfg = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.company_user;
                const statusCfg = USER_STATUS_CONFIG[u.status];
                const company = u.companyId ? getCompany(u.companyId) : null;
                const profile = u.profileId ? getProfile(u.profileId) : null;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-slate-300">{company?.name ?? (u.role === "root" ? "—" : "Sin asignar")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleCfg.color} ${roleCfg.bg} border ${roleCfg.border}`}>
                        {roleCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {u.role === "root" ? (
                        <span className="text-slate-500">—</span>
                      ) : profile ? (
                        <span className="text-white">{profile.name}</span>
                      ) : (
                        <span className="text-slate-500 italic">{u.role === "company_admin" ? "Acceso total" : "Sin perfil"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.bg} border ${statusCfg.border}`}>
                        <span className={`size-1.5 rounded-full ${u.status === "active" ? "bg-emerald-400" : "bg-slate-500"}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("es-AR") : "Nunca"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal({ open: true, editing: u })}
                          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => { setResetPasswordModal(u); setNewPassword(""); }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 transition-colors"
                          aria-label="Resetear contraseña"
                        >
                          <KeyRound className="size-3.5" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={`p-1.5 rounded-md transition-colors ${u.status === "active" ? "text-slate-400 hover:text-amber-400 hover:bg-amber-900/20" : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20"}`}
                          aria-label={u.status === "active" ? "Deshabilitar" : "Habilitar"}
                        >
                          {u.status === "active" ? <Ban className="size-3.5" /> : <CheckCircle className="size-3.5" />}
                        </button>
                        {confirmDelete === u.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { deleteUser(u.id); setConfirmDelete(null); }} className="px-2 py-1 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50">
                              Confirmar
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors" aria-label="Eliminar">
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

      {/* User Modal */}
      {modal.open && (
        <UserModal
          editing={modal.editing}
          onSave={handleSave}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-1">Resetear contraseña</h3>
            <p className="text-sm text-slate-400 mb-4">{resetPasswordModal.name} ({resetPasswordModal.email})</p>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
              placeholder="Nueva contraseña"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setResetPasswordModal(null)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword.trim()}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-500 transition-colors disabled:opacity-40"
              >
                Resetear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
