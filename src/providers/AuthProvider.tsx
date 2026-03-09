"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { seedDemoCubiertas } from "@/lib/seed-demo-cubiertas";
import { seedDemoImportador } from "@/lib/seed-demo-importador";
import { resolvePermissions } from "@/types/user-management";
import type { SystemUser, Profile, Company, ModulePermission, SystemRole } from "@/types/user-management";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string | null;
  profileId: string | null;
  permissions: ModulePermission[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback — only used if freia_system_users is empty (fresh install without seed)
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  "demo@freia.ai": {
    password: "demo123",
    user: { id: "1", email: "demo@freia.ai", name: "Usuario Demo", role: "company_admin", companyId: "company_cubiertas", profileId: null, permissions: [] },
  },
  "admin@freia.ai": {
    password: "admin123",
    user: { id: "2", email: "admin@freia.ai", name: "Administrador", role: "company_admin", companyId: "company_cubiertas", profileId: null, permissions: [] },
  },
  "user@freia.ai": {
    password: "user123",
    user: { id: "3", email: "user@freia.ai", name: "Usuario Estándar", role: "company_user", companyId: "company_cubiertas", profileId: null, permissions: [] },
  },
  "importador@freia.ai": {
    password: "import123",
    user: { id: "4", email: "importador@freia.ai", name: "Importador Demo", role: "company_admin", companyId: "company_importador", profileId: null, permissions: [] },
  },
  "root@freia.ai": {
    password: "root123",
    user: { id: "0", email: "root@freia.ai", name: "Sysadmin Freia", role: "root", companyId: null, profileId: null, permissions: [] },
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar si hay usuario en localStorage al cargar
  useEffect(() => {
    const storedUser = localStorage.getItem("freia_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch {
        localStorage.removeItem("freia_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    // Simular delay de red
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Try system users first
    const systemUsersRaw = localStorage.getItem("freia_system_users");
    const systemUsers: SystemUser[] = systemUsersRaw ? JSON.parse(systemUsersRaw) : [];

    let sessionUser: User | null = null;

    if (systemUsers.length > 0) {
      const found = systemUsers.find(
        (u) => u.email === email && u.password === password,
      );

      if (!found) {
        setIsLoading(false);
        throw new Error("Email o contraseña incorrectos");
      }

      if (found.status === "disabled") {
        setIsLoading(false);
        throw new Error("Tu cuenta se encuentra deshabilitada. Contacta al administrador.");
      }

      // Check company status for non-root users
      if (found.companyId) {
        const companiesRaw = localStorage.getItem("freia_companies");
        const companies: Company[] = companiesRaw ? JSON.parse(companiesRaw) : [];
        const company = companies.find((c) => c.id === found.companyId);
        if (company?.status === "suspended") {
          setIsLoading(false);
          throw new Error("Tu empresa se encuentra suspendida. Contacta al administrador.");
        }
      }

      // Resolve permissions from profile
      const profilesRaw = localStorage.getItem("freia_profiles");
      const profiles: Profile[] = profilesRaw ? JSON.parse(profilesRaw) : [];
      const profile = found.profileId
        ? profiles.find((p) => p.id === found.profileId) ?? null
        : null;
      const permissions = resolvePermissions(found.role, profile);

      // Update lastLoginAt
      const updatedUsers = systemUsers.map((u) =>
        u.id === found.id ? { ...u, lastLoginAt: new Date().toISOString() } : u,
      );
      localStorage.setItem("freia_system_users", JSON.stringify(updatedUsers));

      sessionUser = {
        id: found.id,
        email: found.email,
        name: found.name,
        role: found.role,
        companyId: found.companyId,
        profileId: found.profileId,
        permissions,
      };
    } else {
      // Fallback to hardcoded demo users
      const fallback = DEMO_USERS[email];
      if (!fallback || fallback.password !== password) {
        setIsLoading(false);
        throw new Error("Email o contraseña incorrectos");
      }
      const permissions = resolvePermissions(fallback.user.role as SystemRole, null);
      sessionUser = { ...fallback.user, permissions };
    }

    setUser(sessionUser);
    localStorage.setItem("freia_user", JSON.stringify(sessionUser));

    // Seed demo data on first login — providers already mounted, so reload
    if (email === "demo@freia.ai" && seedDemoCubiertas()) {
      window.location.reload();
      return;
    }
    if (email === "importador@freia.ai" && seedDemoImportador()) {
      window.location.reload();
      return;
    }

    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("freia_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de AuthProvider");
  }
  return context;
}
