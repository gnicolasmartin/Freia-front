"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { Flow, FlowFormData, FlowNode, FlowEdge, FlowVersion, FlowVariable, TestPreset } from "@/types/flow";
import { DEFAULT_START_NODE } from "@/types/flow";
import { getSessionCompanyId } from "@/lib/get-session-company";

interface FlowsContextType {
  flows: Flow[];
  isLoading: boolean;
  createFlow: (data: FlowFormData) => Flow;
  updateFlow: (id: string, data: Partial<FlowFormData>) => Flow | null;
  updateFlowGraph: (
    id: string,
    nodes: FlowNode[],
    edges: FlowEdge[]
  ) => void;
  deleteFlow: (id: string) => boolean;
  getFlow: (id: string) => Flow | undefined;
  updateFlowVariables: (id: string, variables: FlowVariable[]) => void;
  updateFlowTestPresets: (id: string, presets: TestPreset[]) => void;
  updateFlowPolicies: (id: string, policyIds: string[]) => void;
  updateFlowAllowedTools: (id: string, allowedToolIds: string[]) => void;
  publishFlow: (id: string) => FlowVersion | null;
  restoreVersion: (flowId: string, versionId: string) => FlowVersion | null;
}

const FlowsContext = createContext<FlowsContextType | undefined>(undefined);

const STORAGE_KEY = "freia_flows";

export function FlowsProvider({ children }: { children: ReactNode }) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    console.log("[FlowsProvider] load effect — raw items:", stored ? JSON.parse(stored).length : 0);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Flow[];
        const migrated = parsed.map((f) => ({
          ...f,
          policyIds: f.policyIds ?? [],
          allowedToolIds: f.allowedToolIds ?? [],
          useStock: f.useStock ?? false,
          versions: (f.versions ?? []).map((v) => ({
            ...v,
            policyIds: v.policyIds ?? [],
            allowedToolIds: v.allowedToolIds ?? [],
          })),
        }));
        setFlows(migrated);
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      console.log("[FlowsProvider] save effect — writing", flows.length, "flows");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flows));
    }
  }, [flows, isLoading]);

  const createFlow = (data: FlowFormData): Flow => {
    const now = new Date().toISOString();
    const newFlow: Flow = {
      id: crypto.randomUUID(),
      companyId: data.companyId ?? getSessionCompanyId(),
      ...data,
      nodes: [{ ...DEFAULT_START_NODE }],
      edges: [],
      variables: [],
      policyIds: [],
      allowedToolIds: [],
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    setFlows((prev) => [...prev, newFlow]);
    return newFlow;
  };

  const updateFlow = (
    id: string,
    data: Partial<FlowFormData>
  ): Flow | null => {
    let updated: Flow | null = null;
    setFlows((prev) =>
      prev.map((flow) => {
        if (flow.id === id) {
          updated = { ...flow, ...data, updatedAt: new Date().toISOString() };
          return updated;
        }
        return flow;
      })
    );
    return updated;
  };

  const updateFlowGraph = (
    id: string,
    nodes: FlowNode[],
    edges: FlowEdge[]
  ) => {
    setFlows((prev) =>
      prev.map((flow) =>
        flow.id === id
          ? { ...flow, nodes, edges, updatedAt: new Date().toISOString() }
          : flow
      )
    );
  };

  const deleteFlow = (id: string): boolean => {
    const exists = flows.some((f) => f.id === id);
    if (!exists) return false;
    setFlows((prev) => prev.filter((f) => f.id !== id));
    return true;
  };

  const updateFlowVariables = (id: string, variables: FlowVariable[]) => {
    setFlows((prev) =>
      prev.map((flow) =>
        flow.id === id
          ? { ...flow, variables, updatedAt: new Date().toISOString() }
          : flow
      )
    );
  };

  const updateFlowTestPresets = (id: string, presets: TestPreset[]) => {
    setFlows((prev) =>
      prev.map((flow) =>
        flow.id === id ? { ...flow, testPresets: presets } : flow
      )
    );
  };

  const updateFlowPolicies = (id: string, policyIds: string[]) => {
    setFlows((prev) =>
      prev.map((flow) =>
        flow.id === id
          ? { ...flow, policyIds, updatedAt: new Date().toISOString() }
          : flow
      )
    );
  };

  const updateFlowAllowedTools = (id: string, allowedToolIds: string[]) => {
    setFlows((prev) =>
      prev.map((flow) =>
        flow.id === id
          ? { ...flow, allowedToolIds, updatedAt: new Date().toISOString() }
          : flow
      )
    );
  };

  const publishFlow = (id: string): FlowVersion | null => {
    const flow = flows.find((f) => f.id === id);
    if (!flow) return null;

    const existingVersions = flow.versions ?? [];
    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map((v) => v.version)) + 1
      : 1;

    const newVersion: FlowVersion = {
      id: crypto.randomUUID(),
      flowId: id,
      version: nextVersion,
      nodes: JSON.parse(JSON.stringify(flow.nodes)),
      edges: JSON.parse(JSON.stringify(flow.edges)),
      variables: JSON.parse(JSON.stringify(flow.variables ?? [])),
      policyIds: [...(flow.policyIds ?? [])],
      allowedToolIds: [...(flow.allowedToolIds ?? [])],
      publishedAt: new Date().toISOString(),
    };

    setFlows((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          return {
            ...f,
            status: "active",
            updatedAt: newVersion.publishedAt,
            publishedVersionId: newVersion.id,
            versions: [...(f.versions ?? []), newVersion],
          };
        }
        return f;
      })
    );

    return newVersion;
  };

  const restoreVersion = (
    flowId: string,
    versionId: string
  ): FlowVersion | null => {
    const flow = flows.find((f) => f.id === flowId);
    if (!flow) return null;

    const targetVersion = (flow.versions ?? []).find(
      (v) => v.id === versionId
    );
    if (!targetVersion) return null;

    const existingVersions = flow.versions ?? [];
    const nextVersionNum =
      existingVersions.length > 0
        ? Math.max(...existingVersions.map((v) => v.version)) + 1
        : 1;

    const restoredNodes = JSON.parse(JSON.stringify(targetVersion.nodes));
    const restoredEdges = JSON.parse(JSON.stringify(targetVersion.edges));
    const restoredVariables = JSON.parse(JSON.stringify(targetVersion.variables ?? []));
    const restoredPolicyIds = [...(targetVersion.policyIds ?? [])];
    const restoredAllowedToolIds = [...(targetVersion.allowedToolIds ?? [])];

    const newVersion: FlowVersion = {
      id: crypto.randomUUID(),
      flowId,
      version: nextVersionNum,
      nodes: JSON.parse(JSON.stringify(targetVersion.nodes)),
      edges: JSON.parse(JSON.stringify(targetVersion.edges)),
      variables: JSON.parse(JSON.stringify(targetVersion.variables ?? [])),
      policyIds: [...(targetVersion.policyIds ?? [])],
      allowedToolIds: [...(targetVersion.allowedToolIds ?? [])],
      publishedAt: new Date().toISOString(),
      restoredFrom: targetVersion.version,
    };

    setFlows((prev) =>
      prev.map((f) => {
        if (f.id === flowId) {
          return {
            ...f,
            status: "active",
            updatedAt: newVersion.publishedAt,
            nodes: restoredNodes,
            edges: restoredEdges,
            variables: restoredVariables,
            policyIds: restoredPolicyIds,
            allowedToolIds: restoredAllowedToolIds,
            publishedVersionId: newVersion.id,
            versions: [...(f.versions ?? []), newVersion],
          };
        }
        return f;
      })
    );

    return newVersion;
  };

  const getFlow = (id: string) => flows.find((f) => f.id === id);

  // Filter by current user's company (root sees all)
  const scopedFlows = useMemo(() => {
    const companyId = getSessionCompanyId();
    if (!companyId) return flows;
    return flows.filter((f) => f.companyId === companyId);
  }, [flows]);

  return (
    <FlowsContext.Provider
      value={{
        flows: scopedFlows,
        isLoading,
        createFlow,
        updateFlow,
        updateFlowGraph,
        deleteFlow,
        getFlow,
        updateFlowVariables,
        updateFlowTestPresets,
        updateFlowPolicies,
        updateFlowAllowedTools,
        publishFlow,
        restoreVersion,
      }}
    >
      {children}
    </FlowsContext.Provider>
  );
}

export function useFlows() {
  const context = useContext(FlowsContext);
  if (context === undefined) {
    throw new Error("useFlows debe ser usado dentro de FlowsProvider");
  }
  return context;
}
