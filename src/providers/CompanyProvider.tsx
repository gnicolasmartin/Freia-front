"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Company, CompanyStatus } from "@/types/user-management";

interface CompanyContextType {
  companies: Company[];
  isLoading: boolean;
  createCompany: (data: { name: string }) => Company;
  updateCompany: (id: string, data: { name?: string; status?: CompanyStatus }) => Company | null;
  deleteCompany: (id: string) => boolean;
  getCompany: (id: string) => Company | undefined;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);
const STORAGE_KEY = "freia_companies";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setCompanies(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  }, [companies, isLoading]);

  const createCompany = useCallback((data: { name: string }): Company => {
    const now = new Date().toISOString();
    const company: Company = {
      id: crypto.randomUUID(),
      name: data.name,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    setCompanies((prev) => [...prev, company]);
    return company;
  }, []);

  const updateCompany = useCallback((id: string, data: { name?: string; status?: CompanyStatus }): Company | null => {
    let updated: Company | null = null;
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        updated = { ...c, ...data, updatedAt: new Date().toISOString() };
        return updated;
      }),
    );
    return updated;
  }, []);

  const deleteCompany = useCallback((id: string): boolean => {
    let found = false;
    setCompanies((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      found = filtered.length !== prev.length;
      return filtered;
    });
    return found;
  }, []);

  const getCompany = useCallback(
    (id: string) => companies.find((c) => c.id === id),
    [companies],
  );

  return (
    <CompanyContext.Provider value={{ companies, isLoading, createCompany, updateCompany, deleteCompany, getCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanies() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompanies debe ser usado dentro de CompanyProvider");
  return ctx;
}
