"use client";

import { useState } from "react";
import { Plus, Trash2, ShieldCheck, ShieldOff, Mail, KeyRound, Link2, Check, UserPlus, AlertTriangle, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { useFronts } from "@/providers/FrontsProvider";
import type { Front } from "@/types/front";
import type { FrontAuthConfig, FrontVisitor, FrontRole, FrontPermission, PasswordPolicy } from "@/types/front-auth";
import {
  SESSION_TIMEOUT_OPTIONS,
  FRONT_ROLES,
  FRONT_ROLE_CONFIGS,
  FRONT_PERMISSION_LABELS,
  DEFAULT_PASSWORD_POLICY,
  PASSWORD_MIN_LENGTH_OPTIONS,
} from "@/types/front-auth";
import { getVisitorPermissions } from "@/lib/front-auth";
import { generateResetToken, validatePassword } from "@/lib/front-auth";
import { addFrontAuditEntry } from "@/lib/front-audit";
import type { FrontAuditAction } from "@/types/front-audit";

interface FrontAuthPanelProps {
  front: Front;
}

export default function FrontAuthPanel({ front }: FrontAuthPanelProps) {
  const { updateFrontAuthConfig } = useFronts();
  const [config, setConfig] = useState<FrontAuthConfig>({
    ...front.authConfig,
    passwordPolicy: front.authConfig.passwordPolicy ?? { ...DEFAULT_PASSWORD_POLICY },
  });
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<FrontRole>("viewer");
  const [newBlocked, setNewBlocked] = useState(false);
  const [inviteMode, setInviteMode] = useState<"password" | "link">("password");
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [confirmDeleteVisitor, setConfirmDeleteVisitor] = useState<FrontVisitor | null>(null);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);

  const audit = (action: FrontAuditAction, visitor: FrontVisitor, detail?: string) => {
    addFrontAuditEntry({
      action,
      frontId: front.id,
      frontName: front.name,
      visitorEmail: visitor.email,
      visitorName: visitor.name,
      detail,
    });
  };

  const save = (updated: FrontAuthConfig) => {
    setConfig(updated);
    updateFrontAuthConfig(front.id, updated);
  };

  const toggleEnabled = () => {
    save({
      ...config,
      enabled: !config.enabled,
      method: !config.enabled ? "credentials" : "none",
    });
  };

  const isDuplicateEmail = (email: string): boolean => {
    return config.visitors.some(
      (v) => v.email.toLowerCase() === email.trim().toLowerCase()
    );
  };

  const addVisitor = () => {
    if (!newEmail.trim()) return;
    setEmailError(null);
    setNewPasswordError(null);

    // Duplicate check
    if (isDuplicateEmail(newEmail)) {
      setEmailError("Ya existe un visitante con este email.");
      return;
    }

    // Password mode: validate password
    if (inviteMode === "password") {
      if (!newPassword.trim()) return;
      const policyError = validatePassword(newPassword.trim(), config.passwordPolicy);
      if (policyError) {
        setNewPasswordError(policyError);
        return;
      }
    }

    // For invite link mode, use a random temporary password (visitor must reset)
    const tempPassword = inviteMode === "link"
      ? crypto.randomUUID()
      : newPassword.trim();

    const visitor: FrontVisitor = {
      id: crypto.randomUUID(),
      email: newEmail.trim().toLowerCase(),
      password: tempPassword,
      name: newName.trim() || undefined,
      role: newRole,
      blocked: newBlocked,
      createdAt: new Date().toISOString(),
    };

    const updatedConfig = { ...config, visitors: [...config.visitors, visitor] };
    save(updatedConfig);

    // Audit
    audit("visitor_created", visitor, `Rol: ${FRONT_ROLE_CONFIGS[newRole].label}`);

    // If invite link mode, generate reset token and copy link
    if (inviteMode === "link") {
      const token = generateResetToken(front.id, visitor.id);
      const url = `${window.location.origin}/f/${front.subdomain}?reset=${token.token}`;
      navigator.clipboard.writeText(url);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 3000);
      audit("visitor_invited", visitor, "Link de seteo de contraseña");
    }

    setNewEmail("");
    setNewPassword("");
    setNewName("");
    setNewRole("viewer");
    setNewBlocked(false);
    setNewPasswordError(null);
    setEmailError(null);
  };

  const removeVisitor = (visitor: FrontVisitor) => {
    save({ ...config, visitors: config.visitors.filter((v) => v.id !== visitor.id) });
    audit("visitor_deleted", visitor);
    setConfirmDeleteVisitor(null);
  };

  const toggleBlocked = (visitor: FrontVisitor) => {
    const newBlocked = !visitor.blocked;
    save({
      ...config,
      visitors: config.visitors.map((v) =>
        v.id === visitor.id ? { ...v, blocked: newBlocked } : v
      ),
    });
    audit(newBlocked ? "visitor_deactivated" : "visitor_activated", visitor);
  };

  const updateVisitorRole = (visitor: FrontVisitor, role: FrontRole) => {
    if (visitor.role === role) return;
    const oldLabel = FRONT_ROLE_CONFIGS[visitor.role].label;
    const newLabel = FRONT_ROLE_CONFIGS[role].label;
    save({
      ...config,
      visitors: config.visitors.map((v) =>
        v.id === visitor.id ? { ...v, role } : v
      ),
    });
    audit("visitor_role_changed", visitor, `${oldLabel} → ${newLabel}`);
  };

  const handleGenerateResetLink = (visitor: FrontVisitor) => {
    const token = generateResetToken(front.id, visitor.id);
    const url = `${window.location.origin}/f/${front.subdomain}?reset=${token.token}`;
    navigator.clipboard.writeText(url);
    setCopiedTokenId(visitor.id);
    setTimeout(() => setCopiedTokenId(null), 2000);
    audit("visitor_password_reset", visitor, "Link de reseteo generado");
  };

  const forceResetPassword = (visitor: FrontVisitor, tempPassword: string) => {
    save({
      ...config,
      visitors: config.visitors.map((v) =>
        v.id === visitor.id ? { ...v, password: tempPassword } : v
      ),
    });
    audit("visitor_password_reset", visitor, "Contraseña temporal asignada por admin");
  };

  const updateVisitorField = (visitor: FrontVisitor, field: "name" | "email", value: string) => {
    const trimmed = value.trim();
    if (field === "email") {
      if (!trimmed) return;
      if (trimmed.toLowerCase() === visitor.email.toLowerCase()) return;
      if (config.visitors.some((v) => v.id !== visitor.id && v.email.toLowerCase() === trimmed.toLowerCase())) return;
    }
    const oldValue = field === "name" ? (visitor.name ?? "") : visitor.email;
    if (trimmed === oldValue) return;
    save({
      ...config,
      visitors: config.visitors.map((v) =>
        v.id === visitor.id ? { ...v, [field]: field === "name" ? (trimmed || undefined) : trimmed.toLowerCase() } : v
      ),
    });
    audit("visitor_updated", visitor, `${field === "name" ? "Nombre" : "Email"}: ${oldValue || "—"} → ${trimmed || "—"}`);
  };

  const updateVisitorPermissions = (visitor: FrontVisitor, permissions: FrontPermission[]) => {
    const rolePerms = FRONT_ROLE_CONFIGS[visitor.role].permissions;
    const isSameAsRole =
      permissions.length === rolePerms.length &&
      rolePerms.every((p) => permissions.includes(p));

    save({
      ...config,
      visitors: config.visitors.map((v) =>
        v.id === visitor.id ? { ...v, customPermissions: isSameAsRole ? undefined : permissions } : v
      ),
    });
    audit("visitor_permissions_changed", visitor, `${permissions.length} permisos activos`);
  };

  const updatePolicy = (partial: Partial<PasswordPolicy>) => {
    save({
      ...config,
      passwordPolicy: { ...config.passwordPolicy, ...partial },
    });
  };

  return (
    <div className="space-y-5">
      {/* Enable/disable toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-800/30">
        <div className="flex items-center gap-3">
          {config.enabled ? (
            <ShieldCheck className="size-5 text-emerald-400" />
          ) : (
            <ShieldOff className="size-5 text-slate-500" />
          )}
          <div>
            <p className="text-sm font-medium text-white">
              Autenticación {config.enabled ? "activada" : "desactivada"}
            </p>
            <p className="text-xs text-slate-400">
              {config.enabled
                ? "Los visitantes deben iniciar sesión para acceder."
                : "El front es público, sin restricción de acceso."}
            </p>
          </div>
        </div>
        <button
          onClick={toggleEnabled}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            config.enabled ? "bg-emerald-600" : "bg-slate-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              config.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Session settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Tiempo de sesión
              </label>
              <select
                value={config.sessionTimeoutMinutes}
                onChange={(e) =>
                  save({ ...config, sessionTimeoutMinutes: Number(e.target.value) })
                }
                className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
              >
                {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                <input
                  type="checkbox"
                  checked={config.allowRememberMe}
                  onChange={(e) =>
                    save({ ...config, allowRememberMe: e.target.checked })
                  }
                  className="size-3.5 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">
                  Permitir &quot;Recordarme&quot;
                </span>
              </label>
            </div>
          </div>

          {/* Password Policy */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Política de contraseña</label>
            <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-900/30 space-y-2.5">
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-300 shrink-0">Largo mínimo</label>
                <select
                  value={config.passwordPolicy.minLength}
                  onChange={(e) => updatePolicy({ minLength: Number(e.target.value) })}
                  className="rounded border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-xs text-white focus:border-[#dd7430] focus:outline-none"
                >
                  {PASSWORD_MIN_LENGTH_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} caracteres</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {([
                  ["requireUppercase", "Mayúscula"],
                  ["requireNumber", "Número"],
                  ["requireSpecialChar", "Carácter especial"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.passwordPolicy[key]}
                      onChange={(e) => updatePolicy({ [key]: e.target.checked })}
                      className="size-3 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-400">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Roles reference */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Roles disponibles</label>
            <div className="grid grid-cols-2 gap-2">
              {FRONT_ROLES.map((role) => {
                const cfg = FRONT_ROLE_CONFIGS[role];
                return (
                  <div key={role} className="p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/30">
                    <p className="text-xs font-medium text-white">{cfg.label}</p>
                    <p className="text-[10px] text-slate-500 mb-1.5">{cfg.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {cfg.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400"
                        >
                          {FRONT_PERMISSION_LABELS[perm].label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visitors list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">
                Visitantes ({config.visitors.length})
              </label>
            </div>

            {config.visitors.length > 0 && (
              <div className="space-y-1.5 mb-3 max-h-[28rem] overflow-y-auto">
                {config.visitors.map((visitor) => {
                  const isEditing = editingVisitorId === visitor.id;
                  const activePerms = getVisitorPermissions(visitor);
                  const hasCustomPerms = !!visitor.customPermissions;

                  return (
                    <div
                      key={visitor.id}
                      className={`rounded-lg border text-sm ${
                        visitor.blocked
                          ? "border-red-800/30 bg-red-900/10"
                          : "border-slate-700 bg-slate-800/30"
                      }`}
                    >
                      {/* Summary row */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => setEditingVisitorId(isEditing ? null : visitor.id)}
                          className="text-slate-500 hover:text-white shrink-0"
                          aria-label={isEditing ? "Cerrar edición" : "Editar visitante"}
                        >
                          {isEditing ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                        <Mail className="size-3.5 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-white truncate block">
                            {visitor.email}
                          </span>
                          {visitor.name && (
                            <span className="text-xs text-slate-500">{visitor.name}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {FRONT_ROLE_CONFIGS[visitor.role].label}
                        </span>
                        {hasCustomPerms && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-violet-900/30 text-violet-400 shrink-0">
                            Custom
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          visitor.blocked
                            ? "bg-red-900/30 text-red-400"
                            : "bg-emerald-900/30 text-emerald-400"
                        }`}>
                          {visitor.blocked ? "Inactivo" : "Activo"}
                        </span>
                        <button
                          onClick={() => setConfirmDeleteVisitor(visitor)}
                          className="p-1 text-slate-600 hover:text-red-400"
                          aria-label="Eliminar visitante"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      {/* Expanded edit panel */}
                      {isEditing && (
                        <VisitorEditPanel
                          visitor={visitor}
                          onUpdateField={(field, value) => updateVisitorField(visitor, field, value)}
                          onUpdateRole={(role) => updateVisitorRole(visitor, role)}
                          onUpdatePermissions={(perms) => updateVisitorPermissions(visitor, perms)}
                          onToggleBlocked={() => toggleBlocked(visitor)}
                          onGenerateResetLink={() => handleGenerateResetLink(visitor)}
                          onForceResetPassword={(pw) => forceResetPassword(visitor, pw)}
                          resetLinkCopied={copiedTokenId === visitor.id}
                          passwordPolicy={config.passwordPolicy}
                          activePerms={activePerms}
                          isDuplicateEmail={(email) =>
                            config.visitors.some((v) => v.id !== visitor.id && v.email.toLowerCase() === email.trim().toLowerCase())
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reset link hint */}
            {config.visitors.length > 0 && (
              <p className="text-[10px] text-slate-600 mb-3">
                Haz clic en la flecha para editar datos, permisos y forzar reset de contraseña.
              </p>
            )}

            {/* Add visitor form */}
            <div className="border border-dashed border-slate-700 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="size-3.5 text-slate-500" />
                <p className="text-xs text-slate-400 font-medium">Agregar visitante</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
                />
                <div>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setEmailError(null); }}
                    placeholder="Email *"
                    className={`w-full rounded-md border bg-slate-700/50 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none ${
                      emailError ? "border-red-500" : "border-slate-600"
                    }`}
                  />
                  {emailError && (
                    <p className="text-[10px] text-red-400 mt-0.5">{emailError}</p>
                  )}
                </div>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as FrontRole)}
                  className="rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none"
                >
                  {FRONT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {FRONT_ROLE_CONFIGS[r].label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBlocked}
                    onChange={(e) => setNewBlocked(e.target.checked)}
                    className="size-3 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-slate-400">Crear como inactivo</span>
                </label>
              </div>

              {/* Invite mode toggle */}
              <div className="flex gap-1 p-0.5 rounded-md bg-slate-800/50 border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => { setInviteMode("password"); setNewPasswordError(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${
                    inviteMode === "password"
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <KeyRound className="size-3" />
                  Setear contraseña
                </button>
                <button
                  type="button"
                  onClick={() => { setInviteMode("link"); setNewPassword(""); setNewPasswordError(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${
                    inviteMode === "link"
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Link2 className="size-3" />
                  Enviar link de seteo
                </button>
              </div>

              {inviteMode === "password" && (
                <div>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setNewPasswordError(null); }}
                    placeholder="Contraseña *"
                    className={`w-full rounded-md border bg-slate-700/50 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none ${
                      newPasswordError ? "border-red-500" : "border-slate-600"
                    }`}
                  />
                  {newPasswordError && (
                    <p className="text-[10px] text-red-400 mt-0.5">{newPasswordError}</p>
                  )}
                </div>
              )}

              {inviteMode === "link" && (
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Se generará un link de configuración de contraseña y se copiará al portapapeles. Envíalo al visitante.
                </p>
              )}

              {/* Invite link copied feedback */}
              {inviteLinkCopied && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <Check className="size-3" />
                  Link de invitación copiado al portapapeles
                </div>
              )}

              <button
                onClick={addVisitor}
                disabled={!newEmail.trim() || (inviteMode === "password" && !newPassword.trim())}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#dd7430] text-white text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                <Plus className="size-3" />
                {inviteMode === "link" ? "Crear e invitar" : "Agregar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteVisitor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-full bg-red-900/30">
                <AlertTriangle className="size-4 text-red-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Eliminar visitante</h3>
              <button onClick={() => setConfirmDeleteVisitor(null)} className="ml-auto p-1 text-slate-500 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Se eliminará a{" "}
              <span className="text-white font-medium">{confirmDeleteVisitor.email}</span>
              {confirmDeleteVisitor.name && ` (${confirmDeleteVisitor.name})`}.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteVisitor(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-600 hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => removeVisitor(confirmDeleteVisitor)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visitor edit sub-panel ──────────────────────────────────────────────────

const ALL_PERMISSIONS: FrontPermission[] = [
  "view_page", "view_widget", "interact", "operate_stock", "export", "manage_users",
];

function VisitorEditPanel({
  visitor,
  onUpdateField,
  onUpdateRole,
  onUpdatePermissions,
  onToggleBlocked,
  onGenerateResetLink,
  onForceResetPassword,
  resetLinkCopied,
  passwordPolicy,
  activePerms,
  isDuplicateEmail,
}: {
  visitor: FrontVisitor;
  onUpdateField: (field: "name" | "email", value: string) => void;
  onUpdateRole: (role: FrontRole) => void;
  onUpdatePermissions: (perms: FrontPermission[]) => void;
  onToggleBlocked: () => void;
  onGenerateResetLink: () => void;
  onForceResetPassword: (password: string) => void;
  resetLinkCopied: boolean;
  passwordPolicy: PasswordPolicy;
  activePerms: FrontPermission[];
  isDuplicateEmail: (email: string) => boolean;
}) {
  const [editName, setEditName] = useState(visitor.name ?? "");
  const [editEmail, setEditEmail] = useState(visitor.email);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<"link" | "temp">("link");
  const [tempPassword, setTempPassword] = useState("");
  const [tempPasswordErr, setTempPasswordErr] = useState<string | null>(null);
  const [tempPasswordSet, setTempPasswordSet] = useState(false);
  const rolePerms = FRONT_ROLE_CONFIGS[visitor.role].permissions;

  const handleEmailBlur = () => {
    const trimmed = editEmail.trim().toLowerCase();
    if (!trimmed) {
      setEmailErr("Email requerido.");
      setEditEmail(visitor.email);
      return;
    }
    if (isDuplicateEmail(trimmed)) {
      setEmailErr("Ya existe un visitante con este email.");
      setEditEmail(visitor.email);
      return;
    }
    setEmailErr(null);
    onUpdateField("email", trimmed);
  };

  const handleNameBlur = () => {
    onUpdateField("name", editName);
  };

  const togglePermission = (perm: FrontPermission) => {
    const next = activePerms.includes(perm)
      ? activePerms.filter((p) => p !== perm)
      : [...activePerms, perm];
    onUpdatePermissions(next);
  };

  const resetToRoleDefaults = () => {
    onUpdatePermissions(rolePerms);
  };

  return (
    <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 space-y-3">
      {/* Name & Email */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Nombre</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Sin nombre"
            className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Email</label>
          <input
            type="email"
            value={editEmail}
            onChange={(e) => { setEditEmail(e.target.value); setEmailErr(null); }}
            onBlur={handleEmailBlur}
            className={`w-full rounded-md border bg-slate-700/50 px-2 py-1 text-xs text-white focus:border-[#dd7430] focus:outline-none ${
              emailErr ? "border-red-500" : "border-slate-600"
            }`}
          />
          {emailErr && <p className="text-[10px] text-red-400 mt-0.5">{emailErr}</p>}
        </div>
      </div>

      {/* Role & Status */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Rol</label>
          <select
            value={visitor.role}
            onChange={(e) => onUpdateRole(e.target.value as FrontRole)}
            className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs text-white focus:border-[#dd7430] focus:outline-none"
          >
            {FRONT_ROLES.map((r) => (
              <option key={r} value={r}>{FRONT_ROLE_CONFIGS[r].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-0.5">Estado</label>
          <button
            onClick={onToggleBlocked}
            className={`w-full rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
              visitor.blocked
                ? "border-red-800/50 bg-red-900/20 text-red-400 hover:bg-red-900/30"
                : "border-emerald-800/50 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30"
            }`}
          >
            {visitor.blocked ? "Inactivo — clic para activar" : "Activo — clic para desactivar"}
          </button>
        </div>
      </div>

      {/* Permissions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-500">Permisos</label>
          {visitor.customPermissions && (
            <button
              onClick={resetToRoleDefaults}
              className="text-[9px] text-slate-500 hover:text-white transition-colors"
            >
              Restaurar a rol por defecto
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_PERMISSIONS.map((perm) => {
            const isActive = activePerms.includes(perm);
            const isRoleDefault = rolePerms.includes(perm);
            return (
              <button
                key={perm}
                onClick={() => togglePermission(perm)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  isActive
                    ? "bg-[#dd7430]/20 border-[#dd7430]/40 text-[#dd7430]"
                    : "bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
                aria-label={`${isActive ? "Quitar" : "Agregar"} permiso ${FRONT_PERMISSION_LABELS[perm].label}`}
              >
                {FRONT_PERMISSION_LABELS[perm].label}
                {!isRoleDefault && isActive && " *"}
              </button>
            );
          })}
        </div>
        {visitor.customPermissions && (
          <p className="text-[9px] text-slate-600 mt-1">
            * Permiso fuera del rol por defecto. Los cambios aplican de inmediato.
          </p>
        )}
      </div>

      {/* Force password reset */}
      <div>
        <label className="text-[10px] text-slate-500 mb-1 block">Forzar reset de contraseña</label>
        <div className="flex gap-1 p-0.5 rounded-md bg-slate-800/50 border border-slate-700/50 mb-2">
          <button
            type="button"
            onClick={() => { setResetMode("link"); setTempPasswordErr(null); setTempPasswordSet(false); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${
              resetMode === "link" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Link2 className="size-3" />
            Generar link
          </button>
          <button
            type="button"
            onClick={() => { setResetMode("temp"); setTempPasswordSet(false); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${
              resetMode === "temp" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <KeyRound className="size-3" />
            Contraseña temporal
          </button>
        </div>

        {resetMode === "link" && (
          <div className="flex items-center gap-2">
            <button
              onClick={onGenerateResetLink}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-sky-600/20 border border-sky-700/50 text-sky-400 text-[10px] font-medium hover:bg-sky-600/30 transition-colors"
            >
              {resetLinkCopied ? <Check className="size-3" /> : <Link2 className="size-3" />}
              {resetLinkCopied ? "Link copiado" : "Generar y copiar link"}
            </button>
            <span className="text-[9px] text-slate-600">Válido por 30 min, un solo uso</span>
          </div>
        )}

        {resetMode === "temp" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => { setTempPassword(e.target.value); setTempPasswordErr(null); setTempPasswordSet(false); }}
                placeholder="Nueva contraseña temporal"
                className={`flex-1 rounded-md border bg-slate-700/50 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none ${
                  tempPasswordErr ? "border-red-500" : "border-slate-600"
                }`}
              />
              <button
                onClick={() => {
                  const err = validatePassword(tempPassword.trim(), passwordPolicy);
                  if (err) { setTempPasswordErr(err); return; }
                  onForceResetPassword(tempPassword.trim());
                  setTempPasswordSet(true);
                  setTempPassword("");
                }}
                disabled={!tempPassword.trim()}
                className="flex items-center gap-1 px-3 py-1 rounded-md bg-orange-600/20 border border-orange-700/50 text-orange-400 text-[10px] font-medium hover:bg-orange-600/30 transition-colors disabled:opacity-40"
              >
                <KeyRound className="size-3" />
                Aplicar
              </button>
            </div>
            {tempPasswordErr && (
              <p className="text-[10px] text-red-400">{tempPasswordErr}</p>
            )}
            {tempPasswordSet && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Check className="size-3" />
                Contraseña temporal asignada. Comunicala al visitante.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
