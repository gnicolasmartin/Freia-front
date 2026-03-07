"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Front, FrontFormData, FrontVersion, FrontPage } from "@/types/front";
import type { FrontAuthConfig } from "@/types/front-auth";
import { DEFAULT_FRONT_AUTH_CONFIG, DEFAULT_PASSWORD_POLICY } from "@/types/front-auth";

interface FrontsContextType {
  fronts: Front[];
  isLoading: boolean;
  createFront: (data: FrontFormData) => Front;
  updateFront: (id: string, data: Partial<FrontFormData>) => Front | null;
  deleteFront: (id: string) => boolean;
  getFront: (id: string) => Front | undefined;
  isSubdomainAvailable: (subdomain: string, excludeId?: string) => boolean;
  getFrontsByAgent: (agentId: string) => Front[];
  getFrontsByFlow: (flowId: string) => Front[];
  publishFront: (id: string, performedBy: string) => FrontVersion | null;
  unpublishFront: (id: string, performedBy: string) => FrontVersion | null;
  restoreVersion: (frontId: string, versionId: string, performedBy: string) => FrontVersion | null;
  updateFrontPages: (id: string, pages: FrontPage[]) => Front | null;
  updateFrontAuthConfig: (id: string, authConfig: FrontAuthConfig) => Front | null;
  getPublishedFrontBySubdomain: (subdomain: string) => { front: Front; version: FrontVersion } | null;
}

const FrontsContext = createContext<FrontsContextType | undefined>(undefined);

const STORAGE_KEY = "freia_fronts";

/** Migrate legacy fronts that lack versioning fields */
function migrateFront(raw: Record<string, unknown>): Front {
  return {
    ...(raw as unknown as Front),
    pages: Array.isArray(raw.pages) ? (raw.pages as FrontPage[]) : [],
    versions: Array.isArray(raw.versions) ? (raw.versions as FrontVersion[]) : [],
    publishedVersionId: (raw.publishedVersionId as string) ?? undefined,
    authConfig: {
      ...DEFAULT_FRONT_AUTH_CONFIG,
      ...((raw.authConfig as FrontAuthConfig) ?? {}),
      passwordPolicy: ((raw.authConfig as Record<string, unknown>)?.passwordPolicy as FrontAuthConfig["passwordPolicy"]) ?? { ...DEFAULT_PASSWORD_POLICY },
    },
  };
}

export function FrontsProvider({ children }: { children: ReactNode }) {
  const [fronts, setFronts] = useState<Front[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, unknown>[];
        setFronts(parsed.map(migrateFront));
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fronts));
    }
  }, [fronts, isLoading]);

  const createFront = (data: FrontFormData): Front => {
    const now = new Date().toISOString();
    const newFront: Front = {
      id: crypto.randomUUID(),
      ...data,
      pages: [],
      authConfig: { ...DEFAULT_FRONT_AUTH_CONFIG },
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
    setFronts((prev) => [...prev, newFront]);
    return newFront;
  };

  const updateFront = (
    id: string,
    data: Partial<FrontFormData>
  ): Front | null => {
    let updated: Front | null = null;
    setFronts((prev) =>
      prev.map((front) => {
        if (front.id === id) {
          updated = {
            ...front,
            ...data,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        }
        return front;
      })
    );
    return updated;
  };

  const deleteFront = (id: string): boolean => {
    const exists = fronts.some((f) => f.id === id);
    if (!exists) return false;
    setFronts((prev) => prev.filter((f) => f.id !== id));
    return true;
  };

  const getFront = (id: string) => fronts.find((f) => f.id === id);

  const isSubdomainAvailable = (subdomain: string, excludeId?: string): boolean => {
    const lower = subdomain.toLowerCase();
    return !fronts.some(
      (f) => f.subdomain.toLowerCase() === lower && f.id !== excludeId
    );
  };

  const getFrontsByAgent = (agentId: string): Front[] =>
    fronts.filter((f) => f.agentIds.includes(agentId));

  const getFrontsByFlow = (flowId: string): Front[] =>
    fronts.filter((f) => f.flowIds.includes(flowId));

  const publishFront = (id: string, performedBy: string): FrontVersion | null => {
    const front = fronts.find((f) => f.id === id);
    if (!front) return null;

    const now = new Date().toISOString();
    const nextVersion = (front.versions.length > 0
      ? Math.max(...front.versions.map((v) => v.version))
      : 0) + 1;

    const version: FrontVersion = {
      id: crypto.randomUUID(),
      frontId: id,
      version: nextVersion,
      snapshot: {
        name: front.name,
        description: front.description,
        subdomain: front.subdomain,
        branding: { ...front.branding },
        agentIds: [...front.agentIds],
        flowIds: [...front.flowIds],
        pages: front.pages.map((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s })) })),
        authConfig: { ...front.authConfig, visitors: front.authConfig.visitors.map((v) => ({ ...v })) },
      },
      publishedAt: now,
      publishedBy: performedBy,
    };

    let result: FrontVersion | null = null;
    setFronts((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          result = version;
          return {
            ...f,
            status: "published" as const,
            publishedVersionId: version.id,
            versions: [...f.versions, version],
            updatedAt: now,
          };
        }
        return f;
      })
    );
    return result;
  };

  const unpublishFront = (id: string, performedBy: string): FrontVersion | null => {
    const front = fronts.find((f) => f.id === id);
    if (!front || !front.publishedVersionId) return null;

    const now = new Date().toISOString();
    let unpublishedVersion: FrontVersion | null = null;

    setFronts((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updatedVersions = f.versions.map((v) => {
            if (v.id === f.publishedVersionId) {
              const updated = { ...v, unpublishedAt: now, unpublishedBy: performedBy };
              unpublishedVersion = updated;
              return updated;
            }
            return v;
          });
          return {
            ...f,
            status: "draft" as const,
            publishedVersionId: undefined,
            versions: updatedVersions,
            updatedAt: now,
          };
        }
        return f;
      })
    );
    return unpublishedVersion;
  };

  const restoreVersion = (frontId: string, versionId: string, performedBy: string): FrontVersion | null => {
    const front = fronts.find((f) => f.id === frontId);
    if (!front) return null;
    const sourceVersion = front.versions.find((v) => v.id === versionId);
    if (!sourceVersion) return null;

    const now = new Date().toISOString();
    const nextVersion = (front.versions.length > 0
      ? Math.max(...front.versions.map((v) => v.version))
      : 0) + 1;

    const restoredVersion: FrontVersion = {
      id: crypto.randomUUID(),
      frontId,
      version: nextVersion,
      snapshot: {
        name: sourceVersion.snapshot.name,
        description: sourceVersion.snapshot.description,
        subdomain: sourceVersion.snapshot.subdomain,
        branding: { ...sourceVersion.snapshot.branding },
        agentIds: [...sourceVersion.snapshot.agentIds],
        flowIds: [...sourceVersion.snapshot.flowIds],
        pages: sourceVersion.snapshot.pages.map((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s })) })),
        authConfig: { ...sourceVersion.snapshot.authConfig, visitors: sourceVersion.snapshot.authConfig.visitors.map((v) => ({ ...v })) },
      },
      publishedAt: now,
      publishedBy: performedBy,
    };

    let result: FrontVersion | null = null;
    setFronts((prev) =>
      prev.map((f) => {
        if (f.id === frontId) {
          // Mark current active version as unpublished
          const updatedVersions = f.versions.map((v) => {
            if (v.id === f.publishedVersionId && !v.unpublishedAt) {
              return { ...v, unpublishedAt: now, unpublishedBy: performedBy };
            }
            return v;
          });
          result = restoredVersion;
          return {
            ...f,
            // Apply snapshot to the front
            name: sourceVersion.snapshot.name,
            description: sourceVersion.snapshot.description,
            subdomain: sourceVersion.snapshot.subdomain,
            branding: { ...sourceVersion.snapshot.branding },
            agentIds: [...sourceVersion.snapshot.agentIds],
            flowIds: [...sourceVersion.snapshot.flowIds],
            pages: sourceVersion.snapshot.pages.map((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s })) })),
            authConfig: { ...sourceVersion.snapshot.authConfig, visitors: sourceVersion.snapshot.authConfig.visitors.map((v) => ({ ...v })) },
            status: "published" as const,
            publishedVersionId: restoredVersion.id,
            versions: [...updatedVersions, restoredVersion],
            updatedAt: now,
          };
        }
        return f;
      })
    );
    return result;
  };

  const updateFrontPages = (id: string, pages: FrontPage[]): Front | null => {
    let updated: Front | null = null;
    setFronts((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          updated = { ...f, pages, updatedAt: new Date().toISOString() };
          return updated;
        }
        return f;
      })
    );
    return updated;
  };

  const updateFrontAuthConfig = (id: string, authConfig: FrontAuthConfig): Front | null => {
    let updated: Front | null = null;
    setFronts((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          updated = { ...f, authConfig, updatedAt: new Date().toISOString() };
          return updated;
        }
        return f;
      })
    );
    return updated;
  };

  const getPublishedFrontBySubdomain = (subdomain: string): { front: Front; version: FrontVersion } | null => {
    const lower = subdomain.toLowerCase();
    const front = fronts.find(
      (f) => f.subdomain.toLowerCase() === lower && f.status === "published" && f.publishedVersionId
    );
    if (!front) return null;
    const version = front.versions.find((v) => v.id === front.publishedVersionId);
    if (!version) return null;
    return { front, version };
  };

  return (
    <FrontsContext.Provider
      value={{
        fronts,
        isLoading,
        createFront,
        updateFront,
        deleteFront,
        getFront,
        isSubdomainAvailable,
        getFrontsByAgent,
        getFrontsByFlow,
        publishFront,
        unpublishFront,
        restoreVersion,
        updateFrontPages,
        updateFrontAuthConfig,
        getPublishedFrontBySubdomain,
      }}
    >
      {children}
    </FrontsContext.Provider>
  );
}

export function useFronts() {
  const context = useContext(FrontsContext);
  if (context === undefined) {
    throw new Error("useFronts debe ser usado dentro de FrontsProvider");
  }
  return context;
}
