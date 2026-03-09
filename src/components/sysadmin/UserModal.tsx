"use client";

import { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useCompanies } from "@/providers/CompanyProvider";
import { useProfiles } from "@/providers/ProfileProvider";
import { ROLE_CONFIG } from "@/types/user-management";
import type { SystemUser, SystemRole } from "@/types/user-management";

interface UserModalProps {
  editing: SystemUser | null;
  onSave: (data: {
    email: string;
    password: string;
    name: string;
    role: SystemRole;
    companyId: string | null;
    profileId: string | null;
  }) => void;
  onClose: () => void;
}

export default function UserModal({ editing, onSave, onClose }: UserModalProps) {
  const { companies } = useCompanies();
  const { getProfilesByCompany } = useProfiles();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<SystemRole>("company_user");
  const [companyId, setCompanyId] = useState<string>("");
  const [profileId, setProfileId] = useState<string>("");

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setEmail(editing.email);
      setPassword("");
      setRole(editing.role);
      setCompanyId(editing.companyId ?? "");
      setProfileId(editing.profileId ?? "");
    }
  }, [editing]);

  const activeCompanies = companies.filter((c) => c.status === "active");
  const companyProfiles = companyId ? getProfilesByCompany(companyId) : [];
  const showCompany = role !== "root";
  const showProfile = role === "company_user";

  const canSave =
    name.trim() &&
    email.trim() &&
    (editing || password.trim()) &&
    (role === "root" || companyId);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      email: email.trim(),
      password: editing && !password ? editing.password : password,
      name: name.trim(),
      role,
      companyId: role === "root" ? null : companyId || null,
      profileId: role === "company_user" ? profileId || null : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">
            {editing ? "Editar usuario" : "Crear usuario"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
              placeholder="Nombre completo"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
              placeholder="usuario@empresa.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {editing ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 pr-10 text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
                placeholder={editing ? "Dejar vacío para mantener" : "Contraseña"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as SystemRole);
                if (e.target.value === "root") {
                  setCompanyId("");
                  setProfileId("");
                }
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
            >
              {(Object.entries(ROLE_CONFIG) as [SystemRole, typeof ROLE_CONFIG.root][]).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Company */}
          {showCompany && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Empresa</label>
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setProfileId("");
                }}
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
              >
                <option value="">Seleccionar empresa...</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Profile */}
          {showProfile && companyId && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Perfil</label>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 outline-none"
              >
                <option value="">Sin perfil (sin permisos)</option>
                {companyProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.permissions.length} permisos)</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
          >
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
