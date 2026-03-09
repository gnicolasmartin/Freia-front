"use client";

import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Users, Shield } from "lucide-react";
import CompaniesTab from "@/components/sysadmin/CompaniesTab";
import UsersTab from "@/components/sysadmin/UsersTab";
import ProfilesTab from "@/components/sysadmin/ProfilesTab";

const TABS = [
  { key: "companies", label: "Empresas", icon: Building2 },
  { key: "users", label: "Usuarios", icon: Users },
  { key: "profiles", label: "Perfiles", icon: Shield },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SysAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("companies");

  useEffect(() => {
    if (user && user.role !== "root") {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (!user || user.role !== "root") {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
        <p className="text-sm text-slate-400 mt-1">
          Gestión de empresas, usuarios y perfiles del sistema
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-[#dd7430] text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "companies" && <CompaniesTab />}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "profiles" && <ProfilesTab />}
    </div>
  );
}
