"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { SystemUser, SystemRole, UserStatus } from "@/types/user-management";

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role: SystemRole;
  companyId: string | null;
  profileId: string | null;
}

interface UpdateUserData {
  email?: string;
  name?: string;
  role?: SystemRole;
  companyId?: string | null;
  profileId?: string | null;
  status?: UserStatus;
}

interface UserManagementContextType {
  users: SystemUser[];
  isLoading: boolean;
  createUser: (data: CreateUserData) => SystemUser;
  updateUser: (id: string, data: UpdateUserData) => SystemUser | null;
  deleteUser: (id: string) => boolean;
  resetPassword: (id: string, newPassword: string) => boolean;
  toggleUserStatus: (id: string) => SystemUser | null;
  getUsersByCompany: (companyId: string) => SystemUser[];
  getUser: (id: string) => SystemUser | undefined;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);
const STORAGE_KEY = "freia_system_users";

export function UserManagementProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setUsers(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }, [users, isLoading]);

  const createUser = useCallback((data: CreateUserData): SystemUser => {
    const now = new Date().toISOString();
    const user: SystemUser = {
      id: crypto.randomUUID(),
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
      companyId: data.companyId,
      profileId: data.profileId,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    setUsers((prev) => [...prev, user]);
    return user;
  }, []);

  const updateUser = useCallback((id: string, data: UpdateUserData): SystemUser | null => {
    let updated: SystemUser | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        updated = { ...u, ...data, updatedAt: new Date().toISOString() };
        return updated;
      }),
    );
    return updated;
  }, []);

  const deleteUser = useCallback((id: string): boolean => {
    let found = false;
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== id);
      found = filtered.length !== prev.length;
      return filtered;
    });
    return found;
  }, []);

  const resetPassword = useCallback((id: string, newPassword: string): boolean => {
    let found = false;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        found = true;
        return { ...u, password: newPassword, updatedAt: new Date().toISOString() };
      }),
    );
    return found;
  }, []);

  const toggleUserStatus = useCallback((id: string): SystemUser | null => {
    let updated: SystemUser | null = null;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        updated = {
          ...u,
          status: u.status === "active" ? "disabled" : "active",
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    );
    return updated;
  }, []);

  const getUsersByCompany = useCallback(
    (companyId: string) => users.filter((u) => u.companyId === companyId),
    [users],
  );

  const getUser = useCallback(
    (id: string) => users.find((u) => u.id === id),
    [users],
  );

  return (
    <UserManagementContext.Provider
      value={{
        users, isLoading, createUser, updateUser, deleteUser,
        resetPassword, toggleUserStatus, getUsersByCompany, getUser,
      }}
    >
      {children}
    </UserManagementContext.Provider>
  );
}

export function useUserManagement() {
  const ctx = useContext(UserManagementContext);
  if (!ctx) throw new Error("useUserManagement debe ser usado dentro de UserManagementProvider");
  return ctx;
}
