/**
 * user-management.ts
 *
 * Types, constants and helpers for the multi-tenant user/company management system.
 */

// ─── Module Permission Keys ─────────────────────────────────────────────────

export const MODULE_KEYS = [
  "dashboard",
  "agents", "agents.create", "agents.edit", "agents.delete",
  "flows", "flows.create", "flows.edit", "flows.delete",
  "tools", "tools.create", "tools.edit", "tools.delete",
  "integrations", "integrations.create", "integrations.edit", "integrations.delete",
  "conversations",
  "leads",
  "stock", "stock.create", "stock.edit", "stock.delete",
  "calendars", "calendars.create", "calendars.edit", "calendars.delete",
  "policies", "policies.create", "policies.edit", "policies.delete",
  "audit",
  "channels",
  "fronts", "fronts.create", "fronts.edit", "fronts.delete",
  "settings",
] as const;

export type ModulePermission = (typeof MODULE_KEYS)[number];

export const TOP_LEVEL_MODULES = [
  "dashboard", "agents", "flows", "tools", "integrations",
  "conversations", "leads", "stock", "calendars", "policies", "audit",
  "channels", "fronts", "settings",
] as const;

export type TopLevelModule = (typeof TOP_LEVEL_MODULES)[number];

// ─── Role Hierarchy ─────────────────────────────────────────────────────────

export type SystemRole = "root" | "company_admin" | "company_user";

// ─── Company ────────────────────────────────────────────────────────────────

export type CompanyStatus = "active" | "suspended";

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── SystemUser (stored in freia_system_users) ──────────────────────────────

export type UserStatus = "active" | "disabled";

export interface SystemUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: SystemRole;
  companyId: string | null;
  profileId: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

// ─── Profile (reusable permission template) ─────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  companyId: string;
  permissions: ModulePermission[];
  createdAt: string;
  updatedAt: string;
}

// ─── Session User (stored in freia_user) ────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  companyId: string | null;
  profileId: string | null;
  permissions: ModulePermission[];
}

// ─── Display config ─────────────────────────────────────────────────────────

export const ROLE_CONFIG: Record<SystemRole, { label: string; color: string; border: string; bg: string }> = {
  root:          { label: "Sysadmin",      color: "text-red-400",   border: "border-red-800/40",   bg: "bg-red-900/20" },
  company_admin: { label: "Admin Empresa", color: "text-amber-400", border: "border-amber-800/40", bg: "bg-amber-900/20" },
  company_user:  { label: "Usuario",       color: "text-sky-400",   border: "border-sky-800/40",   bg: "bg-sky-900/20" },
};

export const COMPANY_STATUS_CONFIG: Record<CompanyStatus, { label: string; color: string; border: string; bg: string }> = {
  active:    { label: "Activa",     color: "text-emerald-400", border: "border-emerald-800/40", bg: "bg-emerald-900/20" },
  suspended: { label: "Suspendida", color: "text-red-400",     border: "border-red-800/40",     bg: "bg-red-900/20" },
};

export const USER_STATUS_CONFIG: Record<UserStatus, { label: string; color: string; border: string; bg: string }> = {
  active:   { label: "Activo",        color: "text-emerald-400", border: "border-emerald-800/40", bg: "bg-emerald-900/20" },
  disabled: { label: "Deshabilitado", color: "text-slate-400",   border: "border-slate-600/40",   bg: "bg-slate-700/40" },
};

// ─── Permission module display config (for UI checkboxes) ───────────────────

export const MODULE_PERMISSION_CONFIG: Record<TopLevelModule, {
  label: string;
  subPermissions: { key: ModulePermission; label: string }[];
}> = {
  dashboard:     { label: "Dashboard",        subPermissions: [] },
  agents:        { label: "Agentes",          subPermissions: [
    { key: "agents.create", label: "Crear" },
    { key: "agents.edit", label: "Editar" },
    { key: "agents.delete", label: "Eliminar" },
  ]},
  flows:         { label: "Flujos",           subPermissions: [
    { key: "flows.create", label: "Crear" },
    { key: "flows.edit", label: "Editar" },
    { key: "flows.delete", label: "Eliminar" },
  ]},
  tools:         { label: "Herramientas",     subPermissions: [
    { key: "tools.create", label: "Crear" },
    { key: "tools.edit", label: "Editar" },
    { key: "tools.delete", label: "Eliminar" },
  ]},
  integrations:  { label: "Integraciones",    subPermissions: [
    { key: "integrations.create", label: "Crear" },
    { key: "integrations.edit", label: "Editar" },
    { key: "integrations.delete", label: "Eliminar" },
  ]},
  conversations: { label: "Conversaciones",   subPermissions: [] },
  leads:         { label: "Leads",            subPermissions: [] },
  stock:         { label: "Stock / Productos", subPermissions: [
    { key: "stock.create", label: "Crear" },
    { key: "stock.edit", label: "Editar" },
    { key: "stock.delete", label: "Eliminar" },
  ]},
  calendars:     { label: "Calendarios",      subPermissions: [
    { key: "calendars.create", label: "Crear" },
    { key: "calendars.edit", label: "Editar" },
    { key: "calendars.delete", label: "Eliminar" },
  ]},
  policies:      { label: "Políticas",        subPermissions: [
    { key: "policies.create", label: "Crear" },
    { key: "policies.edit", label: "Editar" },
    { key: "policies.delete", label: "Eliminar" },
  ]},
  audit:         { label: "Auditoría",        subPermissions: [] },
  channels:      { label: "Canales",          subPermissions: [] },
  fronts:        { label: "Fronts",           subPermissions: [
    { key: "fronts.create", label: "Crear" },
    { key: "fronts.edit", label: "Editar" },
    { key: "fronts.delete", label: "Eliminar" },
  ]},
  settings:      { label: "Configuraciones",  subPermissions: [] },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function resolvePermissions(
  role: SystemRole,
  profile: Profile | null,
): ModulePermission[] {
  if (role === "root") {
    return [...MODULE_KEYS];
  }
  // company_admin and company_user: use profile permissions
  // company_admin without profile gets ALL permissions (backward-compat)
  if (role === "company_admin" && !profile) {
    return [...MODULE_KEYS];
  }
  return profile?.permissions ?? [];
}

export function hasModulePermission(
  permissions: ModulePermission[],
  required: ModulePermission,
): boolean {
  if (permissions.includes(required)) return true;
  // If user has the top-level module, they get all sub-permissions
  const topLevel = required.split(".")[0] as TopLevelModule;
  if (required.includes(".") && permissions.includes(topLevel)) return true;
  return false;
}

export function canAccessModule(
  role: SystemRole,
  permissions: ModulePermission[],
  moduleKey: TopLevelModule,
): boolean {
  if (role === "root") return true;
  // All other roles (company_admin, company_user) check permissions
  // Note: company_admin without profile gets all permissions via resolvePermissions
  return permissions.includes(moduleKey);
}
