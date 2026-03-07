// Front authentication types — per-front visitor access control

export type FrontAuthMethod = "none" | "credentials";

// --- Roles & Permissions ---

export type FrontRole = "admin_front" | "editor_front" | "operador" | "viewer";

export type FrontPermission =
  | "view_page"
  | "view_widget"
  | "interact"
  | "operate_stock"
  | "export"
  | "manage_users";

export interface FrontRoleConfig {
  role: FrontRole;
  label: string;
  description: string;
  permissions: FrontPermission[];
}

export const FRONT_ROLES: FrontRole[] = ["admin_front", "editor_front", "operador", "viewer"];

export const FRONT_ROLE_CONFIGS: Record<FrontRole, FrontRoleConfig> = {
  admin_front: {
    role: "admin_front",
    label: "Admin Front",
    description: "Acceso total, puede gestionar usuarios",
    permissions: ["view_page", "view_widget", "interact", "operate_stock", "export", "manage_users"],
  },
  editor_front: {
    role: "editor_front",
    label: "Editor Front",
    description: "Puede ver, interactuar y exportar",
    permissions: ["view_page", "view_widget", "interact", "export"],
  },
  operador: {
    role: "operador",
    label: "Operador",
    description: "Puede interactuar y operar stock",
    permissions: ["view_page", "view_widget", "interact", "operate_stock"],
  },
  viewer: {
    role: "viewer",
    label: "Viewer",
    description: "Solo lectura",
    permissions: ["view_page", "view_widget"],
  },
};

export const FRONT_PERMISSION_LABELS: Record<FrontPermission, { label: string; description: string }> = {
  view_page: { label: "Ver página", description: "Acceder a páginas del front" },
  view_widget: { label: "Ver widget", description: "Ver secciones y widgets" },
  interact: { label: "Interactuar", description: "Enviar mensajes en chat y formularios" },
  operate_stock: { label: "Operar stock", description: "Alta, baja y modificación de stock" },
  export: { label: "Exportar", description: "Exportar datos e informes" },
  manage_users: { label: "Gestionar usuarios", description: "Administrar visitantes del front" },
};

// --- Visitor ---

export interface FrontVisitor {
  id: string;
  email: string;
  password: string;
  name?: string;
  role: FrontRole;
  customPermissions?: FrontPermission[];
  blocked: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// --- Password Policy ---

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 6,
  requireUppercase: false,
  requireNumber: false,
  requireSpecialChar: false,
};

export const PASSWORD_MIN_LENGTH_OPTIONS = [4, 6, 8, 10, 12] as const;

// --- Auth Config ---

export interface FrontAuthConfig {
  enabled: boolean;
  method: FrontAuthMethod;
  visitors: FrontVisitor[];
  sessionTimeoutMinutes: number;
  allowRememberMe: boolean;
  passwordPolicy: PasswordPolicy;
}

export interface FrontSession {
  visitorId: string;
  frontId: string;
  email: string;
  name?: string;
  role: FrontRole;
  permissions: FrontPermission[];
  loginAt: string;
  expiresAt: string;
  rememberMe: boolean;
}

export const DEFAULT_FRONT_AUTH_CONFIG: FrontAuthConfig = {
  enabled: false,
  method: "none",
  visitors: [],
  sessionTimeoutMinutes: 60,
  allowRememberMe: true,
  passwordPolicy: { ...DEFAULT_PASSWORD_POLICY },
};

export const SESSION_TIMEOUT_OPTIONS = [
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 240, label: "4 horas" },
  { value: 480, label: "8 horas" },
  { value: 1440, label: "24 horas" },
  { value: 10080, label: "7 días" },
] as const;

// --- Password Reset ---

export interface PasswordResetToken {
  id: string;
  frontId: string;
  visitorId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export const RESET_TOKEN_EXPIRY_MINUTES = 30;

// --- Errors ---

export type FrontAuthError =
  | "invalid_credentials"
  | "user_blocked"
  | "session_expired"
  | "invalid_token"
  | "token_expired"
  | "token_used"
  | "weak_password";

export const FRONT_AUTH_ERROR_MESSAGES: Record<FrontAuthError, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  user_blocked: "Tu cuenta ha sido bloqueada. Contacta al administrador.",
  session_expired: "Tu sesión ha expirado. Inicia sesión nuevamente.",
  invalid_token: "El enlace de reseteo no es válido.",
  token_expired: "El enlace de reseteo ha expirado. Solicita uno nuevo.",
  token_used: "Este enlace ya fue utilizado. Solicita uno nuevo.",
  weak_password: "La contraseña no cumple con la política de seguridad.",
};
