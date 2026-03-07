// Front user management audit types

export type FrontAuditAction =
  | "visitor_created"
  | "visitor_updated"
  | "visitor_deleted"
  | "visitor_activated"
  | "visitor_deactivated"
  | "visitor_role_changed"
  | "visitor_permissions_changed"
  | "visitor_invited"
  | "visitor_password_reset";

export interface FrontAuditEntry {
  id: string;
  timestamp: string;
  action: FrontAuditAction;
  frontId: string;
  frontName: string;
  visitorEmail: string;
  visitorName?: string;
  detail?: string;
}

export const FRONT_AUDIT_ACTION_CONFIG: Record<
  FrontAuditAction,
  { label: string; colorClass: string; bgClass: string }
> = {
  visitor_created: {
    label: "Creado",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-900/20",
  },
  visitor_updated: {
    label: "Editado",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-900/20",
  },
  visitor_deleted: {
    label: "Eliminado",
    colorClass: "text-red-400",
    bgClass: "bg-red-900/20",
  },
  visitor_activated: {
    label: "Activado",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-900/20",
  },
  visitor_deactivated: {
    label: "Desactivado",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-900/20",
  },
  visitor_role_changed: {
    label: "Rol cambiado",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-900/20",
  },
  visitor_permissions_changed: {
    label: "Permisos cambiados",
    colorClass: "text-violet-400",
    bgClass: "bg-violet-900/20",
  },
  visitor_invited: {
    label: "Invitado",
    colorClass: "text-violet-400",
    bgClass: "bg-violet-900/20",
  },
  visitor_password_reset: {
    label: "Reset contraseña",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-900/20",
  },
};
