"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { FrontAuthConfig, FrontSession, FrontRole, FrontPermission } from "@/types/front-auth";
import { getSession, clearSession, hasPermission as checkPermission } from "@/lib/front-auth";

interface FrontAuthContextType {
  session: FrontSession | null;
  isAuthenticated: boolean;
  requiresAuth: boolean;
  role: FrontRole | null;
  permissions: FrontPermission[];
  hasPermission: (perm: FrontPermission) => boolean;
  refreshSession: () => void;
  logout: () => void;
}

const FrontAuthContext = createContext<FrontAuthContextType | undefined>(undefined);

interface FrontAuthProviderProps {
  frontId: string;
  authConfig: FrontAuthConfig;
  children: ReactNode;
}

export function FrontAuthProvider({ frontId, authConfig, children }: FrontAuthProviderProps) {
  const [session, setSession] = useState<FrontSession | null>(null);
  const [checked, setChecked] = useState(false);

  const requiresAuth = authConfig.enabled && authConfig.method !== "none";

  const refreshSession = useCallback(() => {
    const current = getSession(frontId);
    setSession(current);
    setChecked(true);
  }, [frontId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(() => {
    clearSession(frontId);
    setSession(null);
  }, [frontId]);

  const isAuthenticated = !requiresAuth || session !== null;
  const role = session?.role ?? null;
  const permissions = session?.permissions ?? [];
  const hasPermissionFn = useCallback(
    (perm: FrontPermission) => checkPermission(session, perm),
    [session]
  );

  if (!checked) return null;

  return (
    <FrontAuthContext.Provider
      value={{ session, isAuthenticated, requiresAuth, role, permissions, hasPermission: hasPermissionFn, refreshSession, logout }}
    >
      {children}
    </FrontAuthContext.Provider>
  );
}

export function useFrontAuth() {
  const context = useContext(FrontAuthContext);
  if (context === undefined) {
    throw new Error("useFrontAuth debe ser usado dentro de FrontAuthProvider");
  }
  return context;
}
