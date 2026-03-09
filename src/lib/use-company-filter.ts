"use client";

import { useAuth } from "@/providers/AuthProvider";

/**
 * Filters an array of entities by the current user's companyId.
 * Root users see everything. Entities without companyId (legacy) are visible to all.
 */
export function useCompanyFilter<T extends { companyId?: string }>(items: T[]): T[] {
  const { user } = useAuth();
  // Root sees everything
  if (!user || user.role === "root") return items;
  const companyId = user.companyId;
  if (!companyId) return items;
  return items.filter((item) => !item.companyId || item.companyId === companyId);
}
