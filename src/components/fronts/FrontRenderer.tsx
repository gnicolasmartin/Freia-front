"use client";

import { useState, useMemo } from "react";
import { LogOut } from "lucide-react";
import type { Front, FrontVersion, FrontSection } from "@/types/front";
import type { FrontRole } from "@/types/front-auth";
import { FRONT_ROLE_CONFIGS } from "@/types/front-auth";
import { FrontAuthProvider, useFrontAuth } from "@/providers/FrontAuthProvider";
import { FrontDataProvider } from "@/providers/FrontDataProvider";
import { useWidgetData } from "@/hooks/useWidgetData";
import { resolveTemplateStyles, type TemplateStyles } from "@/lib/front-template-styles";
import FrontLoginScreen from "./FrontLoginScreen";
import { SectionRenderer } from "./FrontSectionRenderers";

interface FrontRendererProps {
  front: Front;
  version: FrontVersion;
}

export default function FrontRenderer({ front, version }: FrontRendererProps) {
  const authConfig = version.snapshot.authConfig ?? front.authConfig;

  return (
    <FrontAuthProvider frontId={front.id} authConfig={authConfig}>
      <FrontDataProvider frontId={front.id} flowIds={front.flowIds}>
        <FrontRendererInner front={front} version={version} />
      </FrontDataProvider>
    </FrontAuthProvider>
  );
}

/** Check if a role has access to a page or section with allowedRoles */
function isRoleAllowed(allowedRoles: FrontRole[] | undefined, role: FrontRole | null): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true; // no restriction
  if (!role) return false;
  return allowedRoles.includes(role);
}

function FrontRendererInner({ front, version }: FrontRendererProps) {
  const allPages = version.snapshot.pages ?? front.pages ?? [];
  const { isAuthenticated, requiresAuth, role, hasPermission, session, logout, refreshSession } = useFrontAuth();

  const branding = version.snapshot.branding;
  const ts = useMemo(() => resolveTemplateStyles(branding), [branding]);
  const authConfig = version.snapshot.authConfig ?? front.authConfig;

  // Filter pages by role
  const pages = allPages.filter((p) => isRoleAllowed(p.allowedRoles, role));
  const [activePageId, setActivePageId] = useState<string>(pages[0]?.id ?? "");
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];

  // Show login screen if auth required and not authenticated
  if (!isAuthenticated) {
    return (
      <FrontLoginScreen
        frontId={front.id}
        frontName={version.snapshot.name}
        primaryColor={ts.primaryColor}
        secondaryColor={ts.secondaryColor}
        logoUrl={branding.logoUrl}
        authConfig={authConfig}
        onLoginSuccess={refreshSession}
      />
    );
  }

  if (!activePage) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: ts.secondaryColor }}>
        <p className="text-white/60">Este front no tiene páginas configuradas.</p>
      </div>
    );
  }

  // Filter sections by role
  const visibleSections = activePage.sections.filter((s) => isRoleAllowed(s.allowedRoles, role));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: ts.secondaryColor }}>
      {/* Header / Nav */}
      <header
        className={ts.headerClass}
        style={ts.headerStyle}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={version.snapshot.name} className="h-8 object-contain" />
            ) : (
              <span className="text-lg font-bold text-white">{version.snapshot.name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Page navigation (if multiple pages) */}
            {pages.length > 1 && (
              <nav className="flex items-center gap-1">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setActivePageId(page.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      page.id === activePageId
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {page.title}
                  </button>
                ))}
              </nav>
            )}

            {/* User info + role badge + logout */}
            {requiresAuth && session && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
                <span className="text-xs text-white/60 hidden sm:inline">
                  {session.name ?? session.email}
                </span>
                {session.role && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white/70 hidden sm:inline">
                    {FRONT_ROLE_CONFIGS[session.role]?.label ?? session.role}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {visibleSections.map((section) => (
          <WidgetSection
            key={section.id}
            section={section}
            templateStyles={ts}
            frontName={version.snapshot.name}
            canInteract={hasPermission("interact")}
            hasViewPermission={hasPermission("view_widget")}
            frontId={front.id}
            session={session}
          />
        ))}
      </main>

      {/* Footer */}
      <footer className={ts.footerClass}>
        <p className="text-xs text-white/30">
          Powered by Freia &middot; v{version.version}
        </p>
      </footer>
    </div>
  );
}

/** Wraps each section with data hook to resolve bindings + auto-refresh */
function WidgetSection({
  section,
  templateStyles,
  frontName,
  canInteract,
  hasViewPermission,
  frontId,
  session,
}: {
  section: FrontSection;
  templateStyles: TemplateStyles;
  frontName: string;
  canInteract: boolean;
  hasViewPermission: boolean;
  frontId: string;
  session: { visitorId?: string; email?: string; name?: string; role?: string } | null;
}) {
  const { resolvedData, isLoading, error, lastUpdated, refresh } = useWidgetData(section, hasViewPermission);

  const hasBindings = ((section.config?._bindings as unknown[]) ?? []).length > 0;

  return (
    <SectionRenderer
      section={section}
      primaryColor={templateStyles.primaryColor}
      secondaryColor={templateStyles.secondaryColor}
      frontName={frontName}
      canInteract={canInteract}
      widgetData={hasBindings ? { resolvedData, isLoading, error, lastUpdated, onRefresh: refresh } : undefined}
      frontId={frontId}
      session={session}
      templateStyles={templateStyles}
    />
  );
}
