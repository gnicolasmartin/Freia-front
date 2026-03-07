// Front auth utilities — session management (pure, no React)

import type { FrontSession, FrontAuthConfig, FrontVisitor, FrontAuthError, FrontRole, FrontPermission, PasswordPolicy, PasswordResetToken } from "@/types/front-auth";
import { FRONT_ROLE_CONFIGS, RESET_TOKEN_EXPIRY_MINUTES } from "@/types/front-auth";

const SESSION_KEY_PREFIX = "freia_front_session_";

function sessionKey(frontId: string): string {
  return `${SESSION_KEY_PREFIX}${frontId}`;
}

export function getSession(frontId: string): FrontSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(sessionKey(frontId));
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as FrontSession;
    if (new Date(session.expiresAt) < new Date()) {
      clearSession(frontId);
      return null;
    }
    return session;
  } catch {
    clearSession(frontId);
    return null;
  }
}

export function saveSession(session: FrontSession): void {
  localStorage.setItem(sessionKey(session.frontId), JSON.stringify(session));
}

export function clearSession(frontId: string): void {
  localStorage.removeItem(sessionKey(frontId));
}

export function createSession(
  frontId: string,
  visitor: FrontVisitor,
  timeoutMinutes: number,
  rememberMe: boolean
): FrontSession {
  const now = new Date();
  const effectiveTimeout = rememberMe ? Math.max(timeoutMinutes, 10080) : timeoutMinutes;
  const expiresAt = new Date(now.getTime() + effectiveTimeout * 60 * 1000);

  return {
    visitorId: visitor.id,
    frontId,
    email: visitor.email,
    name: visitor.name,
    role: visitor.role,
    permissions: getVisitorPermissions(visitor),
    loginAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rememberMe,
  };
}

export function authenticateVisitor(
  config: FrontAuthConfig,
  email: string,
  password: string
): { visitor: FrontVisitor } | { error: FrontAuthError } {
  const visitor = config.visitors.find(
    (v) => v.email.toLowerCase() === email.toLowerCase()
  );

  if (!visitor || visitor.password !== password) {
    return { error: "invalid_credentials" };
  }

  if (visitor.blocked) {
    return { error: "user_blocked" };
  }

  return { visitor };
}

export function isSessionValid(frontId: string): boolean {
  return getSession(frontId) !== null;
}

export function getPermissionsForRole(role: FrontRole): FrontPermission[] {
  return FRONT_ROLE_CONFIGS[role]?.permissions ?? [];
}

export function getVisitorPermissions(visitor: FrontVisitor): FrontPermission[] {
  return visitor.customPermissions ?? getPermissionsForRole(visitor.role);
}

export function hasPermission(session: FrontSession | null, perm: FrontPermission): boolean {
  if (!session) return false;
  return session.permissions.includes(perm);
}

// --- Password Policy ---

export function validatePassword(password: string, policy: PasswordPolicy): string | null {
  if (password.length < policy.minLength) {
    return `Mínimo ${policy.minLength} caracteres.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return "Debe incluir al menos una letra mayúscula.";
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    return "Debe incluir al menos un número.";
  }
  if (policy.requireSpecialChar && !/[^a-zA-Z0-9]/.test(password)) {
    return "Debe incluir al menos un carácter especial.";
  }
  return null;
}

export function describePasswordPolicy(policy: PasswordPolicy): string[] {
  const rules: string[] = [`Mínimo ${policy.minLength} caracteres`];
  if (policy.requireUppercase) rules.push("Una letra mayúscula");
  if (policy.requireNumber) rules.push("Un número");
  if (policy.requireSpecialChar) rules.push("Un carácter especial");
  return rules;
}

// --- Password Reset Tokens ---

const RESET_TOKENS_KEY = "freia_front_reset_tokens";

function loadResetTokens(): PasswordResetToken[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RESET_TOKENS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveResetTokens(tokens: PasswordResetToken[]): void {
  localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(tokens));
}

export function generateResetToken(frontId: string, visitorId: string): PasswordResetToken {
  const now = new Date();
  const token: PasswordResetToken = {
    id: crypto.randomUUID(),
    frontId,
    visitorId,
    token: crypto.randomUUID().replace(/-/g, ""),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    used: false,
    createdAt: now.toISOString(),
  };
  const tokens = loadResetTokens();
  saveResetTokens([...tokens, token]);
  return token;
}

export function validateResetToken(
  frontId: string,
  tokenStr: string
): { token: PasswordResetToken } | { error: FrontAuthError } {
  const tokens = loadResetTokens();
  const token = tokens.find((t) => t.frontId === frontId && t.token === tokenStr);

  if (!token) return { error: "invalid_token" };
  if (token.used) return { error: "token_used" };
  if (new Date(token.expiresAt) < new Date()) return { error: "token_expired" };

  return { token };
}

export function consumeResetToken(tokenId: string): void {
  const tokens = loadResetTokens();
  saveResetTokens(tokens.map((t) => (t.id === tokenId ? { ...t, used: true } : t)));
}
