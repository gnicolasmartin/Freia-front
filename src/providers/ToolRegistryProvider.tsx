"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { ToolParamDef } from "@/types/flow";
import type { ToolDefinition, ToolFormData, ToolVersion } from "@/types/tool-registry";
import { DEFAULT_TOOLS } from "@/types/tool-registry";
import { getSessionCompanyId } from "@/lib/get-session-company";

interface ToolRegistryContextType {
  tools: ToolDefinition[];
  isLoading: boolean;
  createTool: (data: ToolFormData) => ToolDefinition;
  updateTool: (id: string, data: Partial<ToolFormData>) => ToolDefinition | null;
  deleteTool: (id: string) => boolean;
  getTool: (id: string) => ToolDefinition | undefined;
  getToolSchema: (id: string) => ToolParamDef[];
  getToolLabel: (id: string) => string;
}

const ToolRegistryContext = createContext<ToolRegistryContextType | undefined>(
  undefined
);

const STORAGE_KEY = "freia_tool_registry";

export function ToolRegistryProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ToolDefinition[];
        // Always refresh builtin tool schemas from DEFAULT_TOOLS so code
        // changes (e.g. removing required flags) take effect even when
        // the user has stale data in localStorage.
        const builtinIds = new Set(DEFAULT_TOOLS.map((t) => t.id));
        const customTools = parsed.filter((t) => !builtinIds.has(t.id));
        // For builtins: use latest DEFAULT_TOOLS definition but preserve
        // any user-added versions array from the stored copy.
        const refreshedBuiltins = DEFAULT_TOOLS.map((def) => {
          const prev = parsed.find((t) => t.id === def.id);
          return prev
            ? { ...def, versions: prev.versions ?? [] }
            : def;
        });
        setTools([...refreshedBuiltins, ...customTools]);
      } catch {
        // Corrupted data — seed with defaults
        setTools(DEFAULT_TOOLS);
      }
    } else {
      // First load — seed with default tools
      setTools(DEFAULT_TOOLS);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
    }
  }, [tools, isLoading]);

  const createTool = useCallback((data: ToolFormData): ToolDefinition => {
    const now = new Date().toISOString();
    const newTool: ToolDefinition = {
      ...data,
      id: data.id || crypto.randomUUID(),
      companyId: data.companyId ?? getSessionCompanyId(),
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    setTools((prev) => [...prev, newTool]);
    return newTool;
  }, []);

  const updateTool = useCallback(
    (id: string, data: Partial<ToolFormData>): ToolDefinition | null => {
      let updated: ToolDefinition | null = null;
      setTools((prev) =>
        prev.map((tool) => {
          if (tool.id === id) {
            const existingVersions = tool.versions ?? [];
            const nextVersion =
              existingVersions.length > 0
                ? Math.max(...existingVersions.map((v) => v.version)) + 1
                : 1;

            const versionSnapshot: ToolVersion = {
              id: crypto.randomUUID(),
              toolId: id,
              version: nextVersion,
              name: tool.name,
              description: tool.description,
              category: tool.category,
              inputSchema: [...tool.inputSchema],
              outputSchema: [...tool.outputSchema],
              requiresConfirmation: tool.requiresConfirmation,
              supportsSimulation: tool.supportsSimulation,
              publishedAt: new Date().toISOString(),
            };

            updated = {
              ...tool,
              ...data,
              updatedAt: new Date().toISOString(),
              versions: [...existingVersions, versionSnapshot],
            };
            return updated;
          }
          return tool;
        })
      );
      return updated;
    },
    []
  );

  const deleteTool = useCallback(
    (id: string): boolean => {
      const exists = tools.some((t) => t.id === id);
      if (!exists) return false;
      setTools((prev) => prev.filter((t) => t.id !== id));
      return true;
    },
    [tools]
  );

  const getTool = useCallback(
    (id: string) => tools.find((t) => t.id === id),
    [tools]
  );

  const getToolSchema = useCallback(
    (id: string): ToolParamDef[] => {
      const tool = tools.find((t) => t.id === id);
      return tool?.inputSchema ?? [];
    },
    [tools]
  );

  const getToolLabel = useCallback(
    (id: string): string => {
      const tool = tools.find((t) => t.id === id);
      return tool?.name ?? id;
    },
    [tools]
  );

  return (
    <ToolRegistryContext.Provider
      value={{
        tools,
        isLoading,
        createTool,
        updateTool,
        deleteTool,
        getTool,
        getToolSchema,
        getToolLabel,
      }}
    >
      {children}
    </ToolRegistryContext.Provider>
  );
}

export function useToolRegistry() {
  const context = useContext(ToolRegistryContext);
  if (context === undefined) {
    throw new Error(
      "useToolRegistry debe ser usado dentro de ToolRegistryProvider"
    );
  }
  return context;
}
