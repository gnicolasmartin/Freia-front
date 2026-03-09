"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { usePermissions } from "@/lib/use-permissions";
import { ROLE_CONFIG } from "@/types/user-management";
import type { TopLevelModule } from "@/types/user-management";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  MessageSquare,
  Wrench,
  Plug,
  Target,
  Shield,
  ShieldAlert,
  ClipboardList,
  Settings,
  Radio,
  LogOut,
  Menu,
  X,
  Package,
  Globe,
} from "lucide-react";
import { useState } from "react";

interface MenuItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  moduleKey: TopLevelModule | "sysadmin";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isRoot, canAccessModule, role } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);

  const allMenuItems: MenuItem[] = [
    { name: "Dashboard",         href: "/dashboard",     icon: LayoutDashboard, moduleKey: "dashboard" },
    { name: "Agentes",           href: "/agents",        icon: Bot,             moduleKey: "agents" },
    { name: "Flujos",            href: "/flows",         icon: GitBranch,       moduleKey: "flows" },
    { name: "Herramientas",      href: "/tools",         icon: Wrench,          moduleKey: "tools" },
    { name: "Integraciones",     href: "/integrations",  icon: Plug,            moduleKey: "integrations" },
    { name: "Conversaciones",    href: "/conversations", icon: MessageSquare,   moduleKey: "conversations" },
    { name: "Leads",             href: "/leads",         icon: Target,          moduleKey: "leads" },
    { name: "Stock / Productos", href: "/stock",         icon: Package,         moduleKey: "stock" },
    { name: "Políticas",         href: "/policies",      icon: Shield,          moduleKey: "policies" },
    { name: "Auditoría",         href: "/audit",         icon: ClipboardList,   moduleKey: "audit" },
    { name: "Canales",           href: "/channels",      icon: Radio,           moduleKey: "channels" },
    { name: "Fronts",            href: "/fronts",        icon: Globe,           moduleKey: "fronts" },
    { name: "Configuraciones",   href: "/settings",      icon: Settings,        moduleKey: "settings" },
  ];

  // Add sysadmin link for root users
  if (isRoot) {
    allMenuItems.unshift({
      name: "SysAdmin",
      href: "/sysadmin",
      icon: ShieldAlert,
      moduleKey: "sysadmin",
    });
  }

  const menuItems = allMenuItems.filter((item) => {
    if (item.moduleKey === "sysadmin") return isRoot;
    return canAccessModule(item.moduleKey);
  });

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const roleConfig = ROLE_CONFIG[role] ?? ROLE_CONFIG.company_user;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-slate-900 border-b border-slate-700 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#dd7430] to-orange-600">
            <span className="text-sm font-bold text-white">F</span>
          </div>
          <span className="font-bold text-white text-sm">Freia</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-white p-1"
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-700 transform transition-transform duration-200 ease-in-out z-30 lg:translate-x-0 lg:relative lg:top-auto lg:h-screen flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-3 p-6 border-b border-slate-700 shrink-0">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#dd7430] to-orange-600">
            <span className="text-lg font-bold text-white">F</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-lg">Freia</h1>
            <p className="text-xs text-slate-400">AI Automation</p>
          </div>
        </div>

        {/* Mobile Logo */}
        <div className="flex lg:hidden items-center gap-3 p-4 border-b border-slate-700 mt-12 shrink-0">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#dd7430] to-orange-600">
            <span className="text-lg font-bold text-white">F</span>
          </div>
          <div>
            <h1 className="font-bold text-white">Freia</h1>
            <p className="text-xs text-slate-400">AI Automation</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all group ${
                  active
                    ? "bg-[#dd7430] text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <Icon
                  className={`size-5 transition-transform ${
                    active ? "scale-110" : "group-hover:scale-105"
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-slate-700 p-4 space-y-2 shrink-0">
          <div className="px-4 py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || "Usuario"}
              </p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleConfig.color} ${roleConfig.bg} border ${roleConfig.border}`}>
                {roleConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-900/20 hover:text-red-400 transition-all font-medium"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
