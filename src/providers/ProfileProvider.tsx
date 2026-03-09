"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Profile, ModulePermission } from "@/types/user-management";

interface CreateProfileData {
  name: string;
  companyId: string;
  permissions: ModulePermission[];
}

interface UpdateProfileData {
  name?: string;
  permissions?: ModulePermission[];
}

interface ProfileContextType {
  profiles: Profile[];
  isLoading: boolean;
  createProfile: (data: CreateProfileData) => Profile;
  updateProfile: (id: string, data: UpdateProfileData) => Profile | null;
  deleteProfile: (id: string) => boolean;
  getProfilesByCompany: (companyId: string) => Profile[];
  getProfile: (id: string) => Profile | undefined;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
const STORAGE_KEY = "freia_profiles";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setProfiles(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles, isLoading]);

  const createProfile = useCallback((data: CreateProfileData): Profile => {
    const now = new Date().toISOString();
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: data.name,
      companyId: data.companyId,
      permissions: data.permissions,
      createdAt: now,
      updatedAt: now,
    };
    setProfiles((prev) => [...prev, profile]);
    return profile;
  }, []);

  const updateProfile = useCallback((id: string, data: UpdateProfileData): Profile | null => {
    let updated: Profile | null = null;
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        updated = { ...p, ...data, updatedAt: new Date().toISOString() };
        return updated;
      }),
    );
    return updated;
  }, []);

  const deleteProfile = useCallback((id: string): boolean => {
    let found = false;
    setProfiles((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      found = filtered.length !== prev.length;
      return filtered;
    });
    return found;
  }, []);

  const getProfilesByCompany = useCallback(
    (companyId: string) => profiles.filter((p) => p.companyId === companyId),
    [profiles],
  );

  const getProfile = useCallback(
    (id: string) => profiles.find((p) => p.id === id),
    [profiles],
  );

  return (
    <ProfileContext.Provider
      value={{ profiles, isLoading, createProfile, updateProfile, deleteProfile, getProfilesByCompany, getProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfiles() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfiles debe ser usado dentro de ProfileProvider");
  return ctx;
}
