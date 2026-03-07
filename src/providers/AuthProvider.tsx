"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { seedDemoCubiertas } from "@/lib/seed-demo-cubiertas";
import { seedDemoImportador } from "@/lib/seed-demo-importador";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Usuarios hardcodeados para testing
const DEMO_USERS = {
  "demo@freia.ai": {
    password: "demo123",
    user: {
      id: "1",
      email: "demo@freia.ai",
      name: "Usuario Demo",
      role: "admin",
    },
  },
  "admin@freia.ai": {
    password: "admin123",
    user: {
      id: "2",
      email: "admin@freia.ai",
      name: "Administrador",
      role: "admin",
    },
  },
  "user@freia.ai": {
    password: "user123",
    user: {
      id: "3",
      email: "user@freia.ai",
      name: "Usuario Estándar",
      role: "user",
    },
  },
  "importador@freia.ai": {
    password: "import123",
    user: {
      id: "4",
      email: "importador@freia.ai",
      name: "Importador Demo",
      role: "admin",
    },
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
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const userCredentials = DEMO_USERS[email as keyof typeof DEMO_USERS];

    if (!userCredentials || userCredentials.password !== password) {
      setIsLoading(false);
      throw new Error("Email o contraseña incorrectos");
    }

    const userData = userCredentials.user;
    setUser(userData);
    localStorage.setItem("freia_user", JSON.stringify(userData));

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
