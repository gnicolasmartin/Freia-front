"use client";

import { type ReactNode } from "react";
import { seedDemoCubiertas } from "@/lib/seed-demo-cubiertas";
import { seedDemoImportador } from "@/lib/seed-demo-importador";
import type { Company, SystemUser, Profile } from "@/types/user-management";

// ─── Seed user management data (companies, users, profiles) ─────────────────

const USER_MGMT_SEED_KEY = "freia_seed_user_mgmt_v1";

function seedUserManagement(): boolean {
  if (localStorage.getItem(USER_MGMT_SEED_KEY)) return false;

  const now = new Date().toISOString();

  const companies: Company[] = [
    { id: "company_cubiertas", name: "Cubiertas Express", status: "active", createdAt: now, updatedAt: now },
    { id: "company_importador", name: "Importador Demo", status: "active", createdAt: now, updatedAt: now },
  ];

  const profiles: Profile[] = [
    {
      id: "profile_viewer",
      name: "Solo lectura",
      companyId: "company_cubiertas",
      permissions: ["dashboard", "agents", "flows", "conversations", "audit"],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const users: SystemUser[] = [
    {
      id: "0", email: "root@freia.ai", password: "root123", name: "Sysadmin Freia",
      role: "root", companyId: null, profileId: null,
      status: "active", createdAt: now, updatedAt: now, lastLoginAt: null,
    },
    {
      id: "1", email: "demo@freia.ai", password: "demo123", name: "Usuario Demo",
      role: "company_admin", companyId: "company_cubiertas", profileId: null,
      status: "active", createdAt: now, updatedAt: now, lastLoginAt: null,
    },
    {
      id: "2", email: "admin@freia.ai", password: "admin123", name: "Administrador",
      role: "company_admin", companyId: "company_cubiertas", profileId: null,
      status: "active", createdAt: now, updatedAt: now, lastLoginAt: null,
    },
    {
      id: "3", email: "user@freia.ai", password: "user123", name: "Usuario Estándar",
      role: "company_user", companyId: "company_cubiertas", profileId: "profile_viewer",
      status: "active", createdAt: now, updatedAt: now, lastLoginAt: null,
    },
    {
      id: "4", email: "importador@freia.ai", password: "import123", name: "Importador Demo",
      role: "company_admin", companyId: "company_importador", profileId: null,
      status: "active", createdAt: now, updatedAt: now, lastLoginAt: null,
    },
  ];

  // Only seed if keys are missing (don't overwrite existing data)
  if (!localStorage.getItem("freia_companies")) {
    localStorage.setItem("freia_companies", JSON.stringify(companies));
  }
  if (!localStorage.getItem("freia_system_users")) {
    localStorage.setItem("freia_system_users", JSON.stringify(users));
  }
  if (!localStorage.getItem("freia_profiles")) {
    localStorage.setItem("freia_profiles", JSON.stringify(profiles));
  }

  localStorage.setItem(USER_MGMT_SEED_KEY, "1");
  console.log("[DemoSeedGate] user management data seeded");
  return true;
}

/**
 * Module-level side effect: runs when the client bundle loads,
 * BEFORE React hydration and any provider useEffect.
 * This guarantees localStorage is seeded before any provider reads it.
 */
if (typeof window !== "undefined") {
  try {
    // Always seed user management data first
    const userMgmtSeeded = seedUserManagement();

    const raw = localStorage.getItem("freia_user");
    console.log("[DemoSeedGate] module-level check, freia_user:", raw ? JSON.parse(raw).email : "none");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.email === "demo@freia.ai") {
        const seeded = seedDemoCubiertas();
        console.log("[DemoSeedGate] seedDemoCubiertas returned:", seeded);
        if (seeded || userMgmtSeeded) {
          window.location.reload();
        }
      }
      if (user?.email === "importador@freia.ai") {
        const seeded = seedDemoImportador();
        console.log("[DemoSeedGate] seedDemoImportador returned:", seeded);
        if (seeded || userMgmtSeeded) {
          window.location.reload();
        }
      }
    }
  } catch (err) {
    console.error("[DemoSeedGate] error:", err);
  }
}

export function DemoSeedGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
