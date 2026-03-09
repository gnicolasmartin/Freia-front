"use client";

import { useAuth } from "@/providers/AuthProvider";
import { hasModulePermission, canAccessModule } from "@/types/user-management";
import type { ModulePermission, TopLevelModule, SystemRole } from "@/types/user-management";

export function usePermissions() {
  const { user } = useAuth();

  const role = (user?.role ?? "company_user") as SystemRole;
  const permissions = (user?.permissions ?? []) as ModulePermission[];
  const companyId = user?.companyId ?? null;
  const isRoot = role === "root";
  const isCompanyAdmin = role === "company_admin";

  return {
    role,
    companyId,
    isRoot,
    isCompanyAdmin,
    permissions,
    can: (perm: ModulePermission) => {
      if (isRoot || isCompanyAdmin) return true;
      return hasModulePermission(permissions, perm);
    },
    canAccessModule: (mod: TopLevelModule) => canAccessModule(role, permissions, mod),
  };
}
